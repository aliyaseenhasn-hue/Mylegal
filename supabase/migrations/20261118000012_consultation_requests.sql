-- طلبات الاستشارة الواردة من نموذج موقع المكتب (lawyer-ali-khazraji)
-- الزائر (anon) يستطيع الإرسال فقط، وأعضاء المكتب وحدهم يقرؤون الطلبات ويحدّثون حالتها.

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default 'f3501e04-f868-4d9d-a738-75c2e035027a' references public.offices(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (phone ~ '^[0-9+ ]{7,20}$'),
  case_type text not null check (case_type in ('جزائية','أحوال شخصية','ميراث وعقارات','مدنية وديون','جرائم إلكترونية وتشهير','إصابات','أخرى')),
  message text not null check (char_length(message) between 10 and 2000),
  preferred_contact text not null default 'واتساب' check (preferred_contact in ('واتساب','اتصال هاتفي')),
  status text not null default 'جديد' check (status in ('جديد','تم التواصل','مغلق')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index consultation_requests_office_created_idx on public.consultation_requests (office_id, created_at desc);

alter table public.consultation_requests enable row level security;

-- زوار الموقع يرسلون طلبات جديدة لمكتب سفراء القانون فقط
create policy "public can submit consultation requests"
  on public.consultation_requests for insert to anon, authenticated
  with check (status = 'جديد' and source = 'website' and office_id = 'f3501e04-f868-4d9d-a738-75c2e035027a');

create policy "office members can read requests"
  on public.consultation_requests for select to authenticated
  using (exists (select 1 from public.office_members m where m.office_id = consultation_requests.office_id and m.user_id = (select auth.uid()) and m.active));

create policy "office members can update requests"
  on public.consultation_requests for update to authenticated
  using (exists (select 1 from public.office_members m where m.office_id = consultation_requests.office_id and m.user_id = (select auth.uid()) and m.active))
  with check (exists (select 1 from public.office_members m where m.office_id = consultation_requests.office_id and m.user_id = (select auth.uid()) and m.active));

grant insert on public.consultation_requests to anon;
grant select, insert, update on public.consultation_requests to authenticated;

-- تنبيه داخل التطبيق لكل أعضاء المكتب عند وصول طلب جديد
create or replace function public.notify_new_consultation_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (office_id, user_id, kind, title, body, link, ref_id, dedupe_key)
  select new.office_id, m.user_id, 'general',
         'طلب استشارة جديد من الموقع: ' || new.full_name,
         new.case_type || ' · ' || new.phone || ' · ' || new.preferred_contact || E'\n' || left(new.message, 300),
         '/requests', new.id, 'consultation:' || new.id
  from public.office_members m
  where m.office_id = new.office_id and m.active
  on conflict (user_id, dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.notify_new_consultation_request() from public, anon, authenticated;

create trigger consultation_requests_notify
after insert on public.consultation_requests
for each row execute function public.notify_new_consultation_request();
