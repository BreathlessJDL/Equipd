-- Buyer rejects item at collection QR confirmation (no collection confirmed, no BP countdown).
-- Run after buyer-protection-seller-delivery-handover-qr.sql and dispute-support-simplified-02-schema-functions.sql.

alter table public.orders
  add column if not exists collection_rejected_at timestamptz,
  add column if not exists collection_rejection_reason text;

create or replace function public.reject_collection_by_qr(
  p_token text,
  p_reason text,
  p_description text,
  p_evidence_paths text[] default '{}',
  p_request_id uuid default gen_random_uuid(),
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_request public.transaction_support_requests;
  v_listing_title text;
  v_description text := trim(p_description);
  v_reason text := nullif(trim(p_reason), '');
  v_path text;
  v_path_prefix text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Collection token is required';
  end if;

  if v_description is null or char_length(v_description) = 0 then
    raise exception 'Please describe why you are rejecting this item';
  end if;

  if v_reason is null then
    raise exception 'Please select a reason for rejecting this item';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.collection_qr_token = trim(p_token)
  for update;

  if not found then
    raise exception 'Invalid collection token';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer for this order can reject this item';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'collection'::public.order_type then
    raise exception 'Item rejection at collection is only available for collection orders';
  end if;

  if v_order.fulfilment_status <> 'awaiting_collection'::public.order_fulfilment_status then
    raise exception 'This item cannot be rejected from fulfilment status %', v_order.fulfilment_status;
  end if;

  if v_order.collection_rejected_at is not null then
    raise exception 'This item was already rejected at collection';
  end if;

  if v_order.collection_qr_expires_at is null
     or v_order.collection_qr_expires_at <= now() then
    raise exception 'This collection code has expired. Ask the seller to generate a new one.';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before rejecting this item';
  end if;

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = v_order.id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'An active dispute already exists for this order';
  end if;

  if exists (
    select 1
    from public.transaction_support_requests r
    where r.order_id = v_order.id
      and r.status in (
        'open'::public.support_request_status,
        'reviewing'::public.support_request_status,
        'awaiting_buyer_evidence'::public.support_request_status,
        'awaiting_seller_evidence'::public.support_request_status,
        'refund_pending'::public.support_request_status,
        'partial_refund_pending'::public.support_request_status
      )
  ) then
    raise exception 'A support case already exists for this order';
  end if;

  v_path_prefix := v_order.id::text || '/support/' || p_request_id::text || '/';

  if p_evidence_paths is not null then
    foreach v_path in array p_evidence_paths loop
      if v_path is null or v_path !~ ('^' || v_path_prefix) then
        raise exception 'Invalid support evidence path';
      end if;
    end loop;
  end if;

  update public.orders
  set
    collection_rejected_at = now(),
    collection_rejection_reason = v_reason,
    collection_qr_token = null,
    collection_qr_expires_at = null,
    collection_confirmation_user_agent = nullif(trim(p_user_agent), ''),
    payout_status = 'on_hold'::public.payout_status,
    protection_status = coalesce(protection_status, 'active')
  where id = v_order.id;

  perform public.freeze_order_payout_for_issue(v_order.id);

  insert into public.transaction_support_requests (
    id,
    order_id,
    listing_id,
    buyer_id,
    seller_id,
    opened_by,
    reason,
    message,
    evidence_paths,
    status
  )
  values (
    p_request_id,
    v_order.id,
    v_order.listing_id,
    v_order.buyer_id,
    v_order.seller_id,
    v_uid,
    'collection_issue'::public.support_request_reason,
    v_description,
    coalesce(p_evidence_paths, '{}'),
    'open'::public.support_request_status
  )
  returning * into v_request;

  perform public.record_order_case_update(
    v_order.id,
    null,
    v_request.id,
    'collection_rejected',
    'Item rejected at collection',
    v_description,
    'Reason: ' || v_reason
  );

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.seller_id,
    'collection_rejected',
    'Item rejected at collection',
    'The buyer rejected '
      || coalesce(v_listing_title, 'your item')
      || ' at collection. Equipd support is reviewing the case.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.buyer_id,
    'collection_rejected',
    'Item rejected at collection',
    'You rejected '
      || coalesce(v_listing_title, 'this item')
      || ' at collection. Equipd support will review your case.',
    '/orders/' || v_order.id::text
  );

  perform public.notify_support_team_email(
    'support_request',
    jsonb_build_object(
      'order_id', v_order.id,
      'support_request_id', v_request.id,
      'reason', 'collection_issue',
      'message', v_description,
      'collection_rejected', true,
      'collection_rejection_reason', v_reason
    )
  );

  select *
  into v_order
  from public.orders
  where id = v_order.id;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'support_request', to_jsonb(v_request)
  );
end;
$$;

revoke all on function public.reject_collection_by_qr(text, text, text, text[], uuid, text) from public;
grant execute on function public.reject_collection_by_qr(text, text, text, text[], uuid, text) to authenticated;

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
