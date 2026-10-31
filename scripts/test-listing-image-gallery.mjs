/**
 * Guards listing gallery navigation, preload order, and display wiring.
 * Run: node scripts/test-listing-image-gallery.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LISTING_GALLERY_PRELOAD_CONCURRENCY,
  LISTING_GALLERY_THUMB_EAGER_COUNT,
  createListingGalleryImageLoader,
  getAdjacentGalleryIndexes,
  getProgressiveGalleryIndexes,
  pickListingImageWidth,
  shouldPreloadRemainingGalleryImages,
  wrapGalleryIndex,
} from '../src/lib/listingGalleryPreload.js'
import { LISTING_GALLERY_MAIN_WIDTHS } from '../src/lib/listingImageTransforms.js'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

assert.equal(wrapGalleryIndex(-1, 8), 7)
assert.equal(wrapGalleryIndex(8, 8), 0)
assert.deepEqual(getAdjacentGalleryIndexes(0, 8), [1, 7])
assert.deepEqual(getAdjacentGalleryIndexes(3, 8), [4, 2])
assert.deepEqual(getAdjacentGalleryIndexes(0, 2), [1])
assert.deepEqual(getAdjacentGalleryIndexes(0, 1), [])
assert.deepEqual(getProgressiveGalleryIndexes(0, 8, [1, 7]), [2, 3, 4, 5, 6])
assert.equal(LISTING_GALLERY_PRELOAD_CONCURRENCY, 2)
assert.ok(LISTING_GALLERY_THUMB_EAGER_COUNT >= 4)
assert.equal(shouldPreloadRemainingGalleryImages({}), true)
assert.equal(shouldPreloadRemainingGalleryImages({ connection: { saveData: true } }), false)
assert.equal(shouldPreloadRemainingGalleryImages({ connection: { effectiveType: '2g' } }), false)
assert.equal(shouldPreloadRemainingGalleryImages({ connection: { effectiveType: '4g' } }), true)

assert.equal(pickListingImageWidth(LISTING_GALLERY_MAIN_WIDTHS, 725, 1), 960)
assert.equal(pickListingImageWidth(LISTING_GALLERY_MAIN_WIDTHS, 390, 3), 1280)
assert.equal(pickListingImageWidth(LISTING_GALLERY_MAIN_WIDTHS, 200, 1), 640)

class FakeImage {
  constructor() {
    this._src = ''
    this.srcset = ''
    this.sizes = ''
    this.fetchPriority = 'auto'
    this.onload = null
    this.onerror = null
  }

  set src(value) {
    this._src = value
    queueMicrotask(() => this.onload?.())
  }

  get src() {
    return this._src
  }
}

const load = createListingGalleryImageLoader({ ImageCtor: FakeImage })
const loaded = await load('https://example.supabase.co/storage/v1/object/public/listing-images/a.jpg', {
  fetchPriority: 'high',
})
assert.equal(loaded, true)

const gallery = read('src/components/listing/ListingImageGallery.jsx')
assert.match(gallery, /setSelectedIndex/, 'next/prev update the selected index immediately')
assert.match(gallery, /displayedIndex/, 'the visible photo is held until the requested photo is ready')
assert.match(gallery, /requestIdRef/, 'stale gallery loads are ignored')
assert.match(gallery, /getAdjacentGalleryIndexes/, 'next and previous photos preload')
assert.match(gallery, /getProgressiveGalleryIndexes/, 'remaining photos preload progressively')
assert.match(gallery, /currentImageReady/, 'background preloads wait for the visible photo')
assert.match(gallery, /shouldPreloadRemainingGalleryImages/, 'slow networks skip remaining gallery preloads')
assert.match(gallery, /fetchPriority: 'low'/, 'background gallery preloads stay low priority')
assert.match(gallery, /loading="eager"/, 'the main gallery photo is never lazy-loaded')
assert.match(gallery, /listing-gallery__pending/, 'pending navigation shows subtle loading feedback')
assert.match(gallery, /ArrowRight/, 'keyboard navigation remains available')
assert.match(gallery, /touchend/, 'swipe navigation remains available')
assert.doesNotMatch(
  gallery,
  /loading=\{safeIndex === 0 \? 'eager' : 'lazy'\}/,
  'later gallery photos are not marked lazy on the main stage',
)

const css = read('src/components/listing/ListingImageGallery.css')
assert.match(css, /listing-gallery-pending/, 'pending state has a non-blocking indicator')
assert.match(css, /pointer-events: none/, 'the pending indicator does not capture clicks')

const recommendations = read('src/components/listing/ListingRecommendations.jsx')
assert.doesNotMatch(
  recommendations,
  /imagePriority/,
  'below-the-fold related listing cards stay lazy-loaded',
)

const locationResults = read('src/components/browse/LocationListingsResults.jsx')
assert.match(locationResults, /imagePriority=\{index < 4\}/, 'location listing grids eager-load above-the-fold cards')

const category = read('src/components/marketing/CategoryListingsSection.jsx')
assert.match(category, /imagePriority=\{index < 4\}/, 'category listing strips eager-load above-the-fold cards')

console.log('listing-image-gallery: ok')
