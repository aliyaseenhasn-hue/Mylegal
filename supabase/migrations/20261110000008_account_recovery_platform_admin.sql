-- =====================================================================
-- استعادة الحساب، تغيير البريد، والمشرف العام للمنصة
-- =====================================================================

-- رموز استعادة كلمة المرور (مخزنة مشفّرة، في مخطط غير مكشوف للواجهة)
create table if not exists app.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on app.password_resets (user_id, created_at desc);
alter table app.password_resets enable row level security;
revoke all on app.password_resets from public, anon, authenticated;

-- المشرفون العامون للمنصة
create table if not exists app.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app.platform_admins enable row level security;
revoke all on app.platform_admins from public, anon, authenticated;

-- أول مالك مسجّل يصبح المشرف العام
insert into app.platform_admins(user_id)
select user_id from public.office_members where role = 'owner' order by created_at limit 1
on conflict do nothing;

-- إمكانية إيقاف مكتب كامل من المشرف العام
alter table public.offices add column if not exists active boolean not null default true;

create or replace function app.current_office_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.office_id from public.office_members m
  join public.offices o on o.id = m.office_id and o.active
  where m.user_id = auth.uid() and m.active
  limit 1
$$;

create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'member', to_jsonb(m) - 'office_id',
    'office', to_jsonb(o),
    'is_platform_admin', exists (select 1 from app.platform_admins a where a.user_id = auth.uid())
  )
  from public.office_members m join public.offices o on o.id = m.office_id
  where m.user_id = auth.uid() and m.active and o.active
  limit 1
$$;
revoke execute on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated;

-- نظرة عامة على المنصة (تُستدعى من الدالة الطرفية بصلاحية service_role فقط)
create or replace function public.platform_overview() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'offices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'phone', o.phone, 'city', o.city, 'active', o.active, 'created_at', o.created_at,
        'owner_name', ow.full_name, 'owner_email', ow.email, 'owner_id', ow.user_id,
        'members', (select count(*) from public.office_members m where m.office_id = o.id),
        'clients', (select count(*) from public.clients c where c.office_id = o.id),
        'cases', (select count(*) from public.cases c where c.office_id = o.id),
        'last_activity', (select max(created_at) from public.activity_log a where a.office_id = o.id)
      ) order by o.created_at desc)
      from public.offices o
      left join lateral (select * from public.office_members m where m.office_id = o.id and m.role = 'owner' limit 1) ow on true
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'full_name', m.full_name, 'email', u.email, 'role', m.role, 'active', m.active,
        'office_id', m.office_id, 'office_name', o.name, 'last_sign_in_at', u.last_sign_in_at, 'created_at', m.created_at,
        'is_platform_admin', exists (select 1 from app.platform_admins a where a.user_id = m.user_id)
      ) order by o.name, m.full_name)
      from public.office_members m join public.offices o on o.id = m.office_id join auth.users u on u.id = m.user_id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'offices', (select count(*) from public.offices),
      'users', (select count(*) from public.office_members),
      'clients', (select count(*) from public.clients),
      'cases', (select count(*) from public.cases),
      'documents', (select count(*) from public.documents)
    )
  )
$$;
revoke all on function public.platform_overview() from public, anon, authenticated;
grant execute on function public.platform_overview() to service_role;

create or replace function public.is_platform_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app.platform_admins where user_id = p_user)
$$;
revoke all on function public.is_platform_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_platform_admin(uuid) to service_role;

-- إدارة رموز الاستعادة (service_role فقط)
create or replace function public.reset_code_create(p_user uuid, p_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  -- حد أقصى 3 طلبات في الساعة لكل مستخدم
  if (select count(*) from app.password_resets where user_id = p_user and created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  update app.password_resets set expires_at = now() where user_id = p_user and expires_at > now();
  insert into app.password_resets(user_id, code_hash, expires_at) values (p_user, p_hash, now() + interval '15 minutes');
  return true;
end $$;

create or replace function public.reset_code_verify(p_user uuid, p_hash text) returns text
language plpgsql security definer set search_path = '' as $$
declare r app.password_resets;
begin
  select * into r from app.password_resets
  where user_id = p_user and expires_at > now()
  order by created_at desc limit 1;
  if r.id is null then return 'expired'; end if;
  if r.attempts >= 5 then return 'locked'; end if;
  if r.code_hash <> p_hash then
    update app.password_resets set attempts = attempts + 1 where id = r.id;
    return 'invalid';
  end if;
  update app.password_resets set expires_at = now() where id = r.id;
  return 'ok';
end $$;

revoke all on function public.reset_code_create(uuid, text), public.reset_code_verify(uuid, text) from public, anon, authenticated;
grant execute on function public.reset_code_create(uuid, text), public.reset_code_verify(uuid, text) to service_role;
