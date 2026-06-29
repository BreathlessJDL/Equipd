import { supabase } from './supabase'
import { DISPUTE_STATUSES } from './orderDisputes'

export const RETURN_DISPUTE_STATUSES = new Set([
  DISPUTE_STATUSES.RETURN_AUTHORISED,
  DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
  DISPUTE_STATUSES.COLLECTION_ARRANGED,
  DISPUTE_STATUSES.COLLECTION_CONFIRMED,
  DISPUTE_STATUSES.READY_FOR_REFUND,
])

export function getCaseReturnErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function fetchOrderCaseReturnLogistics(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('fetch_order_case_return_logistics', {
    p_order_id: orderId,
  })

  return { data: data ?? [], error }
}

export function getReturnLogisticsForDispute(logistics, disputeId) {
  return (
    (logistics ?? [])
      .filter((entry) => entry.dispute_id === disputeId)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0] ?? null
  )
}

export function isReturnWorkflowDispute(dispute) {
  return RETURN_DISPUTE_STATUSES.has(dispute?.status)
}

export function canSellerArrangeCollection(dispute, userId) {
  if (!dispute || !userId || dispute.seller_id !== userId) return false
  return (
    dispute.status === DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION ||
    dispute.status === DISPUTE_STATUSES.RETURN_AUTHORISED
  )
}

export function canBuyerConfirmCollection(dispute, userId) {
  if (!dispute || !userId || dispute.buyer_id !== userId) return false
  return dispute.status === DISPUTE_STATUSES.COLLECTION_ARRANGED
}

export function canAdminIssueRefundAfterCollection(dispute) {
  if (!dispute) return false
  return (
    dispute.status === DISPUTE_STATUSES.READY_FOR_REFUND ||
    dispute.status === DISPUTE_STATUSES.COLLECTION_CONFIRMED
  )
}

export function formatReturnTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatCollectionDate(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export async function adminAuthoriseCaseReturn({ disputeId, adminNote, customerMessage }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_authorise_case_return', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
  })

  return { data, error }
}

export async function adminIssueRefundWithoutReturn({ disputeId, adminNote, customerMessage }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_issue_refund_without_return', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
  })

  return { data, error }
}

export async function sellerArrangeCaseCollection({
  disputeId,
  collectionDate,
  courierName,
  trackingReference,
  messageToBuyer,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('seller_arrange_case_collection', {
    p_dispute_id: disputeId,
    p_collection_date: collectionDate,
    p_courier_name: courierName?.trim() || null,
    p_tracking_reference: trackingReference?.trim() || null,
    p_message_to_buyer: messageToBuyer?.trim() || null,
  })

  return { data, error }
}

export async function buyerConfirmCaseCollection(disputeId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('buyer_confirm_case_collection', {
    p_dispute_id: disputeId,
  })

  return { data, error }
}

export async function adminIssueCaseRefundPending({ disputeId, adminNote, customerMessage }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_issue_case_refund_pending', {
    p_dispute_id: disputeId,
    p_admin_note: adminNote?.trim() || null,
    p_customer_message: customerMessage?.trim() || null,
  })

  return { data, error }
}
