#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CATEGORY_LISTINGS_FETCH_LIMIT,
  getListingCardWidthRem,
  getOneRowListingCapacity,
} from '../src/lib/oneRowListingCapacity.js'

const root = process.cwd()

assert.equal(getListingCardWidthRem(390), 11.5)
assert.equal(getListingCardWidthRem(768), 12.25)
assert.equal(getListingCardWidthRem(1024), 13)
assert.equal(getOneRowListingCapacity(300, 390), 2)
assert.equal(CATEGORY_LISTINGS_FETCH_LIMIT, 12)

// Desktop rail examples (approx): cards must not wrap a second row via capacity math
assert.equal(getOneRowListingCapacity(704, 768), 3) // ~3 × 12.25rem + gaps
assert.equal(getOneRowListingCapacity(954, 1024), 4)
assert.equal(getOneRowListingCapacity(1280, 1440), 5)
assert.equal(getOneRowListingCapacity(1664, 1920), 7)

const css = readFileSync(join(root, 'src/pages/CommercialGymEquipmentPage.css'), 'utf8')
assert.match(css, /listing-grid--one-row/)
assert.match(css, /margin-bottom: 2rem/)
assert.match(css, /\.commercial-page__listings-footer[\s\S]*margin-top: 2rem/)

const shared = readFileSync(
  join(root, 'src/components/marketing/CategoryListingsSection.jsx'),
  'utf8',
)
assert.match(shared, /listings-footer/)
assert.match(shared, /slice\(0, capacity\)/)
assert.doesNotMatch(shared, /btn--secondary/)

for (const file of [
  'src/components/marketing/CategoryLandingPage.jsx',
  'src/pages/HomeGymEquipmentPage.jsx',
  'src/pages/CommercialGymEquipmentPage.jsx',
  'src/pages/CommercialCardioEquipmentPage.jsx',
]) {
  const source = readFileSync(join(root, file), 'utf8')
  assert.match(source, /CategoryListingsSection/)
  assert.doesNotMatch(source, /listings-header[\s\S]*btn--secondary/)
}

console.log('test-category-listings-one-row: ok')
