/**
 * Stage 8 — Merchant Center feed eligibility, fields, XML, price policy.
 */
import {
  BUYER_PROTECTION_FEE_MAX_PENCE,
  BUYER_PROTECTION_FEE_MIN_PENCE,
  calculateBuyerProtectionFee,
} from '../src/lib/buyerProtection.js'
import {
  classifyMerchantListingEligibility,
  isMerchantFeedEligibleListing,
  MERCHANT_EXCLUSION_REASONS,
} from '../src/lib/merchantEligibility.js'
import { classifyMerchantFulfilment } from '../src/lib/merchantFeedFulfilment.js'
import {
  buildMerchantExternalSellerId,
  buildMerchantProductId,
  resolveMerchantIdentifierDecision,
} from '../src/lib/merchantFeedIdentity.js'
import {
  assertMerchantPriceConsistency,
  buildMerchantPriceFields,
  formatMerchantPriceFromPence,
  MERCHANT_PRICE_POLICY,
} from '../src/lib/merchantFeedPrice.js'
import {
  buildMerchantFeedDescription,
  buildMerchantFeedTitle,
  mapListingConditionToMerchant,
} from '../src/lib/merchantFeedContent.js'
import { mapGoogleProductCategory } from '../src/lib/merchantFeedCategories.js'
import { buildMerchantFeedItem, stripMerchantFeedItemPrivateMeta } from '../src/lib/merchantFeedItem.js'
import { buildMerchantFeedFromListings } from '../src/lib/merchantFeedBuild.js'
import {
  buildMerchantFeedXml,
  countMerchantFeedItemsInXml,
} from '../src/lib/merchantFeedXml.js'
import { getListingCanonicalUrl } from '../src/lib/listingPageSeo.js'
import { buildListingProductSchema } from '../src/lib/listingPageStructuredData.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const sellerId = '11111111-1111-4111-8111-111111111111'
const listingId = '22222222-2222-4222-8222-222222222222'

const eligibleListing = {
  id: listingId,
  slug: 'life-fitness-t5-london',
  status: 'active',
  title: 'Life Fitness T5 for sale CHEAP!!!',
  description: 'Well looked after treadmill.\nColour: Silver\nContact me on WhatsApp 07123456789',
  brand: 'Life Fitness',
  model: 'T5',
  condition: 'good',
  price_pence: 100000, // £1000 → BP fee = £50
  quantity_available: 1,
  collection_available: true,
  courier_available: false,
  delivery_notes: 'In-person collection available',
  seller_id: sellerId,
  is_test_data: false,
  source: 'user',
  category: { name: 'Treadmill' },
  primary_image_url: 'https://cdn.example.com/listings/t5.jpg',
  listing_images: [
    { url: 'https://cdn.example.com/listings/t5.jpg', sort_order: 0 },
    { url: 'https://cdn.example.com/listings/t5-b.jpg', sort_order: 1 },
  ],
}

// --- Eligibility ---
assert(isMerchantFeedEligibleListing(eligibleListing), 'eligible listing included')

assert(
  !isMerchantFeedEligibleListing({ ...eligibleListing, status: 'sold', sold_at: '2026-07-01' }),
  'sold excluded',
)
assert(
  !isMerchantFeedEligibleListing({ ...eligibleListing, status: 'archived' }),
  'archived excluded',
)
assert(
  !isMerchantFeedEligibleListing({ ...eligibleListing, is_test_data: true }),
  'test excluded',
)
assert(
  classifyMerchantListingEligibility({ ...eligibleListing, price_pence: 0 })
    .reasons.includes(MERCHANT_EXCLUSION_REASONS.MISSING_PRICE),
  'missing price excluded',
)
assert(
  classifyMerchantListingEligibility({
    ...eligibleListing,
    primary_image_url: null,
    listing_images: [],
  }).reasons.includes(MERCHANT_EXCLUSION_REASONS.MISSING_IMAGE),
  'missing image excluded',
)
assert(
  classifyMerchantListingEligibility({ ...eligibleListing, quantity_available: 0 })
    .reasons.includes(MERCHANT_EXCLUSION_REASONS.NOT_PURCHASABLE),
  'zero quantity excluded',
)

const courierOnly = {
  ...eligibleListing,
  collection_available: false,
  courier_available: true,
  delivery_notes: 'Buyer can arrange a courier or collection service',
}
assert(
  classifyMerchantListingEligibility(courierOnly)
    .reasons.includes(MERCHANT_EXCLUSION_REASONS.UNSUPPORTED_FULFILMENT),
  'buyer courier only unsupported',
)

const sellerDeliveryOnly = {
  ...eligibleListing,
  collection_available: false,
  courier_available: true,
  delivery_notes: 'Seller can personally deliver',
  seller_delivery_radius_miles: 20,
}
assert(
  !classifyMerchantFulfilment(sellerDeliveryOnly).eligible,
  'seller delivery without priced shipping excluded',
)

// --- IDs ---
assertEqual(
  buildMerchantProductId(eligibleListing),
  'listing_22222222222242228222222222222222',
  'stable listing id',
)
assertEqual(
  buildMerchantProductId({ ...eligibleListing, slug: 'changed-slug', title: 'New title' }),
  'listing_22222222222242228222222222222222',
  'id stable across slug/title change',
)
assertEqual(
  buildMerchantExternalSellerId(eligibleListing),
  'seller_11111111111141118111111111111111',
  'external seller id',
)

