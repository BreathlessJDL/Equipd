-- =============================================================================
-- Seller Service Fee — 2% deducted from seller payout
-- =============================================================================

alter table public.payments
  add column if not exists seller_service_fee_pence int not null default 0;

alter table public.orders
  add column if not exists seller_service_fee_pence int not null default 0;

alter table public.payments
  drop constraint if exists payments_seller_service_fee_non_negative;

alter table public.payments
  add constraint payments_seller_service_fee_non_negative
  check (seller_service_fee_pence >= 0);

alter table public.orders
  drop constraint if exists orders_seller_service_fee_non_negative;

alter table public.orders
  add constraint orders_seller_service_fee_non_negative
  check (seller_service_fee_pence >= 0);

create or replace function public.calculate_seller_service_fee(p_item_price_pence int)
returns int
language plpgsql
immutable
as $$
begin
  if p_item_price_pence is null or p_item_price_pence <= 0 then
    return 0;
  end if;

  return round(p_item_price_pence * 0.02);
end;
$$;

create or replace function public.calculate_seller_net_payout(p_item_price_pence int)
returns int
language sql
immutable
as $$
  select greatest(
    0,
    coalesce(p_item_price_pence, 0) - public.calculate_seller_service_fee(p_item_price_pence)
  );
$$;

-- Backfill unpaid orders/payments with the new fee model.
update public.payments p
set
  seller_service_fee_pence = public.calculate_seller_service_fee(p.amount_pence),
  seller_net_pence = public.calculate_seller_net_payout(p.amount_pence)
where p.status <> 'paid'::public.payment_status;

update public.payments p
set
  seller_service_fee_pence = public.calculate_seller_service_fee(p.amount_pence),
  seller_net_pence = public.calculate_seller_net_payout(p.amount_pence)
where p.status = 'paid'::public.payment_status
  and not exists (
    select 1
    from public.orders o
    where o.payment_id = p.id
      and o.payout_status = 'paid'::public.payout_status
  );

update public.orders o
set
  seller_service_fee_pence = public.calculate_seller_service_fee(
    coalesce(o.item_price_pence, o.amount_pence)
  ),
  seller_net_pence = public.calculate_seller_net_payout(
    coalesce(o.item_price_pence, o.amount_pence)
  )
where o.payout_status <> 'paid'::public.payout_status;

create or replace function public.create_payment_and_order_for_accepted_offer(p_offer public.offers)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_price_pence int;
  v_protection_fee_pence int;
  v_seller_service_fee_pence int;
  v_seller_net_pence int;
  v_buyer_total_pence int;
  v_order_type public.order_type;
  v_payment_id uuid;
begin
  v_item_price_pence := p_offer.amount_pence;
  v_protection_fee_pence := public.calculate_buyer_protection_fee(v_item_price_pence);
  v_seller_service_fee_pence := public.calculate_seller_service_fee(v_item_price_pence);
  v_seller_net_pence := public.calculate_seller_net_payout(v_item_price_pence);
  v_buyer_total_pence := v_item_price_pence + v_protection_fee_pence;
  v_order_type := public.auto_order_type_for_listing(p_offer.listing_id);

  insert into public.payments (
    offer_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    buyer_protection_fee_pence,
    buyer_total_pence,
    platform_fee_pence,
    seller_service_fee_pence,
    seller_net_pence,
    status,
    expires_at
  )
  values (
    p_offer.id,
    p_offer.listing_id,
    p_offer.buyer_id,
    p_offer.seller_id,
    v_item_price_pence,
    v_protection_fee_pence,
    v_buyer_total_pence,
    v_protection_fee_pence,
    v_seller_service_fee_pence,
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
    item_price_pence,
    buyer_protection_fee_pence,
    buyer_total_pence,
    platform_fee_pence,
    seller_service_fee_pence,
    seller_net_pence,
    order_type,
    fulfilment_status,
    payout_status,
    dispute_window_hours,
    protection_status
  )
  values (
    p_offer.id,
    v_payment_id,
    p_offer.listing_id,
    p_offer.buyer_id,
    p_offer.seller_id,
    v_item_price_pence,
    v_item_price_pence,
    v_protection_fee_pence,
    v_buyer_total_pence,
    v_protection_fee_pence,
    v_seller_service_fee_pence,
    v_seller_net_pence,
    v_order_type,
    'awaiting_payment'::public.order_fulfilment_status,
    'not_due'::public.payout_status,
    24,
    'active'
  );

  return v_payment_id;
end;
$$;

drop view if exists public.orders_client;

create view public.orders_client
as
select
  o.id,
  o.offer_id,
  o.payment_id,
  o.listing_id,
  o.buyer_id,
  o.seller_id,
  o.amount_pence,
  o.platform_fee_pence,
  o.seller_service_fee_pence,
  o.seller_net_pence,
  o.fulfilment_status,
  o.payout_status,
  o.buyer_confirmed_at,
  o.payout_released_at,
  o.stripe_transfer_id,
  o.created_at,
  o.updated_at,
  o.order_type,
  o.buyer_protection_fee_pence,
  o.item_price_pence,
  o.buyer_total_pence,
  o.payout_release_at,
  o.dispute_window_hours,
  o.protection_status,
  o.collected_at,
  o.delivered_at,
  o.collection_confirmed_by,
  o.collection_confirmed_at,
  o.collection_confirmation_checks,
  o.collection_confirmation_ip,
  o.collection_confirmation_user_agent,
  o.collection_rejected_at,
  o.collection_rejection_reason,
  o.courier_evidence_video_url,
  o.courier_pre_collection_photo_url,
  o.courier_handover_photo_url,
  o.courier_name,
  o.courier_company,
  o.courier_tracking_reference,
  o.courier_buyer_tracking_reference,
  o.courier_evidence_notes,
  o.courier_signature_name,
  o.courier_signature_data,
  o.courier_signed_at,
  o.courier_collected_at,
  o.courier_evidence_submitted_at,
  o.courier_evidence_submitted_by,
  o.courier_delivered_at,
  o.courier_delivery_confirmed_by,
  o.courier_delivery_confirmation_checks,
  o.courier_delivery_confirmation_user_agent
from public.orders o
where o.buyer_id = auth.uid()
   or o.seller_id = auth.uid()
   or public.is_admin();

grant select on public.orders_client to authenticated;

notify pgrst, 'reload schema';
