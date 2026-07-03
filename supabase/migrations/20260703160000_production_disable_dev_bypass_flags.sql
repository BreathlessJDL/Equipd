-- Disable dev-only bypass flags for production launch.
-- Dev RPCs remain callable by admins only (20260703151000_prelaunch_admin_dev_tools_hardening.sql).

insert into public.app_config (key, value, updated_at)
values ('dev_handover_bypass_enabled', 'false', now())
on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at;

notify pgrst, 'reload schema';
