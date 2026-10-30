/**
 * Guards homepage valuator visibility for logged-out and logged-in users.
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
const valuatorCss = read('src/components/home/HomeEquipmentValuator.css')

assert.match(homePage, /import HomeEquipmentValuator from/, 'homepage imports shared valuator')
assert.match(homePage, /<HomeEquipmentValuator/, 'logged-out homepage still renders the search valuator')
assert.match(
  homePage,
  /\{!\s*isLoggedIn\s*\?\s*\(\s*<HomeEquipmentValuator/,
  'standalone valuator is gated to logged-out homepage only',
)
assert.doesNotMatch(
  homePage,
  /home-valuator--signed-in/,
  'logged-in homepage no longer mounts the duplicate valuation hero',
)

const valuatorRender = homePage.match(/<HomeEquipmentValuator[\s\S]*?\/>/)
assert.ok(valuatorRender, 'valuator self-closes as a single shared instance')
assert.match(
  valuatorRender[0],
  /home-valuator--compact-mobile/,
  'homepage uses compact mobile valuator class',
)
assert.doesNotMatch(
  valuatorRender[0],
  /idPrefix=["']brands-valuator["']/,
  'homepage keeps default home-valuator ids',
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

assert.match(valuator, /idPrefix = 'home-valuator'/, 'shared defaults preserve homepage ids')
assert.match(valuator, /DeferredEquipmentAutocomplete/, 'shared autocomplete')
assert.match(valuator, /buildValuationHref/, 'shared valuation routing')
assert.match(valuator, /useState\(''\)/, 'instance-local query state')
assert.match(valuator, /useState\(null\)/, 'instance-local selection state')
assert.match(
  valuator,
  /Instant market valuations based on thousands of listings/,
  'shared default lede is not commercial-only',
)
assert.doesNotMatch(valuator, /commercial fitness products/, 'no commercial-only valuator lede')
assert.match(homePage, /home-valuator--compact-mobile/, 'logged-out homepage uses compact mobile valuator layout')

const hero = read('src/components/home/HomeHero.jsx')
assert.doesNotMatch(hero, /home-hero__copy/, 'homepage does not render duplicate marketplace intro block')
assert.doesNotMatch(hero, /EQUIPD MARKETPLACE|Equipd Marketplace/, 'no marketplace eyebrow under hero')
assert.match(homePage, /<HomeHeroCarousel/, 'homepage still uses the hero carousel')

console.log('homepage-valuator-auth-visibility: ok')
