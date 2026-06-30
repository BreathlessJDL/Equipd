import { isPaymentComplete } from './payments'
import {
  hasBuyerTakenPossession,
  isOrderCompleted,
  ORDER_FULFILMENT_STATUSES,
  ORDER_TYPES,
  PAYOUT_STATUSES,
} from './orders'
import { supabase } from './supabase'

export const DISPUTE_REASONS = {
  SIGNIFICANT_UNDISCLOSED_FAULT: 'significant_undisclosed_fault',
  ITEM_NOT_RECEIVED: 'item_not_received',
  WRONG_ITEM_DELIVERED: 'wrong_item_delivered',
  SIGNIFICANT_SELLER_MISREPRESENTATION: 'significant_seller_misrepresentation',
}

export const DISPUTE_STATUSES = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  AWAITING_BUYER_EVIDENCE: 'awaiting_buyer_evidence',
  AWAITING_SELLER_EVIDENCE: 'awaiting_seller_evidence',
  RETURN_AUTHORISED: 'return_authorised',
  AWAITING_SELLER_COLLECTION: 'awaiting_seller_collection',
  COLLECTION_ARRANGED: 'collection_arranged',
  COLLECTION_CONFIRMED: 'collection_confirmed',
  READY_FOR_REFUND: 'ready_for_refund',
  REFUND_PENDING: 'refund_pending',
  PARTIAL_REFUND_PENDING: 'partial_refund_pending',
  REFUND_COMPLETED: 'refund_completed',
  REJECTED: 'rejected',
  RESOLVED: 'resolved',
  RESOLVED_BUYER: 'resolved_buyer',
  RESOLVED_SELLER: 'resolved_seller',
  CANCELLED: 'cancelled',
}

export const ADMIN_DISPUTE_DECISIONS = {
  MARK_UNDER_REVIEW: 'mark_under_review',
  REQUEST_MORE_EVIDENCE: 'request_more_evidence',
  AUTHORISE_RETURN: 'authorise_return',
  ISSUE_REFUND_WITHOUT_RETURN: 'issue_refund_without_return',
  ISSUE_REFUND_AFTER_COLLECTION: 'issue_refund_after_collection',
  APPROVE_FULL_REFUND: 'approve_full_refund',
  APPROVE_PARTIAL_REFUND: 'approve_partial_refund',
  REJECT_CLAIM: 'reject_claim',
  MARK_RESOLVED_MANUALLY: 'mark_resolved_manually',
}

const PARTIAL_REFUND_LABEL = 'Record agreed partial refund'

export const ADMIN_DISPUTE_DECISION_OPTIONS = [
  { value: ADMIN_DISPUTE_DECISIONS.MARK_UNDER_REVIEW, label: 'Mark under review' },
  { value: ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE, label: 'Request more evidence' },
  { value: ADMIN_DISPUTE_DECISIONS.AUTHORISE_RETURN, label: 'Authorise return' },
  {
    value: ADMIN_DISPUTE_DECISIONS.ISSUE_REFUND_WITHOUT_RETURN,
    label: 'Issue full refund without return',
  },
  { value: ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND, label: PARTIAL_REFUND_LABEL },
  { value: ADMIN_DISPUTE_DECISIONS.REJECT_CLAIM, label: 'Reject claim' },
  { value: ADMIN_DISPUTE_DECISIONS.MARK_RESOLVED_MANUALLY, label: 'Mark resolved manually' },
]

export const ADMIN_SUPPORT_DECISION_OPTIONS = [
  { value: ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE, label: 'Request more evidence' },
  { value: ADMIN_DISPUTE_DECISIONS.APPROVE_FULL_REFUND, label: 'Approve full refund' },
  { value: ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND, label: PARTIAL_REFUND_LABEL },
  { value: ADMIN_DISPUTE_DECISIONS.REJECT_CLAIM, label: 'Reject claim' },
  { value: ADMIN_DISPUTE_DECISIONS.MARK_RESOLVED_MANUALLY, label: 'Mark resolved manually' },
]

export const ADMIN_DECISION_GROUP_LABELS = {
  INVESTIGATION: 'Investigation',
  RESOLUTION: 'Resolution',
  CLOSE: 'Close',
}

export function getAdminInvestigationDecisionOptions(dispute) {
  const groups = dispute ? getAdminDisputeDecisionGroups(dispute) : getAdminSupportDecisionGroups()
  return groups.find((group) => group.label === ADMIN_DECISION_GROUP_LABELS.INVESTIGATION)?.options ?? []
}

