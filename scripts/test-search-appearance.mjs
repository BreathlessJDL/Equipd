/**
 * Stage 7 — search appearance: titles, OG, breadcrumbs, site schema, FAQ, seller shop.
 */
import { buildBrandPageMetaTitle } from '../src/lib/brandCatalogueCore.js'
import {
  buildBrandPageBreadcrumbSchema,
  buildEquipmentBreadcrumbSchema,
  buildListingBreadcrumbSchema,
  findBreadcrumbSchemas,
} from '../src/lib/breadcrumbStructuredData.js'
import { buildEquipmentPageTitle, buildEquipmentProductJsonLd } from '../src/lib/equipmentPageSeo.js'
import { buildFaqPageSchema } from '../src/lib/faqPageStructuredData.js'
import {
  buildListingPageSeo,
  buildListingPageSeoTitle,
} from '../src/lib/listingPageSeo.js'
import {
  buildListingPageStructuredData,
  buildListingProductSchema,
} from '../src/lib/listingPageStructuredData.js'
import { formatPageTitle, stripSiteTitleSuffix } from '../src/lib/pageTitles.js'
import {
  buildSellerShopPageSeo,
  buildSellerShopStructuredData,
} from '../src/lib/sellerShopSeo.js'
import {
  EQUIPD_ORGANIZATION_ID,
  EQUIPD_SEARCH_URL_TEMPLATE,
  buildOrganizationSchema,
  buildWebsiteSchema,
  buildSiteStructuredDataGraph,
} from '../src/lib/siteStructuredData.js'
import {
  EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH,
  buildSocialOpenGraph,
  getEquipdDefaultSocialImageUrl,
} from '../src/lib/socialPreview.js'
import { buildValuationSeoDocument } from '../src/lib/valuationPageSeo.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const activeListing = {
  id: 'a1',
  slug: 'life-fitness-treadmill-london',
  status: 'active',
  title: 'Life Fitness treadmill for sale',
  description: 'Solid commercial treadmill.\nColour: Silver',
  brand: 'Life Fitness',
  model: 'T5',
  condition: 'good',
  price_pence: 120000,
  quantity_available: 1,
  city: 'London',
  category: { name: 'Treadmill' },
  primary_image_url: 'https://cdn.example.com/listings/lf-t5.jpg',
  published_at: '2026-06-01T00:00:00.000Z',
}

const soldListing = {
  ...activeListing,
  id: 's1',
  slug: 'life-fitness-treadmill-london-sold',
  status: 'sold',
  sold_at: '2026-07-01T00:00:00.000Z',
  price_pence: 120000,
}

// --- Titles ---
assertEqual(
  buildListingPageSeoTitle(activeListing),
  'Used Life Fitness T5 Treadmill for Sale',
  'active listing title',
)
assertEqual(
  buildListingPageSeoTitle(soldListing, { sold: true }),
  'Sold Life Fitness T5 Treadmill',
  'sold listing title',
)
assert(
  buildEquipmentPageTitle({
    brand: 'Technogym',
    model: 'Excite Run',
    equipment_type: 'Treadmill',
  }).includes('Used Value & Price Guide'),
  'equipment title suffix',
)
assertEqual(
  buildBrandPageMetaTitle('Precor'),
  'Used Precor Gym Equipment Values & Listings',
  'brand title without site suffix',
)
assertEqual(
  formatPageTitle(buildBrandPageMetaTitle('Precor')),
  'Used Precor Gym Equipment Values & Listings | Equipd',
  'brand title formats once with Equipd',
)
assertEqual(
  stripSiteTitleSuffix('Used Precor Gym Equipment Values & Listings | Equipd'),
  'Used Precor Gym Equipment Values & Listings',
  'stripSiteTitleSuffix removes trailing Equipd',
)

