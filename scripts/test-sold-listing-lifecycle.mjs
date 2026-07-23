/**
 * Stage 5 — sold listing public readability lifecycle (Node-safe helpers).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { LOCATION_SLUGS } from '../src/lib/locations.js'
import { getListingCanonicalUrl, buildListingPageSeo } from '../src/lib/listingPageSeo.js'
import {
  buildListingBreadcrumbSchema,
  findBreadcrumbSchemas,
} from '../src/lib/breadcrumbStructuredData.js'
import {
  buildListingOfferSchema,
  buildListingProductSchema,
  buildListingPageStructuredData,
  isListingGenuinelyPurchasable,
} from '../src/lib/listingPageStructuredData.js'
import { findProductSchemas } from '../src/lib/productPageStructuredData.js'
import {
  addUtcMonths,
  getSoldListingIndexingState,
  isEligiblePublicSoldListing,
} from '../src/lib/listingSoldLifecycle.js'
import {
  buildListingSitemapEntries,
  isActiveListingEligibleForSitemap,
  isListingEligibleForSitemap,
  isSoldListingEligibleForSitemap,
  resolveListingSitemapLastmod,
} from '../src/lib/listingSitemap.js'
import { collectListingIndexNowUrls } from '../src/lib/indexNowCollect.js'
import { shouldNotifyListingChange } from '../src/lib/indexNowCore.js'
import { getListingValuationHref } from '../src/lib/listingDiscovery.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertNull(actual, label) {
  if (actual != null) throw new Error(`${label}: expected null, got ${JSON.stringify(actual)}`)
}

const now = new Date('2026-07-22T12:00:00.000Z')

const activeListing = {
  id: 'a1',
  slug: 'proform-tour-clc-manchester',
  status: 'active',
  title: 'ProForm Tour de France CLC',
  brand: 'ProForm',
  model: 'Tour de France CLC',
  condition: 'good',
  price_pence: 45000,
  quantity_available: 1,
  published_at: '2026-06-01T09:00:00.000Z',
  updated_at: '2026-07-10T12:00:00.000Z',
  created_at: '2026-05-20T09:00:00.000Z',
  is_test_data: false,
  category: { name: 'Exercise Bike' },
  primary_image_url: 'https://cdn.example.com/listings/proform.jpg',
  listing_images: [{ url: 'https://cdn.example.com/listings/proform.jpg' }],
}

const recentSold = {
  ...activeListing,
  id: 's-recent',
  status: 'sold',
  slug: 'sold-proform-tour-clc-leeds',
  quantity_available: 0,
  sold_at: '2026-06-01T10:00:00.000Z',
  published_at: '2026-01-15T09:00:00.000Z',
  updated_at: '2026-06-01T10:05:00.000Z',
}

const oldSold = {
  ...recentSold,
  id: 's-old',
  slug: 'sold-old-bike-birmingham',
  sold_at: '2024-07-22T12:00:00.000Z',
}

const neverPublishedSold = {
  ...recentSold,
  id: 's-never',
  slug: 'never-published-sold',
  published_at: null,
}

const draftListing = { ...activeListing, id: 'd1', status: 'draft', slug: 'draft-bike' }
const testSold = { ...recentSold, id: 't1', is_test_data: true, slug: 'test-sold-bike' }

// --- Eligibility ---
assert(isEligiblePublicSoldListing(recentSold), '1 eligible recent sold')
assert(isEligiblePublicSoldListing(oldSold), 'old sold still publicly readable eligible')
assert(!isEligiblePublicSoldListing(neverPublishedSold), '25 never-published sold not eligible')
assert(!isEligiblePublicSoldListing(draftListing), 'draft not eligible sold')
assert(!isEligiblePublicSoldListing(testSold), 'test sold not eligible')
assert(!isEligiblePublicSoldListing(activeListing), 'active is not sold-eligible')

// --- Sold UX copy helpers (SEO mirrors sold wording) ---
const recentSeo = buildListingPageSeo({ listing: recentSold, now })
assertEqual(
  recentSeo.titleForHook,
  'Sold ProForm Tour de France CLC Exercise Bike',
  '12 sold SEO title',
)
assert(recentSeo.description.includes('has now sold on Equipd'), '13 sold meta description')
assert(!/for sale|buy now|make an offer/i.test(recentSeo.description), 'no active-sale wording')
assertEqual(
  recentSeo.canonicalPath,
  '/listings/sold-proform-tour-clc-leeds',
  '14 canonical unchanged pattern',
)
assertEqual(recentSeo.canonicalUrl, getListingCanonicalUrl(recentSold), 'canonical absolute')
assertEqual(recentSeo.robotsContent, 'index, follow', '15 sold within 12 months index,follow')
assertEqual(recentSeo.noIndex, false, 'recent sold indexable')

const oldSeo = buildListingPageSeo({ listing: oldSold, now })
assertEqual(oldSeo.robotsContent, 'noindex, follow', '16 sold older than 12 months noindex,follow')
assertEqual(oldSeo.noIndex, true, 'old sold noindex flag')
assertEqual(oldSeo.canonicalPath, '/listings/sold-old-bike-birmingham', 'old sold canonical preserved')

// --- Exact 12-month boundary (UTC) ---
const boundarySoldAt = '2025-07-22T12:00:00.000Z'
assertEqual(
  addUtcMonths(boundarySoldAt, 12)?.toISOString(),
  '2026-07-22T12:00:00.000Z',
  '17 exact +12 months UTC',
)
const justBefore = getSoldListingIndexingState({
  soldAt: boundarySoldAt,
  now: new Date('2026-07-22T11:59:59.999Z'),
})
assertEqual(justBefore.indexable, true, '17 indexable just before expiry')
assertEqual(justBefore.sitemapEligible, true, 'sitemap eligible just before expiry')
const atExpiry = getSoldListingIndexingState({
  soldAt: boundarySoldAt,
  now: new Date('2026-07-22T12:00:00.000Z'),
})
assertEqual(atExpiry.indexable, false, '17 noindex exactly at 12 months')
assertEqual(atExpiry.sitemapEligible, false, 'excluded from sitemap at expiry')

// Feb 29 edge (UTC-safe)
const leap = addUtcMonths('2024-02-29T15:30:00.000Z', 12)
assertEqual(leap?.toISOString(), '2025-02-28T15:30:00.000Z', '18 UTC leap-day clamp')

// --- Structured data ---
const soldProduct = buildListingProductSchema({ listing: recentSold })
assert(soldProduct, '19 sold Product schema exists')
assertEqual(soldProduct['@type'], 'Product', 'Product type')
assertNull(buildListingOfferSchema({ listing: recentSold }), '20 sold Offer absent')
assert(!Object.prototype.hasOwnProperty.call(soldProduct, 'offers'), 'sold Product has no offers')
assert(!isListingGenuinelyPurchasable(recentSold), 'sold not purchasable')

const crumb = buildListingBreadcrumbSchema(recentSold)
assert(crumb, 'sold breadcrumb schema allowed')
const bundle = buildListingPageStructuredData({
  listing: recentSold,
  breadcrumbSchema: crumb,
})
assertEqual(bundle.productCount, 1, '21 one Product only')
assertEqual(bundle.breadcrumbCount, 1, '22 one BreadcrumbList only')
assertEqual(findProductSchemas(bundle.jsonLd).length, 1, 'one Product in graph')
assertEqual(findBreadcrumbSchemas(bundle.jsonLd).length, 1, 'one BreadcrumbList in graph')

// --- Sitemap ---
assert(isActiveListingEligibleForSitemap(activeListing), '26 active sitemap unchanged')
assert(isListingEligibleForSitemap(activeListing), 'active via legacy helper')
assert(!isListingEligibleForSitemap(recentSold), 'legacy helper remains active-only')
assert(isSoldListingEligibleForSitemap(recentSold, { now }), '23 recent eligible sold in sitemap')
assert(!isSoldListingEligibleForSitemap(oldSold, { now }), '24 old sold excluded from sitemap')
assert(!isSoldListingEligibleForSitemap(neverPublishedSold, { now }), '25 never-published excluded')

const mixedEntries = buildListingSitemapEntries([activeListing, recentSold, oldSold, neverPublishedSold], { now })
assertEqual(mixedEntries.length, 2, 'active + recent sold only')
assert(
  mixedEntries.some((e) => e.loc === getListingCanonicalUrl(activeListing)),
  'active present',
)
assert(
  mixedEntries.some((e) => e.loc === getListingCanonicalUrl(recentSold)),
  'recent sold present',
)
assertEqual(
  resolveListingSitemapLastmod(recentSold),
  '2026-06-01',
  'sold lastmod prefers sold_at',
)

// --- IndexNow sold transition ---
const soldNotify = shouldNotifyListingChange({
  previous: activeListing,
  next: recentSold,
  action: 'update',
})
assertEqual(soldNotify.reason, 'listing_sold', '27 IndexNow sold reason')
assert(soldNotify.notify, 'sold notifies')
const soldCollected = collectListingIndexNowUrls({
  previous: activeListing,
  next: recentSold,
  action: 'update',
})
assert(
  soldCollected.urls.includes(getListingCanonicalUrl(recentSold)),
  '27 IndexNow sold uses canonical URL',
)

const unpublish = shouldNotifyListingChange({
  previous: activeListing,
  next: { ...activeListing, status: 'archived' },
  action: 'update',
})
assertEqual(unpublish.reason, 'listing_unpublished', 'archive remains unpublished notify')

// --- Soft-404 / not-found distinction (helper level) ---
assert(isEligiblePublicSoldListing(recentSold), '28 valid sold does not map to not-found eligibility')
assert(!isEligiblePublicSoldListing(draftListing), '29 invalid still not publicly readable')

// --- Route collision protections ---
for (const locationSlug of LOCATION_SLUGS) {
  assert(locationSlug !== recentSold.slug, `30 sold slug does not collide with /listings/${locationSlug}`)
  assert(locationSlug !== 'new', 'reserved create path remains special')
}
assert(LOCATION_SLUGS.includes('manchester'), 'manchester location route reserved')
assert(recentSold.slug !== 'manchester', 'sold fixture does not claim manchester')
assert(recentSold.slug !== 'new', 'sold fixture not create route')

// App.jsx still registers location routes before :slug
const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')
const locIdx = appSource.indexOf('LOCATION_SLUGS.map')
const slugIdx = appSource.indexOf('path="listings/:slug"')
assert(locIdx > -1 && slugIdx > locIdx, '30 location routes registered before listing slug')

// --- Valuation CTA href ---
const valuationHref = getListingValuationHref(recentSold, null)
assert(valuationHref.startsWith('/valuation'), '11 valuation CTA uses valuation route')

// Migration present
const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260723100000_sold_listing_public_readability.sql',
)
assert(existsSync(migrationPath), 'migration file present')
const migrationSql = readFileSync(migrationPath, 'utf8')
assert(migrationSql.includes('listing_is_publicly_readable'), 'readability helper in migration')
assert(migrationSql.includes('sold_at'), 'sold_at in migration')
assert(migrationSql.includes('listing_is_publicly_visible'), 'visibility preserved')
assert(
  !/create\s+(or\s+replace\s+)?view\s+public\.listings_public_browse/i.test(migrationSql),
  'browse view not recreated/widened in Stage 5 migration',
)

console.log('test-sold-listing-lifecycle: ok')
