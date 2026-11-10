-- =====================================================================
-- العروض، دوال التقارير، التنبيهات، التخزين، إنشاء المكتب
-- =====================================================================

-- "اليوم" بتوقيت بغداد
create or replace function app.today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Baghdad')::date $$;
grant execute on function app.today() to authenticated;

-- ---------------------------------------------------------------------
-- عرض القضايا مع الملخص المالي (يحترم RLS لأن security_invoker)
-- ---------------------------------------------------------------------
create or replace view public.case_overview with (security_invoker = true) as
select
  c.*,
  cl.name  as client_name,
  cl.phone as client_phone,
  m.full_name as assigned_name,
  coalesce(p.paid, 0) as paid_total,
  coalesce(e.spent, 0) as expenses_total,
  coalesce(e.billable, 0) as billable_expenses,
  greatest(c.total_fees - coalesce(p.paid, 0), 0) as remaining_fees,
  case when c.total_fees > 0 then least(round(coalesce(p.paid, 0) * 100 / c.total_fees), 100) else 0 end as paid_percent,
  nh.next_hearing,
  coalesce(t.open_tasks, 0) as open_tasks,
  coalesce(t.overdue_tasks, 0) as overdue_tasks
from public.cases c
join public.clients cl on cl.id = c.client_id
left join public.office_members m on m.user_id = c.assigned_to and m.office_id = c.office_id
left join lateral (select sum(amount) paid from public.payments where case_id = c.id) p on true
left join lateral (select sum(amount) spent, sum(amount) filter (where billable) billable from public.expenses where case_id = c.id) e on true
left join lateral (select min(hearing_date) next_hearing from public.hearings
                   where case_id = c.id and status = 'scheduled' and hearing_date >= app.today()) nh on true
left join lateral (select count(*) filter (where status in ('pending','in_progress')) open_tasks,
                          count(*) filter (where status in ('pending','in_progress') and due_date < app.today()) overdue_tasks
                   from public.tasks where case_id = c.id) t on true;

create or replace view public.client_overview with (security_invoker = true) as
select
  cl.*,
  coalesce(s.cases_count, 0) as cases_count,
  coalesce(s.active_cases, 0) as active_cases,
  coalesce(s.fees, 0) as total_fees,
  coalesce(s.paid, 0) as paid_total
from public.clients cl
left join lateral (
  select count(*) cases_count,
         count(*) filter (where status in ('preparing','active','suspended')) active_cases,
         sum(total_fees) fees,
         sum((select coalesce(sum(amount),0) from public.payments p where p.case_id = c.id)) paid
  from public.cases c where c.client_id = cl.id
) s on true;

create or replace view public.hearing_agenda with (security_invoker = true) as
select h.*, c.title as case_title, c.file_no, c.case_number, c.assigned_to, c.client_id,
       cl.name as client_name, m.full_name as assigned_name
from public.hearings h
join public.cases c on c.id = h.case_id
join public.clients cl on cl.id = c.client_id
left join public.office_members m on m.user_id = c.assigned_to and m.office_id = c.office_id;

create or replace view public.task_board with (security_invoker = true) as
select t.*, c.title as case_title, c.file_no, cl.name as client_name, m.full_name as assigned_name
from public.tasks t
left join public.cases c on c.id = t.case_id
left join public.clients cl on cl.id = c.client_id
left join public.office_members m on m.user_id = t.assigned_to and m.office_id = t.office_id;

create or replace view public.payment_register with (security_invoker = true) as
select p.*, c.title as case_title, c.file_no, c.client_id, cl.name as client_name, m.full_name as created_by_name
from public.payments p
join public.cases c on c.id = p.case_id
join public.clients cl on cl.id = c.client_id
left join public.office_members m on m.user_id = p.created_by and m.office_id = p.office_id;

create or replace view public.expense_register with (security_invoker = true) as
select e.*, c.title as case_title, c.file_no, cl.name as client_name
from public.expenses e
left join public.cases c on c.id = e.case_id
left join public.clients cl on cl.id = c.client_id;

