-- Mark stale actionable notifications as read when the related action completes.
-- Run after notifications.sql and order-completion-notifications.sql (order_notification_link).
-- Does not delete notifications; only sets is_read = true.

-- ---------------------------------------------------------------------------
-- Link helpers
-- ---------------------------------------------------------------------------

create or replace function public.order_notification_link(p_order_id uuid)
returns text
language sql
immutable
as $$
  select '/orders/' || p_order_id::text;
$$;

create or replace function public.notification_link_matches_offer(
  p_link_url text,
  p_offer_id uuid
)
returns boolean
language sql
immutable
as $$
  select
    p_link_url is not null
    and p_offer_id is not null
    and p_link_url ~ ('offerId=' || p_offer_id::text || '($|&)');
$$;

create or replace function public.notification_link_matches_order(
  p_link_url text,
  p_order_id uuid
)
returns boolean
language sql
immutable
as $$
  select
    p_link_url is not null
    and p_order_id is not null
    and (
      p_link_url = public.order_notification_link(p_order_id)
      or p_link_url like public.order_notification_link(p_order_id) || '#%'
      or p_link_url like public.order_notification_link(p_order_id) || '?%'
    );
$$;

-- ---------------------------------------------------------------------------
-- Reusable read helper
-- ---------------------------------------------------------------------------

