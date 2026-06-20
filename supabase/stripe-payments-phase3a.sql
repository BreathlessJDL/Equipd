-- Equipd Stripe payments Phase 3a — held-funds marketplace foundation
-- Run after stripe-payments-phase2.sql
--
-- Adds: orders table, fulfilment/payout enums, listing in_progress status,
-- payment columns for platform-held charges, accept_offer order creation,
-- and mark_payment_captured() for the future held-funds checkout path.
--
-- Does NOT implement buyer confirmation UI, payout release, or refunds yet.
-- Existing webhook may still call mark_payment_paid() (legacy immediate-sold path).

-- ---------------------------------------------------------------------------
-- Listing status: add in_progress (buyer paid, transaction not complete)
-- ---------------------------------------------------------------------------

alter type public.listing_status add value if not exists 'in_progress' after 'reserved';

-- ---------------------------------------------------------------------------
-- Order fulfilment + payout enums
-- ---------------------------------------------------------------------------

create type public.order_fulfilment_status as enum (
  'awaiting_payment',
  'paid',
  'in_progress',
  'buyer_confirmed',
  'completed',
  'cancelled',
  'disputed'
);

create type public.payout_status as enum (
  'not_due',
  'awaiting_seller_setup',
  'ready',
  'processing',
  'paid',
  'failed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Extend payments for platform-held charges
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists platform_fee_pence int not null default 0,
  add column if not exists seller_net_pence int,
  add column if not exists stripe_charge_id text,
  add column if not exists paid_at timestamptz;

alter table public.payments
  drop constraint if exists payments_platform_fee_non_negative;

alter table public.payments
  add constraint payments_platform_fee_non_negative
  check (platform_fee_pence >= 0);

alter table public.payments
  drop constraint if exists payments_seller_net_positive;

alter table public.payments
  add constraint payments_seller_net_positive
  check (seller_net_pence is null or seller_net_pence > 0);

alter table public.payments
  drop constraint if exists payments_fee_not_greater_than_amount;

alter table public.payments
  add constraint payments_fee_not_greater_than_amount
  check (platform_fee_pence <= amount_pence);

alter table public.payments
  drop constraint if exists payments_stripe_charge_unique;

alter table public.payments
  add constraint payments_stripe_charge_unique unique (stripe_charge_id);

-- Backfill seller_net_pence for existing rows
update public.payments
set seller_net_pence = amount_pence - platform_fee_pence
where seller_net_pence is null;

alter table public.payments
  alter column seller_net_pence set not null;

-- Legacy rows: buyer can pay without seller onboarding gate
update public.payments
set status = 'pending'::public.payment_status
where status = 'awaiting_seller_setup'::public.payment_status;

-- ---------------------------------------------------------------------------
-- orders (1:1 with accepted offer / payment)
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  amount_pence int not null,
  platform_fee_pence int not null default 0,
  seller_net_pence int not null,
  fulfilment_status public.order_fulfilment_status not null default 'awaiting_payment',
  payout_status public.payout_status not null default 'not_due',
  buyer_confirmed_at timestamptz,
  payout_released_at timestamptz,
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_offer_unique unique (offer_id),
  constraint orders_payment_unique unique (payment_id),
  constraint orders_amount_positive check (amount_pence > 0),
  constraint orders_platform_fee_non_negative check (platform_fee_pence >= 0),
  constraint orders_seller_net_positive check (seller_net_pence > 0),
  constraint orders_fee_not_greater_than_amount check (platform_fee_pence <= amount_pence),
  constraint orders_stripe_transfer_unique unique (stripe_transfer_id)
);

create index orders_buyer_fulfilment_idx
  on public.orders (buyer_id, fulfilment_status, created_at desc);

create index orders_seller_payout_idx
  on public.orders (seller_id, payout_status, created_at desc);

