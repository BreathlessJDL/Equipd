#!/usr/bin/env node
/**
 * Fulfilment method option tests (collection / seller delivery / buyer courier combos).
 *
 * Usage: node scripts/test-fulfilment-method-options.mjs
 */

import { createServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FULFILMENT_BUYER_COURIER_MARKER,
  FULFILMENT_COLLECTION_MARKER,
  FULFILMENT_SELLER_DELIVERY_MARKER,
} from '../src/lib/listingFulfilmentOptions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function listingWithNotes(notes, extras = {}) {
  return {
    seller_id: 'seller-1',
    latitude: 53.8008,
    longitude: -1.5491,
    seller_delivery_radius_miles: 20,
    collection_available: true,
    courier_available: false,
    delivery_notes: notes,
    ...extras,
  }
}

const LISTINGS = {
  collectionOnly: listingWithNotes(FULFILMENT_COLLECTION_MARKER, {
    courier_available: false,
    collection_available: true,
    seller_delivery_radius_miles: null,
  }),
  sellerOnly: listingWithNotes(FULFILMENT_SELLER_DELIVERY_MARKER, {
    courier_available: true,
    collection_available: false,
    seller_delivery_radius_miles: 20,
  }),
  buyerCourierOnly: listingWithNotes(FULFILMENT_BUYER_COURIER_MARKER, {
    courier_available: true,
    collection_available: false,
    seller_delivery_radius_miles: null,
  }),
  collectionSeller: listingWithNotes(
    `${FULFILMENT_COLLECTION_MARKER}. ${FULFILMENT_SELLER_DELIVERY_MARKER}`,
    { courier_available: true, collection_available: true, seller_delivery_radius_miles: 20 },
  ),
  allThree: listingWithNotes(
    `${FULFILMENT_COLLECTION_MARKER}. ${FULFILMENT_SELLER_DELIVERY_MARKER}. ${FULFILMENT_BUYER_COURIER_MARKER}`,
    { courier_available: true, collection_available: true, seller_delivery_radius_miles: 20 },
  ),
}

const NEARBY_BUYER = { latitude: 53.79, longitude: -1.55 }
const NO_LOCATION_BUYER = null

const server = await createServer({ root: ROOT, logLevel: 'error' })

