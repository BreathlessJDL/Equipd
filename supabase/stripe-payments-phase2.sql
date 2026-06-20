-- Equipd Stripe payments Phase 2 — Edge Function RPCs
-- Run after stripe-payments-foundation.sql

-- ---------------------------------------------------------------------------
-- Promote awaiting_seller_setup → pending after seller completes onboarding
-- ---------------------------------------------------------------------------

create or replace function public.promote_seller_payments_to_pending(p_seller_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.payments
  set status = 'pending'::public.payment_status
  where seller_id = p_seller_id
    and status = 'awaiting_seller_setup'::public.payment_status
    and expires_at > now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sync seller Stripe profile (service role only) + promote open payments
-- ---------------------------------------------------------------------------

create or replace function public.sync_seller_stripe_onboarding(
  p_seller_id uuid,
  p_stripe_account_id text default null,
  p_onboarding_complete boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set
    stripe_account_id = coalesce(p_stripe_account_id, stripe_account_id),
    stripe_onboarding_complete = coalesce(p_onboarding_complete, stripe_onboarding_complete)
  where id = p_seller_id
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  if coalesce(v_profile.stripe_onboarding_complete, false) then
    perform public.promote_seller_payments_to_pending(p_seller_id);
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_seller_id;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attach Checkout Session id before buyer redirect (validates buyer + pending)
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

revoke all on function public.promote_seller_payments_to_pending(uuid) from public;
revoke all on function public.sync_seller_stripe_onboarding(uuid, text, boolean) from public;
revoke all on function public.attach_checkout_session(uuid, uuid, text) from public;

grant execute on function public.promote_seller_payments_to_pending(uuid) to service_role;
grant execute on function public.sync_seller_stripe_onboarding(uuid, text, boolean) to service_role;
grant execute on function public.attach_checkout_session(uuid, uuid, text) to service_role;
