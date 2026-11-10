-- لا يُسجَّل النشاط عند حذف المكتب بالكامل (الحذف المتسلسل) لتجنب خرق المفتاح الأجنبي
create or replace function app.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_label text; v_case uuid;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if not exists (select 1 from public.offices where id = (r->>'office_id')::uuid) then
    return null;
  end if;
  v_label := coalesce(r->>'title', r->>'name', r->>'file_name',
                      case when tg_table_name = 'payments' then 'سند قبض #' || (r->>'receipt_no') || ' — ' || (r->>'amount') end,
                      case when tg_table_name = 'expenses' then 'مصروف — ' || (r->>'amount') end,
                      case when tg_table_name = 'hearings' then 'جلسة ' || (r->>'hearing_date') end,
                      case when tg_table_name = 'powers_of_attorney' then 'وكالة ' || coalesce(r->>'poa_number','') end);
  v_case := case when tg_table_name = 'cases' then (r->>'id')::uuid else nullif(r->>'case_id','')::uuid end;
  insert into public.activity_log(office_id, actor_id, action, entity, entity_id, label, case_id)
  values ((r->>'office_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (r->>'id')::uuid, left(v_label, 300),
          case when tg_op = 'DELETE' and tg_table_name = 'cases' then null else v_case end);
  return null;
end $$;
