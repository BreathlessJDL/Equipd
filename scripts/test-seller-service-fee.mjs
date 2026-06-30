#!/usr/bin/env node
/**
 * Seller Service Fee calculation tests.
 *
 * Usage: node scripts/test-seller-service-fee.mjs
 */

import {
  calculateBuyerProtectionFee,
  calculateBuyerCheckoutTotals,
} from '../src/lib/buyerProtection.js'
import {
  calculateSellerNetPayout,
  calculateSellerServiceFee,
  calculateSellerPayoutTotals,
} from '../src/lib/sellerServiceFee.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const itemPricePence = 20000

assert(
  calculateBuyerProtectionFee(itemPricePence) === 1000,
  `Expected Buyer Protection £10 for £200 item, got ${calculateBuyerProtectionFee(itemPricePence)}`,
)
logPass('Buyer Protection on £200 item is £10')

const checkout = calculateBuyerCheckoutTotals(itemPricePence)
assert(checkout.buyerTotalPence === 21000, `Expected buyer total 21000, got ${checkout.buyerTotalPence}`)
assert(checkout.sellerServiceFeePence === 400, `Expected seller service fee 400, got ${checkout.sellerServiceFeePence}`)
assert(checkout.sellerNetPence === 19600, `Expected seller net 19600, got ${checkout.sellerNetPence}`)
logPass('£200 item: buyer pays £210, seller service fee £4, seller receives £196')

assert(calculateSellerServiceFee(50000) === 1000, 'Expected £10 service fee on £500 item')
assert(calculateSellerNetPayout(50000) === 49000, 'Expected £490 net on £500 item')
logPass('2% fee scales with item price')

assert(
  calculateBuyerProtectionFee(10000) === 500,
  'Buyer Protection minimum £5 still applies',
)
assert(
  calculateBuyerProtectionFee(600000) === 25000,
  'Buyer Protection maximum £250 still applies',
)
logPass('Buyer Protection min/max unchanged')

const payoutTotals = calculateSellerPayoutTotals(itemPricePence)
assert(
  payoutTotals.itemPricePence - payoutTotals.sellerServiceFeePence === payoutTotals.sellerNetPence,
  'Seller net must equal item price minus service fee',
)
logPass('Seller payout totals reconcile')

console.log('\nAll Seller Service Fee checks passed.')