// --- Listing Product / Offer ---
const activeProduct = buildListingProductSchema({ listing: activeListing })
assertEqual(activeProduct['@type'], 'Product', 'active Product')
assert(activeProduct.offers, 'active has Offer')
assertEqual(activeProduct.offers['@type'], 'Offer', 'Offer type')
assertEqual(activeProduct.color, 'Silver', 'colour from description')
assert(!JSON.stringify(activeProduct).toLowerCase().includes('aggregateoffer'), 'no AggregateOffer')
assertEqual(activeProduct.offers.availability, 'https://schema.org/InStock', 'InStock only')

const soldProduct = buildListingProductSchema({ listing: soldListing })
assert(soldProduct, 'sold Product present')
assert(!('offers' in soldProduct), 'sold omits Offer')
assert(!JSON.stringify(soldProduct).includes('SoldOut'), 'no SoldOut')

const graph = buildListingPageStructuredData({
  listing: activeListing,
  breadcrumbSchema: buildListingBreadcrumbSchema(activeListing),
})
assertEqual(graph.productCount, 1, 'one Product in listing graph')
assertEqual(findBreadcrumbSchemas(graph.jsonLd).length, 1, 'one BreadcrumbList in listing graph')

// --- Sold OG wording ---
const soldSeo = buildListingPageSeo({ listing: soldListing, now: new Date('2026-07-15T00:00:00.000Z') })
assert(soldSeo.titleWithSite.startsWith('Sold '), 'sold og title')
assert(soldSeo.description.includes('has now sold'), 'sold description wording')
assert(!/for sale|buy now/i.test(soldSeo.openGraph['og:description']), 'sold og description not active')
assertEqual(soldSeo.openGraph['og:url'], soldSeo.canonicalUrl, 'og:url matches canonical')
assertEqual(soldSeo.openGraph['twitter:card'], 'summary_large_image', 'twitter large card')

// --- Social fallback ---
assert(getEquipdDefaultSocialImageUrl().endsWith(EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH), 'default OG path')
const og = buildSocialOpenGraph({
  title: 'Test',
  description: 'Desc',
  url: 'https://www.equipd.co.uk/',
  fallbackImage: true,
})
assert(og['og:image'].includes('sell-gym-equipment-og.png'), 'fallback OG image')

// --- Breadcrumbs ---
const listingCrumbs = buildListingBreadcrumbSchema(activeListing, {
  categoryName: 'Treadmills',
  categoryPath: '/browse?category=treadmills',
})
const listingNames = listingCrumbs.itemListElement.map((i) => i.name)
assertEqual(listingNames[0], 'Home', 'listing crumb Home')
assertEqual(listingNames[1], 'Browse', 'listing crumb Browse')
assertEqual(listingNames[2], 'Treadmills', 'listing crumb category')
assertEqual(listingNames.length, 3, 'listing crumb trail stops at category')
assert(
  !listingNames.includes(activeListing.title),
  'listing title is not repeated in breadcrumbs',
)

const brandCrumbs = buildBrandPageBreadcrumbSchema({
  displayName: 'Precor',
  slug: 'precor',
})
assertEqual(brandCrumbs.itemListElement[0].name, 'Home', 'brand Home')
assertEqual(brandCrumbs.itemListElement[1].name, 'Equipment Values', 'brand parent')
assertEqual(brandCrumbs.itemListElement[2].name, 'Precor', 'brand leaf')

const equipmentCrumbs = buildEquipmentBreadcrumbSchema(null, {
  brandDisplayName: 'Precor',
  brandSlug: 'precor',
  productName: 'Precor TRM 885',
  productUrl: '/equipment/precor/precor-trm-885',
})
assert(equipmentCrumbs.itemListElement.some((i) => i.name === 'Precor'), 'equipment brand crumb')
assertEqual(equipmentCrumbs.itemListElement.at(-1).name, 'Precor TRM 885', 'equipment leaf')

