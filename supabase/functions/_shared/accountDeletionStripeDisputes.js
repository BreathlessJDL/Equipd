export const OPEN_STRIPE_DISPUTE_STATUSES = [
  'needs_response',
  'under_review',
  'warning_needs_response',
  'warning_under_review',
]

export const STRIPE_DISPUTE_BLOCK_MESSAGE =
  'A Stripe payment dispute or chargeback is still open on one of your Equipd transactions.'

export const STRIPE_DISPUTE_UNAVAILABLE_MESSAGE =
  'We could not verify Stripe disputes just now. Try again shortly, or contact Equipd support if this continues.'

export function isOpenStripeDispute(dispute) {
  const status = String(dispute?.status ?? '').trim().toLowerCase()
  return OPEN_STRIPE_DISPUTE_STATUSES.includes(status)
}

export function stripeDisputeBlocker(kind, openCount = 0) {
  if (kind === 'unavailable') {
    return {
      code: 'stripe_disputes_unavailable',
      message: STRIPE_DISPUTE_UNAVAILABLE_MESSAGE,
    }
  }

  return {
    code: 'open_stripe_disputes',
    message: STRIPE_DISPUTE_BLOCK_MESSAGE,
    count: openCount,
  }
}

export function mergeDeletionEvaluation(sqlEvaluation, stripeCheck) {
  const blockers = Array.isArray(sqlEvaluation?.blockers) ? [...sqlEvaluation.blockers] : []
  const counts = {
    ...(sqlEvaluation?.counts && typeof sqlEvaluation.counts === 'object' ? sqlEvaluation.counts : {}),
    openStripeDisputes: stripeCheck?.ok ? stripeCheck.openCount : null,
  }

  if (!stripeCheck?.ok) {
    blockers.push(stripeDisputeBlocker('unavailable'))
  } else if ((stripeCheck.openCount ?? 0) > 0) {
    blockers.push(stripeDisputeBlocker('open', stripeCheck.openCount))
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    counts,
  }
}
