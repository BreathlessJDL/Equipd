import { readFileSync } from 'node:fs'
import {
  classifyListingDiscoveryState,
  isListingEligibleForPrerender,
  isListingEligibleForSitemapInclusion,
  LISTING_DISCOVERY_STATES,
} from '../src/lib/listingDiscoveryEligibility.js'
import { buildListingSeoDocument } from '../src/lib/listingSeoPrerender.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const now = new Date('2026-07-23T09:00:00.000Z')

const activeListing = {
  id: 'a1',
  slug: 'life-fitness-integrity-series-treadmill',
  status: 'active',
  title: 'Life Fitness Integrity Series Treadmill',
  description: 'Clean active treadmill.',
  brand: 'Life Fitness',
  model: 'Integrity Series',
  condition: 'good',
  price_pence: 325000,
  quantity_available: 1,
  seller_id: 'seller-1',
  equipment_product_id: 'p1',
  canonical_product_key: 'life-fitness-integrity-series-treadmill',
  category_id: 'cat-1',
  category: { id: 'cat-1', name: 'Treadmill', slug: 'treadmills' },
  location_name: 'Manchester',
  city: 'Manchester',
  published_at: '2026-07-01T00:00:00.000Z',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
  listing_images: [{ id: 'i1', url: 'https://cdn.example.com/active.jpg', sort_order: 0 }],
}

const recentSold = {
  ...activeListing,
  id: 's1',
  slug: 'sold-life-fitness-integrity-series-treadmill',
  status: 'sold',
  sold_at: '2026-07-01T00:00:00.000Z',
  quantity_available: 0,
}

const oldSold = {
  ...recentSold,
  id: 's2',
  slug: 'old-sold-treadmill',
  sold_at: '2025-07-23T09:00:00.000Z',
}

const justInside = {
  ...recentSold,
  id: 's3',
  slug: 'sold-364-days',
  sold_at: '2025-07-24T09:00:00.000Z',
}

const missingSoldAt = {
  ...recentSold,
  id: 's4',
  slug: 'missing-sold-at',
  sold_at: null,
}

const missingPublishedAt = {
  ...recentSold,
  id: 's5',
  slug: 'missing-published-at',
  published_at: null,
}

const testListing = {
  ...activeListing,
  id: 't1',
  slug: 'test-active',
  is_test_data: true,
}

const malformedSlug = {
  ...activeListing,
  id: 'm1',
  slug: 'bad/slug',
}

assertEqual(
  classifyListingDiscoveryState(activeListing, { now }),
  LISTING_DISCOVERY_STATES.ACTIVE_PUBLIC,
  'active public state',
)
assertEqual(
  classifyListingDiscoveryState(recentSold, { now }),
  LISTING_DISCOVERY_STATES.SOLD_INDEXABLE,
  'recent sold indexable state',
)
assertEqual(
  classifyListingDiscoveryState(oldSold, { now }),
  LISTING_DISCOVERY_STATES.SOLD_READABLE_NOINDEX,
  'exact 12-month boundary noindex state',
)
assertEqual(
  classifyListingDiscoveryState(justInside, { now }),
  LISTING_DISCOVERY_STATES.SOLD_INDEXABLE,
  '364 days sold stays indexable',
)
assertEqual(
  classifyListingDiscoveryState(missingSoldAt, { now }),
  LISTING_DISCOVERY_STATES.UNREADABLE,
  'missing sold_at unreadable',
)
assertEqual(
  classifyListingDiscoveryState(missingPublishedAt, { now }),
  LISTING_DISCOVERY_STATES.UNREADABLE,
  'missing published_at unreadable',
)
assertEqual(
  classifyListingDiscoveryState(testListing, { now }),
  LISTING_DISCOVERY_STATES.UNREADABLE,
  'test listing unreadable',
)
assertEqual(
  classifyListingDiscoveryState(malformedSlug, { now }),
  LISTING_DISCOVERY_STATES.UNREADABLE,
  'malformed slug unreadable',
)

