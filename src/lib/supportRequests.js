import { isPaymentComplete } from './payments'
import { ORDER_FULFILMENT_STATUSES } from './orders'
import { DISPUTE_STATUSES, getActiveOrderDispute, getLatestOrderDispute } from './orderDisputes'
import { supabase } from './supabase'

export const SUPPORT_REQUEST_REASONS = {
  ITEM_NOT_RECEIVED: 'item_not_received',
  ITEM_NOT_AS_DESCRIBED: 'item_not_as_described',
  DAMAGED_ITEM: 'damaged_item',
  COLLECTION_ISSUE: 'collection_issue',
  DELIVERY_ISSUE: 'delivery_issue',
  PAYMENT_OR_PAYOUT_ISSUE: 'payment_or_payout_issue',
  OTHER: 'other',
}

export const SUPPORT_REQUEST_STATUSES = {
  OPEN: 'open',
  REVIEWING: 'reviewing',
  AWAITING_BUYER_EVIDENCE: 'awaiting_buyer_evidence',
  AWAITING_SELLER_EVIDENCE: 'awaiting_seller_evidence',
  REFUND_PENDING: 'refund_pending',
  PARTIAL_REFUND_PENDING: 'partial_refund_pending',
  REFUND_COMPLETED: 'refund_completed',
  REJECTED: 'rejected',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
}

export const SUPPORT_REQUEST_REASON_OPTIONS = [
  { value: SUPPORT_REQUEST_REASONS.ITEM_NOT_RECEIVED, label: 'Item not received' },
  { value: SUPPORT_REQUEST_REASONS.ITEM_NOT_AS_DESCRIBED, label: 'Item not as described' },
  { value: SUPPORT_REQUEST_REASONS.DAMAGED_ITEM, label: 'Damaged item' },
  { value: SUPPORT_REQUEST_REASONS.COLLECTION_ISSUE, label: 'Collection issue' },
  { value: SUPPORT_REQUEST_REASONS.DELIVERY_ISSUE, label: 'Delivery issue' },
  {
    value: SUPPORT_REQUEST_REASONS.PAYMENT_OR_PAYOUT_ISSUE,
    label: 'Payment or payout issue',
  },
  { value: SUPPORT_REQUEST_REASONS.OTHER, label: 'Other' },
]

export function getSupportRequestErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function formatSupportRequestReason(reason) {
  const option = SUPPORT_REQUEST_REASON_OPTIONS.find((entry) => entry.value === reason)
  return option?.label ?? reason
}

export function formatSupportRequestStatus(status) {
  const labels = {
    open: 'Open',
    reviewing: 'Under review',
    awaiting_buyer_evidence: 'Awaiting buyer evidence',
    awaiting_seller_evidence: 'Awaiting seller evidence',
    refund_pending: 'Refund pending',
    partial_refund_pending: 'Partial refund pending',
    refund_completed: 'Refund completed',
    rejected: 'Rejected',
    resolved: 'Resolved',
    closed: 'Case closed',
  }

  return labels[status] ?? status
}

export function formatSupportRequestTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function canRaiseSupportRequest(order, payment) {
  if (!isPaymentComplete(payment)) return false
  if (order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.CANCELLED) return false
  if (order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_PAYMENT) return false
  return true
}

export function isSupportRequestActive(request) {
  return (
    request?.status === SUPPORT_REQUEST_STATUSES.OPEN ||
    request?.status === SUPPORT_REQUEST_STATUSES.REVIEWING ||
    request?.status === SUPPORT_REQUEST_STATUSES.AWAITING_BUYER_EVIDENCE ||
    request?.status === SUPPORT_REQUEST_STATUSES.AWAITING_SELLER_EVIDENCE ||
    request?.status === SUPPORT_REQUEST_STATUSES.REFUND_PENDING ||
    request?.status === SUPPORT_REQUEST_STATUSES.PARTIAL_REFUND_PENDING
  )
}

export function canUserAddSupportEvidence(request, userId) {
  if (!request || !userId) return false
  if (request.status === SUPPORT_REQUEST_STATUSES.AWAITING_BUYER_EVIDENCE) {
    return request.buyer_id === userId
  }
  if (request.status === SUPPORT_REQUEST_STATUSES.AWAITING_SELLER_EVIDENCE) {
    return request.seller_id === userId
  }
  return false
}

export function getEquipdCustomerMessageFromSupportRequest(request) {
  const message = request?.resolution_notes?.trim()
  return message || null
}

