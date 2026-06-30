export const BUYER_PROTECTION_FEE_MIN_PENCE = 500
export const BUYER_PROTECTION_FEE_MAX_PENCE = 25000
export const BUYER_PROTECTION_FEE_RATE = 0.05

import {
  calculateSellerNetPayout,
  calculateSellerServiceFee,
} from './seller-service-fee.ts'

export { calculateSellerNetPayout, calculateSellerServiceFee } from './seller-service-fee.ts'

export function calculateBuyerProtectionFee(itemPricePence: number): number {
  if (!itemPricePence || itemPricePence <= 0) {
    return 0
  }

  const rawFee = Math.round(itemPricePence * BUYER_PROTECTION_FEE_RATE)

  return Math.min(
    BUYER_PROTECTION_FEE_MAX_PENCE,
    Math.max(BUYER_PROTECTION_FEE_MIN_PENCE, rawFee),
  )
}

export function resolveBuyerCheckoutAmounts(payment: {
  amount_pence: number
  buyer_protection_fee_pence?: number | null
  buyer_total_pence?: number | null
  seller_service_fee_pence?: number | null
  seller_net_pence?: number | null
}) {
  const itemPricePence = payment.amount_pence
  const buyerProtectionFeePence =
    payment.buyer_protection_fee_pence ?? calculateBuyerProtectionFee(itemPricePence)
  const buyerTotalPence =
    payment.buyer_total_pence ?? itemPricePence + buyerProtectionFeePence
  const sellerServiceFeePence =
    payment.seller_service_fee_pence ?? calculateSellerServiceFee(itemPricePence)
  const sellerNetPence =
    payment.seller_net_pence ?? calculateSellerNetPayout(itemPricePence)

  return {
    itemPricePence,
    buyerProtectionFeePence,
    buyerTotalPence,
    sellerServiceFeePence,
    sellerNetPence,
  }
}
