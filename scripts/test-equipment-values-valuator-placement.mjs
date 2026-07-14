/**
 * Guards shared HomeEquipmentValuator usage on Homepage + Equipment Values.
 * Run: node scripts/test-equipment-values-valuator-placement.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const homePage = read('src/pages/HomePage.jsx')
const brandsPage = read('src/pages/BrandsPage.jsx')
const valuator = read('src/components/home/HomeEquipmentValuator.jsx')
const valuatorCss = read('src/components/home/HomeEquipmentValuator.css')

assert.match(homePage, /import HomeEquipmentValuator from/, 'homepage imports shared valuator')
assert.match(homePage, /<HomeEquipmentValuator\s*\/>/, 'homepage renders shared valuator with defaults')
assert.doesNotMatch(
  homePage,
  /idPrefix=["']brands-valuator["']/,
  'homepage does not use brands id prefix',
)

assert.match(brandsPage, /import HomeEquipmentValuator from/, 'brands page imports same shared valuator')
assert.match(brandsPage, /<HomeEquipmentValuator[\s\S]*idPrefix=["']brands-valuator["']/, 'brands uses distinct idPrefix')
assert.match(brandsPage, /contained/, 'brands uses contained layout inside page shell')
assert.match(
  brandsPage,
  /Find the value of your gym equipment/,
  'brands uses Equipment Values copy for heading',
)
assert.match(
  brandsPage,
  /Explore gym equipment by brand/,
  'brand directory heading remains',
)
assert.match(
  brandsPage,
  /Search equipment brands/,
  'brand directory search input remains',
)

// Placement: breadcrumb → valuator → explore-by-brand hero
const breadcrumbIdx = brandsPage.indexOf('<PageBreadcrumbs')
const valuatorIdx = brandsPage.indexOf('<HomeEquipmentValuator')
const heroTitleIdx = brandsPage.indexOf('Explore gym equipment by brand')
assert.ok(breadcrumbIdx > -1 && valuatorIdx > breadcrumbIdx, 'valuator after breadcrumb')
assert.ok(heroTitleIdx > valuatorIdx, 'brand explore section after valuator')

assert.match(valuator, /idPrefix = 'home-valuator'/, 'default idPrefix preserves homepage ids')
assert.match(valuator, /const inputId = `\$\{idPrefix\}-search`/, 'input ids derive from idPrefix')
assert.match(valuator, /const titleId = `\$\{idPrefix\}-title`/, 'title ids derive from idPrefix')
assert.match(valuator, /buildValuationHref/, 'shared routing helper')
assert.match(valuator, /CanonicalEquipmentAutocomplete/, 'shared autocomplete')
assert.match(valuator, /useState\(''\)/, 'instance-local query state')
assert.match(valuator, /useState\(null\)/, 'instance-local selection state')
assert.doesNotMatch(valuator, /module-level selectedProduct|let selectedProduct/, 'no module shared selection')

assert.match(valuatorCss, /\.home-valuator--contained/, 'contained layout CSS present')
assert.match(
  valuatorCss,
  /@media \(max-width:\s*767px\)[\s\S]*\.home-valuator__form[\s\S]*minmax\(0,\s*1fr\)\s+auto/,
  'mobile valuator keeps input + CTA on one row',
)
assert.match(
  valuatorCss,
  /@media \(max-width:\s*767px\)[\s\S]*\.home-valuator__submit-label--mobile[\s\S]*display:\s*inline/,
  'mobile valuator uses compact CTA label',
)
assert.match(valuator, /home-valuator__title-text--mobile/, 'responsive title spans present')
assert.match(valuator, /Value it/, 'mobile CTA label present')
assert.doesNotMatch(valuatorCss, /brand-logo--bg-dark/, 'valuator CSS unrelated to logo plates')

// Ensure there is only one valuator implementation module referenced.
assert.equal(
  (homePage.match(/HomeEquipmentValuator/g) || []).filter((token) => token === 'HomeEquipmentValuator').length >= 2,
  true,
  'homepage references shared component',
)
assert.doesNotMatch(
  brandsPage,
  /function BrandsEquipmentValuator|CanonicalEquipmentAutocomplete/,
  'brands page does not reimplement autocomplete',
)

console.log('equipment-values-valuator-placement: ok')