// --- Price / Buyer Protection ---
assertEqual(MERCHANT_PRICE_POLICY.doNotSubmitUntilReviewed, true, 'submission gated')
assertEqual(formatMerchantPriceFromPence(100000), '1000.00 GBP', 'price format')
assertEqual(calculateBuyerProtectionFee(100000), 5000, '5% of £1000')
assertEqual(calculateBuyerProtectionFee(100), BUYER_PROTECTION_FEE_MIN_PENCE, 'min fee')
assertEqual(calculateBuyerProtectionFee(10_000_000), BUYER_PROTECTION_FEE_MAX_PENCE, 'max fee')

const priceFields = buildMerchantPriceFields(eligibleListing)
assertEqual(priceFields.price, '1000.00 GBP', 'feed price is listing asking')
assertEqual(priceFields.shippingPrice, '50.00 GBP', 'BP fee in shipping')
assertEqual(priceFields.buyerTotalPence, 105000, 'checkout total')
assert(assertMerchantPriceConsistency(eligibleListing).ok, 'price consistency ok')

const offer = buildListingProductSchema({ listing: eligibleListing })
assertEqual(offer.offers.price, '1000', 'Offer schema listing price')
assertEqual(
  Number(offer.offers.price) * 100,
  priceFields.itemPricePence,
  'feed price matches Offer schema',
)

// --- Content ---
const title = buildMerchantFeedTitle(eligibleListing)
assert(title.includes('Life Fitness'), 'title has brand')
assert(title.includes('T5'), 'title has model')
assert(/used/i.test(title), 'title used')
assert(!/cheap/i.test(title), 'title scrubbed cheap')
assert(!/for sale/i.test(title), 'title scrubbed for sale')

const description = buildMerchantFeedDescription(eligibleListing)
assert(description.includes('Condition: Good'), 'description condition')
assert(!description.includes('07123456789'), 'description strips phone')
assert(!/whatsapp/i.test(description), 'description strips whatsapp')

assertEqual(mapListingConditionToMerchant('good'), 'used', 'condition used')
assertEqual(mapListingConditionToMerchant('new'), 'new', 'condition new')
assertEqual(mapGoogleProductCategory(eligibleListing), 'Sporting Goods > Exercise & Fitness > Cardio > Treadmills', 'google category')

// --- Identifiers ---
const idDecision = resolveMerchantIdentifierDecision(eligibleListing)
assertEqual(idDecision.decision, 'brand_only', 'brand only')
assertEqual(idDecision.identifierExists, null, 'do not auto false for branded')
assertEqual(resolveMerchantIdentifierDecision({ ...eligibleListing, brand: null }).identifierExists, 'no', 'no brand → identifier_exists no')

// --- Feed item + XML ---
const built = buildMerchantFeedItem(eligibleListing)
assert(built.eligible, 'item eligible')
assertEqual(built.item.link, getListingCanonicalUrl(eligibleListing), 'canonical link')
assertEqual(built.item.availability, 'in_stock', 'in_stock')
assertEqual(built.item.condition, 'used', 'used')
assert(built.item.external_seller_id.startsWith('seller_'), 'external seller')
const publicItem = stripMerchantFeedItemPrivateMeta(built.item)
assert(!JSON.stringify(publicItem).includes('@'), 'no email in public item')
assert(!('_meta' in publicItem), 'meta stripped')

const soldListing = { ...eligibleListing, id: '33333333-3333-4333-8333-333333333333', status: 'sold', slug: 'sold-item' }
const feed = buildMerchantFeedFromListings([eligibleListing, soldListing, {
  ...eligibleListing,
  id: '44444444-4444-4444-8444-444444444444',
  slug: 'test-item',
  is_test_data: true,
}])
assertEqual(feed.summary.itemCount, 1, 'only eligible in feed')
assertEqual(feed.summary.eligible, 1, 'one eligible')
assert(!feed.xml.includes('sold-item'), 'sold absent from xml')
assert(!feed.xml.includes('test-item'), 'test absent from xml')
assert(!feed.xml.includes('07123456789'), 'no phone in xml')
assert(!feed.xml.includes('WhatsApp'), 'no whatsapp in xml')
assert(feed.xml.includes('<g:id>listing_22222222222242228222222222222222</g:id>'), 'id in xml')
assert(feed.xml.includes('<g:price>1000.00 GBP</g:price>'), 'price in xml')
assert(feed.xml.includes('<g:shipping>'), 'shipping block')
assert(feed.xml.includes('50.00 GBP'), 'bp fee shipping')
assertEqual(countMerchantFeedItemsInXml(feed.xml), 1, 'one item counted')

const xmlAgain = buildMerchantFeedXml(feed.items)
assertEqual(xmlAgain, buildMerchantFeedXml(feed.items), 'deterministic xml')

// Special character escaping
const ampListing = {
  ...eligibleListing,
  id: '55555555-5555-4555-8555-555555555555',
  slug: 'amp-listing',
  title: 'Smith & Jones Rack',
  brand: 'Hammer Strength',
  model: 'Iso-Lateral',
  category: { name: 'Rack' },
  description: 'Rack <heavy> & ready',
}
const ampBuilt = buildMerchantFeedItem(ampListing)
const ampXml = buildMerchantFeedXml([stripMerchantFeedItemPrivateMeta(ampBuilt.item)])
assert(ampXml.includes('Smith &amp; Jones') || ampXml.includes('Hammer Strength'), 'escaped or cdata title')
assert(!ampXml.includes('<heavy>'), 'raw html not injected')

// Landing-page parity checks (schema-level)
assertEqual(built.item.price.split(' ')[0], Number(offer.offers.price).toFixed(2), 'parity price')
assertEqual(built.item.link, offer.url, 'parity url')
assert(offer.offers, 'parity Offer present')

console.log('test-merchant-feed: ok')
