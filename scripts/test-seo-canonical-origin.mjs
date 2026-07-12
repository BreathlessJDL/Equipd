/**
 * Assert public SEO builders emit only the preferred www origin.
 */

import { EQUIPD_SITE_ORIGIN } from '../src/lib/brandCatalogueCore.js'
import { parseBrowseFiltersFromSearchParams } from '../src/lib/browseFilters.js'
import { buildBrowseSearchPath } from '../src/lib/browseSearchNavigation.js'
import {
  buildEquipmentCanonicalUrl,
  buildEquipmentOpenGraph,
  buildEquipmentPageSeoBundle,
} from '../src/lib/equipmentPageSeo.js'
import {
  EQUIPD_SCHEMA_ORIGIN,
  buildOrganizationSchema,
  buildWebsiteSchema,
  injectSiteStructuredDataIntoHtml,
} from '../src/lib/siteStructuredData.js'
import {
  buildBrandPageSeoDocument,
  buildBrandsIndexSeoDocument,
  buildEquipmentPageSeoDocument,
  injectSeoIntoHtml,
} from '../src/lib/seoCataloguePrerender.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertWwwOnly(text, label) {
  const value = String(text ?? '')
  assert(value.includes('https://www.equipd.co.uk'), `${label}: missing www origin`)
  assert(!/https:\/\/equipd\.co\.uk(?!\/email)/.test(value.replaceAll('https://www.equipd.co.uk', '')), `${label}: non-www host`)
  assert(!value.includes('localhost'), `${label}: localhost`)
  assert(!value.includes('vercel.app'), `${label}: preview host`)
}

assert(EQUIPD_SITE_ORIGIN === 'https://www.equipd.co.uk', 'shared origin is www')
assert(EQUIPD_SCHEMA_ORIGIN === EQUIPD_SITE_ORIGIN, 'schema origin aliases shared origin')

const browsePath = buildBrowseSearchPath('Life Fitness treadmill')
assert(browsePath.startsWith('/browse?search='), 'browse search path prefix')
assert(browsePath.includes('Life') && browsePath.includes('Fitness'), 'browse search path query')
const parsed = parseBrowseFiltersFromSearchParams(new URLSearchParams(browsePath.split('?')[1] || ''))
assert(parsed.search === 'Life Fitness treadmill', 'browse consumes search param')

const product = {
  id: 'p1',
  brand: 'Life Fitness',
  status: 'approved',
  equipment_type: 'Treadmill',
  canonical_product_name: 'Life Fitness Integrity Treadmill',
  canonical_product_key: 'life-fitness-integrity-treadmill',
  original_base_price: 9000,
  original_base_price_currency: 'GBP',
  image_url: 'https://cdn.example.com/treadmill.jpg',
  image_status: 'approved',
}

assertWwwOnly(buildEquipmentCanonicalUrl(product), 'equipment canonical')
const og = buildEquipmentOpenGraph(product)
assertWwwOnly(og['og:url'], 'og:url')
assertWwwOnly(JSON.stringify(buildEquipmentPageSeoBundle(product).jsonLd), 'equipment page jsonld')

const org = buildOrganizationSchema()
const website = buildWebsiteSchema()
assertWwwOnly(JSON.stringify(org), 'organization schema')
assertWwwOnly(JSON.stringify(website), 'website schema')
assert(org.description.includes('used commercial gym equipment'), 'updated description')

const brandsDoc = buildBrandsIndexSeoDocument({
  brands: [{
    displayName: 'Life Fitness',
    slug: 'life-fitness',
    href: '/brands/life-fitness',
    productCount: 1,
  }],
})
const brandDoc = buildBrandPageSeoDocument({
  brand: {
    displayName: 'Life Fitness',
    slug: 'life-fitness',
    href: '/brands/life-fitness',
    productCount: 1,
    intro: 'Explore Life Fitness.',
  },
  products: [{
    displayName: product.canonical_product_name,
    href: `/equipment/${product.canonical_product_key}`,
    canonicalProductKey: product.canonical_product_key,
  }],
})
const productDoc = buildEquipmentPageSeoDocument({ product, hasConsoleOptions: true })

const template = `<!doctype html><html><head><title>Equipd</title></head><body><div id="root"></div></body></html>`
for (const [name, doc] of [
  ['brands-index', brandsDoc],
  ['brand', brandDoc],
  ['equipment', productDoc],
]) {
  const html = injectSeoIntoHtml(template, doc)
  assertWwwOnly(html.match(/rel="canonical"[^>]*>/)?.[0] || '', `${name} canonical tag`)
  assert((html.match(/data-equipd-schema="organization"/g) || []).length === 1, `${name} one org`)
  assert((html.match(/data-equipd-schema="website"/g) || []).length === 1, `${name} one website`)
  assert((html.match(/"@type":"Organization"/g) || []).length === 1, `${name} one Organization @type`)
  assert((html.match(/"@type":"WebSite"/g) || []).length === 1, `${name} one WebSite @type`)
  assert(
    (html.match(/https:\/\/www\.equipd\.co\.uk\/#organization/g) || []).length >= 1,
    `${name} organization @id`,
  )
  assert(!html.includes('https://equipd.co.uk/'), `${name} no non-www absolute urls`)
}

const homeHtml = injectSiteStructuredDataIntoHtml(template)
assert((homeHtml.match(/data-equipd-schema="organization"/g) || []).length === 1, 'home one org')
assert((homeHtml.match(/data-equipd-schema="website"/g) || []).length === 1, 'home one website')
assertWwwOnly(homeHtml, 'home structured data html')

// Representative public paths (path-level; SEO origin coverage is via builders above)
for (const path of [
  '/',
  '/browse',
  '/brands',
  '/brands/life-fitness',
  '/equipment/life-fitness-integrity-treadmill',
  '/listings/manchester',
  '/listings/example-listing-slug',
]) {
  assert(path.startsWith('/'), `path intact: ${path}`)
  assert(!path.includes('https://'), `path not absolute: ${path}`)
}

console.log('seo canonical origin tests passed')
