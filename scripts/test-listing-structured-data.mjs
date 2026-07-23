/**
 * Stage 2 — marketplace listing Product + Offer structured data.
 */
import { LISTING_CONDITIONS } from '../src/lib/constants.js'
import { buildListingBreadcrumbSchema } from '../src/lib/breadcrumbStructuredData.js'
import { buildEquipmentProductJsonLd } from '../src/lib/equipmentPageSeo.js'
import {
  buildListingOfferSchema,
  buildListingPageStructuredData,
  buildListingProductSchema,
  buildListingSellerSchema,
  formatListingOfferPrice,
  isListingGenuinelyPurchasable,
  isMarketplaceListingProductSchema,
  LISTING_CONDITION_SCHEMA_URLS,
  LISTING_OFFER_CURRENCY,
  looksLikeCatalogueProductSchema,
  mapListingConditionToSchemaOrg,
  resolveListingSchemaImageUrls,
  resolveListingSchemaSellerName,
} from '../src/lib/listingPageStructuredData.js'
import { findProductSchemas } from '../src/lib/productPageStructuredData.js'
import { findBreadcrumbSchemas } from '../src/lib/breadcrumbStructuredData.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertNull(actual, label) {
  if (actual != null) throw new Error(`${label}: expected null, got ${JSON.stringify(actual)}`)
}

const completeListing = {
  id: 'listing-1',
  slug: 'proform-tour-de-france-clc-manchester',
  status: 'active',
  title: 'Great bike for sale cheap!!!',
  description: 'Well maintained ProForm Tour de France CLC. Collection preferred.',
  brand: 'ProForm',
  model: 'Tour de France CLC',
  condition: 'good',
  price_pence: 45000,
  quantity_available: 2,
  city: 'Manchester',
  category: { name: 'Exercise Bike' },
  primary_image_url: 'https://cdn.example.com/listings/proform-1.jpg',
  listing_images: [
    { url: 'https://cdn.example.com/listings/proform-1.jpg', sort_order: 0 },
    { url: 'https://cdn.example.com/listings/proform-2.jpg', sort_order: 1 },
    { url: 'https://cdn.example.com/listings/proform-1.jpg', sort_order: 2 },
  ],
  seller_id: 'seller-1',
}

const minimalListing = {
  id: 'listing-2',
  slug: 'basic-treadmill',
  status: 'active',
  title: 'Treadmill',
  description: null,
  brand: null,
  model: null,
  condition: null,
  price_pence: 9900,
  quantity_available: 1,
  listing_images: [],
  primary_image_url: null,
}

const sellerProfile = {
  id: 'seller-1',
  username: 'gymclearance',
  display_name: 'Gym Clearance UK',
  email: 'private@example.com',
  phone: '07700900000',
}

// 1. Active listing with complete data
const completeProduct = buildListingProductSchema({
  listing: completeListing,
  sellerProfile,
})
assert(completeProduct['@type'] === 'Product', 'complete: Product type')
assert(completeProduct['@context'] === 'https://schema.org', 'complete: context')
assertEqual(
  completeProduct['@id'],
  'https://www.equipd.co.uk/listings/proform-tour-de-france-clc-manchester#product',
  'complete: stable product @id',
)
assertEqual(
  completeProduct.url,
  'https://www.equipd.co.uk/listings/proform-tour-de-france-clc-manchester',
  'complete: canonical url',
)
assertEqual(
  completeProduct.name,
  'ProForm Tour de France CLC Exercise Bike',
  'complete: structured name',
)
assert(
  completeProduct.description.includes('Well maintained ProForm'),
  'complete: uses seller description',
)
assert(completeProduct.brand?.['@type'] === 'Brand', 'complete: Brand object')
assertEqual(completeProduct.brand.name, 'ProForm', 'complete: brand name')
assertEqual(completeProduct.model, 'Tour de France CLC', 'complete: model')
assertEqual(completeProduct.category, 'Exercise Bike', 'complete: category')
assertEqual(
  completeProduct.itemCondition,
  'https://schema.org/UsedCondition',
  'complete: itemCondition',
)
assert(completeProduct.offers?.['@type'] === 'Offer', 'complete: Offer present')
assertEqual(
  completeProduct.offers['@id'],
  'https://www.equipd.co.uk/listings/proform-tour-de-france-clc-manchester#offer',
  'complete: stable offer @id',
)
assertEqual(completeProduct.offers.availability, 'https://schema.org/InStock', 'complete: InStock')
assertEqual(completeProduct.offers.seller.name, 'gymclearance', 'complete: public seller name')