export function getAdminResolutionDecisionOptions(dispute) {
  const groups = dispute ? getAdminDisputeDecisionGroups(dispute) : getAdminSupportDecisionGroups()
  return groups.find((group) => group.label === ADMIN_DECISION_GROUP_LABELS.RESOLUTION)?.options ?? []
}

export function getAdminDisputeDecisionGroups(dispute) {
  const inReturnWorkflow = isReturnWorkflowDispute(dispute)

  const investigation = [
    { value: ADMIN_DISPUTE_DECISIONS.MARK_UNDER_REVIEW, label: 'Mark under review' },
    { value: ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE, label: 'Request more evidence' },
  ]

  const resolution = [
    ...(inReturnWorkflow
      ? []
      : [
          { value: ADMIN_DISPUTE_DECISIONS.AUTHORISE_RETURN, label: 'Authorise return' },
          {
            value: ADMIN_DISPUTE_DECISIONS.ISSUE_REFUND_WITHOUT_RETURN,
            label: 'Issue full refund without return',
          },
        ]),
    { value: ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND, label: PARTIAL_REFUND_LABEL },
    { value: ADMIN_DISPUTE_DECISIONS.REJECT_CLAIM, label: 'Reject claim' },
  ]

  const close = [
    { value: ADMIN_DISPUTE_DECISIONS.MARK_RESOLVED_MANUALLY, label: 'Mark resolved manually' },
  ]

  return [
    { label: ADMIN_DECISION_GROUP_LABELS.INVESTIGATION, options: investigation },
    { label: ADMIN_DECISION_GROUP_LABELS.RESOLUTION, options: resolution },
    { label: ADMIN_DECISION_GROUP_LABELS.CLOSE, options: close },
  ]
}

export function getAdminSupportDecisionGroups() {
  return [
    {
      label: ADMIN_DECISION_GROUP_LABELS.INVESTIGATION,
      options: [
        { value: ADMIN_DISPUTE_DECISIONS.REQUEST_MORE_EVIDENCE, label: 'Request more evidence' },
      ],
    },
    {
      label: ADMIN_DECISION_GROUP_LABELS.RESOLUTION,
      options: [
        { value: ADMIN_DISPUTE_DECISIONS.APPROVE_FULL_REFUND, label: 'Approve full refund' },
        { value: ADMIN_DISPUTE_DECISIONS.APPROVE_PARTIAL_REFUND, label: PARTIAL_REFUND_LABEL },
        { value: ADMIN_DISPUTE_DECISIONS.REJECT_CLAIM, label: 'Reject claim' },
      ],
    },
    {
      label: ADMIN_DECISION_GROUP_LABELS.CLOSE,
      options: [
        { value: ADMIN_DISPUTE_DECISIONS.MARK_RESOLVED_MANUALLY, label: 'Mark resolved manually' },
      ],
    },
  ]
}

export function getAdminDisputeDecisionOptions(dispute) {
  return getAdminDisputeDecisionGroups(dispute).flatMap((group) => group.options)
}

const DISPUTE_REASON_LABELS = {
  [DISPUTE_REASONS.SIGNIFICANT_UNDISCLOSED_FAULT]: 'Significant undisclosed fault',
  [DISPUTE_REASONS.ITEM_NOT_RECEIVED]: 'Item not received',
  [DISPUTE_REASONS.WRONG_ITEM_DELIVERED]: 'Wrong item delivered',
  [DISPUTE_REASONS.SIGNIFICANT_SELLER_MISREPRESENTATION]:
    'Significant seller misrepresentation',
}

