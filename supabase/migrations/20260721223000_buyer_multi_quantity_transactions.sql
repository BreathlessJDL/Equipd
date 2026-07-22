-- Complete buyer-facing multi-quantity transaction flow.
-- Additive schema plus replacements of existing canonical commerce functions.
-- No backfill is required: Stage 1 already populated quantity/snapshot columns.

begin;

select pg_advisory_xact_lock(hashtext('equipd_buyer_multi_quantity_transactions'));

-- ---------------------------------------------------------------------------
-- 1. Authoritative buyer offer creation.
-- ---------------------------------------------------------------------------

create or replace function public.create_buyer_offer(
  p_listing_id uuid,
  p_conversation_id uuid,
  p_quantity integer,
  p_total_amount_pence integer,
  p_message text default null
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_conversation public.conversations;
  v_offer public.offers;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Offer quantity must be a whole number between 1 and 999';
  end if;

  if p_total_amount_pence is null or p_total_amount_pence <= 0 then
    raise exception 'Enter a valid total offer amount greater than zero';
  end if;

  if p_total_amount_pence % p_quantity <> 0 then
    raise exception 'Offer total must divide evenly by quantity in pence';
  end if;

  -- Listing-first is the canonical commerce lock order.
  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found
     or not public.listing_is_publicly_visible(v_listing) then
    raise exception 'Listing is not available';
  end if;

  if v_listing.seller_id = v_uid then
    raise exception 'You cannot make an offer on your own listing';
  end if;

  if p_quantity > v_listing.quantity_available then
    raise exception 'Insufficient inventory: requested %, available %',
      p_quantity, v_listing.quantity_available;
  end if;

  if p_total_amount_pence / p_quantity > v_listing.price_pence then
    raise exception 'Offers cannot be higher than the asking price';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found
     or v_conversation.listing_id <> v_listing.id
     or v_conversation.buyer_id <> v_uid
     or v_conversation.seller_id <> v_listing.seller_id then
    raise exception 'A valid listing conversation is required';
  end if;

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    quantity,
    status,
    direction,
    message
  )
  values (
    v_listing.id,
    v_uid,
    v_listing.seller_id,
    p_conversation_id,
    p_total_amount_pence,
    p_quantity,
    'pending'::public.offer_status,
    'buyer_to_seller',
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning * into v_offer;

  return v_offer;
end;
$$;

revoke all on function public.create_buyer_offer(uuid, uuid, integer, integer, text)
  from public, anon;
grant execute on function public.create_buyer_offer(uuid, uuid, integer, integer, text)
  to authenticated, service_role;

-- Offer quantity is fixed once a row exists. Counter rows inherit quantity
-- through set_offer_thread_quantity().
create or replace function public.guard_offer_quantity_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quantity is distinct from old.quantity then
    raise exception 'Offer quantity cannot change after submission';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_offer_quantity_immutable_trigger on public.offers;
create trigger guard_offer_quantity_immutable_trigger
before update of quantity on public.offers
for each row
execute function public.guard_offer_quantity_immutable();

-- Apply the unit-price ceiling to both buyer offers and seller/buyer counters.
create or replace function public.validate_buyer_offer_amount()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_listing_price integer;
  v_quantity integer := new.quantity;
begin
  if new.parent_offer_id is not null then
    select o.quantity
    into v_quantity
    from public.offers o
    where o.id = new.parent_offer_id;
  end if;

  select l.price_pence
  into v_listing_price
  from public.listings l
  where l.id = new.listing_id;

  if v_listing_price is null then
    raise exception 'Listing not found';
  end if;

  if v_quantity is null
     or v_quantity < 1
     or new.amount_pence <= 0
     or new.amount_pence % v_quantity <> 0 then
    raise exception 'Invalid offer quantity or indivisible total';
  end if;

  if new.amount_pence / v_quantity > v_listing_price then
    raise exception 'Offers cannot be higher than the asking price';
  end if;

  return new;
end;
$$;

create or replace function public.counter_offer(
  p_offer_id uuid,
  p_amount_pence integer
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.offers;
  v_listing public.listings;
  v_new_offer public.offers;
  v_parent_direction text;
  v_new_direction text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve then lock listing before offer: same order as acceptance.
  select listing_id
  into v_parent.listing_id
  from public.offers
  where id = p_offer_id;

  if v_parent.listing_id is null then
    raise exception 'Parent offer not found';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_parent.listing_id
  for update;

  select *
  into v_parent
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Parent offer not found';
  end if;

  if v_parent.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be countered';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'Enter a valid counter-offer amount greater than zero';
  end if;

  if p_amount_pence % v_parent.quantity <> 0 then
    raise exception 'Counter-offer total must divide evenly by the fixed quantity';
  end if;

  if p_amount_pence / v_parent.quantity > v_listing.price_pence then
    raise exception 'Counter-offers cannot be higher than the asking price';
  end if;

  v_parent_direction := coalesce(v_parent.direction, 'buyer_to_seller');
  if v_parent_direction = 'buyer_to_seller' then
    if v_parent.seller_id <> auth.uid() then
      raise exception 'Only the seller can counter this offer';
    end if;
    v_new_direction := 'seller_to_buyer';
  elsif v_parent_direction = 'seller_to_buyer' then
    if v_parent.buyer_id <> auth.uid() then
      raise exception 'Only the buyer can counter this counter-offer';
    end if;
    v_new_direction := 'buyer_to_seller';
  else
    raise exception 'Unsupported offer direction';
  end if;

  update public.offers
  set status = 'countered'::public.offer_status, updated_at = now()
  where id = v_parent.id;

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    quantity,
    status,
    direction,
    parent_offer_id
  )
  values (
    v_parent.listing_id,
    v_parent.buyer_id,
    v_parent.seller_id,
    v_parent.conversation_id,
    p_amount_pence,
    v_parent.quantity,
    'pending'::public.offer_status,
    v_new_direction,
    v_parent.id
  )
  returning * into v_new_offer;

  if v_parent.conversation_id is not null then
    insert into public.messages (
      conversation_id, sender_id, message_type, offer_id, body
    )
    values (
      v_parent.conversation_id,
      auth.uid(),
      'offer'::public.message_type,
      v_new_offer.id,
      format(
        'Counter-offer for %s %s: £%s total (£%s per item)',
        v_new_offer.quantity,
        case when v_new_offer.quantity = 1 then 'item' else 'items' end,
        to_char(v_new_offer.amount_pence / 100.0, 'FM999999990.00'),
        to_char((v_new_offer.amount_pence / v_new_offer.quantity) / 100.0, 'FM999999990.00')
      )
    );

    perform public.insert_conversation_system_message(
      v_parent.conversation_id,
      format(
        'Counter-offer sent for %s %s: £%s total (£%s per item).',
        v_new_offer.quantity,
        case when v_new_offer.quantity = 1 then 'item' else 'items' end,
        to_char(v_new_offer.amount_pence / 100.0, 'FM999999990.00'),
        to_char((v_new_offer.amount_pence / v_new_offer.quantity) / 100.0, 'FM999999990.00')
      )
    );
  end if;

  return v_new_offer;
end;
$$;

revoke all on function public.counter_offer(uuid, integer) from public, anon;
grant execute on function public.counter_offer(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Quantity-aware acceptance copy. Inventory/payment/order logic remains in
--    the existing canonical functions.
-- ---------------------------------------------------------------------------

create or replace function public.accept_offer_with_inventory(
  p_offer_id uuid,
  p_expected_direction text
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_listing public.listings;
  v_listing_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_expected_direction not in ('buyer_to_seller', 'seller_to_buyer') then
    raise exception 'Invalid offer direction';
  end if;

  select listing_id into v_listing_id
  from public.offers where id = p_offer_id;
  if v_listing_id is null then raise exception 'Offer not found'; end if;

  select * into v_listing
  from public.listings where id = v_listing_id for update;
  if not found then raise exception 'Listing not found or seller mismatch'; end if;

  select * into v_offer
  from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;

  if v_offer.listing_id <> v_listing.id then
    raise exception 'Offer listing changed during acceptance';
  end if;
  if v_offer.direction <> p_expected_direction then
    raise exception 'Offer direction does not match acceptance flow';
  end if;
  if p_expected_direction = 'buyer_to_seller' and v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can accept this offer';
  end if;
  if p_expected_direction = 'seller_to_buyer' and v_offer.buyer_id <> v_uid then
    raise exception 'Only the buyer can accept this counter-offer';
  end if;
  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be accepted';
  end if;
  if v_offer.quantity < 1
     or v_offer.amount_pence <= 0
     or v_offer.amount_pence % v_offer.quantity <> 0 then
    raise exception 'Invalid offer quantity or indivisible total';
  end if;
  if v_listing.seller_id <> v_offer.seller_id then
    raise exception 'Listing not found or seller mismatch';
  end if;
  if v_listing.status <> 'active'::public.listing_status
     or v_listing.quantity_available < v_offer.quantity then
    raise exception 'Insufficient inventory: requested %, available %',
      v_offer.quantity, coalesce(v_listing.quantity_available, 0);
  end if;

  update public.listings
  set
    quantity_available = quantity_available - v_offer.quantity,
    quantity_reserved = quantity_reserved + v_offer.quantity,
    inventory_version = inventory_version + 1,
    status = case
      when quantity_available - v_offer.quantity > 0 then 'active'::public.listing_status
      else 'reserved'::public.listing_status
    end
  where id = v_listing.id
  returning * into v_listing;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = v_offer.id;

  if v_listing.quantity_total = 1 then
    update public.offers
    set status = 'rejected'::public.offer_status
    where listing_id = v_offer.listing_id
      and id <> v_offer.id
      and status = 'pending'::public.offer_status;
  end if;

  perform public.create_payment_and_order_for_accepted_offer(
    (select o from public.offers o where o.id = v_offer.id)
  );

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      format(
        '%s accepted for %s %s: £%s total (£%s per item).',
        case
          when p_expected_direction = 'seller_to_buyer' then 'Counter-offer'
          else 'Offer'
        end,
        v_offer.quantity,
        case when v_offer.quantity = 1 then 'item' else 'items' end,
        to_char(v_offer.amount_pence / 100.0, 'FM999999990.00'),
        to_char((v_offer.amount_pence / v_offer.quantity) / 100.0, 'FM999999990.00')
      )
    );
  end if;

  select * into v_offer from public.offers where id = p_offer_id;
  return v_offer;
end;
$$;

revoke all on function public.accept_offer_with_inventory(uuid, text)
  from public, anon, authenticated, service_role;

-- Snapshot fields and quantity cannot drift after order creation.
create or replace function public.guard_order_commercial_snapshot_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quantity is distinct from old.quantity
     or new.listing_unit_price_pence is distinct from old.listing_unit_price_pence
     or new.agreed_unit_price_pence is distinct from old.agreed_unit_price_pence
     or new.item_subtotal_pence is distinct from old.item_subtotal_pence
     or new.amount_pence is distinct from old.amount_pence
     or new.item_price_pence is distinct from old.item_price_pence then
    raise exception 'Order quantity and commercial snapshots are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_order_commercial_snapshot_immutable_trigger on public.orders;
create trigger guard_order_commercial_snapshot_immutable_trigger
before update of quantity, listing_unit_price_pence, agreed_unit_price_pence,
  item_subtotal_pence, amount_pence, item_price_pence
on public.orders
for each row
execute function public.guard_order_commercial_snapshot_immutable();

-- ---------------------------------------------------------------------------
-- 3. Client-safe order view exposes authoritative quantity and snapshots.
-- ---------------------------------------------------------------------------

create or replace view public.orders_client
as
select
  o.id, o.offer_id, o.payment_id, o.listing_id, o.buyer_id, o.seller_id,
  o.amount_pence, o.platform_fee_pence, o.seller_service_fee_pence,
  o.seller_net_pence, o.fulfilment_status, o.payout_status,
  o.buyer_confirmed_at, o.payout_released_at, o.stripe_transfer_id,
  o.created_at, o.updated_at, o.order_type, o.buyer_protection_fee_pence,
  o.item_price_pence, o.buyer_total_pence, o.payout_release_at,
  o.dispute_window_hours, o.protection_status, o.collected_at, o.delivered_at,
  o.collection_confirmed_by, o.collection_confirmed_at,
  o.collection_confirmation_checks, o.collection_confirmation_ip,
  o.collection_confirmation_user_agent, o.collection_rejected_at,
  o.collection_rejection_reason, o.courier_evidence_video_url,
  o.courier_pre_collection_photo_url, o.courier_handover_photo_url,
  o.courier_name, o.courier_company, o.courier_tracking_reference,
  o.courier_buyer_tracking_reference, o.courier_evidence_notes,
  o.courier_signature_name, o.courier_signature_data, o.courier_signed_at,
  o.courier_collected_at, o.courier_evidence_submitted_at,
  o.courier_evidence_submitted_by, o.courier_delivered_at,
  o.courier_delivery_confirmed_by, o.courier_delivery_confirmation_checks,
  o.courier_delivery_confirmation_user_agent,
  o.quantity, o.listing_unit_price_pence, o.agreed_unit_price_pence,
  o.item_subtotal_pence, o.inventory_state, o.inventory_reserved_at,
  o.inventory_sold_at, o.inventory_released_at, o.inventory_restocked_at,
  o.inventory_no_restock_at
from public.orders o
where o.buyer_id = auth.uid()
   or o.seller_id = auth.uid()
   or public.is_admin();

revoke all on public.orders_client from public, anon;
grant select on public.orders_client to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Conservative refund/restock rule.
--    Partial or ambiguous monetary refunds never restock the whole quantity.
-- ---------------------------------------------------------------------------

create or replace function public.order_refund_is_explicitly_full(p_order public.orders)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      p_order.collected_at,
      p_order.delivered_at,
      p_order.courier_collected_at,
      p_order.courier_delivered_at,
      p_order.collection_confirmed_at,
      p_order.buyer_confirmed_at,
      p_order.payout_released_at
    ) is null
    and not exists (
      select 1
      from public.order_disputes d
      where d.order_id = p_order.id
        and (
          d.status = 'partial_refund_pending'
          or d.case_outcome = 'buyer_upheld_partial_refund'
          or (
            d.refund_amount_pence is not null
            and d.refund_amount_pence < p_order.buyer_total_pence
          )
        )
    )
    and not exists (
      select 1
      from public.transaction_support_requests r
      where r.order_id = p_order.id
        and (
          r.status::text = 'partial_refund_pending'
          or r.case_outcome = 'buyer_upheld_partial_refund'
          or (
            r.refund_amount_pence is not null
            and r.refund_amount_pence < p_order.buyer_total_pence
          )
        )
    )
    and exists (
      select 1
      from public.order_disputes d
      where d.order_id = p_order.id
        and (
          d.status = 'refund_pending'
          or d.case_outcome = 'buyer_upheld_full_refund'
          or d.refund_amount_pence >= p_order.buyer_total_pence
        )
      union all
      select 1
      from public.transaction_support_requests r
      where r.order_id = p_order.id
        and (
          r.status::text = 'refund_pending'
          or r.case_outcome = 'buyer_upheld_full_refund'
          or r.refund_amount_pence >= p_order.buyer_total_pence
        )
    );
$$;

create or replace function public.apply_refund_inventory_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.fulfilment_status is distinct from new.fulfilment_status
     and new.fulfilment_status = 'refunded'::public.order_fulfilment_status
     and new.inventory_state = 'sold'::public.order_inventory_state then
    if public.order_refund_is_explicitly_full(new) then
      perform public.transition_order_inventory_state(
        new.id, 'restocked'::public.order_inventory_state
      );
    else
      perform public.transition_order_inventory_state(
        new.id, 'no_restock'::public.order_inventory_state
      );
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Quantity-aware in-app notification text.
-- ---------------------------------------------------------------------------

create or replace function public.notify_offer_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_amount text := to_char(new.amount_pence / 100.0, 'FM999999990.00');
  v_direction text := coalesce(new.direction, 'buyer_to_seller');
  v_party_name text;
  v_link text;
  v_quantity_label text := new.quantity || case when new.quantity = 1 then ' item' else ' items' end;
begin
  select l.title into v_listing_title from public.listings l where l.id = new.listing_id;

  if v_direction = 'seller_to_buyer' then
    v_link := '/hub?section=offers&offerId=' || new.id::text;
    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'The seller')
      into v_party_name from public.profiles p where p.id = new.seller_id;
    perform public.create_notification(
      new.buyer_id, 'counter_offer_received', 'Counter-offer received',
      v_party_name || ' countered for ' || v_quantity_label || ': £' || v_amount
        || ' total on ' || coalesce(v_listing_title, 'a listing') || '.',
      v_link
    );
  elsif new.parent_offer_id is not null then
    v_link := '/hub?section=selling&tab=offers&offerId=' || new.id::text;
    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'The buyer')
      into v_party_name from public.profiles p where p.id = new.buyer_id;
    perform public.create_notification(
      new.seller_id, 'counter_offer_received', 'Counter-offer received',
      v_party_name || ' countered for ' || v_quantity_label || ': £' || v_amount
        || ' total on ' || coalesce(v_listing_title, 'a listing') || '.',
      v_link
    );
  else
    v_link := '/hub?section=selling&tab=offers&offerId=' || new.id::text;
    perform public.create_notification(
      new.seller_id, 'offer_received', 'New offer',
      'Offer for ' || v_quantity_label || ': £' || v_amount || ' total on '
        || coalesce(v_listing_title, 'your listing'),
      v_link
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_offer_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_amount text := to_char(new.amount_pence / 100.0, 'FM999999990.00');
  v_direction text := coalesce(new.direction, 'buyer_to_seller');
  v_party_name text;
  v_link text;
  v_quantity_label text := new.quantity || case when new.quantity = 1 then ' item' else ' items' end;
begin
  if old.status <> 'pending'::public.offer_status
     and not (old.status = 'accepted'::public.offer_status
       and new.status = 'cancelled'::public.offer_status) then
    return new;
  end if;
  if new.status in ('countered'::public.offer_status, 'withdrawn'::public.offer_status) then
    return new;
  end if;

  select l.title into v_listing_title from public.listings l where l.id = new.listing_id;

  if new.status = 'accepted'::public.offer_status then
    if v_direction = 'seller_to_buyer' then
      v_link := '/hub?section=selling&tab=offers&offerId=' || new.id::text;
      select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'The buyer')
        into v_party_name from public.profiles p where p.id = new.buyer_id;
      perform public.create_notification(
        new.seller_id, 'counter_offer_accepted', 'Counter-offer accepted',
        v_party_name || ' accepted your counter-offer for ' || v_quantity_label
          || ': £' || v_amount || ' total on ' || coalesce(v_listing_title, 'a listing') || '.',
        v_link
      );
    else
      v_link := '/hub?section=offers&offerId=' || new.id::text;
      perform public.create_notification(
        new.buyer_id, 'offer_accepted', 'Offer accepted',
        'Your offer for ' || v_quantity_label || ': £' || v_amount || ' total on '
          || coalesce(v_listing_title, 'a listing') || ' was accepted',
        v_link
      );
    end if;
  elsif new.status = 'rejected'::public.offer_status then
    if v_direction = 'seller_to_buyer' then
      v_link := '/hub?section=selling&tab=offers&offerId=' || new.id::text;
      perform public.create_notification(
        new.seller_id, 'counter_offer_declined', 'Counter-offer declined',
        'Your counter-offer for ' || v_quantity_label || ': £' || v_amount
          || ' total was declined.',
        v_link
      );
    else
      v_link := '/hub?section=offers&offerId=' || new.id::text;
      perform public.create_notification(
        new.buyer_id, 'offer_declined', 'Offer declined',
        'Your offer for ' || v_quantity_label || ': £' || v_amount
          || ' total was declined.',
        v_link
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_seller_payment_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_order_type public.order_type;
  v_order_id uuid;
  v_quantity integer;
  v_body text;
  v_link text;
  v_paid_for text;
begin
  if new.status <> 'paid'::public.payment_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'paid'::public.payment_status then
    return new;
  end if;

  select l.title, o.order_type, o.id, o.quantity
  into v_listing_title, v_order_type, v_order_id, v_quantity
  from public.listings l
  join public.orders o on o.payment_id = new.id
  where l.id = new.listing_id;

  if v_order_id is null then
    return new;
  end if;

  v_link := '/orders/' || v_order_id::text;
  v_paid_for := case
    when coalesce(v_quantity, 1) > 1 then
      format(
        '%s items from %s',
        v_quantity,
        coalesce(v_listing_title, 'your listing')
      )
    else coalesce(v_listing_title, 'your listing')
  end;

  v_body := case v_order_type
    when 'collection'::public.order_type then
      'The buyer has paid for ' || v_paid_for || '. Message them to organise collection.'
    when 'seller_delivery'::public.order_type then
      'The buyer has paid for ' || v_paid_for
        || '. Check their delivery details and message them to arrange delivery.'
    when 'buyer_courier'::public.order_type then
      'The buyer has paid for ' || v_paid_for
        || '. Prepare for courier collection and check handover evidence requirements.'
    else
      'The buyer has paid for ' || v_paid_for
        || '. Message them to organise collection, delivery, or handover.'
  end;

  perform public.create_notification(
    new.seller_id,
    'buyer_payment_received',
    case
      when coalesce(v_quantity, 1) > 1
        then format('Buyer payment received for %s items', v_quantity)
      else 'Buyer payment received'
    end,
    v_body,
    v_link
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Checkout attach must allow partial multi-quantity reservations.
--    Listing status may remain active when stock remains; authority is the
--    order inventory_state, not a global listing reserved status.
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
  v_order public.orders;
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

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Order not found for payment';
  end if;

  if v_order.inventory_state <> 'reserved'::public.order_inventory_state
     or v_order.fulfilment_status <> 'awaiting_payment'::public.order_fulfilment_status then
    raise exception 'Order reservation is not active';
  end if;

  if v_order.order_type is null then
    raise exception 'Select a fulfilment method before checkout';
  end if;

  if not public.listing_allows_order_type(
    v_payment.listing_id,
    v_order.order_type,
    v_payment.buyer_id
  ) then
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

revoke all on function public.attach_checkout_session(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.attach_checkout_session(uuid, uuid, text)
  to service_role;

-- Admin order list uses a table-returning signature, so it must be recreated
-- to add the quantity snapshots. Admin detail already serializes the full row.
drop function if exists public.admin_list_orders(text);

create function public.admin_list_orders(p_filter text default 'all')
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  buyer_id uuid,
  buyer_display_name text,
  seller_id uuid,
  seller_display_name text,
  amount_pence integer,
  quantity integer,
  agreed_unit_price_pence integer,
  item_subtotal_pence integer,
  inventory_state public.order_inventory_state,
  payment_status public.payment_status,
  fulfilment_status public.order_fulfilment_status,
  payout_status public.payout_status,
  buyer_confirmed_at timestamptz,
  seller_onboarding_complete boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_filter is not null
     and p_filter not in (
       'all', 'awaiting_payment', 'paid_in_progress', 'buyer_confirmed',
       'completed', 'payout_failed', 'cancelled'
     ) then
    raise exception 'Invalid order filter: %', p_filter;
  end if;

  return query
  select
    o.id,
    o.listing_id,
    l.title,
    o.buyer_id,
    buyer.display_name,
    o.seller_id,
    seller.display_name,
    o.amount_pence,
    o.quantity,
    o.agreed_unit_price_pence,
    o.item_subtotal_pence,
    o.inventory_state,
    p.status,
    o.fulfilment_status,
    o.payout_status,
    o.buyer_confirmed_at,
    coalesce(seller.stripe_onboarding_complete, false),
    o.created_at
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.payments p on p.id = o.payment_id
  join public.profiles buyer on buyer.id = o.buyer_id
  join public.profiles seller on seller.id = o.seller_id
  where
    p_filter is null
    or p_filter = 'all'
    or (
      p_filter = 'awaiting_payment'
      and o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
    )
    or (
      p_filter = 'paid_in_progress'
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status in (
        'paid'::public.order_fulfilment_status,
        'in_progress'::public.order_fulfilment_status
      )
    )
    or (
      p_filter = 'buyer_confirmed'
      and o.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status
    )
    or (
      p_filter = 'completed'
      and o.fulfilment_status = 'completed'::public.order_fulfilment_status
    )
    or (
      p_filter = 'payout_failed'
      and o.payout_status = 'failed'::public.payout_status
    )
    or (
      p_filter = 'cancelled'
      and (
        o.fulfilment_status = 'cancelled'::public.order_fulfilment_status
        or p.status in (
          'cancelled'::public.payment_status,
          'expired'::public.payment_status,
          'refunded'::public.payment_status
        )
      )
    )
  order by o.created_at desc;
end;
$$;

revoke all on function public.admin_list_orders(text) from public, anon;
grant execute on function public.admin_list_orders(text) to authenticated;

notify pgrst, 'reload schema';

commit;
