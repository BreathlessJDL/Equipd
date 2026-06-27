#!/usr/bin/env node
/**
 * Regression tests for listing delivery option multi-select round-trip.
 *
 * Usage: node scripts/test-listing-delivery-options-roundtrip.mjs
 */

import {
  buildDeliveryFields,
  FULFILMENT_BUYER_COURIER_MARKER,
  FULFILMENT_COLLECTION_MARKER,
  FULFILMENT_SELLER_DELIVERY_MARKER,
  inferDeliveryOptionsFromListing,
} from '../src/lib/listingFulfilmentOptions.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertSameOptions(actual, expected, label) {
  const sortedActual = [...actual].sort()
  const sortedExpected = [...expected].sort()
  assert(
    sortedActual.length === sortedExpected.length &&
      sortedActual.every((value, index) => value === sortedExpected[index]),
    `${label}: expected [${sortedExpected.join(', ')}], got [${sortedActual.join(', ')}]`,
  )
}

function baseForm(deliveryOptions) {
  return {
    deliveryOptions,
    deliveryNotes: '',
  }
}

function roundTrip(deliveryOptions, sellerDeliveryRadiusMiles = null) {
  const fields = buildDeliveryFields(baseForm(deliveryOptions))
  return inferDeliveryOptionsFromListing({
    collection_available: fields.collection_available,
    courier_available: fields.courier_available,
    delivery_notes: fields.delivery_notes,
    seller_delivery_radius_miles: sellerDeliveryRadiusMiles,
  })
}

const COMBINATIONS = [
  { id: 'collection-only', options: ['collection'], expected: ['collection'] },
  { id: 'seller-only', options: ['seller_delivery'], expected: ['seller_delivery'] },
  { id: 'buyer-courier-only', options: ['buyer_courier'], expected: ['buyer_courier'] },
  {
    id: 'collection-seller',
    options: ['collection', 'seller_delivery'],
    expected: ['collection', 'seller_delivery'],
  },
  {
    id: 'collection-buyer',
    options: ['collection', 'buyer_courier'],
    expected: ['collection', 'buyer_courier'],
  },
  {
    id: 'seller-buyer',
    options: ['seller_delivery', 'buyer_courier'],
    expected: ['seller_delivery', 'buyer_courier'],
  },
  {
    id: 'all-three',
    options: ['collection', 'seller_delivery', 'buyer_courier'],
    expected: ['collection', 'seller_delivery', 'buyer_courier'],
  },
]

console.log('=== Delivery option round-trip (save → load) ===')

for (const combo of COMBINATIONS) {
  const radius = combo.options.includes('seller_delivery') ? 10 : null
  const loaded = roundTrip(combo.options, radius)
  assertSameOptions(loaded, combo.expected, combo.id)
  console.log(`PASS: ${combo.id}`)
}

console.log('\n=== Legacy collection + seller delivery (pre-marker listings) ===')

const legacyCollectionSeller = inferDeliveryOptionsFromListing({
  collection_available: true,
  courier_available: true,
  delivery_notes: FULFILMENT_SELLER_DELIVERY_MARKER,
  seller_delivery_radius_miles: 15,
})

assertSameOptions(legacyCollectionSeller, ['collection', 'seller_delivery'], 'legacy collection+seller')
console.log('PASS: legacy collection+seller')

console.log('\n=== Seller-only does not infer collection ===')

const sellerOnly = inferDeliveryOptionsFromListing({
  collection_available: false,
  courier_available: true,
  delivery_notes: FULFILMENT_SELLER_DELIVERY_MARKER,
  seller_delivery_radius_miles: 10,
})

assertSameOptions(sellerOnly, ['seller_delivery'], 'seller-only')
console.log('PASS: seller-only')

console.log('\n=== Seller + buyer courier does not infer collection ===')

const sellerBuyer = roundTrip(['seller_delivery', 'buyer_courier'], 10)
assertSameOptions(sellerBuyer, ['seller_delivery', 'buyer_courier'], 'seller-buyer-no-collection')
console.log('PASS: seller+buyer without collection')

console.log('\n=== Explicit markers written on save ===')

const collectionSellerFields = buildDeliveryFields(baseForm(['collection', 'seller_delivery']))

assert(
  collectionSellerFields.delivery_notes?.includes(FULFILMENT_COLLECTION_MARKER),
  'Expected collection marker in delivery_notes',
)
assert(
  collectionSellerFields.delivery_notes?.includes(FULFILMENT_SELLER_DELIVERY_MARKER),
  'Expected seller delivery marker in delivery_notes',
)
assert(collectionSellerFields.collection_available === true, 'Expected collection_available true')
assert(collectionSellerFields.courier_available === true, 'Expected courier_available true')
console.log('PASS: collection+seller save markers')

const buyerOnlyFields = buildDeliveryFields(baseForm(['buyer_courier']))

assert(
  !buyerOnlyFields.delivery_notes?.includes(FULFILMENT_COLLECTION_MARKER),
  'Buyer-only should not write collection marker',
)
assert(
  buyerOnlyFields.delivery_notes?.includes(FULFILMENT_BUYER_COURIER_MARKER),
  'Expected buyer courier marker',
)
console.log('PASS: buyer-only save markers')

console.log('\nAll listing delivery option round-trip checks passed.')
