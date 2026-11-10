-- التخزين: دلو خاص للمستندات، ودلو عام لشعار المكتب
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "documents read own office" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select app.current_office_id())::text);
create policy "documents upload own office" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select app.current_office_id())::text
              and (select app.has_role('owner','admin','lawyer','secretary')));
create policy "documents remove own office" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select app.current_office_id())::text
         and (select app.has_role('owner','admin','lawyer','secretary')));
create policy "branding upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = (select app.current_office_id())::text
              and (select app.has_role('owner','admin')));

-- التحديث اللحظي لعداد التنبيهات
alter publication supabase_realtime add table public.notifications;

-- جدولة التنبيهات يومياً الساعة 6 صباحاً بتوقيت بغداد (03:00 UTC)
create extension if not exists pg_cron;
select cron.schedule('mylegal-daily-notifications', '0 3 * * *', $$select app.generate_notifications()$$);
