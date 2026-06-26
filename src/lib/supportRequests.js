import { isPaymentComplete } from './payments'
import { ORDER_FULFILMENT_STATUSES } from './orders'
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
    resolved: 'Resolved',
    closed: 'Closed',
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
    request?.status === SUPPORT_REQUEST_STATUSES.REVIEWING
  )
}

export function getUserActiveSupportRequest(requests, userId) {
  return (requests ?? []).find(
    (request) => request.opened_by === userId && isSupportRequestActive(request),
  )
}

export function canUserRaiseSupportRequest(order, payment, requests, userId) {
  if (!canRaiseSupportRequest(order, payment)) return false
  return !getUserActiveSupportRequest(requests, userId)
}

export function canShowResolutionNotes(request) {
  if (!request?.resolution_notes) return false
  return (
    request.status === SUPPORT_REQUEST_STATUSES.RESOLVED ||
    request.status === SUPPORT_REQUEST_STATUSES.CLOSED
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

export async function createSupportRequest({ orderId, reason, message }) {
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
  })

  return { data, error }
}
