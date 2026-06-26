#!/usr/bin/env node
/**
 * Phase 5C — browse filter URL and chip tests.
 *
 * Usage:
 *   node scripts/test-browse-filters-url.mjs
 */

import {
  applyBrowseFiltersToSearchParams,
  buildBrowseActiveFilterChips,
  buildBrowseQueryOptions,
  hasActiveBrowseFilters,
  parseBrowseFiltersFromSearchParams,
  removeBrowseFilterKey,
} from '../src/lib/browseFilters.js'
import { filterListingsByRadius } from '../src/lib/listingDistance.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const categories = [
  { id: 'cat-1', name: 'Treadmills', slug: 'treadmill' },
  { id: 'cat-2', name: 'Benches', slug: 'bench' },
]

const baseParams = new URLSearchParams(
  'search=treadmill&category=treadmill&brand=Life+Fitness&condition=good&rating=home_use&minPrice=100&maxPrice=500&sort=price_asc&location=Wakefield&lat=53.6833&lng=-1.4977&radius=25',
)

const parsed = parseBrowseFiltersFromSearchParams(baseParams, categories)
assert(parsed.search === 'treadmill', 'Search keyword parsed')
assert(parsed.categoryId === 'cat-1', 'Category slug resolved to id')
assert(parsed.brand === 'Life Fitness', 'Brand parsed')
assert(parsed.condition === 'good', 'Condition parsed')
assert(parsed.rating === 'home_use', 'Usage rating parsed')
assert(parsed.minPrice === '100', 'Min price parsed')
assert(parsed.maxPrice === '500', 'Max price parsed')
assert(parsed.sort === 'price_asc', 'Sort parsed')
assert(parsed.buyerLatitude === 53.6833, 'Latitude parsed')
assert(parsed.radiusMiles === '25', 'Radius parsed')

logPass('All URL params round-trip on parse')

const reapplied = new URLSearchParams()
applyBrowseFiltersToSearchParams(reapplied, parsed, categories)
assert(reapplied.get('search') === 'treadmill', 'Search written back to URL')
assert(reapplied.get('category') === 'treadmill', 'Category slug written back')
assert(reapplied.get('brand') === 'Life Fitness', 'Brand written back')
assert(reapplied.get('condition') === 'good', 'Condition written back')
assert(reapplied.get('rating') === 'home_use', 'Rating written back')
assert(reapplied.get('minPrice') === '100', 'Min price written back')
assert(reapplied.get('maxPrice') === '500', 'Max price written back')
assert(reapplied.get('sort') === 'price_asc', 'Sort written back')
assert(reapplied.get('location') === 'Wakefield', 'Location written back')
assert(reapplied.get('radius') === '25', 'Radius written back')

logPass('All filters written back to URL')

const query = buildBrowseQueryOptions(parsed)
assert(query.search === 'treadmill', 'Query search built')
assert(query.categoryId === 'cat-1', 'Query category built')
assert(query.brand === 'Life Fitness', 'Query brand built')
assert(query.radiusMiles === 25, 'Query radius built')

logPass('Query options built from parsed filters')

const chips = buildBrowseActiveFilterChips(parsed, categories)
assert(chips.length >= 8, 'Active chips generated for combined filters')

const cleared = removeBrowseFilterKey(parsed, 'location')
assert(cleared.buyerLatitude == null, 'Removing location clears coordinates')

logPass('Active chips and chip removal behave as expected')

assert(hasActiveBrowseFilters(parsed), 'Combined filters count as active')
assert(!hasActiveBrowseFilters(parseBrowseFiltersFromSearchParams(new URLSearchParams(), categories)), 'Empty filters inactive')

const withCoords = { id: 'a', latitude: 53.68, longitude: -1.5 }
const withoutCoords = { id: 'b', location: 'Leeds' }
const ukWide = filterListingsByRadius([withCoords, withoutCoords], 53.8, -1.55, null)
const radiusOnly = filterListingsByRadius([withCoords, withoutCoords], 53.8, -1.55, 25)
assert(ukWide.length === 2, 'UK wide keeps listings without coordinates')
assert(radiusOnly.length === 1, 'Radius search excludes listings without coordinates')

logPass('Coordinate fallback rules preserved')

const multiParams = new URLSearchParams()
multiParams.append('category', 'treadmill')
multiParams.append('category', 'bench')
multiParams.append('brand', 'Life Fitness')
multiParams.append('brand', 'Technogym')
multiParams.append('condition', 'good')
multiParams.append('condition', 'like_new')

const multiParsed = parseBrowseFiltersFromSearchParams(multiParams, categories)
assert(multiParsed.categoryIds.length === 2, 'Multiple categories parsed')
assert(multiParsed.brands.length === 2, 'Multiple brands parsed')
assert(multiParsed.conditions.length === 2, 'Multiple conditions parsed')

const multiReapplied = new URLSearchParams()
applyBrowseFiltersToSearchParams(multiReapplied, multiParsed, categories)
assert(multiReapplied.getAll('category').length === 2, 'Multiple categories written to URL')
assert(multiReapplied.getAll('brand').length === 2, 'Multiple brands written to URL')
assert(multiReapplied.getAll('condition').length === 2, 'Multiple conditions written to URL')

const multiChips = buildBrowseActiveFilterChips(multiParsed, categories)
assert(multiChips.filter((chip) => chip.removeKey === 'categoryIds').length === 2, 'One chip per category')
assert(multiChips.filter((chip) => chip.removeKey === 'brands').length === 2, 'One chip per brand')
assert(multiChips.filter((chip) => chip.removeKey === 'conditions').length === 2, 'One chip per condition')

const afterCategoryRemoval = removeBrowseFilterKey(multiParsed, 'categoryIds', 'cat-1')
assert(afterCategoryRemoval.categoryIds.length === 1, 'Single category removed from multi-select')
assert(afterCategoryRemoval.categoryIds[0] === 'cat-2', 'Correct category remains after removal')

const afterBrandRemoval = removeBrowseFilterKey(multiParsed, 'brands', 'Technogym')
assert(afterBrandRemoval.brands.length === 1, 'Single brand removed from multi-select')
assert(afterBrandRemoval.brands[0] === 'Life Fitness', 'Correct brand remains after removal')

logPass('Multi-select filters round-trip and per-chip removal')

console.log('\nAll browse filter URL checks passed.')
