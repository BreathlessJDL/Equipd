-- Equipd Buyer Protection — fulfilment method selection (functions + schema)
-- Run after buyer-protection-fulfilment-method-selection-a-enums.sql has committed.
--
-- Safe to re-run (idempotent where possible).
-- After this script: redeploy stripe-create-checkout.

-- Allow unset order_type while buyer chooses fulfilment method (awaiting_payment only)
alter table public.orders
  alter column order_type drop not null;

-- ---------------------------------------------------------------------------
-- Listing fulfilment options (mirrors inferDeliveryOptionsFromListing in JS)
-- ---------------------------------------------------------------------------

create or replace function public.get_listing_order_types(p_listing_id uuid)
returns public.order_type[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_collection_available boolean;
  v_courier_available boolean;
  v_notes text;
  v_notes_lower text;
  v_has_buyer_courier boolean;
  v_has_seller_delivery boolean;
  v_seller_only boolean;
  v_types public.order_type[] := array[]::public.order_type[];
begin
  select
    coalesce(l.collection_available, true),
    coalesce(l.courier_available, false),
    coalesce(l.delivery_notes, '')
  into v_collection_available, v_courier_available, v_notes
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return array['collection'::public.order_type];
  end if;

  v_notes_lower := lower(v_notes);
  v_has_buyer_courier := v_notes_lower like '%buyer can arrange%';
  v_has_seller_delivery :=
    v_notes_lower like '%seller delivery%'
    or v_notes_lower like '%seller can personally%';

  if v_has_buyer_courier then
    v_types := array_append(v_types, 'buyer_courier'::public.order_type);
  end if;

  if v_has_seller_delivery then
    v_types := array_append(v_types, 'seller_delivery'::public.order_type);
  end if;

  if v_collection_available then
    v_seller_only := v_has_seller_delivery and not v_has_buyer_courier;

    if not v_seller_only then
      v_types := array_append(v_types, 'collection'::public.order_type);
    end if;
  end if;

  if cardinality(v_types) = 0 and v_courier_available then
    v_types := array['buyer_courier'::public.order_type];
  end if;

  if cardinality(v_types) = 0 then
    v_types := array['collection'::public.order_type];
  end if;

  return (
    select coalesce(array_agg(distinct t), array['collection'::public.order_type])
    from unnest(v_types) as t
  );
end;
$$;

create or replace function public.listing_allows_order_type(
  p_listing_id uuid,
  p_order_type public.order_type
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_order_type = any(public.get_listing_order_types(p_listing_id));
$$;

create or replace function public.auto_order_type_for_listing(p_listing_id uuid)
returns public.order_type
language plpgsql
stable
set search_path = public
as $$
declare
  v_types public.order_type[];
begin
  v_types := public.get_listing_order_types(p_listing_id);

  if cardinality(v_types) = 1 then
    return v_types[1];
  end if;

  return null;
end;
$$;

create or replace function public.resolve_order_type_for_listing(p_listing_id uuid)
returns public.order_type
language sql
stable
set search_path = public
as $$
  select coalesce(
    public.auto_order_type_for_listing(p_listing_id),
    'collection'::public.order_type
  );
$$;

create or replace function public.initial_fulfilment_status_for_order_type(p_order_type public.order_type)
returns public.order_fulfilment_status
language sql
immutable
as $$
  select case
    when p_order_type = 'buyer_courier'::public.order_type
      then 'awaiting_courier_collection'::public.order_fulfilment_status
    when p_order_type = 'seller_delivery'::public.order_type
      then 'awaiting_seller_delivery'::public.order_fulfilment_status
    else 'awaiting_collection'::public.order_fulfilment_status
  end;
$$;

-- ---------------------------------------------------------------------------
-- Shared payment + order creation for accepted offers
-- ---------------------------------------------------------------------------

create or replace function public.create_payment_and_order_for_accepted_offer(p_offer public.offers)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_price_pence int;
  v_protection_fee_pence int;
  v_buyer_total_pence int;
  v_order_type public.order_type;
  v_payment_id uuid;
begin
  v_item_price_pence := p_offer.amount_pence;
  v_protection_fee_pence := public.calculate_buyer_protection_fee(v_item_price_pence);
  v_buyer_total_pence := v_item_price_pence + v_protection_fee_pence;
  v_order_type := public.auto_order_type_for_listing(p_offer.listing_id);

  insert into public.payments (
    offer_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    buyer_protection_fee_pence,
    buyer_total_pence,
    platform_fee_pence,
    seller_net_pence,
    status,
    expires_at
  )
  values (
    p_offer.id,
    p_offer.listing_id,
    p_offer.buyer_id,
    p_offer.seller_id,
    v_item_price_pence,
    v_protection_fee_pence,
    v_buyer_total_pence,
    v_protection_fee_pence,
    v_item_price_pence,
    'pending'::public.payment_status,
    now() + interval '3 days'
  )
  returning id into v_payment_id;

  insert into public.orders (
    offer_id,
    payment_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    item_price_pence,
    buyer_protection_fee_pence,
    buyer_total_pence,
    platform_fee_pence,
    seller_net_pence,
    order_type,
    fulfilment_status,
    payout_status,
    dispute_window_hours,
    protection_status
  )
  values (
    p_offer.id,
    v_payment_id,
    p_offer.listing_id,
    p_offer.buyer_id,
    p_offer.seller_id,
    v_item_price_pence,
    v_item_price_pence,
    v_protection_fee_pence,
    v_buyer_total_pence,
    v_protection_fee_pence,
    v_item_price_pence,
    v_order_type,
    'awaiting_payment'::public.order_fulfilment_status,
    'not_due'::public.payout_status,
    24,
    'active'
  );

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer selects fulfilment method before checkout (multi-option listings)
-- ---------------------------------------------------------------------------

create or replace function public.set_order_fulfilment_method(
  p_payment_id uuid,
  p_order_type public.order_type
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_order_type is null then
    raise exception 'Fulfilment method is required';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.buyer_id <> v_uid then
    raise exception 'Only the buyer can choose fulfilment method for this payment';
  end if;

  if v_payment.status <> 'pending'::public.payment_status then
    raise exception 'Fulfilment method can only be set while payment is pending';
  end if;

  if v_payment.expires_at <= now() then
    raise exception 'Payment window has expired';
  end if;

  if not public.listing_allows_order_type(v_payment.listing_id, p_order_type) then
    raise exception 'Selected fulfilment method is not available for this listing';
  end if;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Order not found for payment';
  end if;

  if v_order.fulfilment_status <> 'awaiting_payment'::public.order_fulfilment_status then
    raise exception 'Fulfilment method cannot be changed after payment has started';
  end if;

  update public.orders
  set order_type = p_order_type
  where id = v_order.id;

  select *
  into v_order
  from public.orders
  where id = v_order.id;

  return v_order;
end;
$$;

revoke all on function public.set_order_fulfilment_method(uuid, public.order_type) from public;
grant execute on function public.set_order_fulfilment_method(uuid, public.order_type) to authenticated;

-- ---------------------------------------------------------------------------
-- Checkout requires fulfilment method when multiple options exist
-- ---------------------------------------------------------------------------

create or replace function public.attach_checkout_session(
  p_payment_id uuid,
  p_buyer_id uuid,
  p_stripe_checkout_session_id text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order_type public.order_type;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.buyer_id <> p_buyer_id then
    raise exception 'Only the buyer can start checkout for this payment';
  end if;

  if v_payment.status <> 'pending'::public.payment_status then
    raise exception 'Checkout is only available for pending payments';
  end if;

  if v_payment.expires_at <= now() then
    raise exception 'Payment window has expired';
  end if;

  if not exists (
    select 1
    from public.offers o
    where o.id = v_payment.offer_id
      and o.status = 'accepted'::public.offer_status
  ) then
    raise exception 'Accepted offer required before checkout';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_payment.listing_id
      and l.status = 'reserved'::public.listing_status
  ) then
    raise exception 'Listing is not reserved for payment';
  end if;

  select o.order_type
  into v_order_type
  from public.orders o
  where o.payment_id = p_payment_id;

  if v_order_type is null then
    raise exception 'Select a fulfilment method before checkout';
  end if;

  if not public.listing_allows_order_type(v_payment.listing_id, v_order_type) then
    raise exception 'Selected fulfilment method is not available for this listing';
  end if;

  update public.payments
  set stripe_checkout_session_id = p_stripe_checkout_session_id
  where id = p_payment_id;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment captured: require order_type, set lifecycle by type
-- ---------------------------------------------------------------------------

create or replace function public.mark_payment_captured(
  p_payment_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_next_fulfilment public.order_fulfilment_status;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status = 'paid'::public.payment_status then
    return v_payment;
  end if;

  if v_payment.status not in ('pending'::public.payment_status) then
    raise exception 'Payment cannot be captured from status %', v_payment.status;
  end if;

  if not exists (
    select 1
    from public.offers o
    where o.id = v_payment.offer_id
      and o.status = 'accepted'::public.offer_status
  ) then
    raise exception 'Accepted offer required before payment can be captured';
  end if;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Order not found for payment';
  end if;

  if v_order.order_type is null then
    raise exception 'Order fulfilment method must be selected before payment capture';
  end if;

  if not public.listing_allows_order_type(v_payment.listing_id, v_order.order_type) then
    raise exception 'Order fulfilment method is not allowed for this listing';
  end if;

  update public.payments
  set
    status = 'paid'::public.payment_status,
    stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
    paid_at = now()
  where id = p_payment_id;

  v_next_fulfilment := public.initial_fulfilment_status_for_order_type(v_order.order_type);

  update public.orders
  set
    fulfilment_status = v_next_fulfilment,
    payout_status = 'not_due'::public.payout_status,
    payout_release_at = null,
    protection_status = coalesce(protection_status, 'active')
  where id = v_order.id
    and fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status;

  update public.listings
  set status = 'in_progress'::public.listing_status
  where id = v_payment.listing_id
    and status = 'reserved'::public.listing_status;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seller delivery: seller marks item delivered (starts Buyer Protection window)
-- ---------------------------------------------------------------------------

create or replace function public.confirm_seller_delivery(p_order_id uuid)
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

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.seller_id <> v_uid then
    raise exception 'Only the seller can confirm seller delivery';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'seller_delivery'::public.order_type then
    raise exception 'Seller delivery confirmation is only available for seller delivery orders';
  end if;

  if v_order.fulfilment_status = 'delivered'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'awaiting_seller_delivery'::public.order_fulfilment_status then
    raise exception 'Seller delivery can only be confirmed from awaiting seller delivery';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming seller delivery';
  end if;

  v_dispute_hours := coalesce(v_order.dispute_window_hours, 24);

  update public.orders
  set
    fulfilment_status = 'delivered'::public.order_fulfilment_status,
    delivered_at = now(),
    payout_release_at = now() + make_interval(hours => v_dispute_hours),
    payout_status = 'not_due'::public.payout_status,
    protection_status = coalesce(protection_status, 'active')
  where id = p_order_id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.buyer_id,
    'seller_delivery_confirmed',
    'Seller marked item as delivered',
    'The seller has marked '
      || coalesce(v_listing_title, 'your purchase')
      || ' as delivered. Your '
      || v_dispute_hours::text
      || '-hour Buyer Protection window has started.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.seller_id,
    'seller_delivery_confirmed',
    'Delivery marked as complete',
    'You marked '
      || coalesce(v_listing_title, 'this order')
      || ' as delivered. Payout is held for '
      || v_dispute_hours::text
      || ' hours.',
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.confirm_seller_delivery(uuid) from public;
grant execute on function public.confirm_seller_delivery(uuid) to authenticated;

grant execute on function public.get_listing_order_types(uuid) to authenticated;
grant execute on function public.get_listing_order_types(uuid) to service_role;
