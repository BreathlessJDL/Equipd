#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  buildValuationHref,
  buildCanonicalSuggestionMeta,
  formatCanonicalSuggestionYears,
} from '../src/lib/valuationNavigation.js'
import { resolveValuationSearchMatches } from '../src/lib/equipmentValuation.js'

assert.equal(buildValuationHref({}), '/valuation')
assert.equal(
  buildValuationHref({ productKey: 'life-fitness-95t-treadmill' }),
  '/valuation?product=life-fitness-95t-treadmill&step=details',
)
assert.equal(
  buildValuationHref({ query: 'Life Fitness 95T' }),
  '/valuation?q=Life%20Fitness%2095T',
)
assert.equal(
  buildValuationHref({ productKey: 'abc', query: 'ignored' }),
  '/valuation?product=abc&step=details',
)

assert.equal(
  formatCanonicalSuggestionYears({
    production_start_year: 2012,
    production_end_year: 2020,
  }),
  '2012–2020',
)
assert.equal(
  formatCanonicalSuggestionYears({ baseline_manufacture_year: 2015 }),
  '2015+',
)

assert.equal(
  buildCanonicalSuggestionMeta({
    brand: 'Life Fitness',
    equipment_type: 'Treadmill',
    production_start_year: 2012,
    production_end_year: 2020,
  }),
  'Life Fitness · Treadmill · 2012–2020',
)

const catalog = [
  {
    id: '1',
    brand: 'Life Fitness',
    model: '95T',
    series: 'Integrity',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Series 95T Treadmill',
    canonical_product_key: 'lf-95t',
    status: 'approved',
  },
  {
    id: '2',
    brand: 'Life Fitness',
    model: '95Te',
    series: 'Integrity',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Series 95Te Treadmill',
    canonical_product_key: 'lf-95te',
    status: 'approved',
  },
  {
    id: '3',
    brand: 'Life Fitness',
    model: 'T3',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness T3 Treadmill',
    canonical_product_key: 'lf-t3',
    status: 'approved',
  },
]

const search95t = resolveValuationSearchMatches(catalog, 'Life Fitness 95T')
assert.ok(search95t.matches.length >= 1, '95T should return matches')
assert.equal(
  search95t.matches[0].canonical_product_key,
  'lf-95t',
  'exact 95T should rank first',
)

const limited = search95t.matches.slice(0, 6)
assert.ok(limited.length <= 6, 'homepage limit is 6')

console.log('home valuator autocomplete helpers passed')
