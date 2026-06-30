import { supabase } from './supabase'
import { DISPUTE_STATUSES, getLatestOrderDispute } from './orderDisputes'
import { SUPPORT_REQUEST_STATUSES } from './supportRequests'

export const CASE_OUTCOMES = {
  BUYER_UPHELD_FULL_REFUND: 'buyer_upheld_full_refund',
  BUYER_UPHELD_PARTIAL_REFUND: 'buyer_upheld_partial_refund',
  SELLER_UPHELD: 'seller_upheld',
  MUTUAL_AGREEMENT: 'mutual_agreement',
  OUTSIDE_BUYER_PROTECTION: 'outside_buyer_protection',
  DUPLICATE: 'duplicate',
  CANCELLED: 'cancelled',
}

export const CASE_OUTCOME_OPTIONS = [
  { value: CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND, label: 'Buyer upheld — full refund' },
  { value: CASE_OUTCOMES.BUYER_UPHELD_PARTIAL_REFUND, label: 'Buyer upheld — partial refund' },
  { value: CASE_OUTCOMES.SELLER_UPHELD, label: 'Seller upheld' },
  { value: CASE_OUTCOMES.MUTUAL_AGREEMENT, label: 'Mutual agreement' },
  { value: CASE_OUTCOMES.OUTSIDE_BUYER_PROTECTION, label: 'Outside Buyer Protection' },
  { value: CASE_OUTCOMES.DUPLICATE, label: 'Duplicate' },
  { value: CASE_OUTCOMES.CANCELLED, label: 'Cancelled' },
]

const REFUND_PENDING_STATUSES = new Set([
  DISPUTE_STATUSES.REFUND_PENDING,
  DISPUTE_STATUSES.PARTIAL_REFUND_PENDING,
  SUPPORT_REQUEST_STATUSES.REFUND_PENDING,
  SUPPORT_REQUEST_STATUSES.PARTIAL_REFUND_PENDING,
])

const CLOSE_BLOCKED_STATUSES = new Set([
  DISPUTE_STATUSES.REFUND_PENDING,
  DISPUTE_STATUSES.PARTIAL_REFUND_PENDING,
  DISPUTE_STATUSES.READY_FOR_REFUND,
  DISPUTE_STATUSES.RETURN_AUTHORISED,
  DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
  DISPUTE_STATUSES.COLLECTION_ARRANGED,
  DISPUTE_STATUSES.COLLECTION_CONFIRMED,
  SUPPORT_REQUEST_STATUSES.REFUND_PENDING,
  SUPPORT_REQUEST_STATUSES.PARTIAL_REFUND_PENDING,
])

const CLOSE_ALLOWED_STATUSES = new Set([
  DISPUTE_STATUSES.REFUND_COMPLETED,
  DISPUTE_STATUSES.REJECTED,
  DISPUTE_STATUSES.RESOLVED,
  DISPUTE_STATUSES.RESOLVED_BUYER,
  DISPUTE_STATUSES.RESOLVED_SELLER,
  DISPUTE_STATUSES.OPEN,
  DISPUTE_STATUSES.UNDER_REVIEW,
  DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE,
  DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE,
  SUPPORT_REQUEST_STATUSES.REFUND_COMPLETED,
  SUPPORT_REQUEST_STATUSES.REJECTED,
  SUPPORT_REQUEST_STATUSES.RESOLVED,
  SUPPORT_REQUEST_STATUSES.OPEN,
  SUPPORT_REQUEST_STATUSES.REVIEWING,
  SUPPORT_REQUEST_STATUSES.AWAITING_BUYER_EVIDENCE,
  SUPPORT_REQUEST_STATUSES.AWAITING_SELLER_EVIDENCE,
])

export function getCaseClosureErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function isAdminCaseWorkflowComplete(record) {
  if (!record) return false

  const completeStatuses = new Set([
    DISPUTE_STATUSES.REFUND_COMPLETED,
    DISPUTE_STATUSES.REJECTED,
    DISPUTE_STATUSES.RESOLVED,
    DISPUTE_STATUSES.RESOLVED_BUYER,
    DISPUTE_STATUSES.RESOLVED_SELLER,
    SUPPORT_REQUEST_STATUSES.REFUND_COMPLETED,
    SUPPORT_REQUEST_STATUSES.REJECTED,
    SUPPORT_REQUEST_STATUSES.RESOLVED,
  ])

  return completeStatuses.has(record.status)
}

export function isAdminCaseFinanceComplete(record) {
  if (!record) return false

  return isAdminCaseWorkflowComplete(record)
}

export function canMarkRefundCompleted(record) {
  return REFUND_PENDING_STATUSES.has(record?.status)
}

