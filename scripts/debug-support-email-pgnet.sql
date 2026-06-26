-- Deeper pg_net / config diagnostics

-- Config readable in SQL editor (postgres)?
select
  (select nullif(trim(value), '') from public.app_config where key = 'support_email_functions_base_url') as base_url,
  (select length(nullif(trim(value), '')) from public.app_config where key = 'support_email_webhook_secret') as secret_len,
  (select nullif(trim(value), '') = 'YOUR_SECRET' from public.app_config where key = 'support_email_webhook_secret') as secret_is_placeholder;

-- Function owner
select proname, pg_get_userbyid(proowner) as owner
from pg_proc
where proname = 'notify_support_team_email';

-- Direct pg_net POST (uses secret from app_config)
select net.http_post(
  url := (
    select rtrim(nullif(trim(value), ''), '/') || '/send-support-email'
    from public.app_config
    where key = 'support_email_functions_base_url'
  ),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-support-email-secret', (
      select nullif(trim(value), '')
      from public.app_config
      where key = 'support_email_webhook_secret'
    )
  ),
  body := jsonb_build_object(
    'eventType', 'support_request',
    'metadata', jsonb_build_object('listing_title', 'pg_net direct test', 'message', 'ignore')
  )
) as request_id;
