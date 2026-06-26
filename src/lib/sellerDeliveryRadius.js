import { getListingCoordinates, safeDistanceMiles } from './listingDistance'
import { getSellerDeliveryRadiusMiles, inferDeliveryOptionsFromListing } from './listings'
import { getProfileCoordinates } from './profiles'
import { ORDER_TYPES } from './orders'

export const SELLER_DELIVERY_UNAVAILABLE_COPY =
  'Seller delivery is unavailable for your location.'

export const SELLER_DELIVERY_LOCATION_REQUIRED_COPY =
  'Add your location to check seller delivery.'

export function listingOffersSellerDelivery(listing) {
  if (!listing) return false
  return inferDeliveryOptionsFromListing(listing).includes('seller_delivery')
}

export function evaluateSellerDeliveryAvailability(listing, buyerProfile) {
  const radiusMiles = getSellerDeliveryRadiusMiles(listing)

  if (!listingOffersSellerDelivery(listing)) {
    return {
      offered: false,
      available: false,
      reason: null,
      distanceMiles: null,
      radiusMiles,
    }
  }

  if (radiusMiles == null || radiusMiles <= 0) {
    return {
      offered: true,
      available: false,
      reason: 'invalid_radius',
      distanceMiles: null,
      radiusMiles,
    }
  }

  const { latitude: listingLat, longitude: listingLng } = getListingCoordinates(listing)

  if (listingLat == null || listingLng == null) {
    return {
      offered: true,
      available: false,
      reason: 'missing_listing_location',
      distanceMiles: null,
      radiusMiles,
    }
  }

  const { latitude: buyerLat, longitude: buyerLng } = getProfileCoordinates(buyerProfile)

  if (buyerLat == null || buyerLng == null) {
    return {
      offered: true,
      available: false,
      reason: 'missing_buyer_location',
      distanceMiles: null,
      radiusMiles,
    }
  }

  const distanceMiles = safeDistanceMiles(listingLat, listingLng, buyerLat, buyerLng)

  if (distanceMiles == null) {
    return {
      offered: true,
      available: false,
      reason: 'distance_unknown',
      distanceMiles: null,
      radiusMiles,
    }
  }

  const available = distanceMiles <= radiusMiles

  return {
    offered: true,
    available,
    reason: available ? null : 'outside_radius',
    distanceMiles,
    radiusMiles,
  }
}

export function getSellerDeliveryDisabledReason(evaluation) {
  if (!evaluation?.offered || evaluation.available) return null

  if (evaluation.reason === 'missing_buyer_location') {
    return SELLER_DELIVERY_LOCATION_REQUIRED_COPY
  }

  return SELLER_DELIVERY_UNAVAILABLE_COPY
}

export function isSellerDeliverySelectableForBuyer(listing, buyerProfile) {
  const evaluation = evaluateSellerDeliveryAvailability(listing, buyerProfile)
  return evaluation.offered && evaluation.available
}

export function isSellerDeliveryOrderType(orderType) {
  return orderType === ORDER_TYPES.SELLER_DELIVERY
}
