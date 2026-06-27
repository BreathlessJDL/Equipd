#!/usr/bin/env node
/**
 * Desktop browse filter multi-select behaviour tests.
 * Usage: node scripts/test-browse-filter-multi-select.mjs
 */

import {
  applyBrowseFiltersToSearchParams,
  buildBrowseQueryOptions,
  parseBrowseFiltersFromSearchParams,
} from '../src/lib/browseFilters.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const categories = [
  { id: 'cat-treadmill', name: 'Treadmill', slug: 'treadmill' },
  { id: 'cat-cross', name: 'Crosstrainers', slug: 'crosstrainers' },
]

function toggleInList(list, value) {
  if (!value) return []
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
}

console.log('=== Toggle simulation (OR within group) ===')
let categoryIds = toggleInList([], 'cat-treadmill')
assert(categoryIds.length === 1, 'First category selected')
categoryIds = toggleInList(categoryIds, 'cat-cross')
assert(categoryIds.length === 2, 'Second category added without removing first')
categoryIds = toggleInList(categoryIds, 'cat-treadmill')
assert(categoryIds.length === 1 && categoryIds[0] === 'cat-cross', 'First category toggled off')
console.log('PASS: category toggle keeps other selections')

let brands = toggleInList([], 'Life Fitness')
brands = toggleInList(brands, 'Technogym')
assert(brands.length === 2, 'Multiple brands')
console.log('PASS: brand toggle multi-select')

let conditions = toggleInList([], 'good')
conditions = toggleInList(conditions, 'like_new')
assert(conditions.length === 2, 'Multiple conditions')
console.log('PASS: condition toggle multi-select')

console.log('\n=== URL round-trip for combined multi-select ===')
const filters = {
  search: '',
  categoryIds: ['cat-treadmill', 'cat-cross'],
  categoryId: 'cat-treadmill',
  categorySlug: 'treadmill',
  categorySlugs: ['treadmill', 'crosstrainers'],
  brands: ['Life Fitness', 'Technogym'],
  brand: 'Life Fitness',
  conditions: ['good'],
  condition: 'good',
  rating: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
  locationSearch: '',
  locationPlace: null,
  buyerLatitude: null,
  buyerLongitude: null,
  radiusMiles: 'UK wide',
  radiusMilesValue: null,
}

const params = new URLSearchParams()
applyBrowseFiltersToSearchParams(params, filters, categories)
assert(params.getAll('category').length === 2, 'Two category params in URL')
assert(params.getAll('brand').length === 2, 'Two brand params in URL')

const reparsed = parseBrowseFiltersFromSearchParams(params, categories)
assert(reparsed.categoryIds.length === 2, 'Reparsed two categories')
assert(reparsed.brands.length === 2, 'Reparsed two brands')

const query = buildBrowseQueryOptions(reparsed)
assert(query.categoryIds.length === 2, 'Query has two category ids')
assert(query.brands.length === 2, 'Query has two brands')
console.log('PASS: URL + query options for multi-select filters')

console.log('\nAll browse filter multi-select checks passed.')
