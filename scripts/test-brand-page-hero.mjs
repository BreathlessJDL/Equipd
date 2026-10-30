/**
 * Guards the shared brand-page hero background and dynamic overlay.
 * Run: node scripts/test-brand-page-hero.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const root = process.cwd()
const page = read('src/pages/BrandPage.jsx')
const hero = read('src/components/brands/BrandPageHero.jsx')
const css = read('src/components/brands/BrandPageHero.css')
const lib = read('src/lib/brandPageHero.js')

assert.equal(
  existsSync(join(root, 'public/design-reference/Soft Peach Abstract Hero Background.png')),
  true,
  'shared hero background exists',
)
assert.match(lib, /Soft Peach Abstract Hero Background\.png/, 'background path is configured')
assert.match(css, /background-image:\s*url\('\/design-reference\/Soft Peach Abstract Hero Background\.png'\)/, 'CSS uses the shared artwork')
assert.match(css, /background-size:\s*cover/, 'background covers without stretching axes independently')
assert.match(css, /border-radius:\s*1\.15rem/, 'hero is rounded')
assert.match(hero, /BrandLogo/, 'overlays the catalogue brand logo')
assert.match(css, /--brand-hero-logo-width:\s*13\.5rem/, 'hero logo viewport is wide enough for wordmarks')
assert.match(css, /--brand-hero-logo-height:\s*3rem/, 'hero logo viewport stays compact')
assert.match(css, /object-fit:\s*cover/, 'hero crops square-canvas padding instead of shrinking the artwork')
assert.match(css, /\.brand-page-hero__logo \.brand-logo__image[\s\S]{0,280}width:\s*100%/, 'nested logo image fills the hero viewport')
assert.match(css, /\.brand-page-hero__logo \.brand-logo__image[\s\S]{0,360}transform:\s*none/, 'hero does not clip artwork with a nested scale transform')
assert.match(hero, /Used gym equipment/, 'uses the shared orange label')
assert.match(hero, /buildBrandHeroVisibleTitle/, 'heading is generated from the brand name')
assert.match(css, /font-family:\s*Georgia,\s*'Times New Roman',\s*serif/, 'hero heading uses the approved serif stack')
assert.match(css, /font-size:\s*clamp\(1\.875rem, 1\.2rem \+ 2\.4vw, 2\.875rem\)/, 'hero heading scales between 30px and 46px')
assert.match(css, /\.brand-page-hero__lede[\s\S]{0,220}font-size:\s*1\.0625rem/, 'hero description is 17px on desktop')
assert.match(css, /\.brand-page-hero__eyebrow[\s\S]{0,180}font-size:\s*0\.8125rem/, 'hero label is 13px on desktop')
assert.match(css, /\.brand-page-hero__stat-value[\s\S]{0,160}font-size:\s*2\.125rem/, 'hero stat numbers are 34px on desktop')
assert.doesNotMatch(hero, /Life Fitness|Technogym/, 'hero component does not hardcode manufacturer names')
assert.match(hero, /browseListingsHref/, 'browse CTA uses the brand listing route')
assert.match(hero, /catalogue=1/, 'values CTA preserves the catalogue query')
assert.match(hero, /onSearchSubmit/, 'search submit is wired through')
assert.match(hero, /searchSuggestions/, 'autocomplete suggestions are reused')
assert.match(page, /<BrandPageHero/, 'BrandPage mounts the shared hero')
assert.match(page, /buildBrandHeroStats/, 'BrandPage uses catalogue-backed hero stats')
assert.match(page, /handleSearchSubmit/, 'BrandPage keeps existing search submission')
assert.doesNotMatch(hero, /pale-blue|brand-hero-bg/, 'old pale-blue hero styling is not in the component')
assert.match(hero, /visually-hidden/, 'SEO heading stays in a visually hidden h1')

console.log('brand-page-hero: ok')
