-- Equipd admin support tools
-- Run after transaction-support-requests.sql
--
-- Adds profiles.is_admin, admin RPCs for support request management,
-- and RLS for admin read access on transaction_support_requests.

-- ---------------------------------------------------------------------------
-- Admin flag on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

create or replace function public.prevent_profile_stripe_client_updates()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.stripe_account_id is distinct from old.stripe_account_id
      or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete then
      raise exception 'Stripe payout fields can only be updated by the server';
    end if;

    if new.is_admin is distinct from old.is_admin then
      raise exception 'Admin status can only be updated by the server';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin check helper
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin read access on support requests
-- ---------------------------------------------------------------------------

create policy "Admins can read all support requests"
  on public.transaction_support_requests for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin list support requests
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_support_requests(
  p_status public.support_request_status default null
)
returns table (
  id uuid,
  order_id uuid,
  listing_id uuid,
  listing_title text,
  buyer_id uuid,
  buyer_display_name text,
  seller_id uuid,
  seller_display_name text,
  opened_by uuid,
  opened_by_display_name text,
  reason public.support_request_reason,
  message text,
  status public.support_request_status,
  created_at timestamptz,
  updated_at timestamptz
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
    r.order_id,
    r.listing_id,
    l.title as listing_title,
    r.buyer_id,
    buyer.display_name as buyer_display_name,
    r.seller_id,
    seller.display_name as seller_display_name,
    r.opened_by,
    opener.display_name as opened_by_display_name,
    r.reason,
    r.message,
    r.status,
    r.created_at,
    r.updated_at
  from public.transaction_support_requests r
  join public.listings l on l.id = r.listing_id
  join public.profiles buyer on buyer.id = r.buyer_id
  join public.profiles seller on seller.id = r.seller_id
  join public.profiles opener on opener.id = r.opened_by
  where p_status is null or r.status = p_status
  order by r.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin update support request status
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_support_request_status(
  p_request_id uuid,
  p_status public.support_request_status
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.transaction_support_requests;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.transaction_support_requests
  set status = p_status
  where id = p_request_id
  returning * into v_request;

  if not found then
    raise exception 'Support request not found';
  end if;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.admin_list_support_requests(public.support_request_status) from public;
grant execute on function public.admin_list_support_requests(public.support_request_status) to authenticated;

revoke all on function public.admin_update_support_request_status(
  uuid,
  public.support_request_status
) from public;
grant execute on function public.admin_update_support_request_status(
  uuid,
  public.support_request_status
) to authenticated;

-- Set admin users manually in Supabase SQL editor, e.g.:
-- update public.profiles set is_admin = true where id = '<user-uuid>';
