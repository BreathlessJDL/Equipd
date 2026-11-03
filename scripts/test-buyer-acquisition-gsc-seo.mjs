#!/usr/bin/env node
/**
 * GSC buyer-acquisition SEO pass: buy hub, homepage listings, city hubs,
 * private edit-listing noindex, suspended sellers, canonicals.
 *
 *   node scripts/test-buyer-acquisition-gsc-seo.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BUY_LOCATION_HUBS,
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
  BUY_USED_GYM_EQUIPMENT_META_TITLE,
  BUY_USED_GYM_EQUIPMENT_PATH,
  buildBuyUsedGymEquipmentSeoDocument,
} from '../src/lib/buyUsedGymEquipmentPage.js'
import {
  buildHomePageSeoDocument,
  selectHomeRecentListings,
} from '../src/lib/homePageSeo.js'
import {
  LOCATION_PAGES,
  buildLocationPageMeta,
  buildLocationPagePath,
  buildLocationPageSeoDocument,
  selectPublicLocationListings,
} from '../src/lib/locations.js'
import { DEFAULT_PAGE_DESCRIPTION, DEFAULT_PAGE_TITLE } from '../src/lib/pageTitles.js'
import {
  isPrivateEditListingPath,
  PRIVATE_PAGE_ROBOTS,
  renderPrivateEditListingGoneHtml,
} from '../src/lib/privatePageNoindex.js'
import { injectSeoIntoHtml } from '../src/lib/seoCataloguePrerender.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

const listings = [
  {
    status: 'active',
    slug: 'birmingham-treadmill',
    title: 'Birmingham Commercial Treadmill',
    price_pence: 220000,
    city: 'Birmingham',
    latitude: 52.4862,
    longitude: -1.8904,
    published_at: '2026-09-04T12:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'leeds-rower',
    title: 'Leeds Concept2 Rower',
    price_pence: 95000,
    city: 'Leeds',
    latitude: 53.8008,
    longitude: -1.5491,
    published_at: '2026-09-05T12:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'london-rack',
    title: 'London Power Rack',
    price_pence: 140000,
    city: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    published_at: '2026-09-03T12:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'draft-should-not-appear',
    title: 'Should not appear draft',
    published_at: '2026-09-06T12:00:00.000Z',
  },
  {
    status: 'draft',
    slug: 'true-draft',
    title: 'True Draft',
    published_at: '2026-09-07T12:00:00.000Z',
    latitude: 52.4862,
    longitude: -1.8904,
  },
  {
    status: 'active',
    slug: 'suspended-seller-bike',
    title: 'Suspended Seller Bike',
    price_pence: 50000,
    city: 'Birmingham',
    latitude: 52.4862,
    longitude: -1.8904,
    published_at: '2026-09-08T12:00:00.000Z',
    seller_is_suspended: true,
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'unpublished-qty',
    title: 'Zero Quantity Bike',
    price_pence: 40000,
    city: 'Leeds',
    latitude: 53.8008,
    longitude: -1.5491,
    published_at: '2026-09-09T12:00:00.000Z',
    quantity_available: 0,
  },
]

listings[3].status = 'active'
listings[3].is_test_data = true

const buyDoc = buildBuyUsedGymEquipmentSeoDocument({ listings })
assert.equal(buyDoc.path, BUY_USED_GYM_EQUIPMENT_PATH)
assert.equal(buyDoc.canonicalPath, BUY_USED_GYM_EQUIPMENT_PATH)
assert.equal(buyDoc.title, `${BUY_USED_GYM_EQUIPMENT_META_TITLE} | Equipd`)
assert.ok(BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION.startsWith('Buy used gym equipment'))
assert.ok(buyDoc.bodyHtml.includes('<h1>Buy Used Gym Equipment</h1>'))
assert.ok(buyDoc.bodyHtml.includes('/listings/birmingham-treadmill'))
assert.ok(buyDoc.bodyHtml.includes('£2,200'))
assert.ok(buyDoc.bodyHtml.includes('Birmingham'))
assert.ok(!buyDoc.bodyHtml.includes('/listings/true-draft'))
assert.ok(!buyDoc.bodyHtml.includes('/listings/suspended-seller-bike'))
assert.ok(!buyDoc.bodyHtml.includes('/listings/unpublished-qty'))
assert.ok(!buyDoc.bodyHtml.includes('/listings/draft-should-not-appear'))
for (const hub of BUY_LOCATION_HUBS) {
  assert.ok(buyDoc.bodyHtml.includes(`href="${hub.to}"`), `buy page links ${hub.to}`)
}

const buyHtml = injectSeoIntoHtml(
  '<!doctype html><html><head><title>Home</title><link rel="canonical" href="https://www.equipd.co.uk/" /></head><body><div id="root"></div></body></html>',
  buyDoc,
)
assert.ok(buyHtml.includes('rel="canonical" href="https://www.equipd.co.uk/buy-used-gym-equipment"'))
assert.ok(!buyHtml.includes('rel="canonical" href="https://www.equipd.co.uk/"'))

const homeDoc = buildHomePageSeoDocument({ listings })
assert.equal(homeDoc.path, '/')
assert.equal(homeDoc.canonicalPath, '/')
assert.equal(homeDoc.title, DEFAULT_PAGE_TITLE)
assert.equal(homeDoc.description, DEFAULT_PAGE_DESCRIPTION)
assert.ok(homeDoc.bodyHtml.includes('href="/buy-used-gym-equipment"'))
assert.ok(homeDoc.bodyHtml.includes('href="/browse"'))
assert.ok(homeDoc.bodyHtml.includes('/listings/leeds-rower'))
assert.ok(homeDoc.bodyHtml.includes('Recently Added'))
assert.ok(!homeDoc.bodyHtml.includes('/listings/suspended-seller-bike'))
assert.ok(!homeDoc.bodyHtml.includes('/listings/unpublished-qty'))
assert.ok(!homeDoc.jsonLd.some((node) => node['@type'] === 'Product'))

const selectedHome = selectHomeRecentListings(listings)
assert.ok(selectedHome.every((row) => row.slug !== 'suspended-seller-bike'))
assert.equal(selectedHome[0].slug, 'leeds-rower')

const homeHtml = injectSeoIntoHtml(
  '<!doctype html><html><head><title>Buy, Sell & Value Used Gym Equipment | Equipd Marketplace</title><meta name="description" content="home" /><link rel="canonical" href="https://www.equipd.co.uk/" /></head><body><div id="root"></div></body></html>',
  homeDoc,
)
assert.equal(homeDoc.crawlerOnlyBody, true)
assert.ok(homeHtml.includes('rel="canonical" href="https://www.equipd.co.uk/"'))
assert.ok(homeHtml.includes('Buy, Sell &amp; Value Used Gym Equipment | Equipd Marketplace'))
assert.ok(homeHtml.includes('/listings/birmingham-treadmill'))
assert.ok(homeHtml.includes('id="equipd-home-crawler-listings"'))
assert.ok(homeHtml.includes('seo-prerender--crawler'))
assert.ok(homeHtml.includes('aria-hidden="true"'))
assert.ok(homeHtml.includes(' inert>'))
assert.ok(homeHtml.includes('<div id="root"></div>'))
assert.ok(!homeHtml.includes('<div id="root"><article'))
assert.ok(!homeHtml.includes('<div id="root"><div'))
assert.ok(!/#root">[\s\S]*href="\/listings\//.test(homeHtml))
assert.ok(!homeHtml.includes('listing-images/'))
assert.ok(homeHtml.includes('clip-path:inset(50%)'))

const focusCities = ['birmingham', 'leeds', 'manchester', 'london']
for (const slug of focusCities) {
  const region = LOCATION_PAGES[slug]
  const meta = buildLocationPageMeta(region)
  assert.equal(meta.canonicalPath, buildLocationPagePath(slug))
  assert.equal(meta.title, `Used Gym Equipment in ${region.name} | Equipd`)
  assert.ok(meta.description.includes(region.name))
  assert.notEqual(meta.title, buyDoc.title)
  assert.notEqual(meta.canonicalPath, '/')
  assert.notEqual(meta.canonicalPath, BUY_USED_GYM_EQUIPMENT_PATH)
}

const birminghamDoc = buildLocationPageSeoDocument(LOCATION_PAGES.birmingham, { listings })
assert.equal(birminghamDoc.canonicalPath, '/listings/birmingham')
assert.ok(birminghamDoc.bodyHtml.includes('/listings/birmingham-treadmill'))
assert.ok(birminghamDoc.bodyHtml.includes('£2,200'))
assert.ok(!birminghamDoc.bodyHtml.includes('/listings/london-rack'))
assert.ok(!birminghamDoc.bodyHtml.includes('/listings/leeds-rower'))
assert.ok(!birminghamDoc.bodyHtml.includes('/listings/suspended-seller-bike'))
assert.ok(birminghamDoc.bodyHtml.includes(BUY_USED_GYM_EQUIPMENT_PATH))
assert.ok(!birminghamDoc.bodyHtml.includes('listings load on this page'))

const londonDoc = buildLocationPageSeoDocument(LOCATION_PAGES.london, { listings })
assert.ok(londonDoc.bodyHtml.includes('/listings/london-rack'))
assert.ok(!londonDoc.bodyHtml.includes('/listings/birmingham-treadmill'))

const emptyDoc = buildLocationPageSeoDocument(LOCATION_PAGES.manchester, { listings: [] })
assert.ok(emptyDoc.bodyHtml.includes('No matching listings are live near this city'))
assert.ok(emptyDoc.bodyHtml.includes('/browse'))
assert.ok(!emptyDoc.bodyHtml.includes('/listings/leeds-rower'))

const birminghamSelected = selectPublicLocationListings(listings, LOCATION_PAGES.birmingham)
assert.deepEqual(birminghamSelected.map((row) => row.slug), ['birmingham-treadmill'])

assert.equal(isPrivateEditListingPath('/edit-listing/1767988203812x570887451151433700'), true)
assert.equal(isPrivateEditListingPath('/edit-listing'), true)
assert.equal(isPrivateEditListingPath('/listings/foo/edit'), false)
assert.equal(isPrivateEditListingPath('/buy-used-gym-equipment'), false)

const goneHtml = renderPrivateEditListingGoneHtml()
assert.ok(goneHtml.includes(`name="robots" content="${PRIVATE_PAGE_ROBOTS}"`))
assert.ok(!goneHtml.includes('1767988203812'))
assert.ok(!goneHtml.includes('listing_images'))
assert.ok(!goneHtml.includes('supabase'))
assert.ok(goneHtml.includes('This page is not available'))

const appSource = read('src/App.jsx')
assert.ok(appSource.includes('path="edit-listing/:legacyId"'))
assert.ok(appSource.includes('PrivateEditListingGonePage'))
assert.ok(appSource.includes('path="listings/:slug/edit"'))
assert.ok(appSource.includes('<ProtectedRoute>'))

const editPage = read('src/pages/EditListingPage.jsx')
assert.ok(editPage.includes("robotsContent: 'noindex, nofollow'"))
assert.ok(editPage.includes('noIndex: true'))
assert.ok(editPage.includes('isListingOwner'))
assert.ok(editPage.includes('if (!slug || !user?.id)'))

const robots = read('public/robots.txt')
assert.ok(robots.includes('Disallow: /edit-listing'))
assert.ok(robots.includes('Disallow: /listings/*/edit'))

