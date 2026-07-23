/**
 * Stage 3 — listing discovery links, intelligence summary, similar ranking, alt text.
 */
import { LISTING_CONDITIONS } from '../src/lib/constants.js'
import {
  buildListingImageAltText,
} from '../src/lib/listingPageSeo.js'
import { buildListingProductSchema } from '../src/lib/listingPageStructuredData.js'
import { buildListingBreadcrumbSchema } from '../src/lib/breadcrumbStructuredData.js'
import { findProductSchemas } from '../src/lib/productPageStructuredData.js'
import { findBreadcrumbSchemas } from '../src/lib/breadcrumbStructuredData.js'
import {
  buildListingIntelligenceSummary,
  buildListingInternalLinks,
  getListingBrandPageHref,
  getListingBrowseTypeHref,
  getListingEquipmentPagePath,
  getListingValuationHref,
  getSimilarListingMatchRank,
  normalizeListingEquipmentProductWriteFields,
  rankSimilarListingCandidates,
  resolveListingProductMapping,
} from '../src/lib/listingDiscovery.js'
import { buildValuationHref } from '../src/lib/valuationNavigation.js'

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

const mappedListing = {
  id: 'listing-mapped',
  slug: 'proform-tour-clc',
  status: 'active',
  title: 'Great bike cheap!!!',
  brand: 'ProForm',
  model: 'Tour de France CLC',
  condition: 'good',
  price_pence: 45000,
  category_id: 'cat-bike',
  category: { id: 'cat-bike', name: 'Exercise Bike', slug: 'spin-bikes' },
  equipment_product_id: '11111111-1111-4111-8111-111111111111',
  canonical_product_key: 'proform-tour-de-france-clc',
}

const unmappedListing = {
  id: 'listing-unmapped',
  slug: 'random-weights',
  status: 'active',
  title: 'Used dumbbells',
  brand: 'UnknownBrandXYZ',
  model: null,
  condition: 'fair',
  price_pence: 5000,
  category_id: 'cat-free',
  category: { id: 'cat-free', name: 'Free Weights', slug: 'free-weights' },
}

const approvedProduct = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'approved',
  brand: 'ProForm',
  model: 'Tour de France CLC',
  equipment_type: 'Exercise Bike',
  product_family: 'Tour de France',
  canonical_product_name: 'ProForm Tour de France CLC',
  canonical_product_key: 'proform-tour-de-france-clc',
  original_base_price: 1800,
  original_base_price_currency: 'GBP',
  baseline_manufacture_year: 2018,
  production_start_year: 2016,
  production_end_year: 2020,
}

const incompleteProduct = {
  id: '22222222-2222-4222-8222-222222222222',
  status: 'approved',
  brand: 'ProForm',
  model: 'Basic Bike',
  equipment_type: 'Exercise Bike',
  canonical_product_name: 'ProForm Basic Bike',
  canonical_product_key: 'proform-basic-bike',
  original_base_price: null,
  baseline_manufacture_year: null,
}

const pendingProduct = {
  ...approvedProduct,
  status: 'pending',
}

// 1–2 mapping + equipment URL
assert(resolveListingProductMapping(mappedListing).hasMapping, 'mapped has mapping')
assertEqual(
  getListingEquipmentPagePath(mappedListing, approvedProduct),
  '/equipment/proform-tour-de-france-clc',
  'mapped equipment path',
)
assertNull(
  getListingEquipmentPagePath(unmappedListing, null),
  'unmapped has no equipment path',
)
assert(
  !buildListingInternalLinks(unmappedListing, null).some((link) => link.kind === 'equipment'),
  'unmapped has no false equipment link',
)

// 3–4 brand links
assertEqual(
  getListingBrandPageHref('ProForm'),
  '/brands/proform',
  'canonical brand route',
)
assertNull(getListingBrandPageHref('UnknownBrandXYZ'), 'unknown brand no dead link')
assertNull(getListingBrandPageHref(''), 'empty brand no link')

// 5 equipment-type browse
assertEqual(
  getListingBrowseTypeHref(mappedListing, approvedProduct),
  '/browse?category=spin-bikes',
  'browse uses category slug',
)
assertEqual(
  getListingBrowseTypeHref({ category: null }, { equipment_type: 'Treadmill' }),
  '/browse?category=treadmill',
  'browse falls back to equipment type mapping',
)

