-- Admin suspend/unsuspend must run as service_role so
-- prevent_profile_privilege_client_updates() allows the profile write.
-- The previous authenticated-JWT RPC path was rejected with
-- "Suspension fields can only be updated by the server".
-- Privilege-field client updates remain blocked; only the Edge Function
-- (after requireAdmin) may call these RPCs.

drop function if exists public.admin_suspend_user(uuid, text);
drop function if exists public.admin_unsuspend_user(uuid, text);

create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_reason text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := p_admin_id;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_row public.profiles;
  v_suspended_at timestamptz := now();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account suspension can only be performed by the server';
  end if;
  if v_admin is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_admin
      and p.is_admin = true
  ) then
    raise exception 'Admin access required';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;
  if p_user_id = v_admin then
    raise exception 'You cannot suspend yourself';
  end if;

  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found';
  end if;
  if v_row.is_admin then
    raise exception 'Cannot suspend an admin account';
  end if;
  if v_row.is_official_equipd then
    raise exception 'Cannot suspend an official Equipd account';
  end if;

  if v_row.is_suspended then
    return jsonb_build_object(
      'ok', true,
      'userId', p_user_id,
      'isSuspended', true,
      'alreadyApplied', true,
      'suspendedAt', v_row.suspended_at,
      'reason', v_row.suspension_reason
    );
  end if;

  update public.profiles
  set
    is_suspended = true,
    suspended_at = v_suspended_at,
    suspended_by = v_admin,
    suspension_reason = v_reason
  where id = p_user_id;

  insert into public.account_moderation_events (
    target_user_id, admin_user_id, action, reason
  ) values (
    p_user_id, v_admin, 'suspend', v_reason
  );

  return jsonb_build_object(
    'ok', true,
    'userId', p_user_id,
    'isSuspended', true,
    'suspendedAt', v_suspended_at,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.admin_suspend_user(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_suspend_user(uuid, text, uuid) to service_role;

create or replace function public.admin_unsuspend_user(
  p_user_id uuid,
  p_reason text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := p_admin_id;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_row public.profiles;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account unsuspension can only be performed by the server';
  end if;
  if v_admin is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_admin
      and p.is_admin = true
  ) then
    raise exception 'Admin access required';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  select * into v_row from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found';
  end if;

  if not coalesce(v_row.is_suspended, false) then
    return jsonb_build_object(
      'ok', true,
      'userId', p_user_id,
      'isSuspended', false,
      'alreadyApplied', true
    );
  end if;

  update public.profiles
  set
    is_suspended = false,
    suspended_at = null,
    suspended_by = null,
    suspension_reason = null
  where id = p_user_id;

  insert into public.account_moderation_events (
    target_user_id, admin_user_id, action, reason
  ) values (
    p_user_id, v_admin, 'unsuspend', v_reason
  );

  return jsonb_build_object(
    'ok', true,
    'userId', p_user_id,
    'isSuspended', false
  );
end;
$$;

revoke all on function public.admin_unsuspend_user(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_unsuspend_user(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
