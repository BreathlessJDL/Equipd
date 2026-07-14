/**
 * Guards listing gallery mobile centering + object-fit contain.
 * Run: node scripts/test-listing-gallery-mobile-centre.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const galleryCss = read('src/components/listing/ListingImageGallery.css')
const detailCss = read('src/components/ListingDetail.css')

assert.match(galleryCss, /\.listing-gallery__main-image[\s\S]*object-fit:\s*contain/, 'main image uses contain')
assert.match(galleryCss, /\.listing-gallery__main-image[\s\S]*margin:\s*0 auto/, 'main image has horizontal auto margin')

const mobileBlock = galleryCss.match(/@media \(max-width:\s*767px\)\s*\{[\s\S]*$/)?.[0] || ''
assert.ok(mobileBlock.length > 0, 'mobile gallery media query present')
assert.match(mobileBlock, /\.listing-gallery__layout[\s\S]*align-items:\s*stretch/, 'mobile layout stretches to centre')
assert.match(mobileBlock, /\.listing-gallery__main-wrap[\s\S]*width:\s*100%/, 'mobile main wrap full width')
assert.match(mobileBlock, /\.listing-gallery__thumbs[\s\S]*justify-content:\s*(safe )?center/, 'thumbs centred on mobile')
assert.match(galleryCss, /^\.listing-gallery\s*\{[\s\S]*width:\s*100%/m, 'gallery root is full width')

assert.match(
  detailCss,
  /\.listing-detail__media\s*\{[\s\S]*width:\s*100%/,
  'listing media column is full width',
)

// Desktop grid must remain intact above the mobile query.
assert.match(
  galleryCss,
  /\.listing-gallery__layout\s*\{[\s\S]*grid-template-columns:\s*6\.25rem minmax\(0,\s*1fr\)/,
  'desktop thumb + main grid preserved',
)

console.log('listing-gallery-mobile-centre: ok')
