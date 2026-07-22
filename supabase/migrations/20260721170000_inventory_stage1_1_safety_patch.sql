-- Stage 1.1 inventory safety patch.
-- Additive only. Does not repeat Stage 1 backfill and does not expose quantity UI.

-- ---------------------------------------------------------------------------
-- 1. Durable commerce exception ledger.
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.commerce_exception_status as enum ('open', 'resolved');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.commerce_exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_type text not null,
  order_id uuid references public.orders (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  stripe_event_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  safe_payload_summary jsonb not null default '{}'::jsonb,
  status public.commerce_exception_status not null default 'open'::public.commerce_exception_status,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint commerce_exceptions_type_nonempty
    check (char_length(trim(exception_type)) > 0),
  constraint commerce_exceptions_resolved_consistency
    check (
      (status = 'open'::public.commerce_exception_status and resolved_at is null)
      or (status = 'resolved'::public.commerce_exception_status and resolved_at is not null)
    )
);

create unique index if not exists commerce_exceptions_stripe_event_uidx
  on public.commerce_exceptions (stripe_event_id)
  where stripe_event_id is not null;

-- One late-payment exception per payment, even when Stripe omits/replays event ids.
create unique index if not exists commerce_exceptions_late_payment_payment_uidx
  on public.commerce_exceptions (payment_id)
  where exception_type = 'late_payment_after_release'
    and payment_id is not null;

create index if not exists commerce_exceptions_open_created_idx
  on public.commerce_exceptions (created_at desc)
  where status = 'open'::public.commerce_exception_status;

create index if not exists commerce_exceptions_order_idx
  on public.commerce_exceptions (order_id)
  where order_id is not null;

create index if not exists commerce_exceptions_payment_idx
  on public.commerce_exceptions (payment_id)
  where payment_id is not null;

comment on table public.commerce_exceptions is
  'Durable ledger for commerce anomalies that must not mutate inventory or fulfilment automatically.';

alter table public.commerce_exceptions enable row level security;

drop policy if exists "Admins can read commerce exceptions"
  on public.commerce_exceptions;
create policy "Admins can read commerce exceptions"
  on public.commerce_exceptions for select
  to authenticated
  using (public.is_admin());

revoke all on table public.commerce_exceptions from public, anon, authenticated;
grant select on table public.commerce_exceptions to authenticated;
grant all on table public.commerce_exceptions to service_role;

create or replace view public.commerce_exceptions_admin
with (security_invoker = true)
as
select
  e.id,
  e.exception_type,
  e.order_id,
  e.payment_id,
  e.listing_id,
  e.stripe_event_id,
  e.stripe_checkout_session_id,
  e.stripe_payment_intent_id,
  e.safe_payload_summary,
  e.status,
  e.resolution_notes,
  e.created_at,
  e.resolved_at,
  p.status as payment_status,
  p.expires_at as payment_expires_at,
  o.inventory_state as order_inventory_state,
  o.fulfilment_status as order_fulfilment_status,
  o.payout_status as order_payout_status,
  l.title as listing_title,
  l.quantity_total,
  l.quantity_available,
  l.quantity_reserved,
  l.quantity_sold
from public.commerce_exceptions e
left join public.payments p on p.id = e.payment_id
left join public.orders o on o.id = e.order_id
left join public.listings l on l.id = e.listing_id
where public.is_admin();

comment on view public.commerce_exceptions_admin is
  'Admin-readable commerce exceptions joined to payment, order and listing context.';

revoke all on public.commerce_exceptions_admin from public, anon;
grant select on public.commerce_exceptions_admin to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Helper: record a commerce exception idempotently.
-- ---------------------------------------------------------------------------

create or replace function public.record_commerce_exception(
  p_exception_type text,
  p_order_id uuid default null,
  p_payment_id uuid default null,
  p_listing_id uuid default null,
  p_stripe_event_id text default null,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_safe_payload_summary jsonb default '{}'::jsonb
)
returns public.commerce_exceptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commerce_exceptions;
begin
  if p_exception_type is null or char_length(trim(p_exception_type)) = 0 then
    raise exception 'exception_type is required';
  end if;

  if p_stripe_event_id is not null then
    select *
    into v_row
    from public.commerce_exceptions
    where stripe_event_id = p_stripe_event_id;

    if found then
      return v_row;
    end if;
  end if;

  if p_exception_type = 'late_payment_after_release'
     and p_payment_id is not null then
    select *
    into v_row
    from public.commerce_exceptions
    where exception_type = 'late_payment_after_release'
      and payment_id = p_payment_id;

    if found then
      return v_row;
    end if;
  end if;

  begin
    insert into public.commerce_exceptions (
      exception_type,
      order_id,
      payment_id,
      listing_id,
      stripe_event_id,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      safe_payload_summary
    )
    values (
      trim(p_exception_type),
      p_order_id,
      p_payment_id,
      p_listing_id,
      nullif(trim(p_stripe_event_id), ''),
      nullif(trim(p_stripe_checkout_session_id), ''),
      nullif(trim(p_stripe_payment_intent_id), ''),
      coalesce(p_safe_payload_summary, '{}'::jsonb)
    )
    returning * into v_row;
  exception
    when unique_violation then
      if p_stripe_event_id is not null then
        select *
        into v_row
        from public.commerce_exceptions
        where stripe_event_id = p_stripe_event_id;
      end if;

      if not found
         and p_exception_type = 'late_payment_after_release'
         and p_payment_id is not null then
        select *
        into v_row
        from public.commerce_exceptions
        where exception_type = 'late_payment_after_release'
          and payment_id = p_payment_id;
      end if;

      if not found then
        raise;
      end if;
  end;

  return v_row;
