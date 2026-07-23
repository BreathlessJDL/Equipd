/**
 * Stage 1 — listing page SEO metadata helpers.
 */
import {
  buildListingImageAltText,
  buildListingPageMetaDescription,
  buildListingPageSeo,
  buildListingPageSeoTitle,
  buildListingSeoProductName,
  getListingCanonicalPath,
  getListingCanonicalUrl,
  resolveListingSocialImageUrl,
  textIncludesPhrase,
} from '../src/lib/listingPageSeo.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const HOMEPAGE_TITLE_FRAGMENT = 'Buy, Sell & Value Used Gym Equipment'
const HOMEPAGE_DESCRIPTION_FRAGMENT = "The UK's marketplace for used gym equipment"

const structuredListing = {
  id: '1',
  slug: 'proform-tour-de-france-clc-manchester',
  status: 'active',
  title: 'Great bike for sale cheap!!!',
  brand: 'ProForm',
  model: 'Tour de France CLC',
  condition: 'good',
  price_pence: 45000,
  city: 'Manchester',
  category: { name: 'Exercise Bike' },
  primary_image_url: 'https://cdn.example.com/listings/proform-main.jpg',
  listing_images: [{ url: 'https://cdn.example.com/listings/proform-main.jpg' }],
}

const fallbackListing = {
  id: '2',
  slug: 'seller-free-text-only',
  status: 'active',
  title: 'Used Commercial Treadmill — local collection',
  brand: null,
  model: null,
  condition: 'fair',
  price_pence: 120000,
  location_name: 'Leeds',
  category: null,
}

const noImageListing = {
  ...structuredListing,
  id: '3',
  slug: 'no-image-listing',
  primary_image_url: null,
  listing_images: [],
}

// --- Structured title generation ---
assertEqual(
  buildListingPageSeoTitle(structuredListing),
  'Used ProForm Tour de France CLC Exercise Bike for Sale',
  'structured title from brand + model + type',
)

assertEqual(
  buildListingSeoProductName(structuredListing),
  'ProForm Tour de France CLC Exercise Bike',
  'structured product name',
)

assert(
  buildListingPageSeoTitle(structuredListing, {
    equipmentProduct: {
      canonical_product_name: 'ProForm Tour de France CLC',
      equipment_type: 'Exercise Bike',
    },
  }) === 'Used ProForm Tour de France CLC Exercise Bike for Sale',
  'canonical product name does not duplicate brand/type',
)

// --- Fallback title generation ---
assertEqual(
  buildListingPageSeoTitle(fallbackListing),
  'Used Commercial Treadmill — local collection for Sale',
  'fallback uses cleaned seller title',
)

assert(
  !buildListingPageSeoTitle(fallbackListing).toLowerCase().startsWith('used used'),
  'fallback does not double Used when already present in seller title',
)

// --- Duplicate-word prevention ---
assertEqual(
  buildListingPageSeoTitle({
    ...structuredListing,
    title: 'Used ProForm Tour de France CLC Exercise Bike for Sale',
    brand: 'ProForm',
    model: 'ProForm Tour de France CLC',
    category: { name: 'Exercise Bike' },
  }),
  'Used ProForm Tour de France CLC Exercise Bike for Sale',
  'no duplicated brand / used / for sale / type',
)

assert(
  textIncludesPhrase('Used ProForm Bike', 'proform'),
  'phrase helper finds brand case-insensitively',
)

assert(
  !buildListingSeoProductName({
    brand: 'Life Fitness',
    model: 'Life Fitness Integrity Treadmill',
    category: { name: 'Treadmill' },
    title: 'LF treadmill',
  }).includes('Life Fitness Life Fitness'),
  'brand not duplicated when already in model',
)

// --- Unique descriptions ---
const descA = buildListingPageMetaDescription(structuredListing)
const descB = buildListingPageMetaDescription(fallbackListing)
assert(descA.includes('Manchester'), 'description includes location when available')
assert(descA.includes('£450'), 'description includes price when available')
assert(descA.includes('Buyer Protection'), 'description mentions Buyer Protection')
assert(descA.includes('good'), 'description includes condition')
assert(descB.includes('Leeds'), 'fallback description uses available location')
assert(descA !== descB, 'descriptions are unique across different listings')
assert(!descA.includes('RRP'), 'description does not invent unavailable facts')