// 2. Active listing with minimal data
const minimalProduct = buildListingProductSchema({ listing: minimalListing })
assertEqual(minimalProduct.name, 'Treadmill', 'minimal: seller title fallback')
assert(!('brand' in minimalProduct), 'minimal: omits brand')
assert(!('model' in minimalProduct), 'minimal: omits model')
assert(!('category' in minimalProduct), 'minimal: omits category')
assert(!('itemCondition' in minimalProduct), 'minimal: omits unknown condition')
assert(!('image' in minimalProduct), 'minimal: omits missing image')
assert(minimalProduct.offers?.['@type'] === 'Offer', 'minimal: still has Offer when purchasable')
assert(!('seller' in minimalProduct.offers), 'minimal: omits seller without profile')

// 3–4. Price and currency + listing price source
assertEqual(formatListingOfferPrice(completeListing), '450', 'price: whole pounds as integer string')
assertEqual(formatListingOfferPrice({ price_pence: 4599 }), '45.99', 'price: fractional pounds')
assertEqual(completeProduct.offers.price, '450', 'offer uses listing price_pence')
assertEqual(completeProduct.offers.priceCurrency, LISTING_OFFER_CURRENCY, 'offer currency GBP')
assertEqual(completeProduct.offers.priceCurrency, 'GBP', 'currency is GBP')
assert(completeProduct.offers.price !== '495', 'price is not Buyer Protection total')
assertEqual(Number(completeProduct.offers.price) * 100, completeListing.price_pence, 'price aligns with pence')

// 5. Condition mapping for every supported condition
assertEqual(LISTING_CONDITIONS.length, 5, 'five supported listing conditions')
for (const { value } of LISTING_CONDITIONS) {
  const mapped = mapListingConditionToSchemaOrg(value)
  assert(mapped === LISTING_CONDITION_SCHEMA_URLS[value], `condition mapped: ${value}`)
  assert(mapped.startsWith('https://schema.org/'), `condition is schema.org URL: ${value}`)
}
assertEqual(mapListingConditionToSchemaOrg('new'), 'https://schema.org/NewCondition', 'new → NewCondition')
assertEqual(mapListingConditionToSchemaOrg('like_new'), 'https://schema.org/UsedCondition', 'like_new → Used')
assertEqual(mapListingConditionToSchemaOrg('good'), 'https://schema.org/UsedCondition', 'good → Used')
assertEqual(mapListingConditionToSchemaOrg('fair'), 'https://schema.org/UsedCondition', 'fair → Used')
assertEqual(mapListingConditionToSchemaOrg('poor'), 'https://schema.org/UsedCondition', 'poor → Used')
assertNull(mapListingConditionToSchemaOrg('refurbished'), 'unknown refurbished omitted')
assertNull(mapListingConditionToSchemaOrg('damaged'), 'unknown damaged omitted')
assertNull(mapListingConditionToSchemaOrg(''), 'empty condition omitted')

// 6. In-stock for genuinely available
assert(isListingGenuinelyPurchasable(completeListing), 'purchasable: active with stock')
assertEqual(completeProduct.offers.availability, 'https://schema.org/InStock', 'InStock when available')

