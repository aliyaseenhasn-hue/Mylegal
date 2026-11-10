-- =====================================================================
-- Mylegal — نظام إدارة مكتب المحاماة
-- المخطط الأساسي: مكاتب متعددة معزولة، أدوار، صلاحيات على مستوى الصفوف
-- =====================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------------
-- المكاتب والأعضاء
-- ---------------------------------------------------------------------
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  phone text,
  email text,
  address text,
  city text default 'بغداد',
  bar_number text,
  logo_url text,
  receipt_footer text,
  default_currency text not null default 'IQD' check (default_currency in ('IQD','USD')),
  lawyers_see_all boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.office_members (
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','lawyer','accountant','secretary')),
  full_name text not null,
  email text,
  phone text,
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (office_id, user_id),
  unique (user_id)
);
create index on public.office_members (office_id);

create table public.office_counters (
  office_id uuid not null references public.offices(id) on delete cascade,
  key text not null,
  value bigint not null default 0,
  primary key (office_id, key)
);

-- ---------------------------------------------------------------------
-- دوال مساعدة للصلاحيات
-- ---------------------------------------------------------------------
create or replace function app.current_office_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.office_id from public.office_members m
  where m.user_id = auth.uid() and m.active
  limit 1
$$;

create or replace function app.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.office_members m
  where m.user_id = auth.uid() and m.active
  limit 1
$$;

create or replace function app.has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.role = any(roles) from public.office_members m
                   where m.user_id = auth.uid() and m.active limit 1), false)
$$;