create index orders_listing_idx
  on public.orders (listing_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Backfill orders for payments created before Phase 3a
insert into public.orders (
  offer_id,
  payment_id,
  listing_id,
  buyer_id,
  seller_id,
  amount_pence,
  platform_fee_pence,
  seller_net_pence,
  fulfilment_status,
  payout_status,
  buyer_confirmed_at,
  payout_released_at
)
select
  p.offer_id,
  p.id,
  p.listing_id,
  p.buyer_id,
  p.seller_id,
  p.amount_pence,
  p.platform_fee_pence,
  p.seller_net_pence,
  case
    when p.status = 'paid'::public.payment_status then
      case
        when l.status = 'sold'::public.listing_status then 'completed'::public.order_fulfilment_status
        else 'paid'::public.order_fulfilment_status
      end
    when p.status in (
      'expired'::public.payment_status,
      'cancelled'::public.payment_status
    ) then 'cancelled'::public.order_fulfilment_status
    when p.status = 'refunded'::public.payment_status then 'cancelled'::public.order_fulfilment_status
    else 'awaiting_payment'::public.order_fulfilment_status
  end,
  case
    when p.status = 'paid'::public.payment_status
      and l.status = 'sold'::public.listing_status then 'paid'::public.payout_status
    else 'not_due'::public.payout_status
  end,
  null,
  null
from public.payments p
join public.listings l on l.id = p.listing_id
where not exists (
  select 1
  from public.orders o
  where o.payment_id = p.id
);

-- ---------------------------------------------------------------------------
-- Held funds: buyer paid, funds on platform, listing in_progress
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

  if v_payment.status not in (
    'pending'::public.payment_status
  ) then
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

  update public.orders
  set
    fulfilment_status = 'paid'::public.order_fulfilment_status,
    payout_status = 'not_due'::public.payout_status
  where payment_id = p_payment_id
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
-- Legacy capture path: still marks listing sold (current webhook behaviour)
-- Also syncs linked order row when present.
-- ---------------------------------------------------------------------------

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
declare
  v_payment public.payments;
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

  if v_payment.status not in (
    'awaiting_seller_setup'::public.payment_status,
    'pending'::public.payment_status
  ) then
    raise exception 'Payment cannot be marked paid from status %', v_payment.status;
  end if;

  if not exists (
    select 1
    from public.offers o
    where o.id = v_payment.offer_id
      and o.status = 'accepted'::public.offer_status
  ) then
    raise exception 'Accepted offer required before payment can complete';
  end if;

  update public.payments
  set
    status = 'paid'::public.payment_status,
    stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
    paid_at = coalesce(paid_at, now())
  where id = p_payment_id;

  update public.orders
  set
    fulfilment_status = case
      when fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
        then 'completed'::public.order_fulfilment_status
      else fulfilment_status
    end,
    payout_status = case
      when payout_status = 'not_due'::public.payout_status then 'paid'::public.payout_status
      else payout_status
    end,
    payout_released_at = coalesce(payout_released_at, now())
  where payment_id = p_payment_id;

  update public.listings
  set status = 'sold'::public.listing_status
  where id = v_payment.listing_id
    and status in (
      'reserved'::public.listing_status,
      'in_progress'::public.listing_status
    );

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expire / cancel: sync orders
-- ---------------------------------------------------------------------------

create or replace function public.expire_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status not in (
    'awaiting_seller_setup'::public.payment_status,
    'pending'::public.payment_status
  ) then
    return v_payment;
  end if;

  update public.payments
  set status = 'expired'::public.payment_status
  where id = p_payment_id;

  update public.orders
  set
    fulfilment_status = 'cancelled'::public.order_fulfilment_status,
    payout_status = 'cancelled'::public.payout_status
  where payment_id = p_payment_id;

  update public.listings
  set status = 'active'::public.listing_status
  where id = v_payment.listing_id
    and status = 'reserved'::public.listing_status;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

create or replace function public.cancel_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
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
    raise exception 'Paid payments cannot be cancelled';
  end if;

  update public.payments
  set status = 'cancelled'::public.payment_status
  where id = p_payment_id;

  update public.orders
  set
    fulfilment_status = 'cancelled'::public.order_fulfilment_status,
    payout_status = 'cancelled'::public.payout_status
  where payment_id = p_payment_id;

  update public.listings
  set status = 'active'::public.listing_status
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
-- Accept offer: always pending payment + create order (no seller onboarding gate)
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
  v_payment_id uuid;
  v_platform_fee_pence int := 0;
  v_seller_net_pence int;
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

  v_seller_net_pence := v_offer.amount_pence - v_platform_fee_pence;

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

  insert into public.payments (
    offer_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    platform_fee_pence,
    seller_net_pence,
    status,
    expires_at
  )
  values (
    v_offer.id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_platform_fee_pence,
    v_seller_net_pence,
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
    platform_fee_pence,
    seller_net_pence,
    fulfilment_status,
    payout_status
  )
  values (
    v_offer.id,
    v_payment_id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_platform_fee_pence,
    v_seller_net_pence,
    'awaiting_payment'::public.order_fulfilment_status,
    'not_due'::public.payout_status
  );

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: orders
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;

create policy "Buyers and sellers can read relevant orders"
  on public.orders for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (service role only for payment lifecycle RPCs)
-- ---------------------------------------------------------------------------

revoke all on function public.mark_payment_captured(uuid, text, text, text) from public;
grant execute on function public.mark_payment_captured(uuid, text, text, text) to service_role;
