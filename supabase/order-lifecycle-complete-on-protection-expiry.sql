-- Order lifecycle: mark transaction complete when Buyer Protection expires
-- Run after dev-end-buyer-protection-bypass.sql (step 51)
--
-- Marketplace completion (reviews, sold listing) happens when Buyer Protection ends
-- with no dispute. Stripe seller payout remains a separate financial step.

-- ---------------------------------------------------------------------------
-- Complete order when Buyer Protection window ends
-- ---------------------------------------------------------------------------

create or replace function public.promote_order_after_buyer_protection_window(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_seller_onboarded boolean;
  v_new_payout_status public.payout_status;
  v_completed_at timestamptz;
begin
  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.fulfilment_status not in (
    'collected'::public.order_fulfilment_status,
    'delivered'::public.order_fulfilment_status
  ) then
    raise exception 'Order fulfilment status must be collected or delivered';
  end if;

  if v_order.payout_release_at is null or v_order.payout_release_at > now() then
    raise exception 'Buyer Protection window has not ended yet';
  end if;

  if v_order.payout_status <> 'not_due'::public.payout_status then
    raise exception 'Payout status must be not_due';
  end if;

  if v_order.payout_released_at is not null then
    raise exception 'Payout has already been released';
  end if;

  if v_order.stripe_transfer_id is not null then
    raise exception 'Payout transfer already recorded for this order';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
      and p.stripe_charge_id is not null
  ) then
    raise exception 'Paid charge required before payout can be promoted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_order.listing_id
      and l.status = 'in_progress'::public.listing_status
  ) then
    raise exception 'Listing must be in progress before payout can be promoted';
  end if;

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = v_order.id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'Order has an open dispute';
  end if;

  select
    coalesce(pr.stripe_onboarding_complete, false)
    and pr.stripe_account_id is not null
  into v_seller_onboarded
  from public.profiles pr
  where pr.id = v_order.seller_id;

  v_new_payout_status := case
    when v_seller_onboarded then 'ready'::public.payout_status
    else 'awaiting_seller_setup'::public.payout_status
  end;

  v_completed_at := coalesce(
    v_order.buyer_confirmed_at,
    v_order.delivered_at,
    v_order.collected_at,
    now()
  );

  update public.orders o
  set
    fulfilment_status = 'completed'::public.order_fulfilment_status,
    buyer_confirmed_at = v_completed_at,
    protection_status = 'released',
    payout_status = v_new_payout_status
  where o.id = v_order.id;

  update public.listings l
  set status = 'sold'::public.listing_status
  where l.id = v_order.listing_id
    and l.status = 'in_progress'::public.listing_status;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payout release RPCs — allow completed orders (payout pending after completion)
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_payout_processing(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payout_status = 'paid'::public.payout_status then
    return v_order;
  end if;

  if v_order.payout_status = 'processing'::public.payout_status
    and v_order.stripe_transfer_id is null then
    return v_order;
  end if;

  if v_order.fulfilment_status not in (
    'buyer_confirmed'::public.order_fulfilment_status,
    'completed'::public.order_fulfilment_status
  ) then
    raise exception 'Order must be complete before payout can be released';
  end if;

  if v_order.payout_status not in (
    'ready'::public.payout_status,
    'failed'::public.payout_status
  ) then
    raise exception 'Payout cannot be released from status %', v_order.payout_status;
  end if;

  if v_order.stripe_transfer_id is not null then
    raise exception 'Payout transfer already recorded for this order';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
      and p.stripe_charge_id is not null
  ) then
    raise exception 'Paid charge required before payout can be released';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_order.listing_id
      and l.status in (
        'in_progress'::public.listing_status,
        'sold'::public.listing_status
      )
  ) then
    raise exception 'Listing must be sold or in progress before payout can be released';
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = v_order.seller_id
      and pr.stripe_account_id is not null
      and coalesce(pr.stripe_onboarding_complete, false)
  ) then
    raise exception 'Seller payout setup is not complete';
  end if;

  update public.orders
  set payout_status = 'processing'::public.payout_status
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