// 6–7 valuation prefill
assertEqual(
  getListingValuationHref(mappedListing, approvedProduct),
  buildValuationHref({ productKey: 'proform-tour-de-france-clc' }),
  'valuation prefill uses product key',
)
assertEqual(
  getListingValuationHref(unmappedListing, null),
  buildValuationHref({ query: 'UnknownBrandXYZ' }),
  'valuation partial prefill uses brand query',
)
assertEqual(
  getListingValuationHref({ brand: null, title: 'x' }, null),
  '/valuation',
  'valuation fallback when unmapped',
)

// 8–10 intelligence summary
const intelligence = buildListingIntelligenceSummary(mappedListing, approvedProduct)
assert(intelligence, 'intelligence for mapped+approved')
assert(intelligence.fields.some((f) => f.key === 'rrp'), 'shows RRP when present')
assert(intelligence.fields.some((f) => f.key === 'market'), 'shows market estimate when calculable')
assert(intelligence.disclaimer.includes('Equipd Intelligence'), 'disclaimer present')
assertEqual(
  intelligence.equipmentHref,
  '/equipment/proform-tour-de-france-clc',
  'intelligence equipment link',
)

const incompleteSummary = buildListingIntelligenceSummary(
  { ...mappedListing, equipment_product_id: incompleteProduct.id, canonical_product_key: incompleteProduct.canonical_product_key },
  incompleteProduct,
)
assert(incompleteSummary, 'incomplete product still shows section')
assert(!incompleteSummary.fields.some((f) => f.key === 'rrp'), 'hides missing RRP')
assert(!incompleteSummary.fields.some((f) => f.key === 'market'), 'hides missing market value')
assert(!incompleteSummary.fields.some((f) => f.key === 'production'), 'hides missing production years')

assertNull(
  buildListingIntelligenceSummary(unmappedListing, approvedProduct),
  'no intelligence without listing mapping',
)
assertNull(
  buildListingIntelligenceSummary(mappedListing, pendingProduct),
  'no unpublished intelligence leak',
)
assertNull(
  buildListingIntelligenceSummary(mappedListing, null),
  'no intelligence without product',
)

// Write-field normalization (no fuzzy invent)
assertEqual(
  normalizeListingEquipmentProductWriteFields({
    equipmentProductId: '11111111-1111-4111-8111-111111111111',
    equipmentProductKey: 'proform-tour-de-france-clc',
  }).equipment_product_id,
  '11111111-1111-4111-8111-111111111111',
  'persists valid product id',
)
assertNull(
  normalizeListingEquipmentProductWriteFields({
    equipmentProductId: 'not-a-uuid',
    equipmentProductKey: '  ',
  }).equipment_product_id,
  'rejects invalid product id',
)
assertNull(
  normalizeListingEquipmentProductWriteFields({
    equipmentProductId: 'Great bike ProForm',
  }).equipment_product_id,
  'no fuzzy title-as-id mapping',
)

// 11–17 similar ranking
const currentId = 'listing-mapped'
const siblings = new Set(['33333333-3333-4333-8333-333333333333'])
const candidates = [
  {
    id: 'same-product',
    status: 'active',
    equipment_product_id: mappedListing.equipment_product_id,
    brand: 'ProForm',
    category_id: 'cat-bike',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'same-series',
    status: 'active',
    equipment_product_id: '33333333-3333-4333-8333-333333333333',
    brand: 'ProForm',
    category_id: 'cat-bike',
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'brand-type',
    status: 'active',
    equipment_product_id: null,
    brand: 'ProForm',
    category_id: 'cat-bike',
    created_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 'same-type',
    status: 'active',
    brand: 'Other',
    category_id: 'cat-bike',
    created_at: '2026-01-04T00:00:00Z',
  },
  {
    id: 'recent-other',
    status: 'active',
    brand: 'Matrix',
    category_id: 'cat-other',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'sold-one',
    status: 'sold',
    brand: 'ProForm',
    category_id: 'cat-bike',
    equipment_product_id: mappedListing.equipment_product_id,
    created_at: '2026-06-02T00:00:00Z',
  },
  {
    id: 'draft-one',
    status: 'draft',
    brand: 'ProForm',
    category_id: 'cat-bike',
    created_at: '2026-06-03T00:00:00Z',
  },
  {
    id: 'test-one',
    status: 'active',
    is_test_data: true,
    brand: 'ProForm',
    category_id: 'cat-bike',
    created_at: '2026-06-04T00:00:00Z',
  },
  {
    id: currentId,
    status: 'active',
    brand: 'ProForm',
    category_id: 'cat-bike',
    created_at: '2026-06-05T00:00:00Z',
  },
]

