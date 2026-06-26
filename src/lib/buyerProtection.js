export const BUYER_PROTECTION_FEE_MIN_PENCE = 500
export const BUYER_PROTECTION_FEE_MAX_PENCE = 25000
export const BUYER_PROTECTION_FEE_RATE = 0.05

export const BUYER_PROTECTION_FEE_NOTE =
  'Buyer Protection is 5% of the agreed sale price (minimum £5, maximum £250).'

/** 5% of item price, minimum £5, maximum £250 (whole pence). */
export function calculateBuyerProtectionFee(itemPricePence) {
  const normalized = normalizeListingPricePence(itemPricePence)
  if (normalized == null) {
    return 0
  }

  const rawFee = Math.round(normalized * BUYER_PROTECTION_FEE_RATE)

  return Math.min(
    BUYER_PROTECTION_FEE_MAX_PENCE,
    Math.max(BUYER_PROTECTION_FEE_MIN_PENCE, rawFee),
  )
}

/** Coerce listing/offer price fields to whole pence; null when missing or invalid. */
export function normalizeListingPricePence(value) {
  if (value == null || value === '') return null

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  return Math.round(numeric)
}

export function calculateBuyerCheckoutTotals(itemPricePence) {
  const normalized = normalizeListingPricePence(itemPricePence) ?? 0
  const buyerProtectionFeePence = calculateBuyerProtectionFee(normalized)

  return {
    itemPricePence: normalized,
    buyerProtectionFeePence,
    buyerTotalPence: normalized + buyerProtectionFeePence,
    sellerNetPence: normalized,
  }
}

/** GBP display for buyer-facing totals (always 2 decimal places, matches checkout line items). */
export function formatBuyerProtectionPricePence(pence) {
  if (pence == null || Number.isNaN(Number(pence))) {
    return '—'
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(pence) / 100)
}

export function resolvePaymentCheckoutTotals(payment) {
  if (!payment) {
    return calculateBuyerCheckoutTotals(0)
  }

  const itemPricePence = payment.amount_pence ?? 0
  const buyerProtectionFeePence =
    payment.buyer_protection_fee_pence ?? calculateBuyerProtectionFee(itemPricePence)
  const buyerTotalPence =
    payment.buyer_total_pence ?? itemPricePence + buyerProtectionFeePence

  return {
    itemPricePence,
    buyerProtectionFeePence,
    buyerTotalPence,
    sellerNetPence: payment.seller_net_pence ?? itemPricePence,
  }
}

export function resolveOrderCheckoutTotals(order) {
  if (!order) {
    return calculateBuyerCheckoutTotals(0)
  }

  const itemPricePence = order.item_price_pence ?? order.amount_pence ?? 0
  const buyerProtectionFeePence =
    order.buyer_protection_fee_pence ?? calculateBuyerProtectionFee(itemPricePence)
  const buyerTotalPence =
    order.buyer_total_pence ?? itemPricePence + buyerProtectionFeePence

  return {
    itemPricePence,
    buyerProtectionFeePence,
    buyerTotalPence,
    sellerNetPence: order.seller_net_pence ?? itemPricePence,
  }
}