create or replace function public.mark_order_payout_released(
  p_order_id uuid,
  p_stripe_transfer_id text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if p_stripe_transfer_id is null or btrim(p_stripe_transfer_id) = '' then
    raise exception 'Stripe transfer id is required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payout_status = 'paid'::public.payout_status
    and v_order.stripe_transfer_id = p_stripe_transfer_id then
    return v_order;
  end if;

  if v_order.payout_status <> 'processing'::public.payout_status then
    raise exception 'Payout cannot be marked released from status %', v_order.payout_status;
  end if;

  update public.orders
  set
    payout_status = 'paid'::public.payout_status,
    payout_released_at = now(),
    stripe_transfer_id = p_stripe_transfer_id,
    fulfilment_status = case
      when fulfilment_status = 'completed'::public.order_fulfilment_status
        then fulfilment_status
      else 'completed'::public.order_fulfilment_status
    end
  where id = p_order_id;

  update public.listings
  set status = 'sold'::public.listing_status
  where id = v_order.listing_id
    and status = 'in_progress'::public.listing_status;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seller Connect onboarding promotion — include completed orders awaiting payout
-- ---------------------------------------------------------------------------

create or replace function public.promote_seller_orders_payout_to_ready(p_seller_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_promoted int;
begin
  update public.orders
  set payout_status = 'ready'::public.payout_status
  where seller_id = p_seller_id
    and fulfilment_status in (
      'buyer_confirmed'::public.order_fulfilment_status,
      'completed'::public.order_fulfilment_status
    )
    and payout_status = 'awaiting_seller_setup'::public.payout_status;

  get diagnostics v_promoted = row_count;
  v_count := v_count + v_promoted;

  perform public.release_due_order_payouts();

  update public.orders
  set payout_status = 'ready'::public.payout_status
  where seller_id = p_seller_id
    and fulfilment_status in (
      'buyer_confirmed'::public.order_fulfilment_status,
      'completed'::public.order_fulfilment_status
    )
    and payout_status = 'awaiting_seller_setup'::public.payout_status;

  get diagnostics v_promoted = row_count;
  v_count := v_count + v_promoted;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dev bypass — promotion only (same as production cron)
-- ---------------------------------------------------------------------------

create or replace function public.dev_end_buyer_protection_now(
  p_order_id uuid,
  p_user_agent text default null,
  p_checks jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_dev_bypass_enabled boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select coalesce(nullif(trim(value), ''), '') = 'true'
  into v_dev_bypass_enabled
  from public.app_config
  where key = 'dev_handover_bypass_enabled';

  if public.is_admin() then
    null;
  elsif v_dev_bypass_enabled and v_uid = v_order.buyer_id then
    null;
  else
    raise exception 'Not authorized for test Buyer Protection bypass';
  end if;

  if v_order.protection_status is distinct from 'active' then
    raise exception 'Buyer Protection is not active on this order';
  end if;

  if v_order.fulfilment_status <> 'collected'::public.order_fulfilment_status then
    raise exception 'Order fulfilment status must be collected';
  end if;

  if v_order.payout_status <> 'not_due'::public.payout_status then
    raise exception 'Payout status must be not_due';
  end if;

  if v_order.payout_release_at is null then
    raise exception 'Buyer Protection window is not scheduled';
  end if;

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = v_order.id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'Order has an open dispute';
  end if;

  update public.orders o
  set payout_release_at = now()
  where o.id = p_order_id
    and o.payout_release_at > now();

  return public.promote_order_after_buyer_protection_window(p_order_id);
end;
$$;

drop function if exists public.dev_simulate_order_payout_release_for_testing(uuid);

-- Backfill orders promoted under the old buyer_confirmed lifecycle
update public.orders o
set fulfilment_status = 'completed'::public.order_fulfilment_status
where o.protection_status = 'released'
  and o.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status
  and o.payout_status in (
    'ready'::public.payout_status,
    'awaiting_seller_setup'::public.payout_status,
    'processing'::public.payout_status,
    'failed'::public.payout_status
  );

update public.listings l
set status = 'sold'::public.listing_status
from public.orders o
where o.listing_id = l.id
  and o.fulfilment_status = 'completed'::public.order_fulfilment_status
  and l.status = 'in_progress'::public.listing_status;

notify pgrst, 'reload schema';
