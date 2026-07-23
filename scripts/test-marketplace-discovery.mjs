/**
 * Stage 4 — marketplace discovery: sitemap listings, card hrefs, breadcrumbs, IndexNow URL.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { EQUIPD_SITE_ORIGIN } from '../src/lib/brandCatalogueCore.js'
import { getListingCanonicalUrl } from '../src/lib/listingPageSeo.js'
import {
  assertListingSitemapLocMatchesCanonical,
  buildAbsoluteListingCardHref,
  buildListingSitemapEntries,
  getListingCardHref,
  isListingEligibleForSitemap,
  resolveListingSitemapLastmod,
  shouldSplitSitemap,
  summarizeSitemapEntries,
  SITEMAP_SPLIT_URL_SOFT_LIMIT,
} from '../src/lib/listingSitemap.js'
import {
  buildListingBreadcrumbItems,
  buildListingBreadcrumbSchema,
  findBreadcrumbSchemas,
} from '../src/lib/breadcrumbStructuredData.js'
import { buildListingProductSchema } from '../src/lib/listingPageStructuredData.js'
import { findProductSchemas } from '../src/lib/productPageStructuredData.js'
import { collectListingIndexNowUrls } from '../src/lib/indexNowCollect.js'
import { buildListingIndexNowUrl } from '../src/lib/indexNowCore.js'

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

const activeListing = {
  id: 'a1',
  slug: 'proform-tour-clc-manchester',
  status: 'active',
  title: 'ProForm Tour de France CLC',
  updated_at: '2026-07-10T12:00:00.000Z',
  published_at: '2026-07-01T09:00:00.000Z',
  created_at: '2026-06-20T09:00:00.000Z',
  quantity_available: 2,
  is_test_data: false,
}

const draftListing = { ...activeListing, id: 'd1', status: 'draft', slug: 'draft-bike' }
const soldListing = { ...activeListing, id: 's1', status: 'sold', slug: 'sold-bike' }
const archivedListing = { ...activeListing, id: 'ar1', status: 'archived', slug: 'archived-bike' }
const testListing = { ...activeListing, id: 't1', slug: 'test-bike', is_test_data: true }
const zeroStock = { ...activeListing, id: 'z1', slug: 'zero-stock-bike', quantity_available: 0 }
const invalidSlug = { ...activeListing, id: 'i1', slug: 'bad/slug' }
const emptySlug = { ...activeListing, id: 'e1', slug: '  ' }

// 1–8 eligibility
assert(isListingEligibleForSitemap(activeListing), 'active public listing eligible')
assert(!isListingEligibleForSitemap(draftListing), 'draft excluded')
assert(!isListingEligibleForSitemap(soldListing), 'sold excluded')
assert(!isListingEligibleForSitemap(archivedListing), 'archived excluded')
assert(!isListingEligibleForSitemap(testListing), 'test listing excluded')
assert(!isListingEligibleForSitemap(zeroStock), 'zero-stock excluded')
assert(!isListingEligibleForSitemap(invalidSlug), 'invalid slug excluded')
assert(!isListingEligibleForSitemap(emptySlug), 'empty slug excluded')

// 9 canonical match
assert(
  assertListingSitemapLocMatchesCanonical(activeListing),
  'sitemap loc equals Stage 1 canonical',
)
assertEqual(
  buildListingSitemapEntries([activeListing])[0].loc,
  getListingCanonicalUrl(activeListing),
  'entry loc is canonical',
)
assertEqual(
  buildListingSitemapEntries([activeListing])[0].loc,
  `${EQUIPD_SITE_ORIGIN}/listings/proform-tour-clc-manchester`,
  'www absolute listing URL',
)

// 8 duplicates
const dupEntries = buildListingSitemapEntries([
  activeListing,
  { ...activeListing, id: 'a2', updated_at: '2026-07-15T12:00:00.000Z' },
])
assertEqual(dupEntries.length, 1, 'duplicate listing URL deduplicated')
assertEqual(dupEntries[0].lastmod, '2026-07-15', 'keeps newer lastmod on dedupe')

// 10–11 lastmod
assertEqual(resolveListingSitemapLastmod(activeListing), '2026-07-10', 'uses updated_at')
assertEqual(
  resolveListingSitemapLastmod({
    published_at: '2026-07-01T09:00:00.000Z',
    created_at: '2026-06-20T09:00:00.000Z',
  }),
  '2026-07-01',
  'falls back to published_at',
)
const buildTime = new Date().toISOString().slice(0, 10)
assert(
  resolveListingSitemapLastmod(activeListing) !== buildTime
  || activeListing.updated_at.startsWith(buildTime),
  'lastmod is listing timestamp not invented build time',
)
assertNull(resolveListingSitemapLastmod({}), 'no lastmod without timestamps')

// 17–20 card hrefs
assertEqual(
  getListingCardHref(activeListing),
  '/listings/proform-tour-clc-manchester',
  'listing card href is canonical path',
)
assertEqual(
  buildAbsoluteListingCardHref(activeListing),
  `${EQUIPD_SITE_ORIGIN}/listings/proform-tour-clc-manchester`,
  'absolute card href',
)
assert(getListingCardHref(activeListing).startsWith('/listings/'), 'homepage/brand/recs share ListingCard href')
assertNull(getListingCardHref({ title: 'no slug' }), 'missing slug has no href')

// 21–22 breadcrumbs
const crumbListing = {
  ...activeListing,
  category: { name: 'Spin Bikes', slug: 'spin-bikes' },
}
const crumbItems = buildListingBreadcrumbItems(crumbListing)
assertEqual(crumbItems.length, 3, 'Home → Browse → Category')
assertEqual(crumbItems[0].path, '/', 'breadcrumb home')
assertEqual(crumbItems[1].path, '/browse', 'breadcrumb browse')
assertEqual(crumbItems[2].path, '/browse?category=spin-bikes', 'breadcrumb category path')
assertEqual(crumbItems[2].name, 'Spin Bikes', 'breadcrumb category name')
const crumbSchema = buildListingBreadcrumbSchema(crumbListing)
assertEqual(findBreadcrumbSchemas([crumbSchema]).length, 1, 'one BreadcrumbList')
assertEqual(
  crumbSchema.itemListElement[2].item,
  `${EQUIPD_SITE_ORIGIN}/browse?category=spin-bikes`,
  'JSON-LD final crumb matches category browse URL',
)
assertEqual(
  crumbSchema.itemListElement[1].item,
  `${EQUIPD_SITE_ORIGIN}/browse`,
  'JSON-LD browse matches visible browse',
)
assertEqual(
  crumbSchema['@id'],
  `${EQUIPD_SITE_ORIGIN}/listings/proform-tour-clc-manchester#breadcrumb`,
  'breadcrumb @id stays on listing page',
)
const soldForCrumb = {
  ...soldListing,
  published_at: '2026-01-01T00:00:00.000Z',
  sold_at: '2026-06-01T00:00:00.000Z',
  category: { name: 'Spin Bikes', slug: 'spin-bikes' },
}
assert(buildListingBreadcrumbSchema(soldForCrumb), 'eligible sold has breadcrumb schema')

// Product schema coexistence
const product = buildListingProductSchema({ listing: activeListing })
assertEqual(findProductSchemas([product, crumbSchema]).length, 1, 'one Product on listing page graph')

// 25 IndexNow publish URL is canonical
const indexNowUrl = buildListingIndexNowUrl(activeListing.slug)
assertEqual(indexNowUrl, getListingCanonicalUrl(activeListing), 'IndexNow URL matches canonical')
const publishCollected = collectListingIndexNowUrls({
  previous: { ...activeListing, status: 'draft' },
  next: activeListing,
  action: 'update',
})
assert(publishCollected.notify, 'publish/status change notifies')
assert(
  publishCollected.urls.includes(getListingCanonicalUrl(activeListing)),
  'IndexNow includes canonical listing URL',
)

// 26 Active-only legacy helper: sold still excluded from isListingEligibleForSitemap
assert(!isListingEligibleForSitemap(soldListing), 'legacy sitemap helper remains active-only')
assert(
  !isListingEligibleForSitemap({
    ...soldListing,
    published_at: '2026-01-01T00:00:00.000Z',
    sold_at: '2026-06-01T00:00:00.000Z',
  }),
  'eligible sold still excluded from active-only helper (use isSoldListingEligibleForSitemap)',
)

// Scalability helpers
assert(!shouldSplitSitemap({ urlCount: 2000, byteLength: 500_000 }), 'current scale no split')
assert(shouldSplitSitemap({ urlCount: SITEMAP_SPLIT_URL_SOFT_LIMIT, byteLength: 1 }), 'soft limit trips')
assertEqual(
  summarizeSitemapEntries([
    { loc: `${EQUIPD_SITE_ORIGIN}/` },
    { loc: `${EQUIPD_SITE_ORIGIN}/browse` },
    { loc: `${EQUIPD_SITE_ORIGIN}/brands/proform` },
    { loc: `${EQUIPD_SITE_ORIGIN}/equipment/proform-tour-de-france-clc` },
    { loc: `${EQUIPD_SITE_ORIGIN}/listings/proform-tour-clc-manchester` },
  ]).listings,
  1,
  'summary counts listings',
)

// Optional: if a generated sitemap exists, validate structure + non-listing routes remain
const sitemapPath = join(process.cwd(), 'public', 'sitemap.xml')
if (existsSync(sitemapPath)) {
  const xml = readFileSync(sitemapPath, 'utf8')
  assert(xml.includes('<?xml version="1.0"'), 'sitemap has xml declaration')
  assert(xml.includes('<urlset'), 'sitemap is urlset')
  assert(xml.includes(`${EQUIPD_SITE_ORIGIN}/`), 'home remains')
  assert(xml.includes(`${EQUIPD_SITE_ORIGIN}/browse`), 'browse remains')
  assert(xml.includes(`${EQUIPD_SITE_ORIGIN}/brands`), 'brands remain')
  assert(xml.includes(`${EQUIPD_SITE_ORIGIN}/equipment/`), 'equipment remain')
  assert(!xml.includes('<priority>'), 'no priority values')
  assert(!xml.includes('<changefreq>'), 'no changefreq values')
  // Listing URLs may be zero in empty envs — when present must be canonical form
  const listingLocs = [...xml.matchAll(/<loc>(https:\/\/www\.equipd\.co\.uk\/listings\/[^<]+)<\/loc>/g)]
    .map((m) => m[1])
  for (const loc of listingLocs) {
    assert(!loc.includes('?'), 'listing sitemap loc has no query string')
    assert(!loc.endsWith('/'), 'listing sitemap loc has no trailing slash')
  }
}

console.log('test-marketplace-discovery: ok')
