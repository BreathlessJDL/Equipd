export const SELLER_SERVICE_FEE_RATE = 0.02

export const SELLER_SERVICE_FEE_LABEL = 'Seller Service Fee'

export const SELLER_SERVICE_FEE_NOTE =
  'The Seller Service Fee helps cover secure payments, marketplace operation, customer support, Buyer Protection administration, dispute resolution and ongoing platform improvements.'

function normalizeItemPricePence(value) {
  if (value == null || value === '') return null

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  return Math.round(numeric)
}

/** 2% of item price (whole pence, rounded). */
export function calculateSellerServiceFee(itemPricePence) {
  const normalized = normalizeItemPricePence(itemPricePence)
  if (normalized == null) {
    return 0
  }

  return Math.round(normalized * SELLER_SERVICE_FEE_RATE)
}

/** Item price minus Seller Service Fee. */
export function calculateSellerNetPayout(itemPricePence) {
  const normalized = normalizeItemPricePence(itemPricePence) ?? 0
  const fee = calculateSellerServiceFee(normalized)

  return Math.max(0, normalized - fee)
}

export function calculateSellerPayoutTotals(itemPricePence) {
  const normalized = normalizeItemPricePence(itemPricePence) ?? 0
  const sellerServiceFeePence = calculateSellerServiceFee(normalized)

  return {
    itemPricePence: normalized,
    sellerServiceFeePence,
    sellerNetPence: normalized - sellerServiceFeePence,
  }
}

export function resolvePaymentSellerPayoutTotals(payment) {
  if (!payment) {
    return calculateSellerPayoutTotals(0)
  }

  const itemPricePence = payment.amount_pence ?? 0
  const sellerServiceFeePence =
    payment.seller_service_fee_pence ?? calculateSellerServiceFee(itemPricePence)
  const sellerNetPence =
    payment.seller_net_pence ?? calculateSellerNetPayout(itemPricePence)

  return {
    itemPricePence,
    sellerServiceFeePence,
    sellerNetPence,
  }
}

export function resolveOrderSellerPayoutTotals(order) {
  if (!order) {
    return calculateSellerPayoutTotals(0)
  }

  const itemPricePence = order.item_price_pence ?? order.amount_pence ?? 0
  const sellerServiceFeePence =
    order.seller_service_fee_pence ?? calculateSellerServiceFee(itemPricePence)
  const sellerNetPence =
    order.seller_net_pence ?? calculateSellerNetPayout(itemPricePence)

  return {
    itemPricePence,
    sellerServiceFeePence,
    sellerNetPence,
  }
}
