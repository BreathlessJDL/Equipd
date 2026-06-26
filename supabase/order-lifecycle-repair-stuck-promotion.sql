-- Repair orders stuck after the old promote_order_after_buyer_protection_window
-- (buyer_confirmed + protection_status active + payout_release_at cleared).
-- Run after order-lifecycle-complete-on-protection-expiry.sql (step 52).

update public.orders o
set
  fulfilment_status = 'completed'::public.order_fulfilment_status,
  protection_status = 'released',
  buyer_confirmed_at = coalesce(
    o.buyer_confirmed_at,
    o.collected_at,
    o.delivered_at,
    o.updated_at
  ),
  payout_release_at = coalesce(
    o.payout_release_at,
    o.buyer_confirmed_at,
    o.collected_at,
    o.delivered_at,
    o.updated_at
  )
where o.protection_status = 'active'
  and o.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status
  and o.payout_status in (
    'ready'::public.payout_status,
    'awaiting_seller_setup'::public.payout_status,
    'processing'::public.payout_status,
    'failed'::public.payout_status
  )
  and coalesce(o.collected_at, o.delivered_at, o.buyer_confirmed_at) is not null;

update public.listings l
set status = 'sold'::public.listing_status
from public.orders o
where o.listing_id = l.id
  and o.fulfilment_status = 'completed'::public.order_fulfilment_status
  and l.status = 'in_progress'::public.listing_status;

notify pgrst, 'reload schema';
