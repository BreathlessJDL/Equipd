-- Equipd transaction cancellation (pre-payment seller cancel)
-- Run after conversation-reads.sql (requires offers, payments, orders, notifications)
--
-- Adds cancelled offer status, cancel_accepted_offer() RPC, and buyer notification.

-- ---------------------------------------------------------------------------
-- Offer status: cancelled
-- ---------------------------------------------------------------------------

alter type public.offer_status add value if not exists 'cancelled' after 'withdrawn';

-- ---------------------------------------------------------------------------
-- Seller cancels accepted offer before buyer payment
-- ---------------------------------------------------------------------------

create or replace function public.cancel_accepted_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_payment public.payments;
  v_order public.orders;
  v_has_order boolean := false;
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
    raise exception 'Only the seller can cancel this accepted offer';
  end if;

  if v_offer.status = 'cancelled'::public.offer_status then
    return v_offer;
  end if;

  if v_offer.status <> 'accepted'::public.offer_status then
    raise exception 'Only accepted offers can be cancelled';
  end if;

  select *
  into v_payment
  from public.payments
  where offer_id = p_offer_id
  for update;

  if not found then
    raise exception 'Payment not found for this offer';
  end if;

  if v_payment.status = 'paid'::public.payment_status then
    raise exception 'This transaction has been paid. Contact support to request cancellation or open a dispute.';
  end if;

  select *
  into v_order
  from public.orders
  where offer_id = p_offer_id
  for update;

  v_has_order := found;

  if v_has_order and v_order.payout_status = 'paid'::public.payout_status then
    raise exception 'Seller payout has already been released. Contact support to request cancellation or open a dispute.';
  end if;

  update public.payments
  set status = 'cancelled'::public.payment_status
  where id = v_payment.id
    and status <> 'paid'::public.payment_status;

  if v_has_order then
    update public.orders
    set
      fulfilment_status = 'cancelled'::public.order_fulfilment_status,
      payout_status = 'cancelled'::public.payout_status
    where id = v_order.id;
  end if;

  update public.listings
  set status = 'active'::public.listing_status
  where id = v_offer.listing_id
    and status in (
      'reserved'::public.listing_status,
      'in_progress'::public.listing_status
    );

  update public.offers
  set status = 'cancelled'::public.offer_status
  where id = p_offer_id;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notify buyer when seller cancels an accepted offer
-- ---------------------------------------------------------------------------

create or replace function public.notify_offer_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_amount text;
  v_order_id uuid;
  v_direction text;
  v_party_name text;
  v_link text;
begin
  if old.status <> 'pending'::public.offer_status
    and not (
      old.status = 'accepted'::public.offer_status
      and new.status = 'cancelled'::public.offer_status
    ) then
    return new;
  end if;

  if new.status in (
    'countered'::public.offer_status,
    'withdrawn'::public.offer_status
  ) then
    return new;
  end if;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = new.listing_id;

  v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');
  v_link := '/hub?section=offers&offerId=' || new.id::text;
  v_direction := coalesce(new.direction, 'buyer_to_seller');

  if new.status = 'accepted'::public.offer_status then
    if v_direction = 'seller_to_buyer' then
      select coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.username), ''),
        'The buyer'
      )
      into v_party_name
      from public.profiles p
      where p.id = new.buyer_id;

      perform public.create_notification(
        new.seller_id,
        'counter_offer_accepted',
        'Counter-offer accepted',
        v_party_name || ' accepted your £' || v_amount || ' counter-offer on '
          || coalesce(v_listing_title, 'a listing') || '.',
        v_link
      );
    else
      perform public.create_notification(
        new.buyer_id,
        'offer_accepted',
        'Offer accepted',
        'Your £' || v_amount || ' offer on '
          || coalesce(v_listing_title, 'a listing') || ' was accepted',
        v_link
      );
    end if;
  elsif new.status = 'rejected'::public.offer_status then
    if v_direction = 'seller_to_buyer' then
      select coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.username), ''),
        'The buyer'
      )
      into v_party_name
      from public.profiles p
      where p.id = new.buyer_id;

      perform public.create_notification(
        new.seller_id,
        'counter_offer_declined',
        'Counter-offer declined',
        v_party_name || ' declined your counter-offer on '
          || coalesce(v_listing_title, 'a listing') || '.',
        v_link
      );
    else
      perform public.create_notification(
        new.buyer_id,
        'offer_declined',
        'Offer declined',
        'Your £' || v_amount || ' offer on '
          || coalesce(v_listing_title, 'a listing') || ' was declined',
        v_link
      );
    end if;
  elsif new.status = 'cancelled'::public.offer_status then
    select o.id
    into v_order_id
    from public.orders o
    where o.offer_id = new.id
    limit 1;

    perform public.create_notification(
      new.buyer_id,
      'offer_cancelled',
      'Sale cancelled',
      'The seller cancelled your accepted £' || v_amount || ' offer on '
        || coalesce(v_listing_title, 'a listing') || ' before payment',
      case
        when v_order_id is not null then '/orders/' || v_order_id::text
        else v_link
      end
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.cancel_accepted_offer(uuid) from public;
grant execute on function public.cancel_accepted_offer(uuid) to authenticated;
