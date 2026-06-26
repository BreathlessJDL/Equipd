-- Seller notification when buyer payment is captured.
-- Run after notifications.sql and stripe-payments-phase3a.sql (or latest mark_payment_captured).
-- Idempotent: trigger only fires on transition to paid; mark_payment_captured returns early if already paid.

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
  v_body text;
  v_link text;
begin
  if new.status <> 'paid'::public.payment_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'paid'::public.payment_status then
    return new;
  end if;

  select
    l.title,
    o.order_type,
    o.id
  into
    v_listing_title,
    v_order_type,
    v_order_id
  from public.listings l
  join public.orders o on o.payment_id = new.id
  where l.id = new.listing_id;

  if v_order_id is null then
    return new;
  end if;

  v_link := '/orders/' || v_order_id::text;

  v_body := case v_order_type
    when 'collection'::public.order_type then
      'The buyer has paid for '
        || coalesce(v_listing_title, 'your listing')
        || '. Message them to organise collection.'
    when 'seller_delivery'::public.order_type then
      'The buyer has paid for '
        || coalesce(v_listing_title, 'your listing')
        || '. Check their delivery details and message them to arrange delivery.'
    when 'buyer_courier'::public.order_type then
      'The buyer has paid for '
        || coalesce(v_listing_title, 'your listing')
        || '. Prepare for courier collection and check handover evidence requirements.'
    else
      'The buyer has paid for '
        || coalesce(v_listing_title, 'your listing')
        || '. Message them to organise collection, delivery, or handover.'
  end;

  perform public.create_notification(
    new.seller_id,
    'buyer_payment_received',
    'Buyer payment received',
    v_body,
    v_link
  );

  return new;
end;
$$;

drop trigger if exists payments_notify_seller_paid on public.payments;

create trigger payments_notify_seller_paid
  after insert or update of status on public.payments
  for each row
  execute function public.notify_seller_payment_received();
