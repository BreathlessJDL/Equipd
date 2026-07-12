/**
 * Equipment catalogue admin helper tests.
 */

import {
  CATALOGUE_ATTENTION,
  buildCatalogueSummary,
  findLikelyDuplicateProducts,
  getCatalogueStatusLabel,
  matchesCatalogueAttentionFilter,
  productNeedsPrice,
  productNeedsYear,
} from '../src/lib/equipmentCatalogueAdmin.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const readyProduct = {
  id: '1',
  status: 'approved',
  original_base_price: 10000,
  baseline_manufacture_year: 2018,
  image_status: 'approved',
  image_url: 'https://example.com/a.jpg',
}

const incompleteProduct = {
  id: '2',
  status: 'approved',
  original_base_price: null,
  baseline_manufacture_year: null,
  image_status: null,
}

assert(productNeedsPrice(incompleteProduct), 'missing RRP detected')
assert(productNeedsYear(incompleteProduct), 'missing year detected')
assert(
  matchesCatalogueAttentionFilter(incompleteProduct, CATALOGUE_ATTENTION.NEEDS_PRICE),
  'needs price filter matches',
)
assert(
  getCatalogueStatusLabel(incompleteProduct) === 'Needs price',
  'status label prioritises missing price',
)

const summary = buildCatalogueSummary([readyProduct, incompleteProduct], {
  1: { generation_status: 'approved' },
})
assert(summary.total === 2, 'summary total')
assert(summary.missingRrp === 1, 'summary missing rrp')
assert(summary.ready === 1, 'ready product counted when content approved')

const duplicates = findLikelyDuplicateProducts([
  { id: 'a', brand: 'Life Fitness', model: '95T', canonical_product_name: 'Life Fitness 95T', canonical_product_key: 'lf-95t' },
], {
  brand: 'Life Fitness',
  model: '95T',
  canonicalProductName: 'Life Fitness 95T Treadmill',
  canonicalProductKey: 'other',
})
assert(duplicates.length === 1, 'duplicate by brand+model detected')

console.log('equipment catalogue admin tests passed')
