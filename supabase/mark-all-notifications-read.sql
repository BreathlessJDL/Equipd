-- Mark all unread notifications as read for the authenticated user.
-- Run after notifications.sql
-- Does not delete notifications; only sets is_read = true.
-- Excludes message_received (bell/envelope owns message unread state).

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications n
  set is_read = true
  where n.user_id = v_user_id
    and n.is_read = false
    and n.type <> 'message_received';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;
