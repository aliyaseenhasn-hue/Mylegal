-- =====================================================================
-- تذكير المهام بتاريخ ووقت محددين (يُرسل خلال دقيقة من الموعد)
-- =====================================================================
alter table public.tasks add column if not exists remind_at timestamptz;
alter table public.tasks add column if not exists reminded_at timestamptz;
create index if not exists tasks_remind_idx on public.tasks (remind_at) where reminded_at is null;

-- عند تغيير وقت التذكير أو إعادة فتح المهمة يُعاد تفعيل التذكير
create or replace function app.task_reminder_reset() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.remind_at is distinct from old.remind_at or new.assigned_to is distinct from old.assigned_to then
    new.reminded_at := null;
  end if;
  return new;
end $$;
create trigger tasks_zz_reminder_reset before insert or update on public.tasks
  for each row execute function app.task_reminder_reset();

-- إرسال التذكيرات المستحقة
create or replace function app.send_due_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with due as (
    update public.tasks t set reminded_at = now()
    where t.remind_at <= now() and t.reminded_at is null
      and t.status in ('pending','in_progress') and t.assigned_to is not null
      and t.remind_at > now() - interval '1 day'
    returning t.*
  )
  insert into public.notifications(office_id, user_id, kind, title, body, link, ref_id, dedupe_key)
  select d.office_id, d.assigned_to, 'task_due', '⏰ تذكير: ' || d.title,
         'الموعد: ' || to_char(d.due_date, 'YYYY-MM-DD') || coalesce(' الساعة ' || to_char(d.due_time, 'HH24:MI'), '')
           || coalesce(' — ' || c.title, ''),
         case when d.case_id is not null then '/cases/' || d.case_id else '/tasks' end,
         d.id, 'remind:' || d.id || ':' || extract(epoch from d.remind_at)::bigint
  from due d
  join public.office_members m on m.user_id = d.assigned_to and m.office_id = d.office_id and m.active
  left join public.cases c on c.id = d.case_id
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

select cron.schedule('mylegal-task-reminders', '* * * * *', $$select app.send_due_reminders()$$);

-- التنبيه اليومي: المهام ذات التذكير المحدد لا تُكرَّر إلا إذا تأخرت
create or replace function app.generate_notifications(p_user uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; c int;
begin
  insert into public.notifications(office_id, user_id, kind, title, body, link, ref_id, dedupe_key)
  select t.office_id, t.assigned_to,
         case when t.due_date < app.today() then 'task_overdue' else 'task_due' end,
         case when t.due_date < app.today() then 'مهمة متأخرة: ' else 'مهمة مستحقة: ' end || t.title,
         case when t.due_date < app.today() then 'متأخرة منذ ' || (app.today() - t.due_date) || ' يوم'
              when t.due_date = app.today() then 'مستحقة اليوم'
              else 'تستحق خلال ' || (t.due_date - app.today()) || ' يوم' end,
         '/tasks', t.id,
         'task:' || t.id || ':' || app.today()
  from public.tasks t
  join public.office_members m on m.user_id = t.assigned_to and m.office_id = t.office_id and m.active
  where t.status in ('pending','in_progress') and t.assigned_to is not null
    and (t.due_date < app.today() or (t.remind_at is null and t.due_date <= app.today() + t.reminder_days))
    and (p_user is null or t.assigned_to = p_user)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into public.notifications(office_id, user_id, kind, title, body, link, ref_id, dedupe_key)
  select h.office_id, m.user_id, 'hearing_soon',
         case when h.hearing_date = app.today() then 'جلسة اليوم: ' else 'جلسة غداً: ' end || c.title,
         coalesce(h.court, c.court, '') || coalesce(' — ' || to_char(h.hearing_time, 'HH24:MI'), ''),
         '/cases/' || c.id, h.id,
         'hearing:' || h.id || ':' || h.hearing_date
  from public.hearings h
  join public.cases c on c.id = h.case_id
  join public.office_members m on m.office_id = h.office_id and m.active
       and (m.user_id = c.assigned_to or m.role in ('owner','admin','secretary'))
  where h.status = 'scheduled' and h.hearing_date between app.today() and app.today() + 1
    and (p_user is null or m.user_id = p_user)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into public.notifications(office_id, user_id, kind, title, body, link, ref_id, dedupe_key)
  select p.office_id, m.user_id, 'poa_expiring',
         'وكالة قاربت على الانتهاء: ' || cl.name,
         'تنتهي بتاريخ ' || p.expiry_date,
         '/poa', p.id, 'poa:' || p.id || ':' || p.expiry_date
  from public.powers_of_attorney p
  join public.clients cl on cl.id = p.client_id
  join public.office_members m on m.office_id = p.office_id and m.active and m.role in ('owner','admin','secretary')
  where p.expiry_date between app.today() and app.today() + 30
    and (p_user is null or m.user_id = p_user)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;
  return n;
end $$;

-- عرض المهام يشمل وقت التذكير (الأعمدة الجديدة تُضاف لنهاية العرض)
create or replace view public.task_board with (security_invoker = true) as
select t.id, t.office_id, t.case_id, t.title, t.description, t.task_type, t.priority, t.status, t.due_date, t.due_time,
       t.reminder_days, t.assigned_to, t.completed_at, t.created_by, t.created_at, t.updated_at,
       c.title as case_title, c.file_no, cl.name as client_name, m.full_name as assigned_name,
       t.remind_at, t.reminded_at
from public.tasks t
left join public.cases c on c.id = t.case_id
left join public.clients cl on cl.id = c.client_id
left join public.office_members m on m.user_id = t.assigned_to and m.office_id = t.office_id;