create or replace view public.poa_register with (security_invoker = true) as
select p.*, cl.name as client_name, cl.phone as client_phone
from public.powers_of_attorney p
join public.clients cl on cl.id = p.client_id;

create or replace view public.activity_feed with (security_invoker = true) as
select a.*, m.full_name as actor_name
from public.activity_log a
left join public.office_members m on m.user_id = a.actor_id and m.office_id = a.office_id;

grant select on public.case_overview, public.client_overview, public.hearing_agenda, public.task_board,
  public.payment_register, public.expense_register, public.poa_register, public.activity_feed to authenticated;

-- ---------------------------------------------------------------------
-- ملخص لوحة التحكم
-- ---------------------------------------------------------------------
create or replace function public.dashboard_summary() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'clients', (select count(*) from public.clients where not archived),
    'active_cases', (select count(*) from public.cases where status in ('preparing','active','suspended')),
    'closed_cases', (select count(*) from public.cases where status in ('won','lost','settled','closed','archived')),
    'won_cases', (select count(*) from public.cases where status = 'won'),
    'hearings_today', (select count(*) from public.hearings where hearing_date = app.today() and status = 'scheduled'),
    'hearings_week', (select count(*) from public.hearings where hearing_date between app.today() and app.today() + 7 and status = 'scheduled'),
    'open_tasks', (select count(*) from public.tasks where status in ('pending','in_progress')),
    'overdue_tasks', (select count(*) from public.tasks where status in ('pending','in_progress') and due_date < app.today()),
    'my_open_tasks', (select count(*) from public.tasks where status in ('pending','in_progress') and assigned_to = auth.uid()),
    'poa_expiring', (select count(*) from public.powers_of_attorney where expiry_date between app.today() and app.today() + 30),
    'finance', coalesce((
      select jsonb_agg(jsonb_build_object('currency', cur, 'fees', fees, 'paid', paid, 'expenses', spent,
                                          'month_paid', month_paid, 'remaining', greatest(fees - paid, 0)))
      from (
        select cur,
               coalesce((select sum(total_fees) from public.cases where currency = cur), 0) fees,
               coalesce((select sum(amount) from public.payments where currency = cur), 0) paid,
               coalesce((select sum(amount) from public.expenses where currency = cur), 0) spent,
               coalesce((select sum(amount) from public.payments where currency = cur
                          and payment_date >= date_trunc('month', app.today())), 0) month_paid
        from unnest(array['IQD','USD']) cur
      ) f
      where fees > 0 or paid > 0 or spent > 0 or cur = 'IQD'
    ), '[]'::jsonb)
  )
$$;

-- التحصيل والمصاريف الشهرية
create or replace function public.monthly_finance(p_months int default 12, p_currency text default 'IQD')
returns table(month date, collected numeric, spent numeric)
language sql stable security invoker set search_path = '' as $$
  with months as (
    select (date_trunc('month', app.today()) - (n || ' month')::interval)::date as month
    from generate_series(0, greatest(least(p_months, 36), 1) - 1) n
  )
  select m.month,
         coalesce((select sum(amount) from public.payments p
                   where p.currency = p_currency and date_trunc('month', p.payment_date) = m.month), 0),
         coalesce((select sum(amount) from public.expenses e
                   where e.currency = p_currency and date_trunc('month', e.expense_date) = m.month), 0)
  from months m order by m.month
$$;

-- تقرير الأداء حسب المحامي
create or replace function public.lawyer_performance(p_from date default null, p_to date default null)
returns table(user_id uuid, full_name text, role text, cases_total bigint, cases_active bigint, cases_won bigint,
              cases_lost bigint, hearings_done bigint, tasks_done bigint, tasks_overdue bigint, collected_iqd numeric, collected_usd numeric)
