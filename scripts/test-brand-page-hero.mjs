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
assert.match(css, /--brand-hero-cream:\s*#faf4ec/, 'hero keeps the warm cream fill')
assert.match(css, /radial-gradient/, 'hero uses a soft circle wash instead of the orange line artwork')
assert.doesNotMatch(css, /Soft Peach Abstract Hero Background/, 'decorative orange-line artwork is not applied')
assert.doesNotMatch(css, /brand-page-hero__search/, 'hero search styles are removed')
assert.match(css, /border-radius:\s*1\.15rem/, 'hero is rounded')
assert.match(hero, /BrandLogo/, 'overlays the catalogue brand logo')
assert.match(css, /--brand-hero-logo-width:\s*13\.5rem/, 'hero logo viewport is wide enough for wordmarks')
assert.match(css, /--brand-hero-logo-height:\s*3rem/, 'hero logo viewport stays compact')
assert.match(css, /object-fit:\s*cover/, 'hero crops square-canvas padding instead of shrinking the artwork')
assert.match(css, /brand-logo--technogym[\s\S]*object-fit:\s*contain/, 'Technogym hero logo keeps its aspect ratio')
assert.match(css, /\.brand-page-hero__logo \.brand-logo__image[\s\S]{0,280}width:\s*100%/, 'nested logo image fills the hero viewport')
assert.match(css, /\.brand-page-hero__logo \.brand-logo__image[\s\S]{0,360}transform:\s*none/, 'hero does not clip artwork with a nested scale transform')
assert.match(hero, /Used gym equipment/, 'uses the shared orange label')
assert.match(hero, /buildBrandHeroVisibleTitle/, 'heading is generated from the brand name')
assert.match(css, /font-family:\s*Georgia,\s*'Times New Roman',\s*serif/, 'hero heading uses the approved serif stack')
assert.match(css, /font-size:\s*clamp\(1\.875rem, 1\.2rem \+ 2\.4vw, 2\.875rem\)/, 'hero heading scales between 30px and 46px')
assert.match(css, /\.brand-page-hero__lede[\s\S]{0,220}font-size:\s*1\.0625rem/, 'hero description is 17px on desktop')
assert.match(css, /\.brand-page-hero__eyebrow[\s\S]{0,180}font-size:\s*0\.8125rem/, 'hero label is 13px on desktop')
assert.match(css, /\.brand-page-hero__stat-value[\s\S]{0,160}font-size:\s*2\.125rem/, 'hero stat numbers are 34px on desktop')
assert.match(css, /@media \(min-width: 768px\)[\s\S]*stat \{\s*align-items:\s*center/, 'desktop stats are centred')
assert.match(css, /@media \(min-width: 768px\)[\s\S]*actions \{\s*[\s\S]*justify-content:\s*center/, 'desktop CTAs are centred as a group')
assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/, 'desktop hero uses two equal flexible columns')
assert.match(css, /@media \(min-width: 1101px\)[\s\S]*max-width:\s*28\.75rem/, 'desktop panel is capped at 460px')
assert.match(css, /min-height:\s*22\.5rem/, 'desktop hero is taller for a premium panel')
assert.match(css, /@media \(min-width: 1101px\)[\s\S]*stat-value \{\s*font-size:\s*1\.75rem/, 'desktop stat numbers are 28px')
assert.match(css, /@media \(min-width: 1101px\)[\s\S]*stat-label--full \{\s*font-size:\s*0\.75rem/, 'desktop stat labels are 12px')
assert.match(css, /@media \(min-width: 1101px\)[\s\S]*font-family:\s*var\(--font-sans\)/, 'desktop heading uses the landing-page sans stack')
assert.doesNotMatch(css, /brand-page-hero--open/, 'open layout preview is removed')
assert.doesNotMatch(hero, /heroVariant|useSearchParams/, 'temporary variant preview is removed')
assert.match(css, /\.brand-page-hero__stat-icon,\s*\n\.brand-page-hero__cta-icon \{\s*\n\s*display:\s*none/, 'stat and CTA icons stay hidden off desktop')
assert.doesNotMatch(css, /covered/, 'hero CSS does not mention covered')
assert.doesNotMatch(hero, /Life Fitness|Technogym/, 'hero component does not hardcode manufacturer names')
assert.match(hero, /browseListingsHref/, 'browse CTA uses the brand listing route')
assert.match(hero, /catalogue=1/, 'values CTA preserves the catalogue query')
assert.doesNotMatch(hero, /brand-page-hero__search|SearchIcon|onSearchSubmit/, 'hero search and autocomplete are removed')
assert.match(page, /<BrandPageHero/, 'BrandPage mounts the shared hero')
assert.match(page, /buildBrandHeroStats/, 'BrandPage uses catalogue-backed hero stats')
assert.doesNotMatch(page, /handleSearchSubmit|searchSuggestions|searchFocused/, 'BrandPage no longer owns hero search state')
assert.match(page, /onExploreValues=\{scrollToBrandValuations\}/, 'explore values scrolls to the compact valuation section')
assert.match(page, /BrandPageValuationSearch/, 'compact valuation search is mounted')
assert.doesNotMatch(page, /id="all-models"/, 'full visible catalogue grid is no longer mounted')
assert.match(hero, /stat-label--short/, 'mobile uses shortened statistic labels')
assert.match(css, /stat-label--short/, 'mobile statistic labels are styled separately')
assert.doesNotMatch(hero, /pale-blue|brand-hero-bg/, 'old pale-blue hero styling is not in the component')
assert.match(hero, /visually-hidden/, 'SEO heading stays in a visually hidden h1')

console.log('brand-page-hero: ok')
