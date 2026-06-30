export const PAYMENT_STATUSES = {
  AWAITING_SELLER_SETUP: 'awaiting_seller_setup',
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
}

const paymentFields = `
  id,
  offer_id,
  listing_id,
  buyer_id,
  seller_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  status,
  amount_pence,
  buyer_protection_fee_pence,
  buyer_total_pence,
  platform_fee_pence,
  seller_service_fee_pence,
  seller_net_pence,
  expires_at,
  paid_at,
  created_at,
  updated_at
`

export function getPaymentErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function formatPaymentStatus(status) {
  const labels = {
    awaiting_seller_setup: 'Awaiting seller payout setup',
    pending: 'Awaiting payment',
    paid: 'Paid',
    expired: 'Payment expired',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  }

  return labels[status] ?? status
}

export function isPaymentComplete(payment) {
  return payment?.status === PAYMENT_STATUSES.PAID
}

export function isPaymentOutstanding(payment) {
  if (!payment) return true

  return ![
    PAYMENT_STATUSES.PAID,
    PAYMENT_STATUSES.EXPIRED,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.REFUNDED,
  ].includes(payment.status)
}

export function isPaymentExpired(payment) {
  if (!payment?.expires_at) return false

  if (
    payment.status === PAYMENT_STATUSES.EXPIRED ||
    payment.status === PAYMENT_STATUSES.CANCELLED ||
    payment.status === PAYMENT_STATUSES.PAID
  ) {
    return payment.status === PAYMENT_STATUSES.EXPIRED
  }

  return new Date(payment.expires_at).getTime() <= Date.now()
}

export function canPayNow(payment) {
  if (!payment) return false

  return (
    payment.status === PAYMENT_STATUSES.PENDING &&
    !isPaymentExpired(payment)
  )
}

export function isAwaitingSellerSetup(payment) {
  return payment?.status === PAYMENT_STATUSES.AWAITING_SELLER_SETUP && !isPaymentExpired(payment)
}

export function getOfferPayment(offer) {
  if (!offer?.payment) return null
  return Array.isArray(offer.payment) ? (offer.payment[0] ?? null) : offer.payment
}

export function enrichOfferWithPayment(offer) {
  if (!offer) return offer

  return {
    ...offer,
    payment: getOfferPayment(offer),
  }
}

export { paymentFields }