// 7. No Offer for inactive listing
const soldProduct = buildListingProductSchema({
  listing: { ...completeListing, status: 'sold' },
  sellerProfile,
})
assert(soldProduct, 'sold: Product still built for Stage 5 readiness')
assert(!('offers' in soldProduct), 'sold: no Offer')
assertNull(
  buildListingOfferSchema({ listing: { ...completeListing, status: 'draft' } }),
  'draft: no Offer',
)
assertNull(
  buildListingOfferSchema({ listing: { ...completeListing, status: 'reserved' } }),
  'reserved: no Offer',
)

// 8. No Offer when not genuinely purchasable
assert(
  !isListingGenuinelyPurchasable({ ...completeListing, quantity_available: 0 }),
  'qty 0 not purchasable',
)
assertNull(
  buildListingOfferSchema({ listing: { ...completeListing, quantity_available: 0 } }),
  'qty 0: no Offer',
)
assertNull(
  buildListingOfferSchema({ listing: { ...completeListing, price_pence: 0 } }),
  'zero price: no Offer',
)
assert(
  isListingGenuinelyPurchasable({ ...completeListing, quantity_available: null }),
  'active with unknown qty still purchasable (page allows contact)',
)

// 9. Seller public-data handling
assertEqual(resolveListingSchemaSellerName(sellerProfile), 'gymclearance', 'prefers username')
assertEqual(
  resolveListingSchemaSellerName({ display_name: 'Only Display' }),
  'Only Display',
  'falls back to display_name',
)
assertNull(resolveListingSchemaSellerName({}), 'omits empty profile')
assertNull(resolveListingSchemaSellerName(null), 'omits null profile')
const sellerSchema = buildListingSellerSchema(sellerProfile)
assertEqual(sellerSchema['@type'], 'Person', 'seller Person')
assert(!('email' in sellerSchema), 'no seller email')
assert(!('telephone' in sellerSchema), 'no seller phone')
assert(!('id' in sellerSchema), 'no private seller id')
assert(!JSON.stringify(completeProduct).includes('private@example.com'), 'no email in product graph')
assert(!JSON.stringify(completeProduct).includes('07700900000'), 'no phone in product graph')

// 10–11. Image ordering, dedup, missing
assert.deepEqual = undefined
const images = resolveListingSchemaImageUrls(completeListing)
assertEqual(images.length, 2, 'images deduped to 2')
assertEqual(images[0], 'https://cdn.example.com/listings/proform-1.jpg', 'primary first')
assertEqual(images[1], 'https://cdn.example.com/listings/proform-2.jpg', 'second image')
assert(Array.isArray(completeProduct.image), 'multiple images as array')
assertEqual(completeProduct.image.length, 2, 'product image count')
assertEqual(
  resolveListingSchemaImageUrls(minimalListing).length,
  0,
  'no images when missing',
)
assert(
  !resolveListingSchemaImageUrls({
    listing_images: [{ storage_path: 'user/1/a.jpg', url: null }],
  }).length,
  'rejects storage paths without public url',
)
assert(
  !resolveListingSchemaImageUrls({
    primary_image_url: 'not-a-url',
  }).length,
  'rejects invalid urls',
)

// 12. Missing optional brand/model/category already covered by minimalProduct

// 13–14. Stable @id + canonical — covered above

// 15–16. Exactly one Product + one BreadcrumbList
const breadcrumb = buildListingBreadcrumbSchema(completeListing)
const bundle = buildListingPageStructuredData({
  listing: completeListing,
  sellerProfile,
  breadcrumbSchema: breadcrumb,
})
assertEqual(bundle.productCount, 1, 'exactly one Product')
assertEqual(bundle.breadcrumbCount, 1, 'exactly one BreadcrumbList')
assertEqual(findProductSchemas(bundle.jsonLd).length, 1, 'findProductSchemas count 1')
assertEqual(findBreadcrumbSchemas(bundle.jsonLd).length, 1, 'findBreadcrumbSchemas count 1')

