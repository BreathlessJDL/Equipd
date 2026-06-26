-- Equipd Fulfilment architecture — Phase 5 (app deprecation note)
-- No schema changes. Safe to run (comments only).
--
-- The legacy order_handover_details app layer was removed in favour of:
--   - listing_fulfilment_private (seller collection/courier details at listing time)
--   - order_delivery_details (buyer delivery address after payment)
--   - OrderFulfilmentDetailsCard on Order Detail (Phase 3)
--
-- INTENTIONALLY RETAINED (do not drop without a dedicated teardown migration):
--   - public.order_handover_details table
--   - get_order_handover_details / update_order_handover_details RPCs
--   - order-handover-details-phase4a-foundation.sql
--   - order-handover-details-phase4b-rpc.sql
--
-- New app code must NOT call the handover RPCs or read order_handover_details.
-- Coordination (times, access) remains in messaging for paid orders.

comment on table public.order_handover_details is
  'DEPRECATED app surface (Phase 5). Legacy per-order handover fields. Replaced by listing_fulfilment_private and order_delivery_details. Table retained for audit; do not use from new app code.';