const DISPUTE_STATUS_LABELS = {
  [DISPUTE_STATUSES.OPEN]: 'Open',
  [DISPUTE_STATUSES.UNDER_REVIEW]: 'Under review',
  [DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE]: 'Awaiting buyer evidence',
  [DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE]: 'Awaiting seller evidence',
  [DISPUTE_STATUSES.RETURN_AUTHORISED]: 'Return authorised',
  [DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION]: 'Awaiting seller collection',
  [DISPUTE_STATUSES.COLLECTION_ARRANGED]: 'Collection arranged',
  [DISPUTE_STATUSES.COLLECTION_CONFIRMED]: 'Collection confirmed',
  [DISPUTE_STATUSES.READY_FOR_REFUND]: 'Ready for refund',
  [DISPUTE_STATUSES.REFUND_PENDING]: 'Refund pending',
  [DISPUTE_STATUSES.PARTIAL_REFUND_PENDING]: 'Partial refund pending',
  [DISPUTE_STATUSES.REFUND_COMPLETED]: 'Refund completed',
  [DISPUTE_STATUSES.REJECTED]: 'Rejected',
  [DISPUTE_STATUSES.RESOLVED]: 'Case closed',
  [DISPUTE_STATUSES.RESOLVED_BUYER]: 'Resolved in buyer favour',
  [DISPUTE_STATUSES.RESOLVED_SELLER]: 'Resolved in seller favour',
  [DISPUTE_STATUSES.CANCELLED]: 'Cancelled',
}

const ACTIVE_DISPUTE_STATUSES = new Set([
  DISPUTE_STATUSES.OPEN,
  DISPUTE_STATUSES.UNDER_REVIEW,
  DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE,
  DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE,
  DISPUTE_STATUSES.RETURN_AUTHORISED,
  DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
  DISPUTE_STATUSES.COLLECTION_ARRANGED,
  DISPUTE_STATUSES.COLLECTION_CONFIRMED,
  DISPUTE_STATUSES.READY_FOR_REFUND,
  DISPUTE_STATUSES.REFUND_PENDING,
  DISPUTE_STATUSES.PARTIAL_REFUND_PENDING,
])

const DISPUTE_REASONS_BY_ORDER_TYPE = {
  [ORDER_TYPES.COLLECTION]: [DISPUTE_REASONS.SIGNIFICANT_UNDISCLOSED_FAULT],
  [ORDER_TYPES.SELLER_DELIVERY]: [
    DISPUTE_REASONS.SIGNIFICANT_UNDISCLOSED_FAULT,
    DISPUTE_REASONS.ITEM_NOT_RECEIVED,
    DISPUTE_REASONS.WRONG_ITEM_DELIVERED,
  ],
  [ORDER_TYPES.BUYER_COURIER]: [DISPUTE_REASONS.SIGNIFICANT_SELLER_MISREPRESENTATION],
}

const BLOCKED_FULFILMENT_STATUSES = new Set([
  ORDER_FULFILMENT_STATUSES.DISPUTED,
  ORDER_FULFILMENT_STATUSES.REFUNDED,
  ORDER_FULFILMENT_STATUSES.CANCELLED,
  ORDER_FULFILMENT_STATUSES.COMPLETED,
])

export function formatDisputeReason(reason) {
  return DISPUTE_REASON_LABELS[reason] ?? reason
}

export function formatDisputeStatus(status) {
  return DISPUTE_STATUS_LABELS[status] ?? status
}

export function formatDisputeTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function getDisputeReasonOptions(orderType) {
  const reasons =
    DISPUTE_REASONS_BY_ORDER_TYPE[orderType ?? ORDER_TYPES.COLLECTION] ??
    DISPUTE_REASONS_BY_ORDER_TYPE[ORDER_TYPES.COLLECTION]

  return reasons.map((value) => ({
    value,
    label: formatDisputeReason(value),
  }))
}

export function getDisputeSingleReasonNote(orderType) {
  const normalizedType = orderType ?? ORDER_TYPES.COLLECTION

  if (normalizedType === ORDER_TYPES.COLLECTION) {
    return 'Collection orders only support reporting a significant undisclosed fault after you have collected and inspected the item.'
  }

  if (normalizedType === ORDER_TYPES.BUYER_COURIER) {
    return 'Courier orders only support reporting significant seller misrepresentation (the item was not as described in the listing).'
  }

  return null
}

function isReturnWorkflowDispute(dispute) {
  if (!dispute) return false

  return (
    dispute.status === DISPUTE_STATUSES.RETURN_AUTHORISED ||
    dispute.status === DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION ||
    dispute.status === DISPUTE_STATUSES.COLLECTION_ARRANGED ||
    dispute.status === DISPUTE_STATUSES.COLLECTION_CONFIRMED ||
    dispute.status === DISPUTE_STATUSES.READY_FOR_REFUND
  )
}

export function isDisputeActive(dispute) {
  return ACTIVE_DISPUTE_STATUSES.has(dispute?.status)
}

