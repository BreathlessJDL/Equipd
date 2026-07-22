export const BUYER_PROTECTION_FEE_MIN_PENCE = 500
export const BUYER_PROTECTION_FEE_MAX_PENCE = 25000
export const BUYER_PROTECTION_FEE_RATE = 0.05

import { calculateSellerNetPayout, calculateSellerServiceFee } from './sellerServiceFee.js'

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

  const sellerServiceFeePence = calculateSellerServiceFee(normalized)

  return {
    itemPricePence: normalized,
    itemSubtotalPence: normalized,
    agreedUnitPricePence: normalized,
    quantity: 1,
    buyerProtectionFeePence,
    buyerTotalPence: normalized + buyerProtectionFeePence,
    sellerServiceFeePence,
    sellerNetPence: calculateSellerNetPayout(normalized),
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

  const itemPricePence = payment.item_subtotal_pence ?? payment.amount_pence ?? 0
  const quantity = payment.quantity ?? 1
  const buyerProtectionFeePence =
    payment.buyer_protection_fee_pence ?? calculateBuyerProtectionFee(itemPricePence)
  const buyerTotalPence =
    payment.buyer_total_pence ?? itemPricePence + buyerProtectionFeePence

  const sellerServiceFeePence =
    payment.seller_service_fee_pence ?? calculateSellerServiceFee(itemPricePence)

  return {
    itemPricePence,
    itemSubtotalPence: itemPricePence,
    agreedUnitPricePence: payment.agreed_unit_price_pence ?? itemPricePence,
    quantity,
    buyerProtectionFeePence,
    buyerTotalPence,
    sellerServiceFeePence,
    sellerNetPence: payment.seller_net_pence ?? calculateSellerNetPayout(itemPricePence),
  }
}

export function resolveOrderCheckoutTotals(order) {
  if (!order) {
    return calculateBuyerCheckoutTotals(0)
  }

  const itemPricePence =
    order.item_subtotal_pence ?? order.item_price_pence ?? order.amount_pence ?? 0
  const quantity = order.quantity ?? 1
  const buyerProtectionFeePence =
    order.buyer_protection_fee_pence ?? calculateBuyerProtectionFee(itemPricePence)
  const buyerTotalPence =
    order.buyer_total_pence ?? itemPricePence + buyerProtectionFeePence

  const sellerServiceFeePence =
    order.seller_service_fee_pence ?? calculateSellerServiceFee(itemPricePence)

  return {
    itemPricePence,
    itemSubtotalPence: itemPricePence,
    agreedUnitPricePence: order.agreed_unit_price_pence ?? itemPricePence,
    quantity,
    buyerProtectionFeePence,
    buyerTotalPence,
    sellerServiceFeePence,
    sellerNetPence: order.seller_net_pence ?? calculateSellerNetPayout(itemPricePence),
  }
}
