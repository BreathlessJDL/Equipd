import { supabase } from './supabase'

export const COURIER_DELIVERY_CHECKS = {
  item_received: 'item_received',
  handover_evidence_reviewed: 'handover_evidence_reviewed',
  protection_window_acknowledged: 'protection_window_acknowledged',
}

export function buildCourierDeliveryConfirmationChecks({
  itemReceived,
  handoverEvidenceReviewed,
  protectionWindowAcknowledged,
}) {
  return {
    [COURIER_DELIVERY_CHECKS.item_received]: Boolean(itemReceived),
    [COURIER_DELIVERY_CHECKS.handover_evidence_reviewed]: Boolean(handoverEvidenceReviewed),
    [COURIER_DELIVERY_CHECKS.protection_window_acknowledged]: Boolean(protectionWindowAcknowledged),
  }
}

export function areCourierDeliveryChecksComplete(checks) {
  return (
    checks?.item_received === true &&
    checks?.handover_evidence_reviewed === true &&
    checks?.protection_window_acknowledged === true
  )
}

export function getCourierDeliveryErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function confirmCourierDelivery(orderId, checks) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const userAgent =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent.slice(0, 512)
      : null

  const { data, error } = await supabase.rpc('confirm_courier_delivery', {
    p_order_id: orderId,
    p_checks: checks,
    p_user_agent: userAgent,
  })

  return { data, error }
}
