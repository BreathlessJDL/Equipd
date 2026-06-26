-- Equipd Fulfilment architecture — Phase 4 (seller delivery radius gating)
-- Run after fulfilment-architecture-phase1-schema.sql
-- Requires public.haversine_distance_miles (google-maps-phase5b-distance-search.sql).
--
-- Gates seller_delivery selection by buyer profile location vs listing radius.
-- Safe to re-run (idempotent).

-- ---------------------------------------------------------------------------
-- Listing seller delivery radius (structured + legacy delivery_notes fallback)
-- ---------------------------------------------------------------------------

create or replace function public.listing_seller_delivery_radius_miles(p_listing_id uuid)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_radius integer;
  v_notes text;
  v_match text[];
begin
  select l.seller_delivery_radius_miles, coalesce(l.delivery_notes, '')
  into v_radius, v_notes
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return null;
  end if;

  if v_radius is not null and v_radius > 0 then
    return v_radius;
  end if;

  v_match := regexp_match(v_notes, 'seller delivery up to ([0-9]+)\s*miles', 'i');

  if v_match is not null then
    return v_match[1]::integer;
  end if;

  return null;
end;
$$;

revoke all on function public.listing_seller_delivery_radius_miles(uuid) from public;
grant execute on function public.listing_seller_delivery_radius_miles(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_listing_order_types — honour structured seller_delivery_radius_miles
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
  v_structured_radius integer;
  v_has_buyer_courier boolean;
  v_has_seller_delivery boolean;
  v_seller_only boolean;
  v_types public.order_type[] := array[]::public.order_type[];
begin
  select
    coalesce(l.collection_available, true),
    coalesce(l.courier_available, false),
    coalesce(l.delivery_notes, ''),
    l.seller_delivery_radius_miles
  into v_collection_available, v_courier_available, v_notes, v_structured_radius
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return array['collection'::public.order_type];
  end if;

  v_notes_lower := lower(v_notes);
  v_has_buyer_courier := v_notes_lower like '%buyer can arrange%';
  v_has_seller_delivery :=
    v_notes_lower like '%seller delivery%'
    or v_notes_lower like '%seller can personally%'
    or (v_structured_radius is not null and v_structured_radius > 0);

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

-- ---------------------------------------------------------------------------
-- Buyer within seller delivery radius
-- ---------------------------------------------------------------------------

create or replace function public.buyer_can_select_seller_delivery(
  p_listing_id uuid,
  p_buyer_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_buyer record;
  v_radius integer;
  v_distance double precision;
begin
  if p_buyer_id is null then
    return false;
  end if;

  if not ('seller_delivery'::public.order_type = any(public.get_listing_order_types(p_listing_id))) then
    return false;
  end if;

  v_radius := public.listing_seller_delivery_radius_miles(p_listing_id);

  if v_radius is null or v_radius <= 0 then
    return false;
  end if;

  select l.latitude, l.longitude
  into v_listing
  from public.listings l
  where l.id = p_listing_id;

  if not found
    or v_listing.latitude is null
    or v_listing.longitude is null then
    return false;
  end if;

  select p.latitude, p.longitude
  into v_buyer
  from public.profiles p
  where p.id = p_buyer_id;

  if not found
    or v_buyer.latitude is null
    or v_buyer.longitude is null then
    return false;
  end if;

  v_distance := public.haversine_distance_miles(
    v_listing.latitude,
    v_listing.longitude,
    v_buyer.latitude,
    v_buyer.longitude
  );

  if v_distance is null then
    return false;
  end if;

  return v_distance <= v_radius;
end;
$$;

revoke all on function public.buyer_can_select_seller_delivery(uuid, uuid) from public;
grant execute on function public.buyer_can_select_seller_delivery(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- listing_allows_order_type — buyer-scoped seller_delivery check
-- ---------------------------------------------------------------------------

create or replace function public.listing_allows_order_type(
  p_listing_id uuid,
  p_order_type public.order_type,
  p_buyer_id uuid default auth.uid()
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_order_type = 'seller_delivery'::public.order_type then
      public.buyer_can_select_seller_delivery(p_listing_id, p_buyer_id)
    else
      p_order_type = any(public.get_listing_order_types(p_listing_id))
  end;
$$;

-- ---------------------------------------------------------------------------
-- set_order_fulfilment_method — clearer seller delivery failures
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

  if p_order_type = 'seller_delivery'::public.order_type then
    if not exists (
      select 1
      from public.profiles p
      where p.id = v_uid
        and p.latitude is not null
        and p.longitude is not null
    ) then
      raise exception 'Add your location before selecting seller delivery';
    end if;

    if not public.buyer_can_select_seller_delivery(v_payment.listing_id, v_uid) then
      raise exception 'Seller delivery is not available for your location';
    end if;
  elsif not public.listing_allows_order_type(v_payment.listing_id, p_order_type, v_uid) then
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

-- ---------------------------------------------------------------------------
-- attach_checkout_session — buyer-scoped validation
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

  if not public.listing_allows_order_type(v_payment.listing_id, v_order_type, v_payment.buyer_id) then
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
-- mark_payment_captured — buyer-scoped validation
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

  if not public.listing_allows_order_type(
    v_payment.listing_id,
    v_order.order_type,
    v_payment.buyer_id
  ) then
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

grant execute on function public.listing_allows_order_type(uuid, public.order_type, uuid) to authenticated, service_role;
