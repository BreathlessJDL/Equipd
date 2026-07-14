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
assert.match(homePage, /<HomeEquipmentValuator/, 'homepage renders shared valuator')
assert.doesNotMatch(
  homePage,
  /\{!\s*isLoggedIn\s*\?\s*<HomeEquipmentValuator/,
  'valuator is not gated behind logged-out-only conditional',
)
assert.doesNotMatch(
  homePage,
  /isLoggedIn\s*\?\s*null\s*:\s*<HomeEquipmentValuator/,
  'valuator is not hidden when logged in',
)

const valuatorRender = homePage.match(/<HomeEquipmentValuator[\s\S]*?\/>/)
assert.ok(valuatorRender, 'valuator self-closes as a single shared instance')
assert.match(
  valuatorRender[0],
  /className=\{isLoggedIn \? 'home-valuator--signed-in' : ''\}/,
  'signed-in homepage uses compact class via props',
)
assert.doesNotMatch(
  valuatorRender[0],
  /idPrefix=["']brands-valuator["']/,
  'homepage keeps default home-valuator ids',
)

assert.match(homePage, /\{!\s*isLoggedIn\s*\?\s*<HomeHero/, 'hero remains logged-out marketing only')
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
  /path=["']browse["'][\s\S]*Navigate[\s\S]*index|index[\s\S]*Navigate[\s\S]*browse/,
  'no index→browse redirect route',
)

assert.match(valuator, /idPrefix = 'home-valuator'/, 'shared defaults preserve homepage ids')
assert.match(valuator, /CanonicalEquipmentAutocomplete/, 'shared autocomplete')
assert.match(valuator, /buildValuationHref/, 'shared valuation routing')
assert.match(valuator, /useState\(''\)/, 'instance-local query state')
assert.match(valuator, /useState\(null\)/, 'instance-local selection state')
assert.match(
  valuator,
  /Search over 1,000 fitness products and get an estimated current used value in just a few simple steps\./,
  'shared default lede is not commercial-only',
)
assert.doesNotMatch(valuator, /commercial fitness products/, 'no commercial-only valuator lede')
assert.match(valuatorCss, /\.home-valuator--signed-in/, 'signed-in compact spacing class exists')

const hero = read('src/components/home/HomeHero.jsx')
assert.doesNotMatch(hero, /home-hero__copy/, 'homepage does not render duplicate marketplace intro block')
assert.doesNotMatch(hero, /EQUIPD MARKETPLACE|Equipd Marketplace/, 'no marketplace eyebrow under hero')
assert.match(homePage, /<HomeHero/, 'homepage still uses hero banner component')

console.log('homepage-valuator-auth-visibility: ok')
