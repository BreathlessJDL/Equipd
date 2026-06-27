/**
 * Shared order lifecycle badge mapping for Hub cards and Order Detail.
 */

const BLUE_STAGE_KEYS = new Set([
  'awaiting_collection',
  'awaiting_seller_delivery',
  'awaiting_courier_collection',
  'collection_confirmed',
  'delivery_confirmed',
  'courier_evidence_submitted',
  'payment_received',
  'in_transit',
  'buyer_protection_completed',
  'support_open',
])

const DISPUTE_STAGE_KEYS = new Set([
  'disputed',
  'dispute_opened',
  'dispute_under_review',
])

function formatLifecycleLabel(label) {
  if (!label) return 'In progress'
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function getStatusBadgeFromOrderLifecycleStage(stage, { viewerRole = null } = {}) {
  if (!stage?.key) {
    return { variant: 'pending', label: 'In progress' }
  }

  const { key, label } = stage

  if (key === 'cancelled') {
    return { variant: 'cancelled', label: 'Cancelled' }
  }

  if (DISPUTE_STAGE_KEYS.has(key)) {
    return { variant: 'disputed', label: 'Dispute Open' }
  }

  if (key === 'buyer_protection_active') {
    return { variant: 'buyer_protection', label: 'Buyer Protection Active' }
  }

  if (key === 'awaiting_payment') {
    return { variant: 'awaiting_payment', label: 'Awaiting Payment' }
  }

  if (key === 'awaiting_payout') {
    return { variant: 'awaiting_payout', label: 'Awaiting Payout' }
  }

  if (key === 'completed' || key === 'order_completed') {
    return { variant: 'completed', label: 'Completed' }
  }

  if (key === 'payout_released') {
    return {
      variant: 'paid',
      label: viewerRole === 'seller' ? 'Paid' : 'Completed',
    }
  }

  if (BLUE_STAGE_KEYS.has(key)) {
    return {
      variant: 'buyer_protection',
      label: formatLifecycleLabel(label),
    }
  }

  return {
    variant: 'pending',
    label: formatLifecycleLabel(label),
  }
}

/** @deprecated Use getStatusBadgeFromOrderLifecycleStage */
export function getStatusBadgeFromStage(stage, options = {}) {
  return getStatusBadgeFromOrderLifecycleStage(stage, options)
}
