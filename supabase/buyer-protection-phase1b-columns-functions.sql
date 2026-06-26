-- Equipd Buyer Protection / Order Lifecycle — Phase 1b (columns + functions)
-- Run after buyer-protection-phase1a-enums.sql has been committed successfully.
-- Requires stripe-payments-phase3a.sql and offer-messaging-flow.sql
--
-- Safe to re-run (idempotent where possible).

-- ---------------------------------------------------------------------------
-- payments: buyer protection fee columns
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists buyer_protection_fee_pence int not null default 0,
  add column if not exists buyer_total_pence int;

alter table public.payments
  drop constraint if exists payments_buyer_protection_fee_non_negative;

alter table public.payments
  add constraint payments_buyer_protection_fee_non_negative
  check (buyer_protection_fee_pence >= 0);

alter table public.payments
  drop constraint if exists payments_fee_not_greater_than_amount;

alter table public.payments
  drop constraint if exists payments_buyer_total_valid;

alter table public.payments
  add constraint payments_buyer_total_valid
  check (
    buyer_total_pence is null
    or buyer_total_pence = amount_pence + buyer_protection_fee_pence
  );

update public.payments
set
  buyer_protection_fee_pence = coalesce(platform_fee_pence, 0),
  buyer_total_pence = amount_pence + coalesce(platform_fee_pence, 0)
where buyer_total_pence is null;

alter table public.payments
  alter column buyer_total_pence set not null;

-- Legacy rows: seller receives full item price (amount_pence)
update public.payments
set seller_net_pence = amount_pence
where seller_net_pence is distinct from amount_pence
  and buyer_protection_fee_pence = 0;

-- ---------------------------------------------------------------------------
-- orders: buyer protection + lifecycle columns
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists order_type public.order_type,
  add column if not exists buyer_protection_fee_pence int not null default 0,
  add column if not exists item_price_pence int,
  add column if not exists buyer_total_pence int,
  add column if not exists payout_release_at timestamptz,
  add column if not exists dispute_window_hours int not null default 24,
  add column if not exists protection_status text,
  add column if not exists collected_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.orders
  drop constraint if exists orders_buyer_protection_fee_non_negative;

alter table public.orders
  add constraint orders_buyer_protection_fee_non_negative
  check (buyer_protection_fee_pence >= 0);

alter table public.orders
  drop constraint if exists orders_fee_not_greater_than_amount;

alter table public.orders
  drop constraint if exists orders_buyer_total_valid;

alter table public.orders
  add constraint orders_buyer_total_valid
  check (
    buyer_total_pence is null
    or buyer_total_pence = coalesce(item_price_pence, amount_pence) + buyer_protection_fee_pence
  );

alter table public.orders
  drop constraint if exists orders_dispute_window_hours_positive;

alter table public.orders
  add constraint orders_dispute_window_hours_positive
  check (dispute_window_hours > 0);

alter table public.orders
  drop constraint if exists orders_protection_status_valid;

alter table public.orders
  add constraint orders_protection_status_valid
  check (
    protection_status is null
    or protection_status in ('active', 'dispute_open', 'released', 'refunded', 'cancelled')
  );

update public.orders o
set
  item_price_pence = coalesce(o.item_price_pence, o.amount_pence),
  buyer_protection_fee_pence = coalesce(o.buyer_protection_fee_pence, o.platform_fee_pence, 0),
  buyer_total_pence = coalesce(
    o.buyer_total_pence,
    o.amount_pence + coalesce(o.platform_fee_pence, 0)
  ),
  order_type = coalesce(o.order_type, 'collection'::public.order_type),
  seller_net_pence = o.amount_pence
where o.item_price_pence is null
   or o.buyer_total_pence is null
   or o.order_type is null;

alter table public.orders
  alter column item_price_pence set not null;

alter table public.orders
  alter column buyer_total_pence set not null;

alter table public.orders
  alter column order_type set default 'collection'::public.order_type;

update public.orders
set order_type = 'collection'::public.order_type
where order_type is null;

alter table public.orders
  alter column order_type set not null;

-- ---------------------------------------------------------------------------
-- Fee calculation (5%, min £5, max £250)
-- ---------------------------------------------------------------------------

create or replace function public.calculate_buyer_protection_fee(p_item_price_pence int)
returns int
language plpgsql
immutable
as $$
declare
  v_fee int;
