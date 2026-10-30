#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BRAND_LISTINGS_FETCH_LIMIT,
  getOneRowListingCapacity,
} from '../src/lib/oneRowListingCapacity.js'

const root = process.cwd()

assert.equal(BRAND_LISTINGS_FETCH_LIMIT, 12)
assert.equal(getOneRowListingCapacity(300, 390), 2)
assert.equal(getOneRowListingCapacity(300, 390, { mobileCapacity: 4 }), 4)
assert.equal(getOneRowListingCapacity(704, 768), 3)
assert.equal(getOneRowListingCapacity(954, 1024), 4)

const page = readFileSync(join(root, 'src/pages/BrandPage.jsx'), 'utf8')
assert.match(page, /mobileCapacity:\s*4/)
assert.match(page, /BRAND_LISTINGS_FETCH_LIMIT/)
assert.match(page, /brand-page__listings-cta/)
assert.match(page, /listings--one-row/)
assert.doesNotMatch(page, /View all listings →/)
assert.doesNotMatch(page, /slice\(0,\s*6\)/)
assert.match(page, /Used \$\{brand\.displayName\} equipment for sale/)
assert.match(
  page,
  /<BrandPageHero[\s\S]*\{marketplaceSection\}[\s\S]*\{wantedSection\}/,
  'listings render immediately after the shared hero, before wanted and discovery',
)
assert.doesNotMatch(
  page,
  /buyerIntent \? \(\s*<>\s*\{marketplaceSection\}/,
  'marketplace is not gated behind buyer-intent so every brand shows listings first',
)

const css = readFileSync(join(root, 'src/pages/BrandPage.css'), 'utf8')
assert.match(css, /listings--one-row/)
assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/)
assert.match(css, /brand-page__listings-footer/)
assert.match(css, /section-head--marketplace/)

console.log('test-brand-page-listings-responsive: ok')
