/**
 * Guards shared HomeEquipmentValuator usage on Equipment Values.
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

assert.doesNotMatch(homePage, /HomeEquipmentValuator/, 'homepage no longer mounts the standalone valuator section')
assert.doesNotMatch(
  homePage,
  /idPrefix=["']brands-valuator["']/,
  'homepage does not use brands id prefix',
)

assert.match(brandsPage, /import EquipmentValuesHero from/, 'brands page mounts the Equipment Values hero')
assert.match(brandsPage, /<EquipmentValuesHero/, 'brands page renders the artwork hero')
assert.doesNotMatch(
  brandsPage,
  /Instant Gym Equipment Valuation/,
  'old dynamically rendered Instant Valuation hero heading is gone',
)

const hero = read('src/components/brands/EquipmentValuesHero.jsx')
const heroLib = read('src/lib/equipmentValuesHero.js')
assert.match(hero, /import HomeEquipmentValuator from/, 'hero reuses the shared valuator search')
assert.match(hero, /idPrefix=["']brands-valuator["']/, 'brands uses distinct idPrefix')
assert.match(hero, /searchOnly/, 'hero does not duplicate baked-in heading or chart as HTML')
assert.match(hero, /showShowcase=\{false\}/, 'hero does not render the old graph/card showcase')
assert.match(hero, /<picture>/, 'hero uses responsive picture')
assert.match(heroLib, /Equipment Valuations Hero Banner Desktop\.png/, 'desktop artwork is wired')
assert.match(heroLib, /Equipment Valuations Hero Banner Mobile\.png/, 'mobile artwork is wired')
assert.match(hero, /submitLabel=["']Find value["']/, 'hero uses a Find value submit button')
assert.match(
  hero,
  /popularSearches=\{EQUIPMENT_VALUES_POPULAR_SEARCHES\}/,
  'hero uses catalogue-backed popular searches',
)
assert.match(heroLib, /concept2-rowers-rowerg-model-d/, 'Concept2 RowErg popular search is a catalogue model')
assert.match(heroLib, /technogym-non-motorised-treadmill-skill-line-skillmill/, 'Skillmill popular search is a catalogue model')
assert.match(heroLib, /wattbike-exercise-bike-atom-atom/, 'Wattbike Atom popular search is a catalogue model')
assert.match(valuator, /searchOnly = false/, 'shared valuator supports search-only mode')
assert.match(valuator, /submitLabel = null/, 'shared valuator accepts a custom submit label')
assert.match(
  brandsPage,
  /Used Gym Equipment Values by Brand/,
  'page title remains for SEO metadata / accessible heading',
)
assert.doesNotMatch(
  brandsPage,
  /Search equipment brands/,
  'directory brand-search panel is removed',
)
assert.doesNotMatch(
  brandsPage,
  /className="brands-page__hero"/,
  'beige directory intro panel is removed',
)
assert.match(brandsPage, /Featured brands/, 'featured brands section remains')

// Placement: breadcrumb → artwork hero → featured brands
const breadcrumbIdx = brandsPage.indexOf('<PageBreadcrumbs')
const valuatorIdx = brandsPage.indexOf('<EquipmentValuesHero')
const featuredIdx = brandsPage.indexOf('featured-brands-title')
assert.ok(breadcrumbIdx > -1 && valuatorIdx > breadcrumbIdx, 'artwork hero after breadcrumb')
assert.ok(featuredIdx > valuatorIdx, 'featured brands follow the artwork hero')

assert.match(valuator, /idPrefix = 'home-valuator'/, 'default idPrefix stays unique per mount')
assert.match(valuator, /const inputId = `\$\{idPrefix\}-search`/, 'input ids derive from idPrefix')
assert.match(valuator, /const titleId = `\$\{idPrefix\}-title`/, 'title ids derive from idPrefix')
assert.match(valuator, /buildValuationHref/, 'shared routing helper')
assert.match(valuator, /DeferredEquipmentAutocomplete/, 'shared autocomplete (deferred wrapper)')
assert.match(
  read('src/components/DeferredEquipmentAutocomplete.jsx'),
  /import\('\.\/CanonicalEquipmentAutocomplete'\)/,
  'deferred wrapper loads the shared canonical autocomplete',
)
assert.match(valuator, /useState\(''\)/, 'instance-local query state')
assert.match(valuator, /useState\(null\)/, 'instance-local selection state')
assert.doesNotMatch(valuator, /module-level selectedProduct|let selectedProduct/, 'no module shared selection')

assert.match(valuatorCss, /\.home-valuator--contained/, 'contained layout CSS present')
assert.match(valuator, /home-valuator__title-text--mobile/, 'responsive title spans present')
assert.match(valuator, /Value your equipment/, 'mobile title present')
assert.match(valuator, /home-valuator__submit-label--mobile/, 'mobile CTA label present')
assert.doesNotMatch(valuatorCss, /brand-logo--bg-dark/, 'valuator CSS unrelated to logo plates')

assert.equal(
  (hero.match(/HomeEquipmentValuator/g) || []).filter((token) => token === 'HomeEquipmentValuator').length >= 2,
  true,
  'Equipment Values hero references the shared valuator',
)
assert.doesNotMatch(
  brandsPage,
  /function BrandsEquipmentValuator|CanonicalEquipmentAutocomplete/,
  'brands page does not reimplement autocomplete',
)

console.log('equipment-values-valuator-placement: ok')
