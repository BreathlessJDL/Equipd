#!/usr/bin/env node
/**
 * Unit tests for seller delivery radius gating (client helpers).
 *
 * Usage: node scripts/test-seller-delivery-radius-gating.mjs
 */

import { inferDeliveryOptionsFromListing } from '../src/lib/listingFulfilmentOptions.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const EARTH_RADIUS_MILES = 3958.7613

function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

function evaluateSellerDeliveryAvailability(listing, buyerProfile) {
  const radiusMiles = listing.seller_delivery_radius_miles ?? null
  const offers = inferDeliveryOptionsFromListing(listing).includes('seller_delivery')

  if (!offers) {
    return { offered: false, available: false, reason: null, distanceMiles: null, radiusMiles }
  }

  if (radiusMiles == null || radiusMiles <= 0) {
    return { offered: true, available: false, reason: 'invalid_radius', distanceMiles: null, radiusMiles }
  }

  if (listing.latitude == null || listing.longitude == null) {
    return { offered: true, available: false, reason: 'missing_listing_location', distanceMiles: null, radiusMiles }
  }

  const buyerLat = buyerProfile?.latitude
  const buyerLng = buyerProfile?.longitude

  if (buyerLat == null || buyerLng == null) {
    return { offered: true, available: false, reason: 'missing_buyer_location', distanceMiles: null, radiusMiles }
  }

  const distanceMiles = haversineDistanceMiles(
    listing.latitude,
    listing.longitude,
    buyerLat,
    buyerLng,
  )

  const available = distanceMiles <= radiusMiles

  return {
    offered: true,
    available,
    reason: available ? null : 'outside_radius',
    distanceMiles,
    radiusMiles,
  }
}

function getSellerDeliveryDisabledReason(evaluation) {
  if (!evaluation?.offered || evaluation.available) return null
  if (evaluation.reason === 'missing_buyer_location') {
    return 'Add your location to check seller delivery.'
  }
  return 'Seller delivery is unavailable for your location.'
}

function getAvailableFulfilmentMethods(listing, context = {}) {
  const optionIds = inferDeliveryOptionsFromListing(listing)
  const { buyerProfile, viewerUserId, forBuyerSelection = false } = context
  const ownerViewing = viewerUserId && listing.seller_id === viewerUserId && !forBuyerSelection

  return optionIds
    .map((id) => ({ collection: 'collection', buyer_courier: 'buyer_courier', seller_delivery: 'seller_delivery' }[id]))
    .filter(Boolean)
    .filter((orderType) => {
      if (orderType !== 'seller_delivery') return true
      if (ownerViewing) return true
      if (!forBuyerSelection) return inferDeliveryOptionsFromListing(listing).includes('seller_delivery')
      return evaluateSellerDeliveryAvailability(listing, buyerProfile).available
    })
}

const LEEDS_LISTING = {
  seller_id: 'seller-1',
  latitude: 53.8008,
  longitude: -1.5491,
  seller_delivery_radius_miles: 20,
  collection_available: true,
  courier_available: true,
  delivery_notes: 'Seller can personally deliver. Buyer can arrange a courier or collection service',
}

const NEARBY_BUYER = { latitude: 53.79, longitude: -1.55 }
const FAR_BUYER = { latitude: 51.5074, longitude: -0.1278 }

function main() {
  const nearby = evaluateSellerDeliveryAvailability(LEEDS_LISTING, NEARBY_BUYER)
  assert(nearby.available, 'Nearby buyer should be within seller delivery radius')

  const far = evaluateSellerDeliveryAvailability(LEEDS_LISTING, FAR_BUYER)
  assert(!far.available && far.reason === 'outside_radius', 'Far buyer should be outside radius')
  assert(
    getSellerDeliveryDisabledReason(far) === 'Seller delivery is unavailable for your location.',
    'Outside radius copy',
  )

  const missingLocation = evaluateSellerDeliveryAvailability(LEEDS_LISTING, null)
  assert(
    !missingLocation.available && missingLocation.reason === 'missing_buyer_location',
    'Missing buyer location should block seller delivery',
  )

  const buyerMethods = getAvailableFulfilmentMethods(LEEDS_LISTING, {
    buyerProfile: FAR_BUYER,
    forBuyerSelection: true,
  })
  assert(buyerMethods.includes('collection'), 'Collection remains available')
  assert(buyerMethods.includes('buyer_courier'), 'Buyer courier remains available')
  assert(!buyerMethods.includes('seller_delivery'), 'Far buyer should not get seller delivery')

  const nearbyMethods = getAvailableFulfilmentMethods(LEEDS_LISTING, {
    buyerProfile: NEARBY_BUYER,
    forBuyerSelection: true,
  })
  assert(nearbyMethods.includes('seller_delivery'), 'Nearby buyer should get seller delivery')

  const ownerMethods = getAvailableFulfilmentMethods(LEEDS_LISTING, {
    viewerUserId: 'seller-1',
  })
  assert(ownerMethods.includes('seller_delivery'), 'Seller viewing own listing keeps seller delivery')

  console.log('All seller delivery radius gating helper tests passed.')
}

main()
