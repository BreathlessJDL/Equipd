import { supabase } from './supabase'
import { formatDisputeStatus } from './orderDisputes'
import { formatSupportRequestStatus } from './supportRequests'

const CASE_UPDATE_STATUS_LABELS = {
  evidence_received: 'Evidence received',
  additional_evidence_uploaded: 'Additional evidence uploaded',
  return_authorised: 'Return authorised',
  awaiting_seller_collection: 'Awaiting seller collection',
  collection_arranged: 'Collection arranged',
  collection_confirmed: 'Collection confirmed',
  collection_rejected: 'Item rejected at collection',
  ready_for_refund: 'Ready for refund',
  refund_pending: 'Refund pending',
  refund_completed: 'Refund completed',
  case_closed: 'Case closed',
  resolved: 'Case closed',
  closed: 'Case closed',
}

export function getCaseUpdateErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function fetchOrderCaseUpdates(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })

  return { data: data ?? [], error }
}

export function formatCaseUpdateTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatCaseUpdateStatus(status) {
  if (CASE_UPDATE_STATUS_LABELS[status]) {
    return CASE_UPDATE_STATUS_LABELS[status]
  }

  const disputeLabel = formatDisputeStatus(status)
  if (disputeLabel !== status) return disputeLabel

  const supportLabel = formatSupportRequestStatus(status)
  if (supportLabel !== status) return supportLabel

  return status
}

export function hasVisibleCaseUpdates(updates) {
  return (updates ?? []).length > 0
}

export function getPublicCaseUpdates(updates) {
  return (updates ?? []).filter(
    (update) =>
      update.message_to_customer?.trim() ||
      update.status ||
      update.event_type === 'case_opened',
  )
}
