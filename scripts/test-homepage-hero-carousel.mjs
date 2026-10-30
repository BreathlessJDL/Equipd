/**
 * Guards homepage hero carousel wiring for logged-out and logged-in states.
 * Run: node scripts/test-homepage-hero-carousel.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const lib = read('src/lib/homeHeroCarousel.js')
const carousel = read('src/components/home/HomeHeroCarousel.jsx')
const imageSlide = read('src/components/home/HomeHeroImageSlide.jsx')
const homePage = read('src/pages/HomePage.jsx')
const css = read('src/components/home/HomeHeroCarousel.css')
const pageCss = read('src/components/home/HomePage.css')
const hero = read('src/components/home/HomeHero.jsx')

assert.match(lib, /HOME_HERO_ROTATE_MS = 5000/, 'autoplay interval is 5 seconds')
assert.match(lib, /id: 'coat-rack'[\s\S]*id: 'home-gym'[\s\S]*id: 'valuation'/, 'logged-out slide order')
assert.match(lib, /LOGGED_IN_HOME_HERO_SLIDES[\s\S]*id: 'cardio'[\s\S]*id: 'valuation'/, 'logged-in slide order')
assert.match(lib, /build your home gym banner 8\.png/, 'uses supplied home-gym banner')
assert.equal(existsSync(join(process.cwd(), 'public/design-reference/build your home gym banner 8.png')), true)
assert.doesNotMatch(lib, /build your home gym banner 7\.png/, 'previous home-gym desktop banner is no longer referenced')
assert.match(lib, /Gym Equipment Valuation Landing Page 4\.png/, 'uses supplied valuation banner')
assert.match(lib, /find your next cardio 3\.png/, 'uses supplied cardio banner')
assert.match(lib, /Turn Your Gym Into Cash mobile 3\.png/, 'uses supplied coat-rack mobile banner')
assert.match(lib, /mobileWidth: 1645/, 'coat-rack mobile intrinsic width matches the new artwork')
assert.match(lib, /mobileHeight: 956/, 'coat-rack mobile intrinsic height matches the new artwork')
assert.match(lib, /Build Your Home Gym for Less Mobile\.png/, 'uses supplied home-gym mobile banner')
assert.match(lib, /Gym Equipment Valuation Hero Banner Mobile\.png/, 'uses supplied valuation mobile banner')
assert.match(lib, /Find Your Next Cardio Setup Mobile\.png/, 'uses supplied cardio mobile banner')
assert.match(lib, /HOME_HERO_MOBILE_MEDIA = '\(max-width: 767px\)'/, 'mobile art is selected below 768px')
assert.equal(existsSync(join(process.cwd(), 'public/design-reference/Turn Your Gym Into Cash mobile 3.png')), true)
assert.equal(existsSync(join(process.cwd(), 'public/design-reference/Build Your Home Gym for Less Mobile.png')), true)
assert.equal(existsSync(join(process.cwd(), 'public/design-reference/Gym Equipment Valuation Hero Banner Mobile.png')), true)
assert.equal(existsSync(join(process.cwd(), 'public/design-reference/Find Your Next Cardio Setup Mobile.png')), true)
assert.match(lib, /href: BROWSE_PATH/, 'home-gym CTA uses browse route')
assert.match(lib, /CARDIO_CATEGORY_SLUGS/, 'cardio CTA uses cardio browse categories')
assert.match(
  lib,
  /CARDIO_EQUIPMENT_BROWSE_PATH = buildBrowseNavPath\(\{\s*categorySlugs: CARDIO_CATEGORY_SLUGS/,
  'cardio CTA uses the shared browse filter URL, not a one-off filter path',
)
assert.match(lib, /href: BRANDS_PATH/, 'valuation CTA uses Equipment Values landing page')
assert.doesNotMatch(lib, /popularSearches/, 'valuation banner no longer defines popular-search hotspots')

assert.equal(
  existsSync(join(process.cwd(), 'src/components/home/HomeHeroValuationSlide.jsx')),
  false,
  'dedicated valuation search slide is removed',
)

assert.match(homePage, /<HomeHeroCarousel isLoggedIn=\{isLoggedIn\} \/>/, 'homepage mounts carousel for both auth states')
assert.doesNotMatch(homePage, /\{!\s*isLoggedIn\s*\?\s*<HomeHero/, 'logged-in homepage is no longer hero-less')
assert.match(
  homePage,
  /\{!\s*isLoggedIn\s*\?\s*\(\s*<HomeEquipmentValuator/,
  'standalone valuator hero is logged-out only',
)
assert.doesNotMatch(
  homePage,
  /home-valuator--signed-in/,
  'logged-in homepage does not keep the old valuation hero under the carousel',
)

assert.match(carousel, /prefers-reduced-motion: reduce/, 'respects reduced motion')
assert.match(carousel, /inert=\{active \? undefined : true\}/, 'inactive slides are inert')
assert.match(carousel, /aria-hidden=\{active \? undefined : true\}/, 'inactive slides are hidden from AT')
assert.match(carousel, /\[paused, reduceMotion, slideCount, index\]/, 'autoplay timer resets after manual navigation')
assert.match(carousel, /pause\('hover'\)/, 'pauses on hover')
assert.match(carousel, /pause\('focus'\)/, 'pauses on focus')
assert.match(carousel, /Previous hero slide/, 'previous control is labelled')
assert.match(carousel, /Next hero slide/, 'next control is labelled')
assert.match(carousel, /role="tablist"/, 'pagination indicators are present')
assert.doesNotMatch(carousel, /HomeHeroValuationSlide|DeferredEquipmentAutocomplete/, 'carousel does not mount a search overlay')

assert.match(lib, /Your Gym, Not a Coat Rack 2\.png/, 'uses supplied coat-rack banner')
assert.equal(existsSync(join(process.cwd(), 'public/design-reference/Your Gym, Not a Coat Rack 2.png')), true)
assert.doesNotMatch(lib, /Your Gym, Not a Coat Rack\.png'/, 'old coat-rack desktop banner is no longer referenced')
assert.match(lib, /encodeURI\(/, 'banner paths keep commas so Vite can serve the coat-rack file')
assert.doesNotMatch(lib, /encodeURIComponent\(/, 'does not percent-encode commas in design-reference filenames')
assert.match(hero, /COAT_RACK_HERO_BANNER/, 'coat-rack slide reads the shared banner config')
assert.match(hero, /ProtectedLink/, 'coat-rack CTA still requires login before create listing')
assert.match(hero, /HERO_BANNER\.label/, 'coat-rack CTA uses the painted sell label')
assert.match(lib, /label: 'Sell now'/, 'coat-rack CTA label matches the painted button')
assert.match(lib, /href: '\/listings\/new'/, 'coat-rack still sells via create listing')
assert.doesNotMatch(hero, /home-hero__copy/, 'coat-rack slide does not duplicate banner copy')
assert.match(hero, /HomeHeroBannerPicture/, 'coat-rack uses the shared responsive banner picture')
assert.match(imageSlide, /<picture>/, 'slides use picture for mobile/desktop art')
assert.match(imageSlide, /HOME_HERO_MOBILE_MEDIA/, 'picture source uses the shared mobile media query')
assert.match(imageSlide, /banner\.mobileSrc/, 'picture source points at the mobile banner')

assert.match(imageSlide, /visually-hidden/, 'image CTAs have accessible names without extra visible text')
assert.match(lib, /label: 'Value now'/, 'valuation CTA uses the painted button label')

assert.match(css, /--home-hero-desktop-ratio: 1846 \/ 399/, 'desktop slides match the original coat-rack ratio')
assert.match(css, /--home-hero-mobile-ratio: 1672 \/ 941/, 'mobile slides match the supplied mobile banner ratio')
assert.match(css, /@media \(max-width:\s*767px\)/, 'mobile carousel layout matches the picture breakpoint')
assert.match(css, /aspect-ratio: var\(--home-hero-desktop-ratio\)/, 'desktop slides share a locked ratio')
assert.match(css, /aspect-ratio: var\(--home-hero-mobile-ratio\)/, 'mobile slides share a locked ratio')
assert.doesNotMatch(css, /home-hero-valuation__/, 'search-specific overlay CSS is removed')
assert.doesNotMatch(css, /canonical-autocomplete/, 'autocomplete overlay CSS is removed')
assert.match(css, /prefers-reduced-motion|data-reduce-motion/, 'motion can be disabled in CSS')
assert.match(pageCss, /\.home-page--feed \.home-hero/, 'signed-in homepage keeps the carousel above the feed')

console.log('homepage-hero-carousel: ok')
