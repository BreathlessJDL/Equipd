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
  RESOLVED_BUYER: 'resolved_buyer',
  RESOLVED_SELLER: 'resolved_seller',
  CANCELLED: 'cancelled',
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
  [DISPUTE_STATUSES.RESOLVED_BUYER]: 'Resolved in buyer favour',
  [DISPUTE_STATUSES.RESOLVED_SELLER]: 'Resolved in seller favour',
  [DISPUTE_STATUSES.CANCELLED]: 'Cancelled',
}

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

export function isDisputeActive(dispute) {
  return (
    dispute?.status === DISPUTE_STATUSES.OPEN ||
    dispute?.status === DISPUTE_STATUSES.UNDER_REVIEW
  )
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

export function formatBuyerProtectionStatus(order, payment) {
  if (!order) return '—'

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
  return true
}

export function isOrderDisputed(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.DISPUTED
}

export function getDisputeBuyerMessage() {
  return 'Dispute opened. Equipd will review the issue before any payout is released.'
}

export function getDisputeSellerMessage() {
  return 'Order disputed. Payout is on hold while Equipd reviews the issue.'
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

export function canAdminManageDispute(dispute) {
  return (
    dispute?.status === DISPUTE_STATUSES.OPEN ||
    dispute?.status === DISPUTE_STATUSES.UNDER_REVIEW
  )
}

export function getDisputeResolutionMessage(dispute) {
  if (dispute?.status === DISPUTE_STATUSES.RESOLVED_BUYER) {
    return dispute.resolution ?? 'Resolved in your favour. Refund processing is manual for now.'
  }

  if (dispute?.status === DISPUTE_STATUSES.RESOLVED_SELLER) {
    return dispute.resolution ?? 'Resolved in seller\'s favour. Payout can proceed.'
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
