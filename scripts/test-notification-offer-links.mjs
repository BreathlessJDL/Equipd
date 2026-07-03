#!/usr/bin/env node
/**
 * Unit tests for offer notification deep-link routing.
 *
 * Usage:
 *   node scripts/test-notification-offer-links.mjs
 */

import {
  buildHubMyOffersPath,
  buildHubSellingOffersPath,
  getOfferNotificationNavigationPath,
  OFFER_NOTIFICATION_TYPE_VALUES,
  resolveHubOfferPathFromLink,
} from '../src/lib/notificationNavigation.js'

const NOTIFICATION_TYPES = OFFER_NOTIFICATION_TYPE_VALUES

function getNotificationNavigationPath(notification) {
  return getOfferNotificationNavigationPath(notification)
}

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed += 1
    console.log(`ok: ${message}`)
    return
  }

  failed += 1
  console.error(`FAIL: ${message}`)
}

const offerId = 'offer-123'

assert(
  resolveHubOfferPathFromLink(`/hub?section=offers&offerId=${offerId}`) ===
    buildHubMyOffersPath(offerId),
  'resolveHubOfferPathFromLink maps buyer My Offers links',
)
assert(
  resolveHubOfferPathFromLink(`/hub?section=buying&tab=offers&offerId=${offerId}`) ===
    buildHubMyOffersPath(offerId),
  'resolveHubOfferPathFromLink maps buying tab links to My Offers',
)
assert(
  resolveHubOfferPathFromLink(`/hub?section=selling&tab=offers&offerId=${offerId}`) ===
    buildHubSellingOffersPath(offerId),
  'resolveHubOfferPathFromLink maps seller offers links',
)

assert(
  getNotificationNavigationPath({
    type: NOTIFICATION_TYPES.COUNTER_OFFER_RECEIVED,
    link_url: `/hub?section=offers&offerId=${offerId}`,
  }) === buildHubMyOffersPath(offerId),
  'buyer counter notification opens My Offers',
)
assert(
  getNotificationNavigationPath({
    type: NOTIFICATION_TYPES.COUNTER_OFFER_RECEIVED,
    link_url: `/hub?section=selling&tab=offers&offerId=${offerId}`,
  }) === buildHubSellingOffersPath(offerId),
  'seller counter-back notification opens Selling offers',
)
assert(
  getNotificationNavigationPath({
    type: NOTIFICATION_TYPES.OFFER_RECEIVED,
    link_url: `/hub?section=selling&tab=offers&offerId=${offerId}`,
  }) === buildHubSellingOffersPath(offerId),
  'offer_received preserves seller hub destination from link',
)
assert(
  getNotificationNavigationPath({
    type: NOTIFICATION_TYPES.COUNTER_OFFER_ACCEPTED,
    link_url: `/hub?section=selling&tab=offers&offerId=${offerId}`,
  }) === buildHubSellingOffersPath(offerId),
  'counter_offer_accepted opens seller offers area',
)
assert(
  getNotificationNavigationPath({
    type: NOTIFICATION_TYPES.OFFER_ACCEPTED,
    link_url: `/hub?section=offers&offerId=${offerId}`,
  }) === buildHubMyOffersPath(offerId),
  'offer_accepted opens buyer My Offers',
)
assert(
  getNotificationNavigationPath({
    type: NOTIFICATION_TYPES.OFFER_RECEIVED,
    link_url: `/hub?section=offers&offerId=${offerId}`,
  }) === buildHubSellingOffersPath(offerId),
  'offer_received still falls back to seller offers when link lacks section',
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