// --- Site schema ---
const org = buildOrganizationSchema()
const website = buildWebsiteSchema()
assertEqual(org['@id'], EQUIPD_ORGANIZATION_ID, 'stable Organization @id')
assertEqual(website['@id'], 'https://www.equipd.co.uk/#website', 'stable WebSite @id')
assertEqual(website.publisher['@id'], EQUIPD_ORGANIZATION_ID, 'WebSite references Organization')
assertEqual(
  website.potentialAction.target.urlTemplate,
  EQUIPD_SEARCH_URL_TEMPLATE,
  'SearchAction retained to real browse search',
)
const siteGraph = buildSiteStructuredDataGraph()
assertEqual(siteGraph.filter((n) => n['@type'] === 'Organization').length, 1, 'one Organization')
assertEqual(siteGraph.filter((n) => n['@type'] === 'WebSite').length, 1, 'one WebSite')

// --- FAQ only when items present ---
assertEqual(buildFaqPageSchema([]), null, 'no FAQ schema without items')
assertEqual(buildFaqPageSchema(null), null, 'no FAQ schema for null')
const faqResult = buildFaqPageSchema([
  { question: 'How do I sell?', answer: 'Create a listing on Equipd.' },
])
assertEqual(faqResult.schema['@type'], 'FAQPage', 'FAQPage when Q&A present')
assertEqual(faqResult.schema.mainEntity[0].name, 'How do I sell?', 'FAQ question matches')
assertEqual(faqResult.schema.mainEntity[0].acceptedAnswer.text, 'Create a listing on Equipd.', 'FAQ answer matches')

// --- Valuation landing (no FAQ schema) ---
const valuationDoc = buildValuationSeoDocument()
assertEqual(valuationDoc.path, '/valuation', 'valuation path')
assert(valuationDoc.title.includes('Instant Equipment Valuation'), 'valuation title')
assert(valuationDoc.openGraph['og:image'], 'valuation og image')
assert(!JSON.stringify(valuationDoc.jsonLd).includes('FAQPage'), 'valuation has no FAQPage')

// --- Seller shop: AggregateRating only with real reviews ---
const shopProfile = { id: 'u1', username: 'fitclearance', display_name: 'Fit Clearance' }
const shopNoReviews = buildSellerShopStructuredData(shopProfile, {
  reviewSummary: { averageRating: null, reviewCount: 0 },
})
assertEqual(shopNoReviews['@type'], 'ProfilePage', 'ProfilePage for public shop')
assert(!('aggregateRating' in shopNoReviews.mainEntity), 'no AggregateRating without reviews')

const shopWithReviews = buildSellerShopStructuredData(shopProfile, {
  reviewSummary: { averageRating: 4.5, reviewCount: 3 },
  completedSalesCount: 5,
})
assertEqual(shopWithReviews.mainEntity.aggregateRating['@type'], 'AggregateRating', 'AggregateRating when reviews real')
assertEqual(shopWithReviews.mainEntity.aggregateRating.reviewCount, 3, 'reviewCount real')
assert(!JSON.stringify(shopWithReviews).includes('"@type":"Review"'), 'no individual Review entities')

const shopSeo = buildSellerShopPageSeo(shopProfile, {
  listingCount: 2,
  reviewSummary: { averageRating: 4.5, reviewCount: 3 },
})
assert(shopSeo.titleWithSite.includes('fitclearance'), 'shop title uses public username')
assert(shopSeo.openGraph['og:image'], 'shop OG image present')

// Equipment Product must not carry marketplace Offer
const equipmentProduct = buildEquipmentProductJsonLd({
  brand: 'Precor',
  model: 'TRM 885',
  equipment_type: 'Treadmill',
  slug: 'precor-trm-885',
  brand_slug: 'precor',
  canonical_product_key: 'precor:trm-885',
  status: 'approved',
})
assert(equipmentProduct, 'equipment Product')
assert(!('offers' in equipmentProduct), 'equipment Product has no Offer')

console.log('test-search-appearance: ok')