const sparseDesc = buildListingPageMetaDescription({
  title: 'Rowing Machine',
  slug: 'rowing-machine',
  status: 'active',
})
assert(sparseDesc.includes('Rowing Machine'), 'sparse listing still describes the item')
assert(!sparseDesc.includes('in  condition'), 'sparse listing omits missing condition phrasing')
assert(!sparseDesc.includes('for £'), 'sparse listing omits missing price')

// --- Canonical output ---
assertEqual(
  getListingCanonicalPath(structuredListing),
  '/listings/proform-tour-de-france-clc-manchester',
  'canonical path uses /listings/:slug',
)
assertEqual(
  getListingCanonicalUrl(structuredListing),
  'https://www.equipd.co.uk/listings/proform-tour-de-france-clc-manchester',
  'canonical URL uses www origin',
)

const seo = buildListingPageSeo({ listing: structuredListing })
assertEqual(seo.canonicalPath, '/listings/proform-tour-de-france-clc-manchester', 'bundle canonical path')
assertEqual(
  seo.openGraph['og:url'],
  'https://www.equipd.co.uk/listings/proform-tour-de-france-clc-manchester',
  'og:url is self-referencing canonical',
)
assertEqual(seo.noIndex, false, 'active listing is indexable')
assertEqual(seo.indexable, true, 'active listing indexable flag')

// --- Social image fallback ---
assertEqual(
  resolveListingSocialImageUrl(structuredListing),
  'https://cdn.example.com/listings/proform-main.jpg',
  'primary image used for social',
)
assertEqual(seo.openGraph['og:image'], 'https://cdn.example.com/listings/proform-main.jpg', 'og:image set')
assertEqual(seo.openGraph['twitter:image'], 'https://cdn.example.com/listings/proform-main.jpg', 'twitter:image set')
assertEqual(seo.openGraph['twitter:card'], 'summary_large_image', 'large image card when image present')

const noImageSeo = buildListingPageSeo({ listing: noImageListing })
assertEqual(noImageSeo.socialImage, null, 'no social image when none available')
assert(!Object.prototype.hasOwnProperty.call(noImageSeo.openGraph, 'og:image'), 'og:image omitted without image')
assert(!Object.prototype.hasOwnProperty.call(noImageSeo.openGraph, 'twitter:image'), 'twitter:image omitted without image')
assertEqual(noImageSeo.openGraph['twitter:card'], 'summary', 'summary card without image')

// --- Alt text ---
assertEqual(
  buildListingImageAltText(structuredListing),
  'Used ProForm Tour de France CLC Exercise Bike',
  'gallery alt uses structured name',
)
assertEqual(
  buildListingImageAltText(fallbackListing),
  'Used Commercial Treadmill — local collection',
  'gallery alt falls back to cleaned seller title',
)

// --- Homepage metadata leakage ---
assert(!seo.titleForHook.includes(HOMEPAGE_TITLE_FRAGMENT), 'listing title is not homepage title')
assert(!seo.titleWithSite.includes(HOMEPAGE_TITLE_FRAGMENT), 'listing titleWithSite is not homepage')
assert(!seo.description.includes(HOMEPAGE_DESCRIPTION_FRAGMENT), 'listing description is not homepage description')
assert(seo.openGraph['og:title'] === seo.titleWithSite, 'og:title matches listing title')
assert(seo.openGraph['og:description'] === seo.description, 'og:description matches listing description')
assert(
  seo.openGraph['og:url'] === 'https://www.equipd.co.uk/listings/proform-tour-de-france-clc-manchester',
  'og:url is listing canonical, not homepage',
)
assert(seo.openGraph['og:title'] !== HOMEPAGE_TITLE_FRAGMENT, 'og:title is not homepage title')
assert(!seo.openGraph['og:description']?.includes(HOMEPAGE_DESCRIPTION_FRAGMENT), 'og:description is not homepage')

const notFoundSeo = buildListingPageSeo({ listing: null })
assertEqual(notFoundSeo.noIndex, true, 'missing listing is noindex')
assert(!notFoundSeo.description.includes(HOMEPAGE_DESCRIPTION_FRAGMENT), 'not-found description is not homepage')
assertEqual(notFoundSeo.openGraph, null, 'not-found has no open graph homepage tags')

const draftSeo = buildListingPageSeo({
  listing: { ...structuredListing, status: 'draft' },
})
assertEqual(draftSeo.noIndex, true, 'draft listings are noindex')
assertEqual(draftSeo.indexable, false, 'draft not indexable')

console.log('test-listing-page-seo: ok')
