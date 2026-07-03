#!/usr/bin/env node
/**
 * Seller shop URL helpers and Stripe business profile URL tests.
 *
 * Usage: node scripts/test-seller-shop-urls.mjs
 */

import {
  buildStripeBusinessProfileUrl,
  getSellerShopPath,
  getSellerShopUrl,
  isProfileUuid,
  STRIPE_BUSINESS_PROFILE_PRODUCT_DESCRIPTION,
} from '../src/lib/sellerShopUrls.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const sampleUuid = '77749f0e-2b62-4143-905b-ec6d7b6d74ae'

assert(isProfileUuid(sampleUuid), 'UUID detected')
assert(!isProfileUuid('jordan'), 'Username is not UUID')
assert(!isProfileUuid(''), 'Empty string is not UUID')

assert(
  getSellerShopPath({ id: sampleUuid, username: 'jordan' }) === '/shop/jordan',
  'Username preferred in shop path',
)
assert(
  getSellerShopPath({ id: sampleUuid }) === `/shop/${sampleUuid}`,
  'UUID fallback when username missing',
)
assert(getSellerShopPath(sampleUuid) === `/shop/${sampleUuid}`, 'UUID string path')

assert(
  getSellerShopUrl({ id: sampleUuid, username: 'jordan' }, 'https://www.equipd.co.uk') ===
    'https://www.equipd.co.uk/shop/jordan',
  'Full username shop URL',
)
assert(
  buildStripeBusinessProfileUrl({ id: sampleUuid }, 'https://www.equipd.co.uk') ===
    `https://www.equipd.co.uk/shop/${sampleUuid}`,
  'Stripe URL falls back to profile id',
)
assert(
  STRIPE_BUSINESS_PROFILE_PRODUCT_DESCRIPTION.includes('Equipd Marketplace'),
  'Stripe product description present',
)

console.log('PASS: seller shop URL helpers')