create or replace function app.next_counter(p_office uuid, p_key text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  insert into public.office_counters(office_id, key, value) values (p_office, p_key, 1)
  on conflict (office_id, key) do update set value = public.office_counters.value + 1
  returning value into v;
  return v;
end $$;

create or replace function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- يضبط office_id و created_by تلقائياً ويمنع النقل بين المكاتب
create or replace function app.stamp_office() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.office_id := app.current_office_id();
    if new.office_id is null then
      raise exception 'لا ينتمي المستخدم إلى أي مكتب';
    end if;
    begin new.created_by := coalesce(new.created_by, auth.uid()); exception when undefined_column then null; end;
  else
    new.office_id := old.office_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- الموكلون
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  client_no bigint,
  kind text not null default 'individual' check (kind in ('individual','company')),
  name text not null check (char_length(name) between 2 and 200),
  national_id text,
  phone text not null,
  phone2 text,
  email text,
  address text,
  occupation text,
  referred_by text,
  notes text,
  archived boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.clients (office_id, created_at desc);
create index on public.clients (office_id, name);

-- ---------------------------------------------------------------------
-- القضايا
-- ---------------------------------------------------------------------
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  file_no bigint,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 300),
  case_number text,
  case_year int,
  case_type text not null default 'civil' check (case_type in
    ('civil','criminal','personal_status','commercial','labor','administrative','real_estate','misdemeanor','execution','other')),
  court text,
  court_level text check (court_level in ('first_instance','appeal','cassation','misdemeanor','felony','personal_status','labor','administrative','investigation','execution','other')),
  judge text,
  client_capacity text check (client_capacity in ('plaintiff','defendant','complainant','accused','appellant','respondent','other')),
  opponent_name text,
  opponent_lawyer text,
  status text not null default 'active' check (status in ('preparing','active','suspended','won','lost','settled','closed','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  description text,
  fee_type text not null default 'fixed' check (fee_type in ('fixed','percentage','installments','pro_bono')),
  total_fees numeric(14,2) not null default 0 check (total_fees >= 0),
  currency text not null default 'IQD' check (currency in ('IQD','USD')),
  opened_at date not null default current_date,
  closed_at date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.cases (office_id, status);
create index on public.cases (client_id);
create index on public.cases (assigned_to);

-- ---------------------------------------------------------------------
-- الجلسات
-- ---------------------------------------------------------------------
create table public.hearings (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  hearing_date date not null,
  hearing_time time,
  court text,
  room text,
  purpose text,
  status text not null default 'scheduled' check (status in ('scheduled','done','postponed','cancelled')),
  result text,
  next_date date,
  notes text,
  attended_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.hearings (office_id, hearing_date);
create index on public.hearings (case_id);

-- ---------------------------------------------------------------------
-- المهام والمواعيد
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 300),
  description text,
  task_type text not null default 'other' check (task_type in ('document','deadline','meeting','follow_up','payment','appeal','call','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  due_date date not null,
  due_time time,
  reminder_days int not null default 2 check (reminder_days between 0 and 60),
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (office_id, status, due_date);
create index on public.tasks (case_id);
create index on public.tasks (assigned_to);

-- ---------------------------------------------------------------------
-- المالية: سندات القبض والمصاريف
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  receipt_no bigint,
  case_id uuid not null references public.cases(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'IQD' check (currency in ('IQD','USD')),
  payment_date date not null default current_date,
  method text not null default 'cash' check (method in ('cash','bank_transfer','zaincash','qi_card','check','other')),
  payer_name text,
  reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payments (office_id, payment_date desc);
create index on public.payments (case_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  case_id uuid references public.cases(id) on delete restrict,
  category text not null default 'other' check (category in ('court_fees','expert','transport','stamps','notification','translation','office','salary','rent','other')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'IQD' check (currency in ('IQD','USD')),
  expense_date date not null default current_date,
  billable boolean not null default true,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.expenses (office_id, expense_date desc);
create index on public.expenses (case_id);

-- ---------------------------------------------------------------------
-- الوكالات
-- ---------------------------------------------------------------------
create table public.powers_of_attorney (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  poa_number text,
  poa_type text not null default 'judicial' check (poa_type in ('general','special','judicial','other')),
  issuer text,
  issue_date date,
  expiry_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.powers_of_attorney (office_id, expiry_date);
create index on public.powers_of_attorney (client_id);

-- ---------------------------------------------------------------------
-- المستندات (الملفات في Storage — دلو خاص)
-- ---------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  doc_type text not null default 'other' check (doc_type in ('contract','petition','court_order','judgment','evidence','correspondence','power_of_attorney','id_document','memo','other')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (case_id is not null or client_id is not null)
);
create index on public.documents (office_id, created_at desc);
create index on public.documents (case_id);
create index on public.documents (client_id);

-- ---------------------------------------------------------------------
-- التنبيهات وسجل النشاط
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task_due','task_overdue','hearing_soon','poa_expiring','fees_due','general')),
  title text not null,
  body text,
  link text,
  ref_id uuid,
  dedupe_key text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.notifications (user_id, is_read, created_at desc);

create table public.activity_log (
  id bigserial primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('insert','update','delete')),
  entity text not null,
  entity_id uuid,
  label text,
  case_id uuid,
  created_at timestamptz not null default now()
);
create index on public.activity_log (office_id, created_at desc);
create index on public.activity_log (case_id, created_at desc);

-- ---------------------------------------------------------------------
-- المشغّلات (Triggers)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','cases','hearings','tasks','payments','expenses','powers_of_attorney','documents'] loop
    execute format('create trigger %I_stamp before insert or update on public.%I for each row execute function app.stamp_office()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function app.touch_updated_at()', t, t);
  end loop;
end $$;
create trigger offices_touch before update on public.offices for each row execute function app.touch_updated_at();

-- ترقيم تسلسلي لكل مكتب
create or replace function app.assign_numbers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'clients' and new.client_no is null then
    new.client_no := app.next_counter(new.office_id, 'client');
  elsif tg_table_name = 'cases' and new.file_no is null then
    new.file_no := app.next_counter(new.office_id, 'case');
  elsif tg_table_name = 'payments' and new.receipt_no is null then
    new.receipt_no := app.next_counter(new.office_id, 'receipt');
  end if;
  return new;
end $$;
-- يجب أن يعمل بعد stamp (الأسماء مرتبة أبجدياً: _stamp < _zz_numbers)
create trigger clients_zz_numbers before insert on public.clients for each row execute function app.assign_numbers();
create trigger cases_zz_numbers before insert on public.cases for each row execute function app.assign_numbers();
create trigger payments_zz_numbers before insert on public.payments for each row execute function app.assign_numbers();

-- التحقق من أن السجلات المرتبطة من نفس المكتب
create or replace function app.check_same_office() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if tg_table_name = 'cases' then
    select office_id into v from public.clients where id = new.client_id;
    if v is distinct from new.office_id then raise exception 'الموكل غير موجود'; end if;
  elsif tg_table_name in ('hearings','tasks','payments','expenses','documents') then
    if new.case_id is not null then
      select office_id into v from public.cases where id = new.case_id;
      if v is distinct from new.office_id then raise exception 'القضية غير موجودة'; end if;
    end if;
  end if;
  if tg_table_name in ('powers_of_attorney','documents') and new.client_id is not null then
    select office_id into v from public.clients where id = new.client_id;
    if v is distinct from new.office_id then raise exception 'الموكل غير موجود'; end if;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['cases','hearings','tasks','payments','expenses','powers_of_attorney','documents'] loop
    execute format('create trigger %I_zz_same_office before insert or update on public.%I for each row execute function app.check_same_office()', t, t);
  end loop;
end $$;

-- تاريخ إكمال المهمة وإغلاق القضية
create or replace function app.task_completion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_zz_completion before insert or update on public.tasks for each row execute function app.task_completion();

create or replace function app.case_closing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('won','lost','settled','closed','archived') and new.closed_at is null then
    new.closed_at := current_date;
  elsif new.status in ('preparing','active','suspended') then
    new.closed_at := null;
  end if;
  return new;
end $$;
create trigger cases_zz_closing before insert or update on public.cases for each row execute function app.case_closing();

-- عند إنهاء جلسة مع تحديد موعد قادم: إنشاء الجلسة التالية تلقائياً
create or replace function app.hearing_followup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('done','postponed') and new.next_date is not null
     and (tg_op = 'INSERT' or old.next_date is distinct from new.next_date or old.status is distinct from new.status)
     and not exists (select 1 from public.hearings h where h.case_id = new.case_id and h.hearing_date = new.next_date and h.id <> new.id) then
    insert into public.hearings(office_id, case_id, hearing_date, hearing_time, court, room, purpose, created_by)
    values (new.office_id, new.case_id, new.next_date, new.hearing_time, new.court, new.room,
            case when new.status = 'postponed' then 'جلسة مؤجلة' else 'جلسة مرافعة' end, auth.uid());
  end if;
  return null;
end $$;
create trigger hearings_followup after insert or update on public.hearings for each row execute function app.hearing_followup();

-- سجل النشاط
create or replace function app.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_label text; v_case uuid;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
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
do $$
declare t text;
begin
  foreach t in array array['clients','cases','hearings','tasks','payments','expenses','powers_of_attorney','documents'] loop
    execute format('create trigger %I_log after insert or update or delete on public.%I for each row execute function app.log_activity()', t, t);
  end loop;
end $$;

-- منع تعديل دور المالك أو صلاحيات خارج المكتب
create or replace function app.guard_members() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if; -- service role
  if old.role = 'owner' and (new.role <> 'owner' or not new.active) then
    raise exception 'لا يمكن تغيير دور مالك المكتب';
  end if;
  if new.role = 'owner' and old.role <> 'owner' then
    raise exception 'لا يمكن تعيين مالك جديد من هنا';
  end if;
  new.office_id := old.office_id;
  new.user_id := old.user_id;
  return new;
end $$;
create trigger office_members_guard before update on public.office_members for each row execute function app.guard_members();

-- ---------------------------------------------------------------------
-- تفعيل RLS والسياسات
-- ---------------------------------------------------------------------
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.office_counters enable row level security;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.hearings enable row level security;
alter table public.tasks enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.powers_of_attorney enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;

-- المكتب
create policy offices_select on public.offices for select to authenticated
  using (id = (select app.current_office_id()));
create policy offices_update on public.offices for update to authenticated
  using (id = (select app.current_office_id()) and (select app.has_role('owner','admin')))
  with check (id = (select app.current_office_id()));

-- الأعضاء
create policy members_select on public.office_members for select to authenticated
  using (office_id = (select app.current_office_id()));
create policy members_update on public.office_members for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')))
  with check (office_id = (select app.current_office_id()));

-- الموكلون: الجميع يقرأ، الكل عدا المحاسب يضيف/يعدّل، الحذف للإدارة
create policy clients_select on public.clients for select to authenticated
  using (office_id = (select app.current_office_id()));
create policy clients_insert on public.clients for insert to authenticated
  with check ((select app.has_role('owner','admin','lawyer','secretary')));
create policy clients_update on public.clients for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','lawyer','secretary')));
create policy clients_delete on public.clients for delete to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')));

-- القضايا: المحامي يرى قضاياه فقط إن قيّد المكتب ذلك
create or replace function app.can_see_all_cases() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.role <> 'lawyer' or o.lawyers_see_all
    from public.office_members m join public.offices o on o.id = m.office_id
    where m.user_id = auth.uid() and m.active limit 1), false)
$$;

create policy cases_select on public.cases for select to authenticated
  using (office_id = (select app.current_office_id())
         and ((select app.can_see_all_cases()) or assigned_to = (select auth.uid()) or created_by = (select auth.uid())));
create policy cases_insert on public.cases for insert to authenticated
  with check ((select app.has_role('owner','admin','lawyer','secretary')));
create policy cases_update on public.cases for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','lawyer','secretary'))
         and ((select app.can_see_all_cases()) or assigned_to = (select auth.uid()) or created_by = (select auth.uid())));
create policy cases_delete on public.cases for delete to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')));

-- الجداول التابعة للقضية: الرؤية تتبع رؤية القضية (RLS على cases داخل exists)
create policy hearings_select on public.hearings for select to authenticated
  using (office_id = (select app.current_office_id()) and exists (select 1 from public.cases c where c.id = case_id));
create policy hearings_insert on public.hearings for insert to authenticated
  with check ((select app.has_role('owner','admin','lawyer','secretary')) and exists (select 1 from public.cases c where c.id = case_id));
create policy hearings_update on public.hearings for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','lawyer','secretary'))
         and exists (select 1 from public.cases c where c.id = case_id));
create policy hearings_delete on public.hearings for delete to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')));

create policy tasks_select on public.tasks for select to authenticated
  using (office_id = (select app.current_office_id())
         and (case_id is null or exists (select 1 from public.cases c where c.id = case_id)));
create policy tasks_insert on public.tasks for insert to authenticated
  with check ((select app.current_office_id()) is not null
              and (case_id is null or exists (select 1 from public.cases c where c.id = case_id)));
create policy tasks_update on public.tasks for update to authenticated
  using (office_id = (select app.current_office_id())
         and ((select app.has_role('owner','admin','lawyer','secretary')) or assigned_to = (select auth.uid()))
         and (case_id is null or exists (select 1 from public.cases c where c.id = case_id)));
create policy tasks_delete on public.tasks for delete to authenticated
  using (office_id = (select app.current_office_id())
         and ((select app.has_role('owner','admin')) or created_by = (select auth.uid())));

-- المالية: السكرتير لا يرى المالية، الكتابة للمالك/المدير/المحاسب
create policy payments_select on public.payments for select to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','accountant','lawyer'))
         and exists (select 1 from public.cases c where c.id = case_id));
create policy payments_insert on public.payments for insert to authenticated
  with check ((select app.has_role('owner','admin','accountant')));
create policy payments_update on public.payments for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','accountant')));
create policy payments_delete on public.payments for delete to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')));

create policy expenses_select on public.expenses for select to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','accountant','lawyer'))
         and (case_id is null and (select app.has_role('owner','admin','accountant'))
              or exists (select 1 from public.cases c where c.id = case_id)));
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select app.has_role('owner','admin','accountant')));
create policy expenses_update on public.expenses for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','accountant')));
create policy expenses_delete on public.expenses for delete to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')));