const vercel = JSON.parse(read('vercel.json'))
const rewriteSources = vercel.rewrites.map((rule) => rule.source)
assert.ok(rewriteSources.includes('/edit-listing/:path*'))
assert.ok(
  rewriteSources.indexOf('/listings/:slug/edit') < rewriteSources.indexOf('/listings/:slug'),
  'listing editor rewrite precedes public listing rewrite',
)
assert.ok(
  rewriteSources.indexOf('/edit-listing/:path*')
    < rewriteSources.indexOf('/((?!.*\\.[^/]+$).*)'),
  'legacy edit-listing rewrite precedes SPA catch-all',
)
for (const slug of ['birmingham', 'leeds', 'manchester', 'london']) {
  const rule = vercel.rewrites.find((entry) => entry.source === `/listings/${slug}`)
  assert.equal(rule?.destination, `/listings/${slug}/index.html`)
  assert.notEqual(rule?.destination, '/index.html')
}
assert.ok(
  vercel.headers.some((entry) => (
    entry.source.includes('edit-listing')
    && entry.headers.some((header) => header.value === 'noindex, nofollow')
  )),
)

const apiHandler = read('api/private-page-noindex.js')
assert.ok(apiHandler.includes('statusCode = 404'))
assert.ok(apiHandler.includes('X-Robots-Tag'))
assert.ok(!apiHandler.includes('supabase'))
assert.ok(!apiHandler.includes('fetchListing'))

const prerender = read('scripts/prerender-seo-catalogue.mjs')
assert.ok(prerender.includes('buildHomePageSeoDocument({ listings: activeListings })'))
assert.ok(prerender.includes('buildAllLocationPageSeoDocuments({ listings: activeListings })'))
assert.ok(prerender.includes("join(distDir, 'index.html')"))

console.log('test-buyer-acquisition-gsc-seo: ok')
