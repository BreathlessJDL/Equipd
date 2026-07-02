-- Ensure orders_client exposes seller_service_fee_pence for Hub batch selects.

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
