-- Fix: replace notify_support_team_email() with app_config version (if live DB still uses current_setting).
-- Run in Supabase SQL editor after support-team-email-notifications.sql app_config section exists.

create or replace function public.notify_support_team_email(
  p_event_type text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret text;
  v_url text;
begin
  select nullif(trim(value), '')
  into v_base_url
  from public.app_config
  where key = 'support_email_functions_base_url';

  select nullif(trim(value), '')
  into v_secret
  from public.app_config
  where key = 'support_email_webhook_secret';

  if v_base_url is null then
    raise warning 'notify_support_team_email skipped: support_email_functions_base_url is not configured in app_config';
    return;
  end if;

  if v_secret is null or v_secret = 'YOUR_SECRET' then
    raise warning 'notify_support_team_email skipped: support_email_webhook_secret is not configured in app_config';
    return;
  end if;

  if p_event_type not in (
    'support_request',
    'buyer_protection_dispute',
    'trust_safety_report',
    'general_support'
  ) then
    raise warning 'notify_support_team_email skipped: unsupported event type %', p_event_type;
    return;
  end if;

  v_url := rtrim(v_base_url, '/') || '/send-support-email';

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-support-email-secret', v_secret
    ),
    body := jsonb_build_object(
      'eventType', p_event_type,
      'metadata', coalesce(p_metadata, '{}'::jsonb)
    )
  );
exception
  when others then
    raise warning 'notify_support_team_email failed for %: %', p_event_type, sqlerrm;
end;
$$;

revoke all on function public.notify_support_team_email(text, jsonb) from public;

notify pgrst, 'reload schema';
