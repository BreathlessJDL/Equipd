-- Patch: fully revoke client access to create_notification (PUBLIC retains execute by default)
revoke all on function public.create_notification(uuid, text, text, text, text) from public;
revoke all on function public.create_notification(uuid, text, text, text, text) from authenticated;
revoke all on function public.create_notification(uuid, text, text, text, text) from anon;
grant execute on function public.create_notification(uuid, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
