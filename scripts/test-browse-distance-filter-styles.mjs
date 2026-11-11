#!/usr/bin/env node
/**
 * Distance filter styling should reuse Browse filter tokens.
 *
 *   node scripts/test-browse-distance-filter-styles.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const root = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(root, '../src/components/browse/BrowseDistanceFilter.css'), 'utf8')
const jsx = readFileSync(join(root, '../src/components/browse/BrowseDistanceFilter.jsx'), 'utf8')

assert(css.includes('var(--color-navy)'), 'uses navy token')
assert(css.includes('var(--color-border)'), 'uses border token')
assert(css.includes('var(--radius-lg)'), 'uses shared large radius')
assert(css.includes('font-size: 0.6875rem'), 'desktop headings match filter field labels')
assert(css.includes('text-transform: uppercase'), 'section labels match other filter labels')
assert(css.includes('min-height: 2.25rem'), 'desktop controls match other filter control height')
assert(css.includes('font-size: 0.8125rem'), 'desktop type matches option/input size')
assert(
  /@media \(max-width: 767px\)[\s\S]*font-size:\s*16px/.test(css),
  'mobile town field uses 16px to avoid iOS input zoom',
)
assert(!css.includes('font-weight: 800'), 'does not use heavier headings than other filter menus')
assert(jsx.includes('listing-browse__button--primary'), 'current-location uses shared primary button')
assert(jsx.includes('listing-browse__button--secondary'), 'town search uses shared secondary button')
assert(jsx.includes('Use my current location'), 'keeps current-location action')
assert(jsx.includes('browse-distance-filter__slider'), 'keeps compact radius slider')

console.log('PASS: Distance filter styling reuses Browse filter tokens')
