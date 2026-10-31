/**
 * Guards listing image transform URLs and display wiring.
 * Run: node scripts/test-listing-image-transforms.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LISTING_CARD_IMAGE_WIDTHS,
  LISTING_GALLERY_MAIN_WIDTHS,
  LISTING_GALLERY_THUMB_WIDTHS,
  LISTING_THUMB_IMAGE_WIDTHS,
  buildListingImageSources,
  buildListingImageVariantUrl,
  isListingImageTransformUrl,
} from '../src/lib/listingImageTransforms.js'

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const publicUrl =
  'https://example.supabase.co/storage/v1/object/public/listing-images/user/listing/photo.jpg'
const signedUrl =
  'https://example.supabase.co/storage/v1/object/sign/listing-images/user/listing/photo.jpg?token=abc'
const externalUrl = 'https://cdn.example.com/photo.jpg'

const variant = buildListingImageVariantUrl(publicUrl, { width: 300, quality: 70 })
assert.match(variant, /\/storage\/v1\/render\/image\/public\/listing-images\//)
assert.match(variant, /width=300/)
assert.match(variant, /quality=70/)
assert.match(variant, /resize=contain/)
assert.equal(buildListingImageVariantUrl(signedUrl, { width: 300 }), null)
assert.equal(buildListingImageVariantUrl(externalUrl, { width: 300 }), null)
assert.ok(isListingImageTransformUrl(variant))
assert.equal(isListingImageTransformUrl(publicUrl), false)

const sources = buildListingImageSources(publicUrl, { widths: LISTING_CARD_IMAGE_WIDTHS })
assert.ok(sources.srcSet.includes('300w'))
assert.ok(sources.srcSet.includes('600w'))
assert.doesNotMatch(sources.srcSet, /900w/, 'card variants stay at marketplace card size')
assert.equal(buildListingImageSources(externalUrl).srcSet, undefined)
assert.equal(buildListingImageSources(externalUrl).src, externalUrl)

assert.deepEqual(LISTING_GALLERY_MAIN_WIDTHS, [640, 960, 1280])
assert.ok(LISTING_GALLERY_THUMB_WIDTHS[0] <= 160)
assert.ok(LISTING_THUMB_IMAGE_WIDTHS[0] <= 96)

const card = read('src/components/ListingCard.jsx')
assert.match(card, /ListingPhoto/, 'cards use the shared listing photo')
assert.match(card, /LISTING_CARD_IMAGE_WIDTHS/, 'grid cards request card-sized variants')
assert.match(card, /loading=\{priority \? 'eager' : 'lazy'\}|priority=\{priority\}/, 'above-fold cards can skip lazy-load')

const gallery = read('src/components/listing/ListingImageGallery.jsx')
assert.match(gallery, /LISTING_GALLERY_MAIN_WIDTHS/, 'gallery main image is resized')
assert.match(gallery, /LISTING_GALLERY_THUMB_WIDTHS/, 'gallery thumbs are resized')
assert.match(gallery, /loading="eager"/, 'the main gallery image is always eager')
assert.match(gallery, /getAdjacentGalleryIndexes/, 'gallery preloads neighbouring photos')
assert.doesNotMatch(
  gallery,
  /<img[\s\S]*src=\{currentImage\.url\}/,
  'gallery does not load the original upload as the default main src',
)

const listingPhoto = read('src/components/ListingPhoto.jsx')
assert.match(listingPhoto, /restoreOriginalListingImage/, 'transform failures fall back to the original')
assert.match(listingPhoto, /loading=\{loading \?\? \(priority \? 'eager' : 'lazy'\)\}/, 'offscreen photos lazy-load')

const hub = read('src/components/hub/HubItemRow.jsx')
assert.match(hub, /ListingPhoto/, 'hub thumbs use transformed listing photos')

const conversation = read('src/components/messages/ConversationListItem.jsx')
assert.match(conversation, /ListingPhoto/, 'conversation thumbs use transformed listing photos')

const thread = read('src/components/messages/MessageThreadListingSummary.jsx')
assert.match(thread, /ListingPhoto/, 'message listing summary uses transformed thumbs')

const adminConversation = read('src/pages/AdminConversationPage.jsx')
assert.match(adminConversation, /ListingPhoto/, 'admin conversation listing thumb uses transformed photos')
assert.doesNotMatch(
  adminConversation,
  /<img src=\{listingImage\}/,
  'admin conversation does not load the original listing upload as the default thumb src',
)

const upload = read('src/lib/listingImages.js')
assert.match(upload, /cacheControl: '31536000'/, 'new uploads set a long public cache because paths are unique')
assert.match(upload, /getPublicUrl/, 'listing photos remain public object URLs')
assert.doesNotMatch(upload, /createSignedUrl/, 'listing photos are not served as signed URLs')

const prerender = read('src/lib/listingImagePublicUrl.js')
assert.match(prerender, /object\/public/, 'SEO/prerender images keep the durable original URL')

console.log('listing-image-transforms: ok')
