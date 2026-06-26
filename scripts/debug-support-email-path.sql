-- Support email path diagnostics (run in Supabase SQL editor or: supabase db execute --linked -f scripts/debug-support-email-path.sql)

-- 1. Functions exist?
select
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'notify_support_team_email',
    'create_transaction_support_request',
    'open_order_dispute',
    'create_report'
  )
order by p.proname;

-- 2. pg_net extension
select extname, n.nspname as schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where extname = 'pg_net';

-- 3. net.http_post exists?
select p.proname, n.nspname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'net' and p.proname = 'http_post';

-- 4. app_config values (masked secret)
select
  key,
  case
    when key = 'support_email_webhook_secret' then
      left(value, 4) || '…' || right(value, 4) || ' (len=' || length(value) || ')'
    else value
  end as value_preview,
  updated_at
from public.app_config
where key in ('support_email_functions_base_url', 'support_email_webhook_secret')
order by key;

-- 5. Would notify_support_team_email read config? (as postgres in SQL editor)
select
  (select nullif(trim(value), '') from public.app_config where key = 'support_email_functions_base_url') as base_url,
  (select nullif(trim(value), '') from public.app_config where key = 'support_email_webhook_secret') is not null as has_secret,
  (select nullif(trim(value), '') = 'YOUR_SECRET' from public.app_config where key = 'support_email_webhook_secret') as secret_still_placeholder;

-- 6. RPC bodies include notify_support_team_email?
select
  p.proname,
  position('notify_support_team_email' in p.prosrc) > 0 as calls_notify_support_team_email
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_transaction_support_request',
    'open_order_dispute',
    'create_report'
  )
order by p.proname;

-- 7. Recent pg_net HTTP responses (if any)
select id, status_code, error_msg, created, left(coalesce(content, '')::text, 200) as content_preview
from net._http_response
order by id desc
limit 10;

-- 8. Live notify_support_team_email source uses app_config or current_setting?
select
  position('app_config' in prosrc) > 0 as uses_app_config,
  position('current_setting' in prosrc) > 0 as uses_current_setting
from pg_proc
where proname = 'notify_support_team_email';
