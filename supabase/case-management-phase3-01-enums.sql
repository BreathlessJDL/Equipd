-- =============================================================================
-- Equipd Case Management — Phase 3: ENUMS ONLY
-- =============================================================================
--
-- Run this file first and wait for success before running phase3-02.
-- =============================================================================

ALTER TYPE public.support_request_status ADD VALUE IF NOT EXISTS 'refund_completed';