export function getActiveOrderDispute(disputes) {
  return (disputes ?? []).find((dispute) => isDisputeActive(dispute)) ?? null
}

export function isBuyerProtectionWindowActive(order) {
  if (!order?.payout_release_at || order?.payout_released_at) return false
  if (order?.payout_status === PAYOUT_STATUSES.PAID) return false
  if (!hasBuyerTakenPossession(order)) return false

  const releaseAt = new Date(order.payout_release_at).getTime()
  return !Number.isNaN(releaseAt) && releaseAt > Date.now()
}

function isDisputeClosedForDisplay(dispute) {
  if (!dispute) return false
  if (dispute.case_outcome) return true
  return [
    DISPUTE_STATUSES.RESOLVED,
    DISPUTE_STATUSES.RESOLVED_BUYER,
    DISPUTE_STATUSES.RESOLVED_SELLER,
    DISPUTE_STATUSES.CANCELLED,
  ].includes(dispute.status)
}

export function formatBuyerProtectionStatus(order, payment, disputes = []) {
  if (!order) return '—'

  const latestDispute = getLatestOrderDispute(disputes)
  if (latestDispute && isDisputeClosedForDisplay(latestDispute)) {
    return 'Case closed'
  }

  if (isOrderDisputed(order) || order.fulfilment_status === ORDER_FULFILMENT_STATUSES.DISPUTED) {
    return 'Under dispute'
  }

  if (isBuyerProtectionWindowActive(order)) {
    return 'Protection window active'
  }

  if (order.protection_status === 'released') {
    return 'Protection released'
  }

  if (isOrderCompleted(order)) {
    return 'Protection ended'
  }

  if (hasBuyerTakenPossession(order) && order.payout_release_at) {
    const releaseAt = new Date(order.payout_release_at).getTime()
    if (!Number.isNaN(releaseAt) && releaseAt <= Date.now()) {
      return 'Protection ended'
    }
  }

  if (isPaymentComplete(payment)) {
    return 'Starts after you receive the item'
  }

  return 'Not started'
}

