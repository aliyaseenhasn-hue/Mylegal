-- إصلاح: PL/pgSQL يحلّل حقول NEW حتى داخل شروط AND، فلا يجوز ذكر عمود غير موجود في الجدول
create or replace function app.assign_numbers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(new);
begin
  if tg_table_name = 'clients' and (r->>'client_no') is null then
    new := jsonb_populate_record(new, jsonb_build_object('client_no', app.next_counter(new.office_id, 'client')));
  elsif tg_table_name = 'cases' and (r->>'file_no') is null then
    new := jsonb_populate_record(new, jsonb_build_object('file_no', app.next_counter(new.office_id, 'case')));
  elsif tg_table_name = 'payments' and (r->>'receipt_no') is null then
    new := jsonb_populate_record(new, jsonb_build_object('receipt_no', app.next_counter(new.office_id, 'receipt')));
  end if;
  return new;
end $$;

create or replace function app.check_same_office() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(new); v uuid;
begin
  if tg_table_name = 'cases' then
    select office_id into v from public.clients where id = (r->>'client_id')::uuid;
    if v is distinct from new.office_id then raise exception 'الموكل غير موجود'; end if;
  end if;
  if tg_table_name <> 'cases' and (r->>'case_id') is not null then
    select office_id into v from public.cases where id = (r->>'case_id')::uuid;
    if v is distinct from new.office_id then raise exception 'القضية غير موجودة'; end if;
  end if;
  if tg_table_name <> 'cases' and (r->>'client_id') is not null then
    select office_id into v from public.clients where id = (r->>'client_id')::uuid;
    if v is distinct from new.office_id then raise exception 'الموكل غير موجود'; end if;
  end if;
  return new;
end $$;

create or replace function app.stamp_office() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.office_id := app.current_office_id();
    if new.office_id is null then
      raise exception 'لا ينتمي المستخدم إلى أي مكتب';
    end if;
    if (to_jsonb(new)->>'created_by') is null then
      new := jsonb_populate_record(new, jsonb_build_object('created_by', auth.uid()));
    end if;
  else
    new.office_id := old.office_id;
  end if;
  return new;
end $$;

create or replace function app.case_closing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('won','lost','settled','closed','archived') and new.closed_at is null then
    new.closed_at := (now() at time zone 'Asia/Baghdad')::date;
  elsif new.status in ('preparing','active','suspended') then
    new.closed_at := null;
  end if;
  return new;
end $$;
