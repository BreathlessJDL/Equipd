-- Offer notification improvements: counter-offers, direction-aware status changes.
-- Run in Supabase SQL Editor on existing databases.
-- Safe to re-run (CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- New offer inserted (buyer offer vs seller/buyer counter-offer)
-- ---------------------------------------------------------------------------

create or replace function public.notify_offer_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_amount text;
  v_direction text;
  v_party_name text;
  v_link text;
begin
  select l.title
  into v_listing_title
  from public.listings l
  where l.id = new.listing_id;

  v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');
  v_link := '/hub?section=offers&offerId=' || new.id::text;
  v_direction := coalesce(new.direction, 'buyer_to_seller');

  if v_direction = 'seller_to_buyer' then
    select coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      'The seller'
    )
    into v_party_name
    from public.profiles p
    where p.id = new.seller_id;

    perform public.create_notification(
      new.buyer_id,
      'counter_offer_received',
      'Counter-offer received',
      v_party_name || ' has countered your offer on '
        || coalesce(v_listing_title, 'a listing') || '.',
      v_link
    );
  elsif new.parent_offer_id is not null then
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
      'counter_offer_received',
      'Counter-offer received',
      v_party_name || ' has countered your offer on '
        || coalesce(v_listing_title, 'a listing') || '.',
      v_link
    );
  else
    perform public.create_notification(
      new.seller_id,
      'offer_received',
      'New offer',
      '£' || v_amount || ' offer on ' || coalesce(v_listing_title, 'your listing'),
      v_link
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Offer status updated (accept / decline / cancel — not countered / withdrawn)
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

  -- Countering marks the parent offer countered — not a decline.
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

notify pgrst, 'reload schema';
