/**
 * Phase 2A focused checks — Buy Used Gym Equipment marketplace hub.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUY_EQUIPMENT_TYPE_HEADING,
  BUY_EQUIPMENT_TYPES,
  BUY_FEATURED_BRAND_SLUGS,
  BUY_LISTINGS_HEADING,
  BUY_USED_GYM_EQUIPMENT_H1,
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
  BUY_USED_GYM_EQUIPMENT_META_TITLE,
  BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
  buildBuyUsedGymEquipmentCollectionSchema,
  buildBuyUsedGymEquipmentSeoDocument,
} from '../src/lib/buyUsedGymEquipmentPage.js'
import { getBrandPagePath } from '../src/lib/brandCatalogueCore.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const listings = Array.from({ length: 14 }, (_, index) => ({
  status: 'active',
  slug: `phase2a-listing-${index + 1}`,
  title: `Phase 2A Listing ${index + 1}`,
  published_at: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
}))

const doc = buildBuyUsedGymEquipmentSeoDocument({ listings })
const listingHrefs = [...doc.bodyHtml.matchAll(/href="(\/listings\/[^"]+)"/g)].map((m) => m[1])

assert(listingHrefs.length === 12, `prerender exposes up to 12 listing links (got ${listingHrefs.length})`)
assert(doc.bodyHtml.indexOf(BUY_LISTINGS_HEADING) < doc.bodyHtml.indexOf('How buying on Equipd works'), 'inventory before journey in prerender')
assert(
  doc.bodyHtml.indexOf('How buying on Equipd works') < doc.bodyHtml.indexOf('Shop used gym equipment by type'),
  'journey before equipment types in prerender',
)
assert(doc.bodyHtml.includes(`<h1>${BUY_USED_GYM_EQUIPMENT_H1}</h1>`), 'H1 Buy Used Gym Equipment')
assert(!/thousands of listings/i.test(BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION), 'meta has no thousands claim')
assert(!/thousands of listings/i.test(doc.bodyHtml), 'body has no thousands claim')

for (const category of BUY_EQUIPMENT_TYPES) {
  assert(doc.bodyHtml.includes(`href="${category.to}"`), `equipment type ${category.to}`)
}

for (const slug of BUY_FEATURED_BRAND_SLUGS) {
  assert(doc.bodyHtml.includes(`href="${getBrandPagePath(slug)}"`), `brand ${slug}`)
}

assert(doc.bodyHtml.includes('/commercial-gym-equipment'), 'commercial hub')
assert(doc.bodyHtml.includes('/home-gym-equipment'), 'home hub')
assert(doc.bodyHtml.includes('/commercial-cardio-equipment'), 'commercial cardio child')
assert(doc.bodyHtml.includes('/home-strength-equipment'), 'home strength child')

const collection = buildBuyUsedGymEquipmentCollectionSchema(listings)
assert(collection['@type'] === 'CollectionPage', 'CollectionPage')
assert(collection.mainEntity.itemListElement.length === 12, 'ItemList capped at 12')

const pageJsx = readFileSync(join(process.cwd(), 'src', 'pages', 'BuyUsedGymEquipmentPage.jsx'), 'utf8')
const start = pageJsx.indexOf('export default function BuyUsedGymEquipmentPage')
const renderJsx = pageJsx.slice(start)
const heroIdx = renderJsx.indexOf('buy-page__hero')
const listingsIdx = renderJsx.indexOf('commercial-page__listings-section')
const journeyIdx = renderJsx.indexOf('buy-page__journey-section')
const typesIdx = renderJsx.indexOf('buy-types-heading')
const guideIdx = renderJsx.indexOf('<BuySeoSection')
assert(heroIdx > 0 && listingsIdx > heroIdx, 'hero before inventory')
assert(journeyIdx > listingsIdx, 'journey directly after inventory block')
assert(typesIdx > journeyIdx, 'equipment types after journey')
assert(guideIdx > typesIdx, 'guide after discovery')
assert(
  doc.bodyHtml.indexOf(BUY_LISTINGS_HEADING)
    < doc.bodyHtml.indexOf('How buying on Equipd works')
    && doc.bodyHtml.indexOf('How buying on Equipd works')
      < doc.bodyHtml.indexOf(BUY_EQUIPMENT_TYPE_HEADING),
  'prerender order: listings → journey → types',
)

const sellJsx = readFileSync(join(process.cwd(), 'src', 'pages', 'SellGymEquipmentPage.jsx'), 'utf8')
assert(sellJsx.includes('Create a Listing'), 'sell page still present')
assert(!sellJsx.includes('BUY_LISTINGS_HEADING'), 'sell page not converted to buy inventory hub')

console.log('Phase 2A Buy hub checks: ok')
console.log(
  JSON.stringify(
    {
      title: BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
      metaTitle: BUY_USED_GYM_EQUIPMENT_META_TITLE,
      h1: BUY_USED_GYM_EQUIPMENT_H1,
      meta: BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
      prerenderListingLinks: listingHrefs.length,
      equipmentTypes: BUY_EQUIPMENT_TYPES.map((item) => item.to),
      brands: BUY_FEATURED_BRAND_SLUGS.map((slug) => getBrandPagePath(slug)),
    },
    null,
    2,
  ),
)