end;
$$;

revoke all on function public.record_commerce_exception(
  text, uuid, uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_commerce_exception(
  text, uuid, uuid, uuid, text, text, text, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Capture-or-exception RPC used by the Stripe webhook.
-- ---------------------------------------------------------------------------

create or replace function public.mark_payment_captured_or_exception(
  p_payment_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_stripe_event_id text default null,
  p_safe_payload_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_exception public.commerce_exceptions;
  v_captured public.payments;
  v_reason text;
begin
  if p_payment_id is null then
    raise exception 'payment_id is required';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if v_payment.status = 'paid'::public.payment_status then
    return jsonb_build_object(
      'outcome', 'already_captured',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'payment_status', v_payment.status,
      'inventory_state', v_order.inventory_state,
      'exception_id', null
    );
  end if;

  if v_payment.status = 'pending'::public.payment_status
     and v_order.id is not null
     and v_order.inventory_state = 'reserved'::public.order_inventory_state
     and v_payment.expires_at > now() then
    v_captured := public.mark_payment_captured(
      p_payment_id,
      p_stripe_checkout_session_id,
      p_stripe_payment_intent_id,
      p_stripe_charge_id
    );

    return jsonb_build_object(
      'outcome', 'captured',
      'payment_id', v_captured.id,
      'order_id', v_order.id,
      'payment_status', v_captured.status,
      'inventory_state', 'sold',
      'exception_id', null
    );
  end if;

  -- Late / unpayable payment path: durable exception, no inventory mutation.
  if v_order.id is null then
    v_reason := 'missing_order';
  elsif v_order.inventory_state = 'released'::public.order_inventory_state then
    v_reason := 'inventory_released';
  elsif v_payment.expires_at <= now() then
    v_reason := 'payment_expired';
  elsif v_payment.status <> 'pending'::public.payment_status then
    v_reason := 'payment_status_' || v_payment.status::text;
  else
    v_reason := 'inventory_state_' || coalesce(v_order.inventory_state::text, 'null');
  end if;

  if p_stripe_event_id is not null then
    select *
    into v_exception
    from public.commerce_exceptions
    where stripe_event_id = p_stripe_event_id;
  end if;

  if v_exception.id is null then
    select *
    into v_exception
    from public.commerce_exceptions
    where exception_type = 'late_payment_after_release'
      and payment_id = v_payment.id;
  end if;

  if v_exception.id is not null then
    return jsonb_build_object(
      'outcome', 'already_recorded_exception',
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'payment_status', v_payment.status,
      'inventory_state', v_order.inventory_state,
      'exception_id', v_exception.id,
      'exception_status', v_exception.status,
      'reason', v_reason
    );
  end if;

  v_exception := public.record_commerce_exception(
    'late_payment_after_release',
    v_order.id,
    v_payment.id,
    coalesce(v_order.listing_id, v_payment.listing_id),
    p_stripe_event_id,
    coalesce(p_stripe_checkout_session_id, v_payment.stripe_checkout_session_id),
    coalesce(p_stripe_payment_intent_id, v_payment.stripe_payment_intent_id),
    coalesce(p_safe_payload_summary, '{}'::jsonb) || jsonb_build_object(
      'reason', v_reason,
      'payment_status', v_payment.status,
      'payment_expires_at', v_payment.expires_at,
      'order_inventory_state', v_order.inventory_state,
      'order_fulfilment_status', v_order.fulfilment_status,
      'stripe_charge_id', p_stripe_charge_id
    )
  );

  return jsonb_build_object(
    'outcome', 'late_payment_exception',
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'payment_status', v_payment.status,
    'inventory_state', v_order.inventory_state,
    'exception_id', v_exception.id,
    'exception_status', v_exception.status,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.mark_payment_captured_or_exception(
  uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.mark_payment_captured_or_exception(
  uuid, text, text, text, text, jsonb
) to service_role;

-- Keep the direct capture RPC service-role only (unchanged privileges).
revoke all on function public.mark_payment_captured(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_payment_captured(uuid, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Quantity-1 sibling offer rejection on successful reservation.
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
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_expected_direction not in ('buyer_to_seller', 'seller_to_buyer') then
    raise exception 'Invalid offer direction';
  end if;

  -- Lock the listing before the offer so concurrent acceptances (and any
  -- quantity-1 sibling rejections) always serialize in the same order.
  select listing_id
  into v_listing_id
  from public.offers
  where id = p_offer_id;

  if v_listing_id is null then
    raise exception 'Offer not found';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_listing_id
  for update;

  if not found then
    raise exception 'Listing not found or seller mismatch';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

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
      v_offer.quantity, coalesce(v_listing.quantity_available, 0)
      using errcode = 'P0001';
  end if;

  update public.listings
  set
    quantity_available = quantity_available - v_offer.quantity,
    quantity_reserved = quantity_reserved + v_offer.quantity,
    inventory_version = inventory_version + 1,
    status = case
      when quantity_available - v_offer.quantity > 0
        then 'active'::public.listing_status
      else 'reserved'::public.listing_status
    end
  where id = v_listing.id
  returning * into v_listing;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = v_offer.id;

  -- Quantity-1 listings restore the previous sibling-rejection policy.
  -- Notifications continue via the existing offer-status trigger.
  -- Multi-quantity listings keep siblings pending for later availability checks.
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
      case
        when p_expected_direction = 'seller_to_buyer'
          then 'Counter-offer accepted.'
        else 'Offer accepted.'
      end
    );
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

revoke all on function public.accept_offer_with_inventory(uuid, text) from public;
revoke all on function public.accept_offer_with_inventory(uuid, text)
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Resilient expiry worker: process each payment independently.
-- ---------------------------------------------------------------------------

drop function if exists public.release_expired_payments();

create or replace function public.release_expired_payments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_processed integer := 0;
  v_released integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_before public.payments;
  v_after public.payments;
  v_order public.orders;
  v_error text;
begin
  for v_payment_id in
    select id
    from public.payments
    where status in (
      'awaiting_seller_setup'::public.payment_status,
      'pending'::public.payment_status
    )
      and expires_at <= now()
    order by expires_at
    for update skip locked
  loop
    v_processed := v_processed + 1;

    begin
      select * into v_before
      from public.payments
      where id = v_payment_id;

      select * into v_order
      from public.orders
      where payment_id = v_payment_id;

      if not found then
        perform public.record_commerce_exception(
          'expiry_worker_malformed_payment',
          null,
          v_payment_id,
          v_before.listing_id,
          null,
          v_before.stripe_checkout_session_id,
          v_before.stripe_payment_intent_id,
          jsonb_build_object(
            'reason', 'missing_order',
            'payment_status', v_before.status,
            'payment_expires_at', v_before.expires_at
          )
        );
        v_failed := v_failed + 1;
        continue;
      end if;

      v_after := public.expire_payment(v_payment_id);

      if v_after.status = 'expired'::public.payment_status
         and v_before.status is distinct from 'expired'::public.payment_status then
        v_released := v_released + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_error := left(sqlerrm, 500);
        begin
          perform public.record_commerce_exception(
            'expiry_worker_malformed_payment',
            v_order.id,
            v_payment_id,
            coalesce(v_order.listing_id, v_before.listing_id),
            null,
            v_before.stripe_checkout_session_id,
            v_before.stripe_payment_intent_id,
            jsonb_build_object(
              'reason', 'expire_payment_failed',
              'error', v_error,
              'payment_status', v_before.status,
              'payment_expires_at', v_before.expires_at,
              'order_inventory_state', v_order.inventory_state
            )
          );
        exception
          when others then
            -- Still continue the batch even if exception persistence fails.
            null;
        end;
        v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'released', v_released,
    'skipped', v_skipped,
    'failed', v_failed
  );
end;
$$;

revoke all on function public.release_expired_payments()
  from public, anon, authenticated;
grant execute on function public.release_expired_payments() to service_role;

-- Cron continues to call the same function name; jsonb result is ignored by schedule.
do $$
declare
  v_job_id bigint;
  v_cron_database text := coalesce(
    nullif(current_setting('cron.database_name', true), ''),
    'postgres'
  );
begin
  if current_database() <> v_cron_database then
    raise notice
      'Skipping pg_cron reschedule in isolated validation database % (cron database is %)',
      current_database(),
      v_cron_database;
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'equipd-release-expired-payments'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'equipd-release-expired-payments',
    '*/5 * * * *',
    'select public.release_expired_payments();'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Preserve Stage 1 inventory write protections (no privilege expansion).
-- ---------------------------------------------------------------------------

revoke all on function public.update_listing_quantity(uuid, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.update_listing_quantity(uuid, integer, bigint)
  to service_role;

notify pgrst, 'reload schema';