create or replace function public.mark_related_notifications_read(
  p_user_id uuid,
  p_types text[],
  p_offer_id uuid default null,
  p_order_id uuid default null,
  p_listing_id uuid default null,
  p_exact_link_url text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if p_user_id is null or p_types is null or cardinality(p_types) = 0 then
    return 0;
  end if;

  with thread_offers as (
    select p_offer_id as offer_id
    where p_offer_id is not null

    union

    select o.id
    from public.offers o
    where p_offer_id is not null
      and o.parent_offer_id = p_offer_id

    union

    select o.parent_offer_id
    from public.offers o
    where p_offer_id is not null
      and o.id = p_offer_id
      and o.parent_offer_id is not null
  ),
  listing_offer_ids as (
    select o.id as offer_id
    from public.offers o
    where p_listing_id is not null
      and o.listing_id = p_listing_id
  )
  update public.notifications n
  set is_read = true
  where n.user_id = p_user_id
    and n.is_read = false
    and n.type = any(p_types)
    and (
      (p_exact_link_url is not null and n.link_url = p_exact_link_url)
      or (
        p_order_id is not null
        and public.notification_link_matches_order(n.link_url, p_order_id)
      )
      or (
        p_offer_id is not null
        and exists (
          select 1
          from thread_offers t
          where public.notification_link_matches_offer(n.link_url, t.offer_id)
        )
      )
      or (
        p_listing_id is not null
        and p_offer_id is null
        and exists (
          select 1
          from listing_offer_ids lo
          where public.notification_link_matches_offer(n.link_url, lo.offer_id)
        )
      )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_related_notifications_read(
  uuid,
  text[],
  uuid,
  uuid,
  uuid,
  text
) from public;
grant execute on function public.mark_related_notifications_read(
  uuid,
  text[],
  uuid,
  uuid,
  uuid,
  text
) to service_role;

-- ---------------------------------------------------------------------------
-- Offer lifecycle cleanup
-- ---------------------------------------------------------------------------

create or replace function public.mark_stale_offer_action_notifications_read(
  p_actor_id uuid,
  p_offer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_count integer := 0;
  v_inbound_types text[] := array[
    'offer_received',
    'counter_offer_received'
  ];
begin
  if p_actor_id is null or p_offer_id is null then
    return 0;
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  if not found then
    return 0;
  end if;

  v_count := v_count + public.mark_related_notifications_read(
    p_actor_id,
    v_inbound_types,
    p_offer_id => p_offer_id
  );

  if v_offer.status = 'withdrawn'::public.offer_status then
    v_count := v_count + public.mark_related_notifications_read(
      v_offer.seller_id,
      v_inbound_types,
      p_offer_id => p_offer_id
    );
  end if;

  return v_count;
end;
$$;

revoke all on function public.mark_stale_offer_action_notifications_read(uuid, uuid) from public;
grant execute on function public.mark_stale_offer_action_notifications_read(uuid, uuid) to service_role;

create or replace function public.cleanup_offer_notifications_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'pending'::public.offer_status
    and new.status in (
      'accepted'::public.offer_status,
      'rejected'::public.offer_status,
      'countered'::public.offer_status,
      'withdrawn'::public.offer_status
    ) then
    perform public.mark_stale_offer_action_notifications_read(auth.uid(), new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists offers_cleanup_notifications_on_status_change on public.offers;

create trigger offers_cleanup_notifications_on_status_change
  after update of status on public.offers
  for each row
  execute function public.cleanup_offer_notifications_on_status_change();

create or replace function public.cleanup_offer_notifications_on_new_buyer_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_offer_id is null
    and coalesce(new.direction, 'buyer_to_seller') = 'buyer_to_seller' then
    perform public.mark_related_notifications_read(
      new.buyer_id,
      array['offer_declined', 'counter_offer_declined'],
      p_listing_id => new.listing_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists offers_cleanup_notifications_on_new_buyer_offer on public.offers;

create trigger offers_cleanup_notifications_on_new_buyer_offer
  after insert on public.offers
  for each row
  execute function public.cleanup_offer_notifications_on_new_buyer_offer();

-- ---------------------------------------------------------------------------
-- Payment captured → buyer offer outcome notifications no longer actionable
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_payment_notifications_on_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome_types text[] := array['offer_accepted', 'counter_offer_accepted'];
begin
  if new.status <> 'paid'::public.payment_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'paid'::public.payment_status then
    return new;
  end if;

  perform public.mark_related_notifications_read(
    new.buyer_id,
    v_outcome_types,
    p_offer_id => new.offer_id
  );

  return new;
end;
$$;

drop trigger if exists payments_cleanup_notifications_on_paid on public.payments;

create trigger payments_cleanup_notifications_on_paid
  after insert or update of status on public.payments
  for each row
  execute function public.cleanup_payment_notifications_on_paid();

-- ---------------------------------------------------------------------------
-- Order fulfilment progress
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_fulfilment_notifications_read(
  p_order public.orders,
  p_old_fulfilment public.order_fulfilment_status,
  p_new_fulfilment public.order_fulfilment_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := p_order.id;
  v_seller_step_types text[] := array[
    'buyer_payment_received',
    'courier_evidence_submitted'
  ];
  v_buyer_step_types text[] := array[
    'seller_delivery_confirmed',
    'courier_collection_confirmed'
  ];
  v_shared_step_types text[] := array[
    'collection_confirmed',
    'courier_delivery_confirmed'
  ];
begin
  if p_old_fulfilment is not distinct from p_new_fulfilment then
    return;
  end if;

  if p_old_fulfilment = 'paid'::public.order_fulfilment_status
    and p_new_fulfilment <> 'paid'::public.order_fulfilment_status then
    perform public.mark_related_notifications_read(
      p_order.seller_id,
      array['buyer_payment_received'],
      p_order_id => v_order_id
    );
  end if;

  if p_new_fulfilment = 'in_transit'::public.order_fulfilment_status then
    perform public.mark_related_notifications_read(
      p_order.buyer_id,
      array['courier_collection_confirmed'],
      p_order_id => v_order_id
    );
  end if;

  if p_new_fulfilment = 'collected'::public.order_fulfilment_status then
    perform public.mark_related_notifications_read(
      p_order.seller_id,
      v_seller_step_types,
      p_order_id => v_order_id
    );
    perform public.mark_related_notifications_read(
      p_order.buyer_id,
      array['seller_delivery_confirmed'],
      p_order_id => v_order_id
    );
  end if;

  if p_new_fulfilment = 'delivered'::public.order_fulfilment_status then
    perform public.mark_related_notifications_read(
      p_order.buyer_id,
      v_buyer_step_types,
      p_order_id => v_order_id
    );
    perform public.mark_related_notifications_read(
      p_order.seller_id,
      v_seller_step_types,
      p_order_id => v_order_id
    );
  end if;

  if p_new_fulfilment = 'completed'::public.order_fulfilment_status
    and p_order.protection_status = 'released' then
    perform public.mark_related_notifications_read(
      p_order.buyer_id,
      v_shared_step_types || array['seller_delivery_confirmed', 'courier_collection_confirmed'],
      p_order_id => v_order_id
    );
    perform public.mark_related_notifications_read(
      p_order.seller_id,
      v_shared_step_types || v_seller_step_types,
      p_order_id => v_order_id
    );
  end if;
end;
$$;

revoke all on function public.mark_order_fulfilment_notifications_read(
  public.orders,
  public.order_fulfilment_status,
  public.order_fulfilment_status
) from public;
grant execute on function public.mark_order_fulfilment_notifications_read(
  public.orders,
  public.order_fulfilment_status,
  public.order_fulfilment_status
) to service_role;

create or replace function public.cleanup_order_notifications_on_fulfilment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.fulfilment_status is distinct from new.fulfilment_status then
    perform public.mark_order_fulfilment_notifications_read(
      new,
      old.fulfilment_status,
      new.fulfilment_status
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_cleanup_notifications_on_fulfilment_change on public.orders;

create trigger orders_cleanup_notifications_on_fulfilment_change
  after update of fulfilment_status on public.orders
  for each row
  execute function public.cleanup_order_notifications_on_fulfilment_change();

-- ---------------------------------------------------------------------------
-- Review submitted → clear buyer review reminder
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_review_notifications_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mark_related_notifications_read(
    new.reviewer_user_id,
    array['buyer_review_reminder'],
    p_order_id => new.order_id
  );

  return new;
end;
$$;

drop trigger if exists reviews_cleanup_notifications_on_insert on public.reviews;

create trigger reviews_cleanup_notifications_on_insert
  after insert on public.reviews
  for each row
  execute function public.cleanup_review_notifications_on_insert();

-- ---------------------------------------------------------------------------
-- Disputes resolved → clear open dispute alerts
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_dispute_notifications_on_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stale_types text[] := array[
    'order_dispute_opened',
    'order_dispute_under_review'
  ];
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status in (
    'resolved_buyer',
    'resolved_seller',
    'cancelled'
  ) then
    perform public.mark_related_notifications_read(
      new.buyer_id,
      v_stale_types,
      p_order_id => new.order_id
    );
    perform public.mark_related_notifications_read(
      new.seller_id,
      v_stale_types,
      p_order_id => new.order_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists order_disputes_cleanup_notifications_on_resolve on public.order_disputes;

create trigger order_disputes_cleanup_notifications_on_resolve
  after update of status on public.order_disputes
  for each row
  execute function public.cleanup_dispute_notifications_on_resolve();

-- ---------------------------------------------------------------------------
-- Support requests resolved/closed
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_support_request_notifications_on_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status in (
    'resolved'::public.support_request_status,
    'closed'::public.support_request_status
  ) then
    perform public.mark_related_notifications_read(
      new.buyer_id,
      array['support_request_opened'],
      p_order_id => new.order_id
    );
    perform public.mark_related_notifications_read(
      new.seller_id,
      array['support_request_opened'],
      p_order_id => new.order_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists support_requests_cleanup_notifications_on_close
  on public.transaction_support_requests;

create trigger support_requests_cleanup_notifications_on_close
  after update of status on public.transaction_support_requests
  for each row
  execute function public.cleanup_support_request_notifications_on_close();

notify pgrst, 'reload schema';