assert(isListingEligibleForPrerender(activeListing, { now }), 'active included in prerender')
assert(isListingEligibleForPrerender(recentSold, { now }), 'recent sold included in prerender')
assert(!isListingEligibleForPrerender(oldSold, { now }), 'old sold excluded from prerender')
assert(!isListingEligibleForPrerender(testListing, { now }), 'test excluded from prerender')
assert(
  isListingEligibleForPrerender(recentSold, { now }) === isListingEligibleForSitemapInclusion(recentSold, { now }),
  'prerender and sitemap rules align',
)

const equipmentProduct = {
  id: 'p1',
  status: 'approved',
  brand: 'Life Fitness',
  equipment_type: 'Treadmill',
  product_family: 'Integrity Series',
  canonical_product_name: 'Integrity Series Treadmill',
  canonical_product_key: 'life-fitness-integrity-series-treadmill',
  original_base_price: 899500,
  original_base_price_currency: 'GBP',
}

const sellerProfile = {
  id: 'seller-1',
  display_name: 'Gym Clearance UK',
  username: 'gymclearance',
}

const recs = [
  { ...activeListing, id: 'a2', slug: 'lf-treadmill-2', title: 'Life Fitness Treadmill 2' },
]

const activeDoc = buildListingSeoDocument({
  listing: activeListing,
  equipmentProduct,
  sellerProfile,
  activeListings: recs,
  now,
})

assert(activeDoc.title.includes('for Sale | Equipd'), 'active title pattern kept')
assert(activeDoc.canonicalPath === '/listings/life-fitness-integrity-series-treadmill', 'active canonical unchanged')
assert(activeDoc.robots === 'index, follow', 'active index follow')
assert(activeDoc.bodyHtml.includes('<h1>Life Fitness Integrity Series Treadmill</h1>'), 'active h1 prerendered')
assert(activeDoc.bodyHtml.includes('£3250') || activeDoc.bodyHtml.includes('Price:'), 'active price included')
assert(activeDoc.bodyHtml.includes("Seller's description"), 'active description section')
assert(activeDoc.bodyHtml.includes('View seller profile'), 'seller profile included')
assert(activeDoc.bodyHtml.includes('About this equipment'), 'equipment intelligence included')
assert(activeDoc.bodyHtml.includes('Listing summary'), 'active summary included')

const soldDoc = buildListingSeoDocument({
  listing: recentSold,
  equipmentProduct,
  sellerProfile,
  activeListings: recs,
  now,
})

assertEqual(
  soldDoc.title,
  'Sold Life Fitness Integrity Series Treadmill | Equipd',
  'sold title pattern preserved',
)
assertEqual(
  soldDoc.canonicalPath,
  '/listings/sold-life-fitness-integrity-series-treadmill',
  'sold canonical unchanged',
)
assertEqual(soldDoc.robots, 'index, follow', 'recent sold remains indexable')
assert(soldDoc.bodyHtml.includes('This item has now sold'), 'sold banner present')
assert(soldDoc.bodyHtml.includes('This listing has been completed on Equipd.'), 'sold supporting copy present')
assert(soldDoc.bodyHtml.includes('View Similar Listings'), 'sold similar CTA present')
assert(soldDoc.bodyHtml.includes('Value This Equipment'), 'sold valuation CTA present')
assert(!soldDoc.bodyHtml.includes('Make an offer'), 'sold omits offer CTA')
assert(!soldDoc.bodyHtml.includes('Message seller'), 'sold omits message CTA')
assert(!soldDoc.bodyHtml.includes('Quantity'), 'sold omits quantity controls')
assert(!JSON.stringify(soldDoc.jsonLd).includes('"Offer"'), 'sold JSON-LD omits Offer')
assert(!JSON.stringify(soldDoc.jsonLd).includes('AggregateOffer'), 'sold JSON-LD omits AggregateOffer')
assert(!JSON.stringify(soldDoc.jsonLd).includes('SoldOut'), 'sold JSON-LD omits SoldOut')

const oldSoldDoc = buildListingSeoDocument({
  listing: oldSold,
  equipmentProduct,
  sellerProfile,
  activeListings: recs,
  now,
})
assertEqual(oldSoldDoc.robots, 'noindex, follow', 'old sold noindex follow')

const vercelJson = readFileSync('vercel.json', 'utf8')
assert(vercelJson.includes('/api/public-listing-page'), 'vercel routes missing listing response API')

console.log('test-listing-prerender: ok')