export function formatCaseOutcomeLabel(outcome) {
  return CASE_OUTCOME_OPTIONS.find((option) => option.value === outcome)?.label ?? outcome ?? '—'
}

const CLOSED_DISPUTE_STATUSES = new Set([
  DISPUTE_STATUSES.RESOLVED,
  DISPUTE_STATUSES.RESOLVED_BUYER,
  DISPUTE_STATUSES.RESOLVED_SELLER,
  DISPUTE_STATUSES.CANCELLED,
])

const CLOSED_SUPPORT_STATUSES = new Set([
  SUPPORT_REQUEST_STATUSES.CLOSED,
  SUPPORT_REQUEST_STATUSES.RESOLVED,
])

export function isCaseClosed(record) {
  if (!record) return false
  if (record.case_outcome) return true
  if (CLOSED_DISPUTE_STATUSES.has(record.status)) return true
  if (CLOSED_SUPPORT_STATUSES.has(record.status)) return true
  return false
}

export function hasClosedBuyerProtectionCase(disputes = [], supportRequests = []) {
  const latestDispute = getLatestOrderDispute(disputes)
  if (latestDispute && isCaseClosed(latestDispute)) return true
  return (supportRequests ?? []).some((request) => isCaseClosed(request))
}

export function canCloseCase(record) {
  if (!record || isCaseClosed(record)) return false
  if (CLOSE_BLOCKED_STATUSES.has(record?.status)) return false
  return CLOSE_ALLOWED_STATUSES.has(record?.status)
}

export function getDefaultRefundCompletedCustomerMessage() {
  return 'The refund has now been completed. Equipd will close this case once final checks are complete.'
}

export function getDefaultCloseCaseCustomerMessage(outcome) {
  switch (outcome) {
    case CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND:
      return 'This case has now been resolved and closed. Thank you for working with Equipd while we reviewed the issue.'
    case CASE_OUTCOMES.BUYER_UPHELD_PARTIAL_REFUND:
      return 'This case has now been resolved following the agreed partial refund.'
    case CASE_OUTCOMES.SELLER_UPHELD:
      return 'This case has now been closed. After reviewing the information provided, Equipd was unable to uphold the claim under Buyer Protection.'
    case CASE_OUTCOMES.MUTUAL_AGREEMENT:
      return 'This case has now been closed following the agreement reached between buyer and seller.'
    case CASE_OUTCOMES.OUTSIDE_BUYER_PROTECTION:
      return 'This case has now been closed. The issue falls outside Equipd Buyer Protection.'
    case CASE_OUTCOMES.DUPLICATE:
      return 'This case has been closed as a duplicate. If you still need help, please contact Equipd support.'
    case CASE_OUTCOMES.CANCELLED:
      return 'This case has been closed at the request of the parties involved.'
    default:
      return 'This case has now been resolved and closed.'
  }
}

export function suggestCaseOutcome(record) {
  if (!record) return CASE_OUTCOMES.MUTUAL_AGREEMENT

  if (record.status === DISPUTE_STATUSES.REJECTED || record.status === SUPPORT_REQUEST_STATUSES.REJECTED) {
    return CASE_OUTCOMES.SELLER_UPHELD
  }

  if (
    record.status === DISPUTE_STATUSES.REFUND_COMPLETED ||
    record.status === SUPPORT_REQUEST_STATUSES.REFUND_COMPLETED
  ) {
    if (record.refund_amount_pence > 0) {
      return CASE_OUTCOMES.BUYER_UPHELD_PARTIAL_REFUND
    }

    return CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND
  }

  return CASE_OUTCOMES.MUTUAL_AGREEMENT
}

export async function adminMarkDisputeRefundCompleted({
  disputeId,
  adminNote,
  customerMessage,
  refundReference,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_mark_dispute_refund_completed', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
    p_refund_reference: refundReference?.trim() || null,
  })

  return { data, error }
}

export async function adminMarkSupportRefundCompleted({
  requestId,
  adminNote,
  customerMessage,
  refundReference,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_mark_support_refund_completed', {
    p_request_id: requestId,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
    p_refund_reference: refundReference?.trim() || null,
  })

  return { data, error }
}

export async function adminCloseDisputeCase({
  disputeId,
  caseOutcome,
  adminNote,
  customerMessage,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_close_dispute_case', {
    p_dispute_id: disputeId,
    p_case_outcome: caseOutcome,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
  })

  return { data, error }
}

export async function adminCloseSupportCase({
  requestId,
  caseOutcome,
  adminNote,
  customerMessage,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_close_support_case', {
    p_request_id: requestId,
    p_case_outcome: caseOutcome,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
  })

  return { data, error }
}
