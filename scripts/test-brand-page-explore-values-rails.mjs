#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BRAND_VALUATION_SHORTCUT_LIMIT,
  BRAND_VALUATIONS_ANCHOR_ID,
  filterCatalogByBrandSlug,
  selectPopularBrandProducts,
} from '../src/lib/brandPageCurated.js'

const root = process.cwd()
const page = readFileSync(join(root, 'src/pages/BrandPage.jsx'), 'utf8')
const search = readFileSync(join(root, 'src/components/brands/BrandPageValuationSearch.jsx'), 'utf8')
const css = readFileSync(join(root, 'src/components/brands/BrandPageValuationSearch.css'), 'utf8')
const autocomplete = readFileSync(join(root, 'src/components/CanonicalEquipmentAutocomplete.jsx'), 'utf8')

assert.equal(BRAND_VALUATIONS_ANCHOR_ID, 'brand-equipment-valuations')
assert.equal(BRAND_VALUATION_SHORTCUT_LIMIT, 4)
assert.match(page, /BrandPageValuationSearch/)
assert.match(page, /id=\{BRAND_VALUATIONS_ANCHOR_ID\}|scrollToBrandValuations/)
assert.match(search, /How much is your \$\{displayName\} worth\?/)
assert.match(search, /Search \$\{displayName\} models\.\.\./)
assert.match(search, /Find valuation/)
assert.match(search, /CanonicalEquipmentAutocomplete/)
assert.match(search, /brandSlug=\{brand\.slug\}/)
assert.match(search, /resolveValuationSearchMatches/)
assert.match(css, /background:\s*var\(--brand-hero-cream\)/)
assert.match(css, /text-align:\s*center/)
assert.match(autocomplete, /brandSlug/)
assert.match(autocomplete, /filterCatalogByBrandSlug/)
assert.doesNotMatch(page, /brand-page__rail--models/)
assert.doesNotMatch(page, /filteredValueResearchProducts/)
assert.doesNotMatch(page, /Browse by series/)

const lifeFitness = filterCatalogByBrandSlug([
  { brand: 'Life Fitness', canonical_product_key: 'lf-1' },
  { brand: 'Technogym', canonical_product_key: 'tg-1' },
  { brand: 'Matrix', canonical_product_key: 'mx-1' },
], 'life-fitness')
assert.equal(lifeFitness.length, 1, 'brand filter keeps only Life Fitness')

const popular = selectPopularBrandProducts([
  {
    href: '/equipment/a',
    displayName: 'Life Fitness 95T',
    estimatedValueLabel: '£2,000',
    imageUrl: '/a.jpg',
    originalRrp: 8000,
  },
  {
    href: '/equipment/b',
    displayName: 'Life Fitness 95K',
    estimatedValueLabel: '£1,500',
    imageUrl: '/b.jpg',
    originalRrp: 5000,
  },
], { limit: BRAND_VALUATION_SHORTCUT_LIMIT })
assert.ok(popular.length <= 4, 'shortcuts stay within the cap')

console.log('test-brand-page-explore-values-rails: ok')
