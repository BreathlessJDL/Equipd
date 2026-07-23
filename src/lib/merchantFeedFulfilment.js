/**
 * Merchant feed fulfilment decisions.
 * Accuracy over coverage — initial free-listings subset requires collection.
 */

import { inferDeliveryOptionsFromListing } from './listingFulfilmentOptions.js'

export const MERCHANT_FULFILMENT_MODES = Object.freeze({
  COLLECTION: 'collection',
  SELLER_DELIVERY: 'seller_delivery',
  BUYER_COURIER: 'buyer_courier',
})

/**
 * Decision table (initial Stage 8):
 * | Options                         | Eligible? | Notes |
 * | collection (+ anything)         | yes       | Primary path; shipping fee slot used for BP fee |
 * | seller_delivery only            | no        | No priced delivery area cost in data |
 * | buyer_courier only              | no        | Buyer-paid courier is not seller shipping |
 * | seller_delivery + buyer_courier | no        | Same — no collection, no truthful shipping |
 */
export function classifyMerchantFulfilment(listing) {
  const options = inferDeliveryOptionsFromListing(listing)
  const hasCollection = options.includes('collection')
  const hasSellerDelivery = options.includes('seller_delivery')
  const hasBuyerCourier = options.includes('buyer_courier')

  if (hasCollection) {
    return {
      eligible: true,
      mode: MERCHANT_FULFILMENT_MODES.COLLECTION,
      options,
      shippingLabel: 'collection_available',
      reason: null,
    }
  }

  if (hasSellerDelivery && !hasBuyerCourier) {
    return {
      eligible: false,
      mode: MERCHANT_FULFILMENT_MODES.SELLER_DELIVERY,
      options,
      shippingLabel: null,
      reason: 'seller_delivery_without_priced_shipping',
    }
  }

  if (hasBuyerCourier) {
    return {
      eligible: false,
      mode: MERCHANT_FULFILMENT_MODES.BUYER_COURIER,
      options,
      shippingLabel: null,
      reason: 'buyer_courier_not_seller_shipping',
    }
  }

  return {
    eligible: false,
    mode: null,
    options,
    shippingLabel: null,
    reason: 'no_supported_fulfilment',
  }
}
