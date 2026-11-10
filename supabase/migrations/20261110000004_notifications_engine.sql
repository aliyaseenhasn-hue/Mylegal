-- محرك التنبيهات: مهام مستحقة/متأخرة، جلسات اليوم والغد، وكالات تنتهي خلال 30 يوماً
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
    and t.due_date <= app.today() + t.reminder_days
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

create or replace function public.refresh_my_notifications() returns int
language sql security definer set search_path = '' as $$
  select app.generate_notifications(auth.uid())
$$;
grant execute on function public.refresh_my_notifications() to authenticated;
