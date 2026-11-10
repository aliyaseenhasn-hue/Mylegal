-- دوال الواجهة متاحة للمستخدمين المسجلين فقط
revoke execute on function public.my_context() from public, anon;
revoke execute on function public.refresh_my_notifications() from public, anon;
revoke execute on function public.update_my_profile(text, text, text) from public, anon;
revoke execute on function public.dashboard_summary() from public, anon;
revoke execute on function public.monthly_finance(int, text) from public, anon;
revoke execute on function public.lawyer_performance(date, date) from public, anon;
revoke execute on function public.global_search(text) from public, anon;
grant execute on function public.my_context(), public.refresh_my_notifications(), public.update_my_profile(text, text, text),
  public.dashboard_summary(), public.monthly_finance(int, text), public.lawyer_performance(date, date), public.global_search(text) to authenticated;
