-- =============================================================================
-- Equipd simplified dispute / support workflow — PHASE 1: ENUMS ONLY
-- =============================================================================
--
-- Prerequisites:
--   buyer-protection-phase4c-dispute-admin-resolution.sql
--   support-team-email-notifications.sql
--
-- HOW TO RUN (Supabase SQL Editor):
--   1. Run THIS file only. Wait until it completes successfully.
--   2. Then run dispute-support-simplified-02-schema-functions.sql
--
-- This file adds enum values only. It does not use the new values in indexes,
-- constraints, functions, or casts. Postgres requires enum additions to be
-- committed before they can be referenced elsewhere.
--
-- Do not wrap this file and file 02 in a single transaction.
-- =============================================================================

-- order_fulfilment_status
ALTER TYPE public.order_fulfilment_status ADD VALUE IF NOT EXISTS 'refund_pending';

-- support_request_status
ALTER TYPE public.support_request_status ADD VALUE IF NOT EXISTS 'awaiting_buyer_evidence';
ALTER TYPE public.support_request_status ADD VALUE IF NOT EXISTS 'awaiting_seller_evidence';
ALTER TYPE public.support_request_status ADD VALUE IF NOT EXISTS 'refund_pending';
ALTER TYPE public.support_request_status ADD VALUE IF NOT EXISTS 'partial_refund_pending';
ALTER TYPE public.support_request_status ADD VALUE IF NOT EXISTS 'rejected';
