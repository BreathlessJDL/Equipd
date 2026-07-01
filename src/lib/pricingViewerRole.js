/**
 * Resolve whether buyer- or seller-facing pricing should render for an offer card.
 */

export function resolveOfferPricingViewerRole({
  userId = null,
  offer = null,
  orderStatusRole = null,
} = {}) {
  if (orderStatusRole === 'buyer' || orderStatusRole === 'seller' || orderStatusRole === 'admin') {
    return orderStatusRole
  }

  if (userId && offer?.buyer_id === userId) return 'buyer'
  if (userId && offer?.seller_id === userId) return 'seller'

  return null
}

export function shouldShowBuyerPricing(options = {}) {
  return resolveOfferPricingViewerRole(options) === 'buyer'
}

export function shouldShowSellerPricing(options = {}) {
  return resolveOfferPricingViewerRole(options) === 'seller'
}
