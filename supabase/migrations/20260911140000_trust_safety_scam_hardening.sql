-- Trust & Safety scam hardening (P0 + P1 foundations)
-- Reserved Equipd identity, official accounts, suspension, conversation rate limits,
-- suspicious message flags, moderation audit, avatar upload path support.
-- Safe against existing production data: does not rename/delete users or mark anyone official.

-- ---------------------------------------------------------------------------
-- 1. Profile privilege / moderation columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_official_equipd boolean not null default false;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists suspended_by uuid references auth.users (id) on delete set null;

alter table public.profiles
  add column if not exists suspension_reason text;

create index if not exists profiles_is_official_equipd_idx
  on public.profiles (is_official_equipd)
  where is_official_equipd = true;

create index if not exists profiles_is_suspended_idx
  on public.profiles (is_suspended)
  where is_suspended = true;

comment on column public.profiles.is_official_equipd is
  'Unforgeable official Equipd account marker. Client updates are blocked; only service_role may change it.';

comment on column public.profiles.is_suspended is
  'When true, marketplace mutations and public listing discovery are blocked. Existing data retained.';

-- ---------------------------------------------------------------------------
-- 2. Reserved Equipd identity helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_equipd_identity(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    lower(
      regexp_replace(
        coalesce(p_value, ''),
        '[\s_\-\.]+',
        '',
        'g'
      )
    ),
    ''
  );
$$;

revoke all on function public.normalize_equipd_identity(text) from public;
grant execute on function public.normalize_equipd_identity(text) to anon, authenticated, service_role;

