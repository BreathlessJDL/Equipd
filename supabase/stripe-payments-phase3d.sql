-- Equipd Stripe payments Phase 3d — seller payout release
-- Run after stripe-payments-phase3c.sql
--
-- Adds: payout release RPCs (processing / released / failed).
-- Does NOT schedule jobs — release is invoked immediately from Edge Functions.

-- ---------------------------------------------------------------------------
-- Lock order for payout release (ready or failed → processing)
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

-- ---------------------------------------------------------------------------
-- Finalise payout after successful Stripe transfer
-- ---------------------------------------------------------------------------

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
-- Mark payout release failure (processing → failed)
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_payout_failed(p_order_id uuid)
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

  if v_order.payout_status = 'failed'::public.payout_status then
    return v_order;
  end if;

  if v_order.payout_status = 'paid'::public.payout_status then
    return v_order;
  end if;

  if v_order.payout_status <> 'processing'::public.payout_status then
    raise exception 'Payout cannot be marked failed from status %', v_order.payout_status;
  end if;

  update public.orders
  set payout_status = 'failed'::public.payout_status
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Revert a stuck processing lock back to ready (no transfer created)
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_payout_ready(p_order_id uuid)
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

  if v_order.payout_status = 'ready'::public.payout_status then
    return v_order;
  end if;

  if v_order.payout_status not in (
    'processing'::public.payout_status,
    'failed'::public.payout_status
  ) then
    raise exception 'Payout cannot be reset to ready from status %', v_order.payout_status;
  end if;

  if v_order.stripe_transfer_id is not null then
    raise exception 'Payout transfer already recorded for this order';
  end if;

  update public.orders
  set payout_status = 'ready'::public.payout_status
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.mark_order_payout_processing(uuid) from public;
grant execute on function public.mark_order_payout_processing(uuid) to service_role;

revoke all on function public.mark_order_payout_released(uuid, text) from public;
grant execute on function public.mark_order_payout_released(uuid, text) to service_role;

revoke all on function public.mark_order_payout_failed(uuid) from public;
grant execute on function public.mark_order_payout_failed(uuid) to service_role;

revoke all on function public.mark_order_payout_ready(uuid) from public;
grant execute on function public.mark_order_payout_ready(uuid) to service_role;
