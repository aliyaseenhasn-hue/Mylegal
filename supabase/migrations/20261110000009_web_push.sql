-- =====================================================================
-- إشعارات الدفع (Web Push) للهاتف والحاسبة
-- =====================================================================
create extension if not exists pg_net with schema extensions;

-- إعدادات خاصة (مفاتيح VAPID وسر الاستدعاء). القيم تُدخل يدوياً ولا تُحفظ في المستودع.
create table if not exists app.push_config (
  key text primary key,
  value text not null
);
alter table app.push_config enable row level security;
revoke all on app.push_config from public, anon, authenticated;

-- اشتراكات الأجهزة
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

alter table public.notifications add column if not exists pushed_at timestamptz;

-- بيانات الإرسال (service_role فقط)
create or replace function public.push_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from app.push_config
$$;
create or replace function public.push_job(p_notification uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'notification', to_jsonb(n),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                               from public.push_subscriptions s where s.user_id = n.user_id), '[]'::jsonb),
    'unread', (select count(*) from public.notifications u where u.user_id = n.user_id and not u.is_read)
  )
  from public.notifications n where n.id = p_notification
$$;
revoke all on function public.push_config(), public.push_job(uuid) from public, anon, authenticated;
grant execute on function public.push_config(), public.push_job(uuid) to service_role;

-- إرسال فوري عند إنشاء أي تنبيه
create or replace function app.dispatch_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_secret text; v_url text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return null;
  end if;
  select value into v_secret from app.push_config where key = 'trigger_secret';
  select value into v_url from app.push_config where key = 'function_url';
  if v_secret is null or v_url is null then return null; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 10000
  );
  return null;
end $$;
create trigger notifications_push after insert on public.notifications for each row execute function app.dispatch_push();

-- تنبيه فوري عند إسناد مهمة لعضو آخر
create or replace function app.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor text;
begin
  if new.assigned_to is null or new.assigned_to = auth.uid() or new.status not in ('pending','in_progress') then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then
    return null;
  end if;
  select full_name into v_actor from public.office_members where user_id = auth.uid();
  insert into public.notifications(office_id, user_id, kind, title, body, link, ref_id, dedupe_key)
  values (new.office_id, new.assigned_to, 'general', 'مهمة جديدة: ' || new.title,
          coalesce('من ' || v_actor || ' — ', '') || 'تستحق ' || to_char(new.due_date, 'YYYY-MM-DD'),
          case when new.case_id is not null then '/cases/' || new.case_id else '/tasks' end,
          new.id, 'assigned:' || new.id || ':' || new.assigned_to)
  on conflict (user_id, dedupe_key) do nothing;
  return null;
end $$;
create trigger tasks_notify_assigned after insert or update of assigned_to on public.tasks
  for each row execute function app.notify_task_assigned();