-- Homoglyph-aware brand token: i may be impersonated with l / 1 / |
-- (covers the live scam username EQUlPD → equlpd). Separator-stripped only;
-- does not rewrite stored usernames.
create or replace function public.is_reserved_equipd_identity(p_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_norm text := public.normalize_equipd_identity(p_value);
  v_brand text := 'equ[il1|]pd';
  v_suffix text := '(support|admin|team|payment|payments|customersupport|customerservice|help|helpdesk|official|security|verification)?';
  v_prefix text := '(support|admin|team|payment|payments|official|help|helpdesk|security|verification|customersupport|customerservice)';
begin
  if v_norm is null then
    return false;
  end if;

  -- Whole-identity matches only (avoid false positives in longer free text).
  if v_norm ~ ('^' || v_brand || '$') then
    return true;
  end if;

  if v_norm ~ ('^(official)?' || v_brand || v_suffix || '$') then
    return true;
  end if;

  if v_norm ~ ('^' || v_prefix || v_brand || '$') then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.is_reserved_equipd_identity(text) from public;
grant execute on function public.is_reserved_equipd_identity(text) to anon, authenticated, service_role;

create or replace function public.reserved_equipd_identity_error()
returns text
language sql
immutable
as $$
  select 'That name is reserved for Equipd. Please choose a different username or display name.';
$$;

-- Report-only: existing reserved-looking identities (do not auto-rename).
create or replace function public.list_reserved_equipd_identity_conflicts()
returns table (
  user_id uuid,
  username text,
  display_name text,
  is_admin boolean,
  is_official_equipd boolean,
  conflict_field text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.is_admin,
    p.is_official_equipd,
    case
      when public.is_reserved_equipd_identity(p.username)
        and public.is_reserved_equipd_identity(p.display_name) then 'username+display_name'
      when public.is_reserved_equipd_identity(p.username) then 'username'
      else 'display_name'
    end as conflict_field
  from public.profiles p
  where public.is_reserved_equipd_identity(p.username)
     or public.is_reserved_equipd_identity(p.display_name)
  order by p.created_at asc;
$$;

revoke all on function public.list_reserved_equipd_identity_conflicts() from public, anon, authenticated;
grant execute on function public.list_reserved_equipd_identity_conflicts() to service_role;

create or replace function public.admin_list_reserved_equipd_identity_conflicts()
returns table (
  user_id uuid,
  username text,
  display_name text,
  is_admin boolean,
  is_official_equipd boolean,
  conflict_field text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select * from public.list_reserved_equipd_identity_conflicts();
end;
$$;

revoke all on function public.admin_list_reserved_equipd_identity_conflicts() from public, anon;
grant execute on function public.admin_list_reserved_equipd_identity_conflicts() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Privilege / suspension helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_suspended(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_suspended
      from public.profiles p
      where p.id = coalesce(p_user_id, auth.uid())
    ),
    false
  );
$$;

revoke all on function public.is_suspended(uuid) from public;
grant execute on function public.is_suspended(uuid) to authenticated;

create or replace function public.assert_not_suspended(p_user_id uuid default auth.uid())
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_suspended(p_user_id) then
    raise exception 'Your account is suspended and cannot perform this action.';
  end if;
end;
$$;

revoke all on function public.assert_not_suspended(uuid) from public;
grant execute on function public.assert_not_suspended(uuid) to authenticated;

create or replace function public.is_official_equipd(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_official_equipd
      from public.profiles p
      where p.id = coalesce(p_user_id, auth.uid())
    ),
    false
  );
$$;

revoke all on function public.is_official_equipd(uuid) from public;
grant execute on function public.is_official_equipd(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Protect privileged profile fields + reserved identity (INSERT/UPDATE)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_profile_privilege_client_updates()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      if coalesce(new.is_admin, false) then
        raise exception 'Admin status can only be set by the server';
      end if;
      if coalesce(new.is_official_equipd, false) then
        raise exception 'Official Equipd status can only be set by the server';
      end if;
      if coalesce(new.is_suspended, false)
        or new.suspended_at is not null
        or new.suspended_by is not null
        or nullif(trim(coalesce(new.suspension_reason, '')), '') is not null then
        raise exception 'Suspension fields can only be set by the server';
      end if;
      new.is_admin := false;
      new.is_official_equipd := false;
      new.is_suspended := false;
      new.suspended_at := null;
      new.suspended_by := null;
      new.suspension_reason := null;
    end if;

    if auth.role() is distinct from 'service_role'
      and not coalesce(new.is_official_equipd, false)
      and not coalesce(new.is_admin, false) then
      if public.is_reserved_equipd_identity(new.username)
        or public.is_reserved_equipd_identity(new.display_name) then
        raise exception '%', public.reserved_equipd_identity_error();
      end if;
    end if;

    return new;
  end if;

  -- UPDATE
  if auth.role() is distinct from 'service_role' then
    if new.stripe_account_id is distinct from old.stripe_account_id
      or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete then
      raise exception 'Stripe payout fields can only be updated by the server';
    end if;

    if new.is_admin is distinct from old.is_admin then
      raise exception 'Admin status can only be updated by the server';
    end if;

    if new.is_official_equipd is distinct from old.is_official_equipd then
      raise exception 'Official Equipd status can only be updated by the server';
    end if;

    if new.is_suspended is distinct from old.is_suspended
      or new.suspended_at is distinct from old.suspended_at
      or new.suspended_by is distinct from old.suspended_by
      or new.suspension_reason is distinct from old.suspension_reason then
      raise exception 'Suspension fields can only be updated by the server';
    end if;

    if old.is_suspended then
      raise exception 'Your account is suspended and cannot update your profile.';
    end if;

    if not coalesce(old.is_official_equipd, false)
      and not coalesce(old.is_admin, false) then
      if (
          new.username is distinct from old.username
          and public.is_reserved_equipd_identity(new.username)
        )
        or (
          new.display_name is distinct from old.display_name
          and public.is_reserved_equipd_identity(new.display_name)
        ) then
        raise exception '%', public.reserved_equipd_identity_error();
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_stripe_client_updates on public.profiles;
drop trigger if exists profiles_prevent_privilege_client_updates on public.profiles;

create trigger profiles_prevent_privilege_client_updates
  before insert or update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_client_updates();

-- Legacy Stripe trigger function name retained for older SQL docs/scripts.
-- Privilege protection is now handled by prevent_profile_privilege_client_updates.

-- ---------------------------------------------------------------------------
-- 5. Username availability + signup include reserved identity
-- ---------------------------------------------------------------------------

create or replace function public.is_username_available(
  p_username text,
  p_exclude_user_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := nullif(trim(p_username), '');

  if normalized is null then
    return false;
  end if;

  if char_length(normalized) < 3
    or char_length(normalized) > 24
    or normalized !~ '^[a-zA-Z0-9_-]+$'
  then
    return false;
  end if;

  if public.is_reserved_equipd_identity(normalized) then
    -- Allow a user to keep an existing reserved username during bootstrap
    -- (e.g. legitimate Equipd account before/after marking official).
    -- New claims of reserved identities remain blocked.
    if p_exclude_user_id is null
      or not exists (
        select 1
        from public.profiles p
        where p.id = p_exclude_user_id
          and lower(p.username) = lower(normalized)
      )
    then
      return false;
    end if;
  end if;

  return not exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(normalized)
      and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  );
end;
$$;

revoke all on function public.is_username_available(text, uuid) from public;
grant execute on function public.is_username_available(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Public profile view includes official flag only (never admin/suspension)
-- ---------------------------------------------------------------------------

create or replace view public.profiles_public
with (security_barrier = true)
as
select
  p.id,
  p.username,
  p.display_name,
  p.location,
  p.avatar_url,
  p.created_at,
  p.last_active_at,
  p.is_official_equipd
from public.profiles p;

grant select on public.profiles_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Hide suspended sellers' listings from public discovery
-- ---------------------------------------------------------------------------

create or replace function public.listing_is_publicly_visible(
  p_listing public.listings
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    not coalesce(p_listing.is_test_data, false)
    and p_listing.status = 'active'::public.listing_status
    and p_listing.quantity_available > 0
    and (
      p_listing.source is distinct from 'import'::public.listing_source
      or public.listing_has_images(p_listing.id)
    )
    and not exists (
      select 1
      from public.profiles seller
      where seller.id = p_listing.seller_id
        and seller.is_suspended = true
    );
$$;

comment on function public.listing_is_publicly_visible(public.listings) is
  'Canonical marketplace visibility. Excludes test fixtures, non-active/out-of-stock, image-less imports, and suspended sellers.';

-- ---------------------------------------------------------------------------
-- 8. Moderation audit log
-- ---------------------------------------------------------------------------

create table if not exists public.account_moderation_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_moderation_events_action_allowed check (
    action in ('suspend', 'unsuspend', 'mark_official', 'unmark_official')
  )
);

create index if not exists account_moderation_events_target_created_idx
  on public.account_moderation_events (target_user_id, created_at desc);

create index if not exists account_moderation_events_admin_created_idx
  on public.account_moderation_events (admin_user_id, created_at desc);

alter table public.account_moderation_events enable row level security;

revoke all on table public.account_moderation_events from public, anon, authenticated;
grant select on table public.account_moderation_events to authenticated;
grant all on table public.account_moderation_events to service_role;

drop policy if exists "Admins can read moderation events" on public.account_moderation_events;
create policy "Admins can read moderation events"
  on public.account_moderation_events for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 9. Admin suspend / unsuspend
-- ---------------------------------------------------------------------------

create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_row public.profiles;
begin
  if v_admin is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
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

  update public.profiles
  set
    is_suspended = true,
    suspended_at = now(),
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
    'suspendedAt', now(),
    'reason', v_reason
  );
end;
$$;

revoke all on function public.admin_suspend_user(uuid, text) from public;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;

create or replace function public.admin_unsuspend_user(
  p_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_admin is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  update public.profiles
  set
    is_suspended = false,
    suspended_at = null,
    suspended_by = null,
    suspension_reason = null
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

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

revoke all on function public.admin_unsuspend_user(uuid, text) from public;
grant execute on function public.admin_unsuspend_user(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. New conversation rate limits (server-enforced RPC)
-- ---------------------------------------------------------------------------

create or replace function public.start_listing_conversation(p_listing_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.listings;
  v_existing public.conversations;
  v_created public.conversations;
  v_account_created_at timestamptz;
  v_account_age interval;
  v_hour_limit integer;
  v_day_limit integer;
  v_hour_count integer;
  v_day_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_not_suspended(v_user_id);

  if p_listing_id is null then
    raise exception 'listing_id is required';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_listing.seller_id = v_user_id then
    raise exception 'You cannot message yourself.';
  end if;

  if not public.listing_is_publicly_visible(v_listing) then
    raise exception 'Messaging can only be started on active listings.';
  end if;

  if public.is_suspended(v_listing.seller_id) then
    raise exception 'This seller is currently unavailable.';
  end if;

  select *
    into v_existing
  from public.conversations c
  where c.listing_id = p_listing_id
    and c.buyer_id = v_user_id
  limit 1;

  if found then
    return v_existing;
  end if;

  -- Rate limits apply to NEW conversations only. Admin/official bypass.
  if not public.is_admin() and not public.is_official_equipd(v_user_id) then
    select u.created_at into v_account_created_at
    from auth.users u
    where u.id = v_user_id;

    v_account_age := now() - coalesce(v_account_created_at, now());

    if v_account_age < interval '24 hours' then
      v_hour_limit := 5;
      v_day_limit := 15;
    elsif v_account_age < interval '7 days' then
      v_hour_limit := 10;
      v_day_limit := 30;
    else
      v_hour_limit := 20;
      v_day_limit := 60;
    end if;

    select count(*)::int into v_hour_count
    from public.conversations c
    where c.buyer_id = v_user_id
      and c.created_at > now() - interval '1 hour';

    select count(*)::int into v_day_count
    from public.conversations c
    where c.buyer_id = v_user_id
      and c.created_at > now() - interval '24 hours';

    if v_hour_count >= v_hour_limit or v_day_count >= v_day_limit then
      raise exception 'You''ve started several new conversations recently. Please try again later.';
    end if;
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing_id, v_user_id, v_listing.seller_id)
  returning * into v_created;

  return v_created;
end;
$$;

revoke all on function public.start_listing_conversation(uuid) from public;
grant execute on function public.start_listing_conversation(uuid) to authenticated;

-- Close direct conversation inserts to force RPC rate limiting.
drop policy if exists "Buyers can start conversations on active listings" on public.conversations;

-- ---------------------------------------------------------------------------
-- 11. Message send: suspension + suspicious flags
-- ---------------------------------------------------------------------------

create table if not exists public.suspicious_message_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  rule_key text not null,
  score integer not null default 1,
  snippet text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  review_notes text,
  constraint suspicious_message_flags_status_allowed check (
    status in ('open', 'reviewed', 'dismissed')
  )
);

create index if not exists suspicious_message_flags_status_created_idx
  on public.suspicious_message_flags (status, created_at desc);

create index if not exists suspicious_message_flags_user_created_idx
  on public.suspicious_message_flags (user_id, created_at desc);

create unique index if not exists suspicious_message_flags_message_rule_uidx
  on public.suspicious_message_flags (message_id, rule_key);

alter table public.suspicious_message_flags enable row level security;

revoke all on table public.suspicious_message_flags from public, anon, authenticated;
grant select on table public.suspicious_message_flags to authenticated;
grant all on table public.suspicious_message_flags to service_role;

drop policy if exists "Admins can read suspicious message flags" on public.suspicious_message_flags;
create policy "Admins can read suspicious message flags"
  on public.suspicious_message_flags for select
  to authenticated
  using (public.is_admin());

create or replace function public.evaluate_suspicious_message_score(p_body text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_text text := lower(coalesce(p_body, ''));
  v_score integer := 0;
  v_rules text[] := array[]::text[];
begin
  if v_text ~ 'scan\s*(a\s*)?qr' or v_text ~ 'qr\s*code' then
    v_score := v_score + 3;
    v_rules := array_append(v_rules, 'qr_scan');
  end if;

  if v_text ~ 'verification\s+fee' or v_text ~ 'verify\s+(your\s+)?(card|bank|account|payment)' then
    v_score := v_score + 4;
    v_rules := array_append(v_rules, 'payment_verification');
  end if;

  if v_text ~ 'maintain\s+(a\s*)?(balance|funds)' or v_text ~ 'keep\s+funds' then
    v_score := v_score + 3;
    v_rules := array_append(v_rules, 'maintain_balance');
  end if;

  if v_text ~ 'bank\s+transfer' or v_text ~ 'sort\s*code' or v_text ~ 'account\s+number' then
    v_score := v_score + 2;
    v_rules := array_append(v_rules, 'bank_transfer_language');
  end if;

  if (v_text ~ 'whatsapp' or v_text ~ 'telegram')
    and (v_text ~ 'pay|payment|transfer|fee|verify') then
    v_score := v_score + 3;
    v_rules := array_append(v_rules, 'offplatform_payment_contact');
  end if;

  if v_text ~ 'equipd\s+(will|requires|needs|asks)'
    and (v_text ~ 'pay|fee|verify|card|transfer') then
    v_score := v_score + 4;
    v_rules := array_append(v_rules, 'fake_equipd_payment_claim');
  end if;

  return jsonb_build_object(
    'score', v_score,
    'rules', to_jsonb(v_rules)
  );
end;
$$;

revoke all on function public.evaluate_suspicious_message_score(text) from public;

create or replace function public.maybe_flag_suspicious_message(
  p_message_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval jsonb := public.evaluate_suspicious_message_score(p_body);
  v_score integer := coalesce((v_eval->>'score')::int, 0);
  v_rules jsonb := coalesce(v_eval->'rules', '[]'::jsonb);
  v_rule text;
begin
  if v_score < 3 then
    return;
  end if;

  for v_rule in
    select jsonb_array_elements_text(v_rules)
  loop
    insert into public.suspicious_message_flags (
      message_id, user_id, conversation_id, rule_key, score, snippet
    ) values (
      p_message_id,
      p_user_id,
      p_conversation_id,
      v_rule,
      v_score,
      left(trim(coalesce(p_body, '')), 180)
    )
    on conflict (message_id, rule_key) do nothing;
  end loop;
end;
$$;

revoke all on function public.maybe_flag_suspicious_message(uuid, uuid, uuid, text) from public;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text;
  v_message public.messages;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_not_suspended(v_user_id);

  if p_conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if not public.is_message_conversation_participant(p_conversation_id, v_user_id) then
    raise exception 'You do not have access to this conversation';
  end if;

  v_body := public.assert_marketplace_message_allowed(p_body, p_conversation_id, v_user_id);

  insert into public.messages (
    conversation_id,
    sender_id,
    body,
    message_type
  )
  values (
    p_conversation_id,
    v_user_id,
    v_body,
    'text'::public.message_type
  )
  returning * into v_message;

  perform public.maybe_flag_suspicious_message(
    v_message.id,
    v_user_id,
    p_conversation_id,
    v_body
  );

  return v_message;
end;
$$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Listing mutations: block suspended sellers via trigger
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_not_suspended()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_suspended(coalesce(new.seller_id, auth.uid())) then
    raise exception 'Your account is suspended and cannot manage listings.';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_not_suspended on public.listings;
create trigger listings_enforce_not_suspended
  before insert or update on public.listings
  for each row
  execute function public.enforce_listing_not_suspended();

create or replace function public.enforce_sender_not_suspended()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if public.is_suspended(new.sender_id) then
    raise exception 'Your account is suspended and cannot send messages.';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_enforce_not_suspended on public.messages;
create trigger messages_enforce_not_suspended
  before insert on public.messages
  for each row
  execute function public.enforce_sender_not_suspended();

create or replace function public.enforce_offer_actor_not_suspended()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if public.is_suspended(auth.uid()) then
    raise exception 'Your account is suspended and cannot make or manage offers.';
  end if;
  return new;
end;
$$;

drop trigger if exists offers_enforce_not_suspended on public.offers;
create trigger offers_enforce_not_suspended
  before insert or update on public.offers
  for each row
  execute function public.enforce_offer_actor_not_suspended();

-- ---------------------------------------------------------------------------
-- 13. Ensure reports table exists (may already be present from standalone SQL)
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  report_type text not null,
  reason text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  admin_note text
);

alter table public.reports enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'reports'
      and constraint_name = 'reports_reason_allowed'
  ) then
    alter table public.reports drop constraint reports_reason_allowed;
  end if;
exception when undefined_table then
  null;
end $$;

alter table public.reports
  drop constraint if exists reports_reason_allowed;

alter table public.reports
  add constraint reports_reason_allowed check (
    reason in (
      'suspected_fraud',
      'misleading_listing',
      'prohibited_item',
      'duplicate_listing',
      'incorrect_category',
      'offensive_content',
      'requested_off_platform_payment',
      'suspicious_behaviour',
      'harassment',
      'no_show',
      'abusive_language',
      'fraud',
      'shared_contact_details',
      'impersonating_equipd',
      'suspicious_payment_request',
      'spam',
      'other'
    )
  );

-- Ensure type/status/target constraints exist (idempotent).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'reports'
      and constraint_name = 'reports_report_type_allowed'
  ) then
    alter table public.reports
      add constraint reports_report_type_allowed check (
        report_type in ('listing', 'user', 'conversation', 'message')
      );
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'reports'
      and constraint_name = 'reports_status_allowed'
  ) then
    alter table public.reports
      add constraint reports_status_allowed check (
        status in ('open', 'under_review', 'resolved', 'dismissed')
      );
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'reports'
      and constraint_name = 'reports_has_target'
  ) then
    alter table public.reports
      add constraint reports_has_target check (
        reported_user_id is not null
        or listing_id is not null
        or conversation_id is not null
        or message_id is not null
      );
  end if;