begin
  if p_item_price_pence is null or p_item_price_pence <= 0 then
    return 0;
  end if;

  v_fee := round(p_item_price_pence * 0.05);

  if v_fee < 500 then
    return 500;
  end if;

  if v_fee > 25000 then
    return 25000;
  end if;

  return v_fee;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve order type from listing delivery options (defaults to collection)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_order_type_for_listing(p_listing_id uuid)
returns public.order_type
language plpgsql
stable
set search_path = public
as $$
declare
  v_collection_available boolean;
  v_courier_available boolean;
begin
  select
    coalesce(l.collection_available, true),
    coalesce(l.courier_available, false)
  into v_collection_available, v_courier_available
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return 'collection'::public.order_type;
  end if;

  if v_courier_available and not v_collection_available then
    return 'buyer_courier'::public.order_type;
  end if;

  return 'collection'::public.order_type;
end;
$$;

create or replace function public.initial_fulfilment_status_for_order_type(p_order_type public.order_type)
returns public.order_fulfilment_status
language sql
immutable
as $$
  select case
    when p_order_type = 'buyer_courier'::public.order_type
      then 'awaiting_courier_collection'::public.order_fulfilment_status
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
  v_order_type := public.resolve_order_type_for_listing(p_offer.listing_id);

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

revoke all on function public.create_payment_and_order_for_accepted_offer(public.offers) from public;

-- ---------------------------------------------------------------------------
-- Payment captured: held funds, lifecycle status by order type (no payout)
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

  update public.payments
  set
    status = 'paid'::public.payment_status,
    stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
    paid_at = now()
  where id = p_payment_id;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if found then
    v_next_fulfilment := public.initial_fulfilment_status_for_order_type(
      coalesce(v_order.order_type, 'collection'::public.order_type)
    );

    update public.orders
    set
      fulfilment_status = v_next_fulfilment,
      payout_status = 'not_due'::public.payout_status,
      payout_release_at = null,
      protection_status = coalesce(protection_status, 'active')
    where id = v_order.id
      and fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status;
  end if;

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

-- Legacy path: align with held-funds capture (no immediate payout / sold)
create or replace function public.mark_payment_paid(
  p_payment_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.mark_payment_captured(
    p_payment_id,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer confirmation: accept new lifecycle statuses (legacy paid still works)
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

-- ---------------------------------------------------------------------------
-- accept_offer / accept_counter_offer: use buyer protection fee model
-- ---------------------------------------------------------------------------

create or replace function public.accept_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can accept this offer';
  end if;

  if coalesce(v_offer.direction, 'buyer_to_seller') <> 'buyer_to_seller' then
    raise exception 'Only buyer offers can be accepted by the seller';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be accepted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_offer.listing_id
      and l.seller_id = v_uid
      and l.status = 'active'::public.listing_status
    for update
  ) then
    raise exception 'Listing is not available for acceptance';
  end if;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = p_offer_id;

  update public.offers
  set status = 'rejected'::public.offer_status
  where listing_id = v_offer.listing_id
    and id <> p_offer_id
    and status = 'pending'::public.offer_status;

  update public.listings
  set status = 'reserved'::public.listing_status
  where id = v_offer.listing_id;

  perform public.create_payment_and_order_for_accepted_offer(v_offer);

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      'Offer accepted.'
    );
  end if;

  return v_offer;
end;
$$;

create or replace function public.accept_counter_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can accept this counter-offer';
  end if;

  if v_offer.direction <> 'seller_to_buyer' then
    raise exception 'This is not a seller counter-offer';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending counter-offers can be accepted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_offer.listing_id
      and l.status = 'active'::public.listing_status
    for update
  ) then
    raise exception 'Listing is not available for acceptance';
  end if;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = p_offer_id;

  update public.offers
  set status = 'rejected'::public.offer_status
  where listing_id = v_offer.listing_id
    and id <> p_offer_id
    and status = 'pending'::public.offer_status;

  update public.listings
  set status = 'reserved'::public.listing_status
  where id = v_offer.listing_id;

  perform public.create_payment_and_order_for_accepted_offer(v_offer);

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      'Counter-offer accepted.'
    );
  end if;

  return v_offer;
end;
$$;

grant execute on function public.calculate_buyer_protection_fee(int) to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.accept_counter_offer(uuid) to authenticated;

notify pgrst, 'reload schema';