export function getBuyerProtectionTimeRemaining(order) {
  if (!isBuyerProtectionWindowActive(order)) return null

  const releaseAt = new Date(order.payout_release_at).getTime()
  const remainingMs = Math.max(0, releaseAt - Date.now())

  const totalMinutes = Math.ceil(remainingMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m remaining`
  }

  if (hours > 0) {
    return `${hours}h remaining`
  }

  return `${minutes}m remaining`
}

export function canBuyerOpenDispute(order, payment, disputes) {
  if (!order || !isPaymentComplete(payment)) return false
  if (order.buyer_id == null) return false
  if (BLOCKED_FULFILMENT_STATUSES.has(order.fulfilment_status)) return false
  if (
    order.fulfilment_status !== ORDER_FULFILMENT_STATUSES.COLLECTED &&
    order.fulfilment_status !== ORDER_FULFILMENT_STATUSES.DELIVERED
  ) {
    return false
  }
  if (!isBuyerProtectionWindowActive(order)) return false
  if (getActiveOrderDispute(disputes)) return false
  if (isDisputeClosedForDisplay(getLatestOrderDispute(disputes))) return false
  return true
}

export function isOrderDisputed(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.DISPUTED
}

export function getDisputeBuyerMessage() {
  return 'Your dispute has been raised. Equipd support is reviewing the case and will contact you if anything else is needed.'
}

export function getDisputeSellerMessage() {
  return 'The buyer has raised a Buyer Protection dispute and uploaded evidence. Equipd support is reviewing the case.'
}

export function getDisputeAdminMessage() {
  return 'Buyer Protection dispute open. Review evidence and case status below.'
}

export function getDisputeErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function fetchDisputesForOrder(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('fetch_order_disputes', {
    p_order_id: orderId,
  })

  return { data: data ?? [], error }
}

export function getLatestOrderDispute(disputes) {
  return (disputes ?? [])[0] ?? null
}

export function getEquipdCustomerMessageFromDispute(dispute) {
  const message = dispute?.customer_message?.trim()
  return message || null
}

function isBuyerCentricDisputeOpenedMessage(message) {
  const trimmed = message?.trim()
  if (!trimmed) return false

  return /^your dispute has been raised/i.test(trimmed)
}

export function getDisputeSupportMessageForViewer(dispute, viewerRole) {
  const message = getEquipdCustomerMessageFromDispute(dispute)
  if (!message) return null

  if (isBuyerCentricDisputeOpenedMessage(message)) {
    if (viewerRole === 'seller') return getDisputeSellerMessage()
    if (viewerRole === 'admin') return getDisputeAdminMessage()
    if (viewerRole === 'buyer') return getDisputeBuyerMessage()
  }

  return message
}

export function getEquipdSupportUpdateFromDispute(dispute, viewerRole = null) {
  const message = viewerRole
    ? getDisputeSupportMessageForViewer(dispute, viewerRole)
    : getEquipdCustomerMessageFromDispute(dispute)
  if (!message) return null

  return {
    statusLabel: formatDisputeStatus(dispute.status),
    message,
    updatedAt: formatDisputeTimestamp(dispute.updated_at ?? dispute.resolved_at),
  }
}

export function canAdminManageDispute(dispute) {
  return isDisputeActive(dispute)
}

export function getDisputeResolutionMessage(dispute) {
  if (dispute?.customer_message) {
    return dispute.customer_message
  }

  if (dispute?.status === DISPUTE_STATUSES.RESOLVED_BUYER) {
    return dispute.resolution ?? 'Resolved in your favour. Refund processing is manual for now.'
  }

  if (dispute?.status === DISPUTE_STATUSES.RESOLVED_SELLER) {
    return dispute.resolution ?? 'Resolved in seller\'s favour. Payout can proceed.'
  }

  if (dispute?.status === DISPUTE_STATUSES.REFUND_PENDING) {
    return dispute.resolution ?? 'Full refund approved. Equipd will process this manually.'
  }

  if (dispute?.status === DISPUTE_STATUSES.PARTIAL_REFUND_PENDING) {
    return dispute.resolution ?? 'Partial refund approved. Equipd will process this manually.'
  }

  if (dispute?.status === DISPUTE_STATUSES.REFUND_COMPLETED) {
    return dispute.resolution ?? 'The refund has been completed.'
  }

  if (dispute?.status === DISPUTE_STATUSES.REJECTED) {
    return dispute.resolution ?? 'Your claim was reviewed and rejected.'
  }

  if (dispute?.status === DISPUTE_STATUSES.RESOLVED) {
    return dispute.resolution ?? 'Equipd marked this issue as resolved.'
  }

  return dispute?.resolution ?? null
}

export async function adminMarkDisputeUnderReview(disputeId, adminNote) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_mark_dispute_under_review', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
  })

  return { data, error }
}

export async function adminResolveDisputeForSeller(disputeId, adminNote) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_resolve_dispute_for_seller', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
  })

  return { data, error }
}

export async function adminResolveDisputeForBuyer(disputeId, adminNote) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_resolve_dispute_for_buyer', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
  })

  return { data, error }
}

export async function adminApplyDisputeDecision({
  disputeId,
  decision,
  adminNote,
  customerMessage,
  refundAmountPence,
  evidenceParty,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_apply_dispute_decision', {
    p_dispute_id: disputeId,
    p_decision: decision,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
    p_refund_amount_pence: refundAmountPence ?? null,
    p_evidence_party: evidenceParty ?? 'buyer',
  })

  return { data, error }
}

export async function openOrderDispute({
  orderId,
  disputeId,
  reason,
  description,
  evidencePaths,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const trimmedDescription = description?.trim()

  if (!trimmedDescription) {
    return { data: null, error: new Error('Please describe the problem.') }
  }

  if (!evidencePaths?.length) {
    return { data: null, error: new Error('At least one evidence photo is required.') }
  }

  const { data, error } = await supabase.rpc('open_order_dispute', {
    p_order_id: orderId,
    p_reason: reason,
    p_description: trimmedDescription,
    p_evidence_paths: evidencePaths,
    p_dispute_id: disputeId,
  })

  return { data, error }
}

export async function appendOrderDisputeEvidence(disputeId, evidencePaths) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('append_order_dispute_evidence', {
    p_dispute_id: disputeId,
    p_evidence_paths: evidencePaths,
  })

  return { data, error }
}

export async function devEndBuyerProtectionNow(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const userAgent =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent.slice(0, 512)
      : null

  const { data, error } = await supabase.rpc('dev_end_buyer_protection_now', {
    p_order_id: orderId,
    p_user_agent: userAgent,
    p_checks: {
      source: 'dev_end_buyer_protection_button',
    },
  })

  return { data, error }
}