-- الوكالات
create policy poa_select on public.powers_of_attorney for select to authenticated
  using (office_id = (select app.current_office_id()));
create policy poa_insert on public.powers_of_attorney for insert to authenticated
  with check ((select app.has_role('owner','admin','lawyer','secretary')));
create policy poa_update on public.powers_of_attorney for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','lawyer','secretary')));
create policy poa_delete on public.powers_of_attorney for delete to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin')));

-- المستندات
create policy documents_select on public.documents for select to authenticated
  using (office_id = (select app.current_office_id())
         and (case_id is null or exists (select 1 from public.cases c where c.id = case_id)));
create policy documents_insert on public.documents for insert to authenticated
  with check ((select app.has_role('owner','admin','lawyer','secretary'))
              and (case_id is null or exists (select 1 from public.cases c where c.id = case_id)));
create policy documents_update on public.documents for update to authenticated
  using (office_id = (select app.current_office_id()) and (select app.has_role('owner','admin','lawyer','secretary')));
create policy documents_delete on public.documents for delete to authenticated
  using (office_id = (select app.current_office_id()) and ((select app.has_role('owner','admin')) or created_by = (select auth.uid())));

-- التنبيهات: لكل مستخدم تنبيهاته فقط
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- سجل النشاط: للإدارة، ولمن يرى القضية في نشاط القضية
create policy activity_select on public.activity_log for select to authenticated
  using (office_id = (select app.current_office_id())
         and ((select app.has_role('owner','admin'))
              or (case_id is not null and exists (select 1 from public.cases c where c.id = case_id))));

-- ---------------------------------------------------------------------
-- الصلاحيات على مستوى الجداول (Data API)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.clients, public.cases, public.hearings, public.tasks,
  public.payments, public.expenses, public.powers_of_attorney, public.documents to authenticated;
grant select, update on public.offices, public.office_members to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select on public.activity_log to authenticated;
revoke all on public.office_counters from authenticated;