end $$;

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);

create unique index if not exists reports_one_open_listing_per_reporter_idx
  on public.reports (reporter_id, listing_id)
  where status = 'open' and listing_id is not null;

create unique index if not exists reports_one_open_user_per_reporter_idx
  on public.reports (reporter_id, reported_user_id)
  where status = 'open' and report_type = 'user' and reported_user_id is not null;

create unique index if not exists reports_one_open_conversation_per_reporter_idx
  on public.reports (reporter_id, conversation_id)
  where status = 'open' and conversation_id is not null;

create unique index if not exists reports_one_open_message_per_reporter_idx
  on public.reports (reporter_id, message_id)
  where status = 'open' and message_id is not null;

drop policy if exists "Reporters can read own reports" on public.reports;
create policy "Reporters can read own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

drop policy if exists "Admins can read all reports" on public.reports;
create policy "Admins can read all reports"
  on public.reports for select
  to authenticated
  using (public.is_admin());

-- Self-contained reporting RPCs (previously only in standalone
-- supabase/trust-safety-phase2-reporting.sql — NOT in migration history).
-- create or replace so existing production objects are updated safely.

create or replace function public.create_report(
  p_report_type text,
  p_reason text,
  p_description text default null,
  p_reported_user_id uuid default null,
  p_listing_id uuid default null,
  p_conversation_id uuid default null,
  p_message_id uuid default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_description text := nullif(trim(p_description), '');
  v_listing public.listings;
  v_conversation public.conversations;
  v_message public.messages;
  v_reported_user_id uuid := p_reported_user_id;
  v_conversation_id uuid := p_conversation_id;
  v_report public.reports;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_suspended(v_uid) then
    raise exception 'Your account is suspended and cannot submit reports.';
  end if;

  if p_report_type not in ('listing', 'user', 'conversation', 'message') then
    raise exception 'Invalid report type';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Please choose a reason';
  end if;

  if p_reason = 'other' and v_description is null then
    raise exception 'Please describe the issue when selecting Other';
  end if;

  if p_report_type = 'listing' then
    if p_reason not in (
      'suspected_fraud',
      'misleading_listing',
      'prohibited_item',
      'duplicate_listing',
      'incorrect_category',
      'offensive_content',
      'other'
    ) then
      raise exception 'Invalid reason for listing report';
    end if;

    if p_listing_id is null then
      raise exception 'Listing is required';
    end if;

    select * into v_listing from public.listings where id = p_listing_id;
    if not found then
      raise exception 'Listing not found';
    end if;
    if v_listing.seller_id = v_uid then
      raise exception 'You cannot report your own listing';
    end if;
    v_reported_user_id := v_listing.seller_id;

  elsif p_report_type = 'user' then
    if p_reason not in (
      'suspected_fraud',
      'impersonating_equipd',
      'suspicious_payment_request',
      'spam',
      'harassment',
      'requested_off_platform_payment',
      'suspicious_behaviour',
      'no_show',
      'abusive_language',
      'fraud',
      'other'
    ) then
      raise exception 'Invalid reason for user report';
    end if;

    if v_reported_user_id is null then
      raise exception 'User is required';
    end if;
    if v_reported_user_id = v_uid then
      raise exception 'You cannot report yourself';
    end if;
    if not exists (select 1 from public.profiles where id = v_reported_user_id) then
      raise exception 'User not found';
    end if;

  elsif p_report_type in ('conversation', 'message') then
    if p_reason not in (
      'suspected_fraud',
      'impersonating_equipd',
      'suspicious_payment_request',
      'requested_off_platform_payment',
      'shared_contact_details',
      'harassment',
      'spam',
      'abusive_language',
      'suspicious_behaviour',
      'other'
    ) then
      raise exception 'Invalid reason for conversation report';
    end if;

    if p_report_type = 'conversation' then
      if v_conversation_id is null then
        raise exception 'Conversation is required';
      end if;
      select * into v_conversation from public.conversations where id = v_conversation_id;
      if not found then
        raise exception 'Conversation not found';
      end if;
      if v_conversation.buyer_id <> v_uid and v_conversation.seller_id <> v_uid then
        raise exception 'You are not a participant in this conversation';
      end if;
      v_reported_user_id := case
        when v_conversation.buyer_id = v_uid then v_conversation.seller_id
        else v_conversation.buyer_id
      end;
    else
      if p_message_id is null then
        raise exception 'Message is required';
      end if;
      select * into v_message from public.messages where id = p_message_id;
      if not found then
        raise exception 'Message not found';
      end if;
      select * into v_conversation
      from public.conversations
      where id = v_message.conversation_id;
      if v_conversation.buyer_id <> v_uid and v_conversation.seller_id <> v_uid then
        raise exception 'You are not a participant in this conversation';
      end if;
      v_reported_user_id := case
        when v_conversation.buyer_id = v_uid then v_conversation.seller_id
        else v_conversation.buyer_id
      end;
      v_conversation_id := coalesce(v_conversation_id, v_message.conversation_id);
    end if;
  end if;

  if exists (
    select 1
    from public.reports r
    where r.reporter_id = v_uid
      and r.status = 'open'
      and (
        (p_listing_id is not null and r.listing_id = p_listing_id)
        or (
          p_report_type = 'user'
          and v_reported_user_id is not null
          and r.reported_user_id = v_reported_user_id
          and r.report_type = 'user'
        )
        or (v_conversation_id is not null and r.conversation_id = v_conversation_id)
        or (p_message_id is not null and r.message_id = p_message_id)
      )
  ) then
    raise exception 'You already have an open report for this item';
  end if;

  insert into public.reports (
    reporter_id,
    reported_user_id,
    listing_id,
    conversation_id,
    message_id,
    report_type,
    reason,
    description
  )
  values (
    v_uid,
    v_reported_user_id,
    p_listing_id,
    v_conversation_id,
    p_message_id,
    p_report_type,
    p_reason,
    v_description
  )
  returning * into v_report;

  return v_report;
end;
$$;

create or replace function public.has_open_report(
  p_report_type text,
  p_reported_user_id uuid default null,
  p_listing_id uuid default null,
  p_conversation_id uuid default null,
  p_message_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1
    from public.reports r
    where r.reporter_id = v_uid
      and r.status = 'open'
      and (
        (p_listing_id is not null and r.listing_id = p_listing_id)
        or (
          p_report_type = 'user'
          and p_reported_user_id is not null
          and r.reported_user_id = p_reported_user_id
          and r.report_type = 'user'
        )
        or (p_conversation_id is not null and r.conversation_id = p_conversation_id)
        or (p_message_id is not null and r.message_id = p_message_id)
      )
  );
end;
$$;

create or replace function public.admin_list_reports(
  p_status text default null
)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_display_name text,
  reported_user_id uuid,
  reported_user_display_name text,
  listing_id uuid,
  listing_title text,
  conversation_id uuid,
  message_id uuid,
  report_type text,
  reason text,
  description text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_note text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    r.id,
    r.reporter_id,
    reporter.display_name as reporter_display_name,
    r.reported_user_id,
    reported.display_name as reported_user_display_name,
    r.listing_id,
    l.title as listing_title,
    r.conversation_id,
    r.message_id,
    r.report_type,
    r.reason,
    r.description,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.reviewed_by,
    r.admin_note
  from public.reports r
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles reported on reported.id = r.reported_user_id
  left join public.listings l on l.id = r.listing_id
  where p_status is null or r.status = p_status
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_update_report_status(
  p_report_id uuid,
  p_status text,
  p_admin_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('open', 'under_review', 'resolved', 'dismissed') then
    raise exception 'Invalid status';
  end if;

  update public.reports
  set
    status = p_status,
    admin_note = nullif(trim(p_admin_note), ''),
    reviewed_at = case
      when p_status in ('resolved', 'dismissed', 'under_review') then now()
      else reviewed_at
    end,
    reviewed_by = case
      when p_status in ('resolved', 'dismissed', 'under_review') then auth.uid()
      else reviewed_by
    end
  where id = p_report_id
  returning * into v_report;

  if not found then
    raise exception 'Report not found';
  end if;

  return v_report;
end;
$$;

revoke all on function public.create_report(text, text, text, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.create_report(text, text, text, uuid, uuid, uuid, uuid)
  to authenticated;

revoke all on function public.has_open_report(text, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.has_open_report(text, uuid, uuid, uuid, uuid)
  to authenticated;

revoke all on function public.admin_list_reports(text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;

revoke all on function public.admin_update_report_status(uuid, text, text)
  from public, anon;
grant execute on function public.admin_update_report_status(uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Admin investigation helpers
-- ---------------------------------------------------------------------------

create or replace function public.admin_user_moderation_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles;
  v_email text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;

  select jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'displayName', v_profile.display_name,
    'email', v_email,
    'createdAt', v_profile.created_at,
    'updatedAt', v_profile.updated_at,
    'isAdmin', v_profile.is_admin,
    'isOfficialEquipd', v_profile.is_official_equipd,
    'isSuspended', v_profile.is_suspended,
    'suspendedAt', v_profile.suspended_at,
    'suspendedBy', v_profile.suspended_by,
    'suspensionReason', v_profile.suspension_reason,
    'listingCount', (
      select count(*)::int from public.listings l where l.seller_id = p_user_id
    ),
    'activeListingCount', (
      select count(*)::int from public.listings l
      where l.seller_id = p_user_id and l.status = 'active'
    ),
    'conversationCount', (
      select count(*)::int from public.conversations c
      where c.buyer_id = p_user_id or c.seller_id = p_user_id
    ),
    'messageCount', (
      select count(*)::int from public.messages m where m.sender_id = p_user_id
    ),
    'uniqueUsersContacted', (
      select count(*)::int from (
        select case when c.buyer_id = p_user_id then c.seller_id else c.buyer_id end as other_id
        from public.conversations c
        where c.buyer_id = p_user_id or c.seller_id = p_user_id
      ) x
    ),
    'openReportCount', (
      select count(*)::int from public.reports r
      where r.reported_user_id = p_user_id and r.status in ('open', 'under_review')
    ),
    'openSuspiciousFlagCount', (
      select count(*)::int from public.suspicious_message_flags f
      where f.user_id = p_user_id and f.status = 'open'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_user_moderation_summary(uuid) from public;
grant execute on function public.admin_user_moderation_summary(uuid) to authenticated;

create or replace function public.admin_list_users_contacted_by(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.last_contact_at desc)
      from (
        select
          other.id as contacted_user_id,
          other.username,
          other.display_name,
          au.email,
          c.id as conversation_id,
          c.created_at as first_contact_at,
          greatest(
            c.created_at,
            coalesce((
              select max(m.created_at)
              from public.messages m
              where m.conversation_id = c.id and m.sender_id = p_user_id
            ), c.created_at)
          ) as last_contact_at,
          (
            select count(*)::int
            from public.messages m
            where m.conversation_id = c.id and m.sender_id = p_user_id
          ) as messages_sent_by_user
        from public.conversations c
        join public.profiles other
          on other.id = case
            when c.buyer_id = p_user_id then c.seller_id
            else c.buyer_id
          end
        left join auth.users au on au.id = other.id
        where c.buyer_id = p_user_id or c.seller_id = p_user_id
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_users_contacted_by(uuid) from public;
grant execute on function public.admin_list_users_contacted_by(uuid) to authenticated;

create or replace function public.admin_list_suspicious_message_flags(
  p_status text default 'open',
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
      from (
        select
          f.id,
          f.message_id,
          f.user_id,
          f.conversation_id,
          f.rule_key,
          f.score,
          f.snippet,
          f.status,
          f.created_at,
          p.username,
          p.display_name
        from public.suspicious_message_flags f
        left join public.profiles p on p.id = f.user_id
        where p_status is null or f.status = p_status
        order by f.created_at desc
        limit v_limit
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_suspicious_message_flags(text, integer) from public;
grant execute on function public.admin_list_suspicious_message_flags(text, integer) to authenticated;

create or replace function public.admin_list_suspended_users(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.suspended_at desc nulls last)
      from (
        select
          p.id,
          p.username,
          p.display_name,
          u.email,
          p.suspended_at,
          p.suspended_by,
          p.suspension_reason
        from public.profiles p
        left join auth.users u on u.id = p.id
        where p.is_suspended = true
        order by p.suspended_at desc nulls last
        limit v_limit
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_suspended_users(integer) from public;
grant execute on function public.admin_list_suspended_users(integer) to authenticated;

create or replace function public.admin_list_high_volume_new_conversation_accounts(
  p_hours integer default 24,
  p_min_conversations integer default 8,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_hours integer := least(greatest(coalesce(p_hours, 24), 1), 168);
  v_min integer := least(greatest(coalesce(p_min_conversations, 8), 1), 100);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(t)::jsonb order by t.conversation_count desc)
      from (
        select
          p.id,
          p.username,
          p.display_name,
          u.email,
          u.created_at as account_created_at,
          count(*)::int as conversation_count
        from public.conversations c
        join public.profiles p on p.id = c.buyer_id
        left join auth.users u on u.id = p.id
        where c.created_at > now() - make_interval(hours => v_hours)
        group by p.id, p.username, p.display_name, u.email, u.created_at
        having count(*) >= v_min
        order by count(*) desc
        limit v_limit
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_high_volume_new_conversation_accounts(integer, integer, integer) from public;
grant execute on function public.admin_list_high_volume_new_conversation_accounts(integer, integer, integer) to authenticated;

-- Extend admin_search_users payload with suspension/official flags when function exists.
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
        'isAdmin', s.is_admin,
        'isOfficialEquipd', s.is_official_equipd,
        'isSuspended', s.is_suspended,
        'suspendedAt', s.suspended_at,
        'suspensionReason', s.suspension_reason
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
      p.is_official_equipd,
      p.is_suspended,
      p.suspended_at,
      p.suspension_reason,
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
-- 14. Profile-image Storage: require Edge Function upload (service role)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can upload profile images to own folder" on storage.objects;
drop policy if exists "Users can update own profile images" on storage.objects;

-- Keep delete for cleanup of own folder; uploads go through Edge Function.
-- Authenticated users can no longer insert/update profile-images directly.

-- ---------------------------------------------------------------------------
-- 15. Wanted requests: block suspended authenticated creators
-- ---------------------------------------------------------------------------

drop policy if exists "Users can create own wanted requests" on public.wanted_requests;
create policy "Users can create own wanted requests"
  on public.wanted_requests for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_suspended(auth.uid())
  );

drop policy if exists "Users can update own wanted requests" on public.wanted_requests;
create policy "Users can update own wanted requests"
  on public.wanted_requests for update
  to authenticated
  using (user_id = auth.uid() and not public.is_suspended(auth.uid()))
  with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));

notify pgrst, 'reload schema';