// 17. No catalogue Product duplication
assert(isMarketplaceListingProductSchema(completeProduct), 'listing product is marketplace-shaped')
assert(!looksLikeCatalogueProductSchema(completeProduct), 'listing product is not catalogue-shaped')
assert(
  !String(completeProduct['@id']).includes('/brands/'),
  'listing @id is not catalogue brand path',
)

const catalogueProduct = {
  id: 'lf1',
  brand: 'Life Fitness',
  status: 'approved',
  equipment_type: 'Treadmill',
  model: 'Integrity Series Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
  canonical_product_key: 'life-fitness-integrity-series-treadmill',
  image_status: 'approved',
  image_url: 'https://cdn.example.com/lf.jpg',
}
const catalogueLd = buildEquipmentProductJsonLd(catalogueProduct)
assert(catalogueLd, 'catalogue product builds')
assert(looksLikeCatalogueProductSchema(catalogueLd), 'catalogue helper produces catalogue Product')
assert(!isMarketplaceListingProductSchema(catalogueLd), 'catalogue Product is not marketplace listing')

const mixed = [completeProduct, catalogueLd, breadcrumb]
assertEqual(findProductSchemas(mixed).length, 2, 'two Products if both wrongly combined')
assert(
  findProductSchemas([completeProduct, breadcrumb]).length === 1
  && !findProductSchemas([completeProduct, breadcrumb]).some(looksLikeCatalogueProductSchema),
  'listing page graph must only include marketplace Product',
)

// Mapped equipment supplies brand/model only — still marketplace @id
const mappedProduct = buildListingProductSchema({
  listing: {
    ...minimalListing,
    title: 'Seller free text only',
  },
  equipmentProduct: {
    brand: 'Technogym',
    model: 'Element Chest Press',
    equipment_type: 'Chest Press',
    canonical_product_name: 'Technogym Element Chest Press',
  },
})
assert(isMarketplaceListingProductSchema(mappedProduct), 'mapped listing stays marketplace Product')
assert(mappedProduct.name.includes('Technogym'), 'mapped name can use intelligence fields')
assert(!looksLikeCatalogueProductSchema(mappedProduct), 'mapped listing is not catalogue Product')

// 18. No invented SKU/GTIN/MPN
assert(!('sku' in completeProduct), 'no sku')
assert(!('gtin' in completeProduct), 'no gtin')
assert(!('gtin13' in completeProduct), 'no gtin13')
assert(!('mpn' in completeProduct), 'no mpn')
assert(!('aggregateRating' in completeProduct), 'no aggregateRating')

// 19. Schema values match visible listing fields
assertEqual(completeProduct.brand.name, completeListing.brand, 'brand matches listing')
assertEqual(completeProduct.model, completeListing.model, 'model matches listing')
assertEqual(completeProduct.category, completeListing.category.name, 'category matches listing')
assertEqual(Number(completeProduct.offers.price) * 100, completeListing.price_pence, 'price matches pence')

// 20. No private seller data — covered in seller section

// 21. Colour from description extras (visible on listing page)
const colouredListing = {
  ...completeListing,
  description: 'Well maintained bike.\nColour: Matte Black\nDimensions (L×W×H cm): 150 × 60 × 120',
}
const colouredProduct = buildListingProductSchema({ listing: colouredListing })
assertEqual(colouredProduct.color, 'Matte Black', 'color from Colour: description line')
assert(
  colouredProduct.additionalProperty?.some((p) => p.name === 'Colour' && p.value === 'Matte Black'),
  'Colour additionalProperty from description',
)
assert(!String(colouredProduct.description || '').includes('Colour:'), 'schema description strips Colour line')
assert(!String(colouredProduct.description || '').includes('Dimensions'), 'schema description strips Dimensions line')

console.log('test-listing-structured-data: ok')