language sql stable security invoker set search_path = '' as $$
  select m.user_id, m.full_name, m.role,
    (select count(*) from public.cases c where c.assigned_to = m.user_id),
    (select count(*) from public.cases c where c.assigned_to = m.user_id and c.status in ('preparing','active','suspended')),
    (select count(*) from public.cases c where c.assigned_to = m.user_id and c.status = 'won'),
    (select count(*) from public.cases c where c.assigned_to = m.user_id and c.status = 'lost'),
    (select count(*) from public.hearings h join public.cases c on c.id = h.case_id
      where c.assigned_to = m.user_id and h.status = 'done'
        and (p_from is null or h.hearing_date >= p_from) and (p_to is null or h.hearing_date <= p_to)),
    (select count(*) from public.tasks t where t.assigned_to = m.user_id and t.status = 'completed'
        and (p_from is null or t.completed_at::date >= p_from) and (p_to is null or t.completed_at::date <= p_to)),
    (select count(*) from public.tasks t where t.assigned_to = m.user_id and t.status in ('pending','in_progress') and t.due_date < app.today()),
    (select coalesce(sum(p.amount),0) from public.payments p join public.cases c on c.id = p.case_id
      where c.assigned_to = m.user_id and p.currency = 'IQD'
        and (p_from is null or p.payment_date >= p_from) and (p_to is null or p.payment_date <= p_to)),
    (select coalesce(sum(p.amount),0) from public.payments p join public.cases c on c.id = p.case_id
      where c.assigned_to = m.user_id and p.currency = 'USD'
        and (p_from is null or p.payment_date >= p_from) and (p_to is null or p.payment_date <= p_to))
  from public.office_members m
  where m.office_id = app.current_office_id() and m.active and m.role in ('owner','admin','lawyer')
  order by 4 desc
$$;

-- بحث شامل
create or replace function public.global_search(q text)
returns table(kind text, id uuid, title text, subtitle text)
language sql stable security invoker set search_path = '' as $$
  (select 'client', id, name, coalesce(phone, '') from public.clients
    where length(q) >= 2 and (name ilike '%' || q || '%' or phone ilike '%' || q || '%' or national_id ilike '%' || q || '%') limit 6)
  union all
  (select 'case', c.id, c.title, coalesce('ملف ' || c.file_no, '') || coalesce(' — ' || c.case_number, '') from public.cases c
    where length(q) >= 2 and (c.title ilike '%' || q || '%' or c.case_number ilike '%' || q || '%'
                              or c.opponent_name ilike '%' || q || '%' or c.file_no::text = q) limit 6)
  union all
  (select 'task', id, title, due_date::text from public.tasks
    where length(q) >= 2 and title ilike '%' || q || '%' limit 4)
$$;

grant execute on function public.dashboard_summary(), public.monthly_finance(int, text),
  public.lawyer_performance(date, date), public.global_search(text) to authenticated;

-- معلومات المستخدم الحالي ومكتبه
create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'member', to_jsonb(m) - 'office_id',
    'office', to_jsonb(o)
  )
  from public.office_members m join public.offices o on o.id = m.office_id
  where m.user_id = auth.uid() and m.active
  limit 1
$$;
grant execute on function public.my_context() to authenticated;

create or replace function public.update_my_profile(p_full_name text, p_phone text, p_title text)
returns void language sql security definer set search_path = '' as $$
  update public.office_members set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
         phone = p_phone, title = p_title
  where user_id = auth.uid()
$$;
grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- إنشاء مكتب جديد (يُستدعى من الدالة الطرفية بصلاحية service_role فقط)
-- ---------------------------------------------------------------------
create or replace function public.create_office_with_owner(p_user uuid, p_office_name text, p_full_name text, p_email text, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_office uuid;
begin
  if exists (select 1 from public.office_members where user_id = p_user) then
    raise exception 'المستخدم مرتبط بمكتب مسبقاً';
  end if;
  insert into public.offices(name, phone, email) values (p_office_name, p_phone, p_email) returning id into v_office;
  insert into public.office_members(office_id, user_id, role, full_name, email, phone)
  values (v_office, p_user, 'owner', p_full_name, p_email, p_phone);
  return v_office;
end $$;
revoke all on function public.create_office_with_owner(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_office_with_owner(uuid, text, text, text, text) to service_role;

