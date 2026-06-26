-- Equipd general support contact form
-- Run after support-team-email-notifications.sql
--
-- Adds submit_general_support_inquiry() RPC for the guided /support flow.
-- Reuses notify_support_team_email → send-support-email with event type general_support.

-- ---------------------------------------------------------------------------
-- Allow general_support in notify_support_team_email
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Public contact form submission (guided support flow)
-- ---------------------------------------------------------------------------

create or replace function public.submit_general_support_inquiry(
  p_name text,
  p_email text,
  p_subject text,
  p_message text,
  p_category text,
  p_subcategory text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_email text := trim(p_email);
  v_subject text := trim(p_subject);
  v_message text := trim(p_message);
  v_category text := trim(p_category);
  v_subcategory text := trim(p_subcategory);
begin
  if v_name is null or char_length(v_name) = 0 then
    raise exception 'Please enter your name';
  end if;

  if v_email is null or char_length(v_email) = 0 then
    raise exception 'Please enter your email address';
  end if;

  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address';
  end if;

  if v_subject is null or char_length(v_subject) = 0 then
    raise exception 'Please enter a subject';
  end if;

  if v_message is null or char_length(v_message) = 0 then
    raise exception 'Please enter a message';
  end if;

  if v_category is null or char_length(v_category) = 0 then
    raise exception 'Support category is required';
  end if;

  if v_subcategory is null or char_length(v_subcategory) = 0 then
    raise exception 'Support subcategory is required';
  end if;

  perform public.notify_support_team_email(
    'general_support',
    jsonb_build_object(
      'category', v_category,
      'subcategory', v_subcategory,
      'name', v_name,
      'email', v_email,
      'subject', v_subject,
      'message', v_message,
      'user_id', auth.uid()
    )
  );
end;
$$;

revoke all on function public.submit_general_support_inquiry(
  text, text, text, text, text, text
) from public;

grant execute on function public.submit_general_support_inquiry(
  text, text, text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
