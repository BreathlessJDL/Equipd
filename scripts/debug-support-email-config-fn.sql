create or replace function public.debug_support_email_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_secret text;
begin
  select nullif(trim(value), '')
  into v_base
  from public.app_config
  where key = 'support_email_functions_base_url';

  select nullif(trim(value), '')
  into v_secret
  from public.app_config
  where key = 'support_email_webhook_secret';

  return jsonb_build_object(
    'base_url', v_base,
    'secret_len', coalesce(length(v_secret), 0),
    'secret_is_placeholder', v_secret = 'YOUR_SECRET',
    'would_skip',
      v_base is null
      or v_secret is null
      or v_secret = 'YOUR_SECRET'
  );
end;
$$;

revoke all on function public.debug_support_email_config() from public;
grant execute on function public.debug_support_email_config() to service_role;

select public.debug_support_email_config();
