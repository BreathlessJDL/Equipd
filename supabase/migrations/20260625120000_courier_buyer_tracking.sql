-- Equipd Buyer Protection — Courier buyer tracking & seller evidence polish
-- Run after buyer-protection-phase3b-courier-delivery-confirmation.sql
-- Safe to re-run (idempotent where possible).
--
-- Moves tracking responsibility to buyer delivery confirmation.
-- Preserves legacy courier_tracking_reference (seller-submitted) on existing rows.

alter table public.orders
  add column if not exists courier_buyer_tracking_reference text,
  add column if not exists courier_evidence_notes text;

-- ---------------------------------------------------------------------------
-- Seller submits courier handover evidence (tracking no longer required)
-- ---------------------------------------------------------------------------

create or replace function public.submit_courier_handover_evidence(
  p_order_id uuid,
  p_payload jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_listing_title text;
  v_video_path text;
  v_pre_photo_path text;
  v_handover_photo_path text;
  v_courier_name text;
  v_courier_company text;
  v_signature_name text;
  v_signature_data text;
  v_evidence_notes text;
  v_dispatch_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Evidence payload is required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.seller_id <> v_uid then
    raise exception 'Only the seller can submit courier handover evidence';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'buyer_courier'::public.order_type then
    raise exception 'Courier evidence is only required for buyer-organised courier orders';
  end if;

  if v_order.fulfilment_status <> 'awaiting_courier_collection'::public.order_fulfilment_status then
    raise exception 'Courier evidence can only be submitted while awaiting courier collection';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before submitting courier evidence';
  end if;

  v_video_path := nullif(trim(p_payload ->> 'courier_evidence_video_url'), '');
  v_pre_photo_path := nullif(trim(p_payload ->> 'courier_pre_collection_photo_url'), '');
  v_handover_photo_path := nullif(trim(p_payload ->> 'courier_handover_photo_url'), '');
  v_courier_name := nullif(trim(p_payload ->> 'courier_name'), '');
  v_courier_company := nullif(trim(p_payload ->> 'courier_company'), '');
  v_signature_name := nullif(trim(p_payload ->> 'courier_signature_name'), '');
  v_signature_data := nullif(trim(p_payload ->> 'courier_signature_data'), '');
  v_evidence_notes := nullif(trim(p_payload ->> 'courier_evidence_notes'), '');

  v_dispatch_at := coalesce(
    nullif(p_payload ->> 'courier_collected_at', '')::timestamptz,
    now()
  );

  if v_video_path is null then
    raise exception 'Condition video is required';
  end if;

  if v_pre_photo_path is null then
    raise exception 'Pre-collection photo is required';
  end if;

  if v_handover_photo_path is null then
    raise exception 'Handover/loading photo is required';
  end if;

  if v_courier_name is null and v_courier_company is null then
    raise exception 'Courier name or courier company is required';
  end if;

  if v_signature_name is null then
    raise exception 'Courier signed name is required';
  end if;

  if v_signature_data is null then
    raise exception 'Courier signature is required';
  end if;

  update public.orders
  set
    courier_evidence_video_url = v_video_path,
    courier_pre_collection_photo_url = v_pre_photo_path,
    courier_handover_photo_url = v_handover_photo_path,
    courier_name = v_courier_name,
    courier_company = v_courier_company,
    courier_evidence_notes = v_evidence_notes,
    courier_signature_name = v_signature_name,
    courier_signature_data = v_signature_data,
    courier_signed_at = coalesce(
      nullif(p_payload ->> 'courier_signed_at', '')::timestamptz,
      now()
    ),
    courier_collected_at = v_dispatch_at,
    courier_evidence_submitted_at = now(),
    courier_evidence_submitted_by = v_uid,
    fulfilment_status = 'in_transit'::public.order_fulfilment_status,
    payout_status = 'not_due'::public.payout_status,
    payout_release_at = null
  where id = p_order_id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.buyer_id,
    'courier_evidence_submitted',
    'Courier handover evidence submitted',
    'The seller submitted courier handover evidence for '
      || coalesce(v_listing_title, 'your order')
      || '. The item is now in transit.',
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer confirms courier delivery (optional buyer tracking reference)
-- ---------------------------------------------------------------------------

drop function if exists public.confirm_courier_delivery(uuid, jsonb, text);

create or replace function public.confirm_courier_delivery(
  p_order_id uuid,
  p_checks jsonb,
  p_user_agent text default null,
  p_buyer_tracking_reference text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_listing_title text;
  v_dispute_hours int;
  v_buyer_tracking text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_checks is null
     or coalesce((p_checks ->> 'item_received')::boolean, false) is not true
     or coalesce((p_checks ->> 'handover_evidence_reviewed')::boolean, false) is not true
     or coalesce((p_checks ->> 'protection_window_acknowledged')::boolean, false) is not true then
    raise exception 'All delivery confirmation checks must be accepted';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer can confirm courier delivery';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'buyer_courier'::public.order_type then
    raise exception 'Courier delivery confirmation is only available for buyer-organised courier orders';
  end if;

  if v_order.fulfilment_status = 'delivered'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'in_transit'::public.order_fulfilment_status then
    raise exception 'Courier delivery can only be confirmed while the order is in transit';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming delivery';
  end if;

  if v_order.courier_evidence_submitted_at is null then
    raise exception 'Courier handover evidence must be submitted before confirming delivery';
  end if;

  v_dispute_hours := coalesce(v_order.dispute_window_hours, 24);
  v_buyer_tracking := nullif(trim(p_buyer_tracking_reference), '');

  update public.orders
  set
    fulfilment_status = 'delivered'::public.order_fulfilment_status,
    delivered_at = now(),
    courier_delivered_at = now(),
    courier_delivery_confirmed_by = v_uid,
    courier_delivery_confirmation_checks = p_checks,
    courier_delivery_confirmation_user_agent = nullif(trim(p_user_agent), ''),
    courier_buyer_tracking_reference = v_buyer_tracking,
    payout_release_at = now() + make_interval(hours => v_dispute_hours),
    payout_status = 'not_due'::public.payout_status,
    protection_status = coalesce(protection_status, 'active')
  where id = p_order_id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.seller_id,
    'courier_delivery_confirmed',
    'Buyer confirmed courier delivery',
    'The buyer has confirmed delivery for '
      || coalesce(v_listing_title, 'your order')
      || '. Payout is held for '
      || v_dispute_hours::text
      || ' hours.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.buyer_id,
    'courier_delivery_confirmed',
    'Delivery confirmed',
    'You confirmed delivery for '
      || coalesce(v_listing_title, 'your purchase')
      || '. Your '
      || v_dispute_hours::text
      || '-hour Buyer Protection window has started.',
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.confirm_courier_delivery(uuid, jsonb, text, text) from public;
grant execute on function public.confirm_courier_delivery(uuid, jsonb, text, text) to authenticated;

-- Client-safe orders view (drop/recreate — new columns cannot be inserted mid-view with CREATE OR REPLACE)
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