export function getEquipdSupportUpdateFromSupportRequest(request) {
  const message = getEquipdCustomerMessageFromSupportRequest(request)
  if (!message) return null

  return {
    statusLabel: formatSupportRequestStatus(request.status),
    message,
    updatedAt: formatSupportRequestTimestamp(request.updated_at ?? request.resolved_at),
  }
}

export function canAdminManageSupportRequest(request) {
  return isSupportRequestActive(request) || canCloseSupportCase(request)
}

function canCloseSupportCase(request) {
  if (!request || request.case_outcome) return false
  const blocked = new Set([
    SUPPORT_REQUEST_STATUSES.REFUND_PENDING,
    SUPPORT_REQUEST_STATUSES.PARTIAL_REFUND_PENDING,
  ])
  if (blocked.has(request.status)) return false
  return (
    request.status === SUPPORT_REQUEST_STATUSES.REJECTED ||
    request.status === SUPPORT_REQUEST_STATUSES.RESOLVED ||
    request.status === SUPPORT_REQUEST_STATUSES.OPEN ||
    request.status === SUPPORT_REQUEST_STATUSES.REVIEWING ||
    request.status === SUPPORT_REQUEST_STATUSES.AWAITING_BUYER_EVIDENCE ||
    request.status === SUPPORT_REQUEST_STATUSES.AWAITING_SELLER_EVIDENCE
  )
}

export function getActiveSupportRequest(requests) {
  return (requests ?? []).find((request) => isSupportRequestActive(request)) ?? null
}

export function getUserActiveSupportRequest(requests, userId) {
  return (requests ?? []).find(
    (request) => request.opened_by === userId && isSupportRequestActive(request),
  )
}

function isClosedDisputeForSupport(dispute) {
  if (!dispute) return false
  if (dispute.case_outcome) return true
  return [
    DISPUTE_STATUSES.RESOLVED,
    DISPUTE_STATUSES.RESOLVED_BUYER,
    DISPUTE_STATUSES.RESOLVED_SELLER,
    DISPUTE_STATUSES.CANCELLED,
  ].includes(dispute.status)
}

function hasClosedBuyerProtectionCaseForSupport(disputes, requests) {
  if (isClosedDisputeForSupport(getLatestOrderDispute(disputes))) return true
  return (requests ?? []).some(
    (request) =>
      request.case_outcome ||
      request.status === SUPPORT_REQUEST_STATUSES.CLOSED ||
      request.status === SUPPORT_REQUEST_STATUSES.RESOLVED,
  )
}

export function canUserRaiseSupportRequest(order, payment, requests, userId, disputes = []) {
  if (!canRaiseSupportRequest(order, payment)) return false
  if (hasClosedBuyerProtectionCaseForSupport(disputes, requests)) return false
  if (getActiveOrderDispute(disputes)) return false
  if (getActiveSupportRequest(requests)) return false
  return true
}

export function canShowResolutionNotes(request) {
  if (!request?.resolution_notes) return false
  return (
    request.status === SUPPORT_REQUEST_STATUSES.RESOLVED ||
    request.status === SUPPORT_REQUEST_STATUSES.CLOSED ||
    request.status === SUPPORT_REQUEST_STATUSES.REJECTED ||
    request.status === SUPPORT_REQUEST_STATUSES.REFUND_PENDING ||
    request.status === SUPPORT_REQUEST_STATUSES.PARTIAL_REFUND_PENDING
  )
}

export async function fetchSupportRequestsForOrder(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('fetch_order_support_requests', {
    p_order_id: orderId,
  })

  return { data: data ?? [], error }
}

export async function createSupportRequest({ orderId, reason, message, evidencePaths, requestId }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const trimmedMessage = message?.trim()

  if (!trimmedMessage) {
    return { data: null, error: new Error('Please describe the issue.') }
  }

  const { data, error } = await supabase.rpc('create_transaction_support_request', {
    p_order_id: orderId,
    p_reason: reason,
    p_message: trimmedMessage,
    p_evidence_paths: evidencePaths ?? [],
    p_request_id: requestId ?? crypto.randomUUID(),
  })

  return { data, error }
}

export async function appendSupportRequestEvidence(requestId, evidencePaths) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('append_support_request_evidence', {
    p_request_id: requestId,
    p_evidence_paths: evidencePaths,
  })

  return { data, error }
}

export async function adminApplySupportDecision({
  requestId,
  decision,
  adminNote,
  customerMessage,
  refundAmountPence,
  evidenceParty,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_apply_support_decision', {
    p_request_id: requestId,
    p_decision: decision,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
    p_refund_amount_pence: refundAmountPence ?? null,
    p_evidence_party: evidenceParty ?? 'buyer',
  })

  return { data, error }
}