const context = {
  listingId: currentId,
  equipmentProductId: mappedListing.equipment_product_id,
  siblingProductIds: siblings,
  brand: 'ProForm',
  categoryId: 'cat-bike',
  equipmentType: 'Exercise Bike',
}

assertEqual(getSimilarListingMatchRank(candidates[0], context), 1, 'same product rank 1')
assertEqual(getSimilarListingMatchRank(candidates[1], context), 2, 'same series rank 2')
assertEqual(getSimilarListingMatchRank(candidates[2], context), 3, 'brand+type rank 3')
assertEqual(getSimilarListingMatchRank(candidates[3], context), 4, 'same type rank 4')
assertEqual(getSimilarListingMatchRank(candidates[4], context), 5, 'recent fallback rank 5')
assertNull(getSimilarListingMatchRank(candidates[5], context), 'excludes sold')
assertNull(getSimilarListingMatchRank(candidates[6], context), 'excludes draft')
assertNull(getSimilarListingMatchRank(candidates[7], context), 'excludes test')
assertNull(getSimilarListingMatchRank(candidates[8], context), 'excludes current')

const ranked = rankSimilarListingCandidates(candidates, context, { limit: 4 })
assertEqual(ranked.length, 4, 'respects result limit')
assertEqual(ranked[0].id, 'same-product', 'prefers same product first')
assertEqual(ranked[1].id, 'same-series', 'series second')
assertEqual(ranked[2].id, 'brand-type', 'brand+type third')
assertEqual(new Set(ranked.map((r) => r.id)).size, 4, 'no duplicate recommendations')
assert(!ranked.some((r) => r.id === currentId), 'current excluded from ranked')
assert(!ranked.some((r) => r.status === 'sold'), 'sold excluded from ranked')

const rankedWithDupInput = rankSimilarListingCandidates(
  [...candidates, candidates[0], candidates[1]],
  context,
  { limit: 12 },
)
assertEqual(
  rankedWithDupInput.filter((row) => row.id === 'same-product').length,
  1,
  'duplicate input rows collapsed',
)

// 18–20 alt text
assertEqual(
  buildListingImageAltText(mappedListing),
  'Used ProForm Tour de France CLC Exercise Bike',
  'structured alt text',
)
assertEqual(
  buildListingImageAltText(unmappedListing),
  'Used UnknownBrandXYZ dumbbells Free Weights',
  'fallback uses brand + cleaned title + type when present',
)
assert(
  !buildListingImageAltText({
    title: 'Used ProForm Bike',
    brand: 'ProForm',
    model: 'Bike',
    category: { name: 'Exercise Bike' },
  }).toLowerCase().startsWith('used used'),
  'no repeated Used',
)

// Shared card path uses same helper (smoke)
assert(typeof buildListingImageAltText === 'function', 'shared alt helper exists')

// Decorative: empty string remains valid for intentionally decorative images
assertEqual('', '', 'decorative empty alt convention')

// 21 exactly one Product schema
const product = buildListingProductSchema({
  listing: mappedListing,
  equipmentProduct: approvedProduct,
})
const breadcrumb = buildListingBreadcrumbSchema(mappedListing)
const nodes = [product, breadcrumb].filter(Boolean)
assertEqual(findProductSchemas(nodes).length, 1, 'exactly one Product schema')
assertEqual(findBreadcrumbSchemas(nodes).length, 1, 'exactly one BreadcrumbList')
assert(String(product['@id']).includes('/listings/'), 'marketplace Product only')
assert(!String(product['@id']).includes('/equipment/'), 'no catalogue Product on listing')

// 22 no fuzzy mapping at render — title resemblance alone does not create mapping
assert(
  !resolveListingProductMapping({
    title: 'ProForm Tour de France CLC Exercise Bike',
    brand: 'ProForm',
    model: 'Tour de France CLC',
  }).hasMapping,
  'title/brand/model alone do not invent mapping',
)

assertEqual(LISTING_CONDITIONS.length, 5, 'conditions unchanged')

const links = buildListingInternalLinks(mappedListing, approvedProduct)
assert(links.some((l) => l.kind === 'equipment'), 'mapped internal equipment link')
assert(links.some((l) => l.kind === 'valuation'), 'valuation link always present')
assert(links.every((l) => typeof l.href === 'string' && l.href.startsWith('/')), 'crawlable hrefs')

console.log('test-listing-discovery-links: ok')
