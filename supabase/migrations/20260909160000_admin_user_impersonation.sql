-- Admin user impersonation: audit sessions, search RPC, Custom Access Token Hook.
-- Writes during impersonation use the customer's auth.uid() (time-window correlation only).
-- Do not expose this table to anon/authenticated clients.

create table if not exists public.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  impersonated_user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  auth_session_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  constraint admin_impersonation_sessions_expires_after_start
    check (expires_at > started_at),
  constraint admin_impersonation_sessions_not_self
    check (admin_user_id <> impersonated_user_id)
);

create index if not exists admin_impersonation_sessions_admin_started_idx
  on public.admin_impersonation_sessions (admin_user_id, started_at desc);

create index if not exists admin_impersonation_sessions_target_started_idx
  on public.admin_impersonation_sessions (impersonated_user_id, started_at desc);

create unique index if not exists admin_impersonation_sessions_auth_session_uidx
  on public.admin_impersonation_sessions (auth_session_id)
  where auth_session_id is not null;

create index if not exists admin_impersonation_sessions_pending_bind_idx
  on public.admin_impersonation_sessions (impersonated_user_id, started_at desc)
  where auth_session_id is null and ended_at is null;

alter table public.admin_impersonation_sessions enable row level security;

revoke all on table public.admin_impersonation_sessions from public, anon, authenticated;

-- Hook + Edge (service_role) need table access. Auth admin role for the access-token hook.
grant select, insert, update on table public.admin_impersonation_sessions to service_role;
grant select, update on table public.admin_impersonation_sessions to supabase_auth_admin;

comment on table public.admin_impersonation_sessions is
  'Admin impersonation audit. Marketplace writes during an open session are attributable only by time-window correlation (auth.uid = customer), not per-mutation actor columns.';

-- ---------------------------------------------------------------------------
-- Admin user search
-- ---------------------------------------------------------------------------

create or replace function public.admin_search_users(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer;
  v_raw text;
  v_like text;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_raw := nullif(trim(coalesce(p_query, '')), '');
  v_like := case when v_raw is null then null else '%' || replace(replace(v_raw, '\', '\\'), '%', '\%') || '%' end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'username', s.username,
        'displayName', s.display_name,
        'email', s.email,
        'createdAt', s.created_at,
        'listingCount', s.listing_count,
        'isAdmin', s.is_admin
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      p.id,
      p.username,
      p.display_name,
      p.created_at,
      p.is_admin,
      u.email,
      (
        select count(*)::int
        from public.listings l
        where l.seller_id = p.id
          and coalesce(l.is_test_data, false) = false
      ) as listing_count
    from public.profiles p
    join auth.users u on u.id = p.id
    where
      v_like is null
      or p.username ilike v_like escape '\'
      or coalesce(p.display_name, '') ilike v_like escape '\'
      or coalesce(u.email, '') ilike v_like escape '\'
    order by p.created_at desc
    limit v_limit
  ) s;

  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_search_users(text, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook
-- Binds pending impersonation rows to Auth session_id and injects impersonated_by.
-- Denies token refresh for ended/expired impersonation sessions only.
-- ---------------------------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  auth_method text;
  uid uuid;
  sid uuid;
  sess record;
  pending record;
begin
  claims := event->'claims';
  auth_method := replace(coalesce(event->>'authentication_method', ''), '"', '');
  uid := nullif(event->>'user_id', '')::uuid;

  begin
    sid := nullif(claims->>'session_id', '')::uuid;
  exception when others then
    sid := null;
  end;

  if uid is null then
    return event;
  end if;

  -- Bind a pending impersonation start to this newly issued Auth session.
  if auth_method in ('otp', 'magiclink') and sid is not null then
    select *
      into pending
    from public.admin_impersonation_sessions s
    where s.impersonated_user_id = uid
      and s.ended_at is null
      and s.auth_session_id is null
      and s.expires_at > now()
      and s.started_at > now() - interval '5 minutes'
    order by s.started_at desc
    limit 1
    for update;

    if found then
      update public.admin_impersonation_sessions
      set
        auth_session_id = sid,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('bound_at', now())
      where id = pending.id;

      if jsonb_typeof(claims->'app_metadata') is null then
        claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
      end if;
      claims := jsonb_set(claims, '{app_metadata, impersonated_by}', to_jsonb(pending.admin_user_id::text));
      event := jsonb_set(event, '{claims}', claims);
      return event;
    end if;
  end if;

  -- Refresh / subsequent tokens for an already-bound impersonation session.
  if sid is not null then
    select *
      into sess
    from public.admin_impersonation_sessions s
    where s.auth_session_id = sid
    limit 1
    for update;

    if found then
      if sess.ended_at is not null or sess.expires_at <= now() then
        if sess.ended_at is null then
          update public.admin_impersonation_sessions
          set
            ended_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ended_reason', 'expired')
          where id = sess.id;
        end if;

        return jsonb_build_object(
          'error',
          jsonb_build_object(
            'http_code', 403,
            'message', 'Impersonation session has expired'
          )
        );
      end if;

      if jsonb_typeof(claims->'app_metadata') is null then
        claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
      end if;
      claims := jsonb_set(claims, '{app_metadata, impersonated_by}', to_jsonb(sess.admin_user_id::text));
      event := jsonb_set(event, '{claims}', claims);
      return event;
    end if;
  end if;

  return event;
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Allow the Auth admin role to invoke is_admin if needed by other policies (no-op safe).
grant usage on schema public to supabase_auth_admin;

notify pgrst, 'reload schema';
