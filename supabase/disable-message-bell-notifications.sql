-- Disable bell notifications for new messages
-- Run after conversation-reads.sql
--
-- Message unread state is handled by conversation_reads + track_message_unread_state().
-- The envelope/messages nav badge reads from conversation_reads.unread_count.
-- Bell notifications intentionally exclude messages to avoid duplicating that alert.

drop trigger if exists messages_notify_recipient on public.messages;

-- Keep the function as a documented no-op so re-running notifications.sql safely
-- does not recreate message bell alerts.
create or replace function public.notify_message_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Disabled: new messages increment conversation_reads only, not notifications.
  return new;
end;
$$;
