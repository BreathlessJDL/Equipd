-- =============================================================================
-- Equipd Case Management — Phase 2.5: Admin polish (case outcome field)
-- =============================================================================
--
-- Prerequisites: case-management-phase2-return-workflow.sql
-- Internal-only outcome field for Phase 3 case closure.
-- =============================================================================

alter table public.order_disputes
  add column if not exists case_outcome text;

alter table public.order_disputes
  drop constraint if exists order_disputes_case_outcome_valid;

alter table public.order_disputes
  add constraint order_disputes_case_outcome_valid
  check (
    case_outcome is null
    or case_outcome in (
      'buyer_upheld_full_refund',
      'buyer_upheld_partial_refund',
      'seller_upheld',
      'mutual_agreement',
      'outside_buyer_protection',
      'duplicate',
      'cancelled'
    )
  );

comment on column public.order_disputes.case_outcome is
  'Internal Equipd outcome recorded when a case is closed. Not shown to customers.';

alter table public.transaction_support_requests
  add column if not exists case_outcome text;

alter table public.transaction_support_requests
  drop constraint if exists transaction_support_requests_case_outcome_valid;

alter table public.transaction_support_requests
  add constraint transaction_support_requests_case_outcome_valid
  check (
    case_outcome is null
    or case_outcome in (
      'buyer_upheld_full_refund',
      'buyer_upheld_partial_refund',
      'seller_upheld',
      'mutual_agreement',
      'outside_buyer_protection',
      'duplicate',
      'cancelled'
    )
  );

comment on column public.transaction_support_requests.case_outcome is
  'Internal Equipd outcome recorded when a case is closed. Not shown to customers.';
