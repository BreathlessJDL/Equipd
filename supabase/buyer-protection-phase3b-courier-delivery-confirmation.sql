-- Equipd Buyer Protection / Order Lifecycle — Phase 3B (Courier delivery confirmation)
-- Run after buyer-protection-phase3a-courier-evidence.sql
-- Safe to re-run (idempotent where possible).

-- ---------------------------------------------------------------------------
-- Courier delivery confirmation columns
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists courier_delivered_at timestamptz,
  add column if not exists courier_delivery_confirmed_by uuid references auth.users (id),
  add column if not exists courier_delivery_confirmation_checks jsonb,
  add column if not exists courier_delivery_confirmation_user_agent text;

alter table public.orders
  drop constraint if exists orders_courier_delivery_confirmation_checks_object;

alter table public.orders
  add constraint orders_courier_delivery_confirmation_checks_object
  check (
    courier_delivery_confirmation_checks is null
    or jsonb_typeof(courier_delivery_confirmation_checks) = 'object'
  );

-- ---------------------------------------------------------------------------
-- Buyer confirms courier delivery (starts 24-hour payout hold)
-- ---------------------------------------------------------------------------

create or replace function public.confirm_courier_delivery(
  p_order_id uuid,
  p_checks jsonb,
  p_user_agent text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_listing_title text;
  v_dispute_hours int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_checks is null
     or coalesce((p_checks ->> 'item_received')::boolean, false) is not true
     or coalesce((p_checks ->> 'handover_evidence_reviewed')::boolean, false) is not true
     or coalesce((p_checks ->> 'protection_window_acknowledged')::boolean, false) is not true then
    raise exception 'All delivery confirmation checks must be accepted';
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
    raise exception 'Only the buyer can confirm courier delivery';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'buyer_courier'::public.order_type then
    raise exception 'Courier delivery confirmation is only available for buyer-organised courier orders';
  end if;

  if v_order.fulfilment_status = 'delivered'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'in_transit'::public.order_fulfilment_status then
    raise exception 'Courier delivery can only be confirmed while the order is in transit';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming delivery';
  end if;

  if v_order.courier_evidence_submitted_at is null then
    raise exception 'Courier handover evidence must be submitted before confirming delivery';
  end if;

  v_dispute_hours := coalesce(v_order.dispute_window_hours, 24);

  update public.orders
  set
    fulfilment_status = 'delivered'::public.order_fulfilment_status,
    delivered_at = now(),
    courier_delivered_at = now(),
    courier_delivery_confirmed_by = v_uid,
    courier_delivery_confirmation_checks = p_checks,
    courier_delivery_confirmation_user_agent = nullif(trim(p_user_agent), ''),
    payout_release_at = now() + make_interval(hours => v_dispute_hours),
    payout_status = 'not_due'::public.payout_status,
    protection_status = coalesce(protection_status, 'active')
  where id = p_order_id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.seller_id,
    'courier_delivery_confirmed',
    'Buyer confirmed courier delivery',
    'The buyer has confirmed delivery for '
      || coalesce(v_listing_title, 'your order')
      || '. Payout is held for '
      || v_dispute_hours::text
      || ' hours.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.buyer_id,
    'courier_delivery_confirmed',
    'Delivery confirmed',
    'You confirmed delivery for '
      || coalesce(v_listing_title, 'your purchase')
      || '. Your '
      || v_dispute_hours::text
      || '-hour Buyer Protection window has started.',
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.confirm_courier_delivery(uuid, jsonb, text) from public;
grant execute on function public.confirm_courier_delivery(uuid, jsonb, text) to authenticated;

-- Prevent legacy receipt confirmation from bypassing buyer_courier lifecycle.
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

  if coalesce(v_order.order_type, 'collection'::public.order_type) = 'buyer_courier'::public.order_type then
    raise exception 'Use courier delivery confirmation for buyer-organised courier orders';
  end if;

  if v_order.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status not in (
    'paid'::public.order_fulfilment_status,
    'awaiting_collection'::public.order_fulfilment_status,
    'awaiting_courier_collection'::public.order_fulfilment_status,
    'delivered'::public.order_fulfilment_status
  ) then
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
    collected_at = coalesce(collected_at, now()),
    payout_status = case
      when v_seller_onboarded then 'ready'::public.payout_status
      else 'awaiting_seller_setup'::public.payout_status
    end,
    payout_release_at = null
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

notify pgrst, 'reload schema';
