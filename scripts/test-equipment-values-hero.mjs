/**
 * Guards Equipment Values landing-page hero artwork + search wiring.
 * Run: node scripts/test-equipment-values-hero.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const root = process.cwd()
const hero = read('src/components/brands/EquipmentValuesHero.jsx')
const css = read('src/components/brands/EquipmentValuesHero.css')
const lib = read('src/lib/equipmentValuesHero.js')
const valuator = read('src/components/home/HomeEquipmentValuator.jsx')
const brandsPage = read('src/pages/BrandsPage.jsx')

assert.equal(
  existsSync(join(root, 'public/design-reference/Equipment Valuations Hero Banner Desktop.png')),
  true,
  'desktop banner file exists',
)
assert.equal(
  existsSync(join(root, 'public/design-reference/Equipment Valuations Hero Banner Mobile.png')),
  true,
  'mobile banner file exists',
)

assert.match(hero, /<picture>/, 'uses picture for responsive art')
assert.match(hero, /EQUIPMENT_VALUES_HERO_MOBILE_MEDIA/, 'mobile source uses shared breakpoint')
assert.match(lib, /HOME_HERO_MOBILE_MEDIA/, 'mobile media matches homepage hero breakpoint')
assert.doesNotMatch(hero, /<img[\s\S]*desktop[\s\S]*<img/, 'does not mount both images as sibling imgs')
assert.match(hero, /searchOnly/, 'does not duplicate baked-in heading as visible HTML copy')
assert.match(hero, /showShowcase=\{false\}/, 'does not render the old live graph/card')
assert.doesNotMatch(hero, /buildEquipmentDepreciationGraphData|SHOWCASE_PRODUCT/, 'hero does not rebuild the old chart')
assert.match(valuator, /DeferredEquipmentAutocomplete/, 'search still uses shared autocomplete')
assert.match(hero, /submitLabel=["']Find value["']/, 'Find value button is wired')
assert.match(css, /object-fit:\s*contain/, 'artwork keeps intrinsic proportions')
assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*home-valuator__popular[\s\S]*display:\s*none/, 'popular chips hide on mobile')
assert.match(brandsPage, /<EquipmentValuesHero/, 'brands page mounts the new hero')
assert.doesNotMatch(brandsPage, /Instant Gym Equipment Valuation/, 'old valuator heading is gone')

console.log('equipment-values-hero: ok')
