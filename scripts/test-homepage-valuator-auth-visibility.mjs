/**
 * Guards that the homepage no longer mounts the standalone Equipment Valuator
 * section for logged-out or logged-in users.
 * Run: node scripts/test-homepage-valuator-auth-visibility.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const homePage = read('src/pages/HomePage.jsx')
const app = read('src/App.jsx')
const valuator = read('src/components/home/HomeEquipmentValuator.jsx')

assert.doesNotMatch(homePage, /HomeEquipmentValuator/, 'homepage does not import or render the standalone valuator')
assert.doesNotMatch(homePage, /home-valuator--compact-mobile/, 'homepage does not apply the compact valuator class')
assert.doesNotMatch(homePage, /home-valuator--signed-in/, 'logged-in homepage does not mount a valuator')
assert.doesNotMatch(
  read('src/components/home/HomePage.css'),
  /\.home-page[^{]*\.home-valuator/,
  'homepage layout CSS no longer positions a valuator section',
)

assert.match(homePage, /<HomeHeroCarousel/, 'homepage uses the rotating hero carousel')
assert.match(
  homePage,
  /<HomeHeroCarousel isLoggedIn=\{isLoggedIn\} \/>/,
  'carousel receives logged-in state so signed-in users get the cardio-first slides',
)
assert.match(homePage, /HomeDiscoverySection/, 'signed-in homepage keeps marketplace discovery')
assert.match(homePage, /ListingBrowseResults/, 'signed-in homepage keeps marketplace listings')
assert.match(homePage, /home-page--feed/, 'signed-in compact feed class retained')

assert.doesNotMatch(
  homePage,
  /navigate\(['"`]\/browse|Navigate[^\n]*to=['"`]\/browse/,
  'homepage does not redirect signed-in users to /browse',
)
assert.match(app, /<Route index element=\{<HomePage \/>\} \/>/, 'index route remains HomePage')
assert.match(app, /path=["']browse["'][\s\S]*BrowsePage/, '/browse route remains available')
assert.doesNotMatch(
  app,
  /<Route index element=\{<Navigate[\s\S]*browse/,
  'index route is not a Navigate to browse',
)
assert.doesNotMatch(
  app,
  /<Route path=["']browse["'][^>]*element=\{<Navigate/,
  'browse route is not a Navigate away from listings',
)

assert.match(valuator, /DeferredEquipmentAutocomplete/, 'shared autocomplete remains for Equipment Values')
assert.match(valuator, /buildValuationHref/, 'shared valuation routing remains')
assert.match(
  valuator,
  /Instant market valuations based on thousands of listings/,
  'shared default lede is not commercial-only',
)
assert.doesNotMatch(valuator, /commercial fitness products/, 'no commercial-only valuator lede')

const hero = read('src/components/home/HomeHero.jsx')
assert.doesNotMatch(hero, /home-hero__copy/, 'homepage does not render duplicate marketplace intro block')
assert.doesNotMatch(hero, /EQUIPD MARKETPLACE|Equipd Marketplace/, 'no marketplace eyebrow under hero')
assert.match(homePage, /<HomeHeroCarousel/, 'homepage still uses the hero carousel')

const brandsHero = read('src/components/brands/EquipmentValuesHero.jsx')
assert.match(brandsHero, /HomeEquipmentValuator/, 'Equipment Values still uses the shared valuator search')

console.log('homepage-valuator-auth-visibility: ok')
