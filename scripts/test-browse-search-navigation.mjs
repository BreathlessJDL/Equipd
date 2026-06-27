#!/usr/bin/env node
/**
 * Browse category/search navigation helper tests.
 *
 * Usage: node scripts/test-browse-search-navigation.mjs
 */

import {
  buildBrowseNavPath,
  buildBrowseSearchPath,
  isBrowseRoute,
} from '../src/lib/browseSearchNavigation.js'
import { resolvePopularNavTarget, POPULAR_CATEGORY_NAV_ITEMS } from '../src/lib/popularCategoryNav.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(isBrowseRoute('/browse'), 'Browse route detected')
assert(!isBrowseRoute('/'), 'Home is not browse route')
assert(!isBrowseRoute('/hub'), 'Hub is not browse route')

assert(
  buildBrowseSearchPath('Technogym') === '/browse?search=Technogym',
  'Search path built',
)
assert(buildBrowseSearchPath('  ') === '/browse', 'Empty search goes to browse')

assert(
  buildBrowseNavPath({ categorySlug: 'treadmill' }) === '/browse?category=treadmill',
  'Category path built',
)
assert(
  buildBrowseNavPath({ categorySlug: 'treadmill', search: 'Technogym' }) ===
    '/browse?search=Technogym&category=treadmill',
  'Combined search and category path built',
)
assert(
  buildBrowseNavPath({ rating: 'full_commercial' }) === '/browse?rating=full_commercial',
  'Rating path built',
)

const categories = [{ id: 'cat-1', slug: 'treadmill', name: 'Treadmills' }]
const treadmillNav = POPULAR_CATEGORY_NAV_ITEMS.find((item) => item.id === 'treadmills')
const target = resolvePopularNavTarget(treadmillNav, categories)

assert(target.href === '/browse?category=treadmill', 'Popular nav treadmill href')
assert(target.categoryId === 'cat-1', 'Popular nav resolves category id')

console.log('PASS: browse route detection')
console.log('PASS: search navigation paths')
console.log('PASS: category navigation paths')
console.log('PASS: popular category nav targets')

console.log('\nAll browse search navigation checks passed.')
