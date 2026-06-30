export const SELLER_SERVICE_FEE_RATE = 0.02

export function calculateSellerServiceFee(itemPricePence: number): number {
  if (!itemPricePence || itemPricePence <= 0) {
    return 0
  }

  return Math.round(itemPricePence * SELLER_SERVICE_FEE_RATE)
}

export function calculateSellerNetPayout(itemPricePence: number): number {
  if (!itemPricePence || itemPricePence <= 0) {
    return 0
  }

  return Math.max(0, itemPricePence - calculateSellerServiceFee(itemPricePence))
}
