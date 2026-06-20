-- Equipd Stripe payments Phase 3c — buyer confirmation
-- Run after stripe-payments-phase3a.sql
--
-- Adds: confirm_order_received() for buyers after payment,
-- promote_seller_orders_payout_to_ready() when seller completes Connect onboarding.
-- Does NOT release payouts, transfer funds, or mark listings sold.

-- ---------------------------------------------------------------------------
-- Buyer confirms collection / delivery
-- ---------------------------------------------------------------------------

create or replace function public.confirm_order_received(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_seller_onboarded boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer can confirm this order';
  end if;

  if v_order.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'paid'::public.order_fulfilment_status then
    raise exception 'Order cannot be confirmed from fulfilment status %', v_order.fulfilment_status;
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming receipt';
  end if;

  if not exists (
    select 1
    from public.offers o
    where o.id = v_order.offer_id
      and o.status = 'accepted'::public.offer_status
  ) then
    raise exception 'Accepted offer required before confirming receipt';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_order.listing_id
      and l.status = 'in_progress'::public.listing_status
  ) then
    raise exception 'Listing is not in progress';
  end if;

  select coalesce(p.stripe_onboarding_complete, false)
  into v_seller_onboarded
  from public.profiles p
  where p.id = v_order.seller_id;

  update public.orders
  set
    fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status,
    buyer_confirmed_at = now(),
    payout_status = case
      when v_seller_onboarded then 'ready'::public.payout_status
      else 'awaiting_seller_setup'::public.payout_status
    end
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Promote buyer-confirmed orders when seller completes Connect onboarding
-- ---------------------------------------------------------------------------

create or replace function public.promote_seller_orders_payout_to_ready(p_seller_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.orders
  set payout_status = 'ready'::public.payout_status
  where seller_id = p_seller_id
    and fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status
    and payout_status = 'awaiting_seller_setup'::public.payout_status;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend seller onboarding sync to promote confirmed-order payouts
-- ---------------------------------------------------------------------------

create or replace function public.sync_seller_stripe_onboarding(
  p_seller_id uuid,
  p_stripe_account_id text default null,
  p_onboarding_complete boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set
    stripe_account_id = coalesce(p_stripe_account_id, stripe_account_id),
    stripe_onboarding_complete = coalesce(p_onboarding_complete, stripe_onboarding_complete)
  where id = p_seller_id
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  if coalesce(v_profile.stripe_onboarding_complete, false) then
    perform public.promote_seller_payments_to_pending(p_seller_id);
    perform public.promote_seller_orders_payout_to_ready(p_seller_id);
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_seller_id;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.confirm_order_received(uuid) from public;
grant execute on function public.confirm_order_received(uuid) to authenticated;

revoke all on function public.promote_seller_orders_payout_to_ready(uuid) from public;
grant execute on function public.promote_seller_orders_payout_to_ready(uuid) to service_role;

revoke all on function public.sync_seller_stripe_onboarding(uuid, text, boolean) from public;
grant execute on function public.sync_seller_stripe_onboarding(uuid, text, boolean) to service_role;
