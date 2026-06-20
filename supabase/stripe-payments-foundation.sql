-- Equipd Stripe payments foundation (Phase 1 — database only)
-- Run after listing-delivery-options.sql
--
-- Adds: reserved listing status, payments table, seller Stripe profile fields,
-- updated accept_offer(), and payment lifecycle RPCs for future Stripe integration.

-- ---------------------------------------------------------------------------
-- Listing status: add reserved
-- ---------------------------------------------------------------------------

alter type public.listing_status add value if not exists 'reserved' after 'active';

-- ---------------------------------------------------------------------------
-- Payment status enum
-- ---------------------------------------------------------------------------

create type public.payment_status as enum (
  'awaiting_seller_setup',
  'pending',
  'paid',
  'expired',
  'cancelled',
  'refunded'
);

-- ---------------------------------------------------------------------------
-- Seller Stripe fields on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false;

create unique index if not exists profiles_stripe_account_id_unique_idx
  on public.profiles (stripe_account_id)
  where stripe_account_id is not null;

create or replace function public.prevent_profile_stripe_client_updates()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.stripe_account_id is distinct from old.stripe_account_id
      or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete then
      raise exception 'Stripe payout fields can only be updated by the server';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_stripe_client_updates on public.profiles;

create trigger profiles_prevent_stripe_client_updates
  before update on public.profiles
  for each row execute function public.prevent_profile_stripe_client_updates();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status public.payment_status not null default 'pending',
  amount_pence int not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount_pence > 0),
  constraint payments_offer_unique unique (offer_id),
  constraint payments_checkout_session_unique unique (stripe_checkout_session_id),
  constraint payments_payment_intent_unique unique (stripe_payment_intent_id)
);

create index payments_buyer_status_idx
  on public.payments (buyer_id, status, created_at desc);

create index payments_seller_status_idx
  on public.payments (seller_id, status, created_at desc);

create index payments_listing_idx
  on public.payments (listing_id);

create index payments_expires_at_idx
  on public.payments (expires_at)
  where status in (
    'awaiting_seller_setup'::public.payment_status,
    'pending'::public.payment_status
  );

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Listings visibility: buyers with accepted offers can read reserved listings
-- ---------------------------------------------------------------------------

drop policy if exists "Active listings are publicly readable" on public.listings;

create policy "Active listings are publicly readable"
  on public.listings for select
  to anon, authenticated
  using (
    status = 'active'::public.listing_status
    or seller_id = auth.uid()
    or exists (
      select 1
      from public.offers o
      where o.listing_id = listings.id
        and o.buyer_id = auth.uid()
        and o.status = 'accepted'::public.offer_status
    )
  );

-- ---------------------------------------------------------------------------
-- Payment RPCs (called by future Edge Functions / webhooks via service role)
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
    stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
  where id = p_payment_id;

  update public.listings
  set status = 'sold'::public.listing_status
  where id = v_payment.listing_id
    and status = 'reserved'::public.listing_status;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

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

create or replace function public.release_expired_payments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_count int := 0;
begin
  for v_payment in
    select *
    from public.payments
    where status in (
      'awaiting_seller_setup'::public.payment_status,
      'pending'::public.payment_status
    )
      and expires_at <= now()
    for update
  loop
    perform public.expire_payment(v_payment.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.mark_payment_paid(uuid, text, text) from public;
revoke all on function public.expire_payment(uuid) from public;
revoke all on function public.cancel_payment(uuid) from public;
revoke all on function public.release_expired_payments() from public;

-- ---------------------------------------------------------------------------
-- Accept offer: reserve listing + create payment (no longer marks sold)
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
  v_seller_onboarded boolean;
  v_payment_status public.payment_status;
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

  select p.stripe_onboarding_complete
  into v_seller_onboarded
  from public.profiles p
  where p.id = v_offer.seller_id;

  v_payment_status := case
    when coalesce(v_seller_onboarded, false) then 'pending'::public.payment_status
    else 'awaiting_seller_setup'::public.payment_status
  end;

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
    status,
    expires_at
  )
  values (
    v_offer.id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_payment_status,
    now() + interval '3 days'
  );

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

grant execute on function public.accept_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: payments
-- ---------------------------------------------------------------------------

alter table public.payments enable row level security;

create policy "Buyers and sellers can read relevant payments"
  on public.payments for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());
