#!/usr/bin/env node
/**
 * /browse prerender must be distinct from the homepage shell.
 *
 *   node scripts/test-browse-page-seo.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BROWSE_PAGE_H1,
  BROWSE_PAGE_META_DESCRIPTION,
  BROWSE_PAGE_TITLE,
  BROWSE_PATH,
  buildBrowsePageSeoDocument,
} from '../src/lib/browsePageSeo.js'
import { DEFAULT_PAGE_TITLE } from '../src/lib/pageTitles.js'
import { injectSeoIntoHtml } from '../src/lib/seoCataloguePrerender.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const homepage = readFileSync(join(ROOT, 'index.html'), 'utf8')
const sitemap = readFileSync(join(ROOT, 'public/sitemap.xml'), 'utf8')
const browsePageSource = readFileSync(join(ROOT, 'src/pages/BrowsePage.jsx'), 'utf8')

assert.equal(BROWSE_PATH, '/browse')
assert.notEqual(BROWSE_PAGE_TITLE, DEFAULT_PAGE_TITLE)
assert.match(BROWSE_PAGE_TITLE, /Browse Used Gym Equipment for Sale/)
assert.doesNotMatch(BROWSE_PAGE_TITLE, /Sell & Value/)
assert.ok(sitemap.includes('https://www.equipd.co.uk/browse'), 'sitemap includes /browse')
assert.ok(browsePageSource.includes('useBrowseFilters'), 'browse keeps URL filters')
assert.ok(browsePageSource.includes('ListingBrowseFilters'), 'browse keeps filter UI')
assert.ok(browsePageSource.includes('useBrowseListings'), 'browse keeps listing search')

const listings = [
  {
    status: 'active',
    slug: 'life-fitness-treadmill-browse-1',
    title: 'Life Fitness Treadmill',
    price_pence: 125000,
    city: 'Manchester',
    published_at: '2026-10-01T12:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'draft',
    slug: 'draft-hidden',
    title: 'Draft Machine',
    price_pence: 1,
    published_at: '2026-10-02T12:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'suspended-hidden',
    title: 'Suspended Seller Treadmill',
    price_pence: 90000,
    seller_is_hidden_from_marketplace: true,
    published_at: '2026-10-03T12:00:00.000Z',
    quantity_available: 1,
  },
]

const doc = buildBrowsePageSeoDocument({ listings })
assert.equal(doc.canonicalPath, '/browse')
assert.equal(doc.title, BROWSE_PAGE_TITLE)
assert.equal(doc.description, BROWSE_PAGE_META_DESCRIPTION)
assert.equal(doc.path, '/browse')
assert.ok(doc.bodyHtml.includes(BROWSE_PAGE_H1))
assert.ok(doc.bodyHtml.includes('/listings/life-fitness-treadmill-browse-1'))
assert.ok(doc.bodyHtml.includes('£1,250'))
assert.ok(doc.bodyHtml.includes('Manchester'))
assert.ok(!doc.bodyHtml.includes('/listings/draft-hidden'))
assert.ok(!doc.bodyHtml.includes('/listings/suspended-hidden'))
assert.ok(!doc.bodyHtml.includes('Turn Your Gym Into Cash'))
assert.ok(!doc.jsonLd.some((node) => node['@type'] === 'Product'))

const template = homepage.replace(
  '</body>',
  '<script type="module" src="/assets/index-test.js"></script></body>',
)
const html = injectSeoIntoHtml(template, doc)
assert.ok(html.includes('<link rel="canonical" href="https://www.equipd.co.uk/browse" />'))
assert.ok(html.includes(`<title>${BROWSE_PAGE_TITLE}</title>`))
assert.ok(!html.includes(`<title>${DEFAULT_PAGE_TITLE}</title>`))
assert.ok(html.includes('rel="canonical" href="https://www.equipd.co.uk/browse"'))
assert.equal(
  (html.match(/rel="canonical"/g) || []).length,
  1,
  'single canonical',
)
assert.ok(html.includes('/listings/life-fitness-treadmill-browse-1'))
assert.ok(!html.includes('href="https://www.equipd.co.uk/" />') || html.includes('canonical" href="https://www.equipd.co.uk/browse"'))

const emptyDoc = buildBrowsePageSeoDocument({ listings: [] })
assert.ok(emptyDoc.bodyHtml.includes('No live listings are available right now'))
assert.ok(emptyDoc.bodyHtml.includes('/used-commercial-treadmills'))

console.log('test-browse-page-seo: ok')
