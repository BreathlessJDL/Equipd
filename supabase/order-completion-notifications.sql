-- Review reminder (buyer) and payout complete (seller) notifications.
-- Run after notifications.sql, order-lifecycle-complete-on-protection-expiry.sql, and reviews-phase1.sql.
--
-- Buyer reminder: when fulfilment_status becomes completed and Buyer Protection has ended.
-- Seller notification: when payout_status becomes paid (Stripe transfer released).
-- Idempotent: safe to call helper functions repeatedly (cron / webhook re-runs).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.order_notification_link(p_order_id uuid)
returns text
language sql
immutable
as $$
  select '/orders/' || p_order_id::text;
$$;

create or replace function public.notification_exists_for_order(
  p_user_id uuid,
  p_type text,
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = p_type
      and n.link_url = public.order_notification_link(p_order_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Buyer review reminder
-- ---------------------------------------------------------------------------

create or replace function public.send_buyer_review_reminder_if_eligible(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_link text;
begin
  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return false;
  end if;

  if v_order.fulfilment_status <> 'completed'::public.order_fulfilment_status then
    return false;
  end if;

  if v_order.protection_status is distinct from 'released' then
    return false;
  end if;

  if v_order.buyer_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.reviews r
    where r.order_id = v_order.id
      and r.reviewer_user_id = v_order.buyer_id
  ) then
    return false;
  end if;

  v_link := public.order_notification_link(v_order.id);

  if public.notification_exists_for_order(
    v_order.buyer_id,
    'buyer_review_reminder',
    v_order.id
  ) then
    return false;
  end if;

  perform public.create_notification(
    v_order.buyer_id,
    'buyer_review_reminder',
    'Leave a review',
    'Your order is complete — leave a review for the seller.',
    v_link
  );

  return true;
end;
$$;

revoke all on function public.send_buyer_review_reminder_if_eligible(uuid) from public;
grant execute on function public.send_buyer_review_reminder_if_eligible(uuid) to service_role;

create or replace function public.notify_buyer_review_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fulfilment_status = 'completed'::public.order_fulfilment_status
    and old.fulfilment_status is distinct from 'completed'::public.order_fulfilment_status then
    perform public.send_buyer_review_reminder_if_eligible(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_notify_buyer_review_reminder on public.orders;

create trigger orders_notify_buyer_review_reminder
  after update of fulfilment_status on public.orders
  for each row
  execute function public.notify_buyer_review_reminder();

-- ---------------------------------------------------------------------------
-- Seller payout / order complete
-- ---------------------------------------------------------------------------

create or replace function public.send_seller_payout_complete_notification_if_eligible(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_link text;
begin
  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return false;
  end if;

  if v_order.payout_status <> 'paid'::public.payout_status then
    return false;
  end if;

  if v_order.seller_id is null then
    return false;
  end if;

  v_link := public.order_notification_link(v_order.id);

  if public.notification_exists_for_order(
    v_order.seller_id,
    'seller_payout_complete',
    v_order.id
  ) then
    return false;
  end if;

  perform public.create_notification(
    v_order.seller_id,
    'seller_payout_complete',
    'Payout released',
    'Your payout has been released and the order is complete.',
    v_link
  );

  return true;
end;
$$;

revoke all on function public.send_seller_payout_complete_notification_if_eligible(uuid) from public;
grant execute on function public.send_seller_payout_complete_notification_if_eligible(uuid) to service_role;

create or replace function public.notify_seller_payout_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payout_status = 'paid'::public.payout_status
    and old.payout_status is distinct from 'paid'::public.payout_status then
    perform public.send_seller_payout_complete_notification_if_eligible(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_notify_seller_payout_complete on public.orders;

create trigger orders_notify_seller_payout_complete
  after update of payout_status on public.orders
  for each row
  execute function public.notify_seller_payout_complete();

-- ---------------------------------------------------------------------------
-- Idempotency guard (duplicate inserts fail safely)
-- ---------------------------------------------------------------------------

create unique index if not exists notifications_user_type_order_link_uniq
  on public.notifications (user_id, type, link_url)
  where type in ('buyer_review_reminder', 'seller_payout_complete');

notify pgrst, 'reload schema';