try {
  const {
    getAvailableFulfilmentMethodOptions,
    getAvailableFulfilmentMethods,
    isValidFulfilmentMethodForListing,
  } = await server.ssrLoadModule('/src/lib/fulfilmentMethods.js')

  function optionTypes(listing, buyerProfile) {
    return getAvailableFulfilmentMethodOptions(listing, {
      buyerProfile,
      forBuyerSelection: true,
    }).map((option) => option.orderType)
  }

  function enabledTypes(listing, buyerProfile) {
    return getAvailableFulfilmentMethodOptions(listing, {
      buyerProfile,
      forBuyerSelection: true,
    })
      .filter((option) => !option.disabled)
      .map((option) => option.orderType)
  }

  // Must not throw ReferenceError
  assert(
    optionTypes(LISTINGS.collectionOnly, NEARBY_BUYER).includes('collection'),
    'collection only',
  )
  console.log('PASS: collection only')

  assert(
    optionTypes(LISTINGS.sellerOnly, NEARBY_BUYER).includes('seller_delivery'),
    'seller only offered',
  )
  assert(
    enabledTypes(LISTINGS.sellerOnly, NEARBY_BUYER).includes('seller_delivery'),
    'seller only enabled for nearby buyer',
  )
  console.log('PASS: seller delivery only')

  assert(
    optionTypes(LISTINGS.buyerCourierOnly, NEARBY_BUYER).includes('buyer_courier'),
    'buyer courier only',
  )
  console.log('PASS: buyer courier only')

  const combo = optionTypes(LISTINGS.collectionSeller, NEARBY_BUYER)
  assert(combo.includes('collection') && combo.includes('seller_delivery'), 'collection + seller')
  console.log('PASS: collection + seller delivery')

  const all = optionTypes(LISTINGS.allThree, NEARBY_BUYER)
  assert(
    all.includes('collection') && all.includes('seller_delivery') && all.includes('buyer_courier'),
    'all three methods',
  )
  console.log('PASS: all three methods')

  const missingLocationOptions = getAvailableFulfilmentMethodOptions(LISTINGS.collectionSeller, {
    buyerProfile: NO_LOCATION_BUYER,
    forBuyerSelection: true,
  })
  const sellerOption = missingLocationOptions.find((option) => option.orderType === 'seller_delivery')
  assert(sellerOption?.disabled === true, 'seller delivery disabled without buyer location')
  assert(Boolean(sellerOption?.disabledReason), 'seller delivery disabled reason present')
  assert(
    enabledTypes(LISTINGS.collectionSeller, NO_LOCATION_BUYER).includes('collection'),
    'collection still enabled without buyer location',
  )
  console.log('PASS: missing buyer location returns disabled seller delivery')

  assert(
    getAvailableFulfilmentMethods(LISTINGS.allThree, {
      buyerProfile: NEARBY_BUYER,
      forBuyerSelection: true,
    }).length >= 3,
    'getAvailableFulfilmentMethods returns methods',
  )
  console.log('PASS: getAvailableFulfilmentMethods')

  assert(
    isValidFulfilmentMethodForListing(LISTINGS.collectionOnly, 'collection'),
    'checkout: collection only',
  )
  console.log('PASS: checkout validation — collection only')

  assert(
    isValidFulfilmentMethodForListing(LISTINGS.buyerCourierOnly, 'buyer_courier'),
    'checkout: buyer courier only',
  )
  console.log('PASS: checkout validation — buyer courier only')

  assert(
    isValidFulfilmentMethodForListing(LISTINGS.sellerOnly, 'seller_delivery', {
      buyerProfile: NEARBY_BUYER,
    }),
    'checkout: seller delivery with buyer location',
  )
  console.log('PASS: checkout validation — seller delivery with location')

  const strippedSellerListing = {
    ...LISTINGS.sellerOnly,
    seller_delivery_radius_miles: undefined,
    latitude: undefined,
    longitude: undefined,
  }
  assert(
    isValidFulfilmentMethodForListing(strippedSellerListing, 'seller_delivery', {
      buyerProfile: NO_LOCATION_BUYER,
      persistedOrderType: 'seller_delivery',
    }),
    'checkout: persisted seller delivery survives missing embed fields',
  )
  console.log('PASS: checkout validation — persisted seller delivery without embed coords')

  assert(
    isValidFulfilmentMethodForListing(strippedSellerListing, 'seller_delivery', {
      buyerProfile: NO_LOCATION_BUYER,
    }),
    'checkout: seller delivery without radius does not block payment',
  )
  console.log('PASS: checkout validation — missing radius does not block seller delivery')

  const embedMissingCoords = {
    ...LISTINGS.sellerOnly,
    latitude: undefined,
    longitude: undefined,
  }
  assert(
    isValidFulfilmentMethodForListing(embedMissingCoords, 'seller_delivery', {
      buyerProfile: NEARBY_BUYER,
      persistedOrderType: 'seller_delivery',
    }),
    'checkout: persisted seller delivery when embed lacks listing coords',
  )
  console.log('PASS: checkout validation — persisted seller delivery with radius but missing embed coords')

  assert(
    isValidFulfilmentMethodForListing(LISTINGS.collectionSeller, 'collection'),
    'checkout: collection in combo listing',
  )
  assert(
    isValidFulfilmentMethodForListing(LISTINGS.collectionSeller, 'seller_delivery', {
      buyerProfile: NEARBY_BUYER,
    }),
    'checkout: seller delivery in combo listing',
  )
  console.log('PASS: checkout validation — collection + seller delivery')

  assert(
    isValidFulfilmentMethodForListing(LISTINGS.allThree, 'buyer_courier'),
    'checkout: buyer courier in all-three listing',
  )
  console.log('PASS: checkout validation — all three methods')

  assert(
    !isValidFulfilmentMethodForListing(LISTINGS.collectionOnly, 'seller_delivery'),
    'checkout rejects unavailable method',
  )
  console.log('PASS: checkout validation — rejects genuinely unavailable method')

  console.log('\nAll fulfilment method option checks passed.')
} catch (error) {
  console.error('FAIL:', error.message)
  console.error(error.stack)
  process.exitCode = 1
} finally {
  await server.close()
}
