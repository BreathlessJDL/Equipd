/**
 * Unit checks for /buy-used-gym-equipment marketplace hub (Phase 2A).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { formatPageTitle } from '../src/lib/pageTitles.js'
import {
  BROWSE_PATH,
  BUY_BENEFITS,
  BUY_CONTEXT_HUBS,
  BUY_EQUIPMENT_TYPES,
  BUY_FAQ_ITEMS,
  BUY_FEATURED_BRAND_SLUGS,
  BUY_GUIDE_LINKS,
  BUY_HERO_ARTWORK,
  BUY_HERO_TRUST_ITEMS,
  BUY_JOURNEY_STEPS,
  BUY_LISTINGS_HEADING,
  BUY_LISTINGS_LIMIT,
  BUY_USED_GYM_EQUIPMENT_H1,
  BUY_USED_GYM_EQUIPMENT_LEAD,
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
  BUY_USED_GYM_EQUIPMENT_META_TITLE,
  BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
  BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
  BUY_USED_GYM_EQUIPMENT_PATH,
  BUY_VALUATION_STEPS,
  buildBuyUsedGymEquipmentBreadcrumbSchema,
  buildBuyUsedGymEquipmentCollectionSchema,
  buildBuyUsedGymEquipmentFaqSchema,
  buildBuyUsedGymEquipmentSeoDocument,
  buildBuyUsedGymEquipmentWebPageSchema,
  mapBuyHubListingsForSeo,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
} from '../src/lib/buyUsedGymEquipmentPage.js'
import { injectSeoIntoHtml } from '../src/lib/seoCataloguePrerender.js'
import { normalizeFaqItems } from '../src/lib/faqPageStructuredData.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const sampleListings = [
  {
    status: 'active',
    slug: 'life-fitness-treadmill-demo-1',
    title: 'Life Fitness Treadmill',
    published_at: '2026-09-01T12:00:00.000Z',
  },
  {
    status: 'active',
    slug: 'concept2-rower-demo-2',
    title: 'Concept2 Model D',
    published_at: '2026-09-02T12:00:00.000Z',
  },
  {
    status: 'draft',
    slug: 'should-not-appear',
    title: 'Draft Listing',
    published_at: '2026-09-03T12:00:00.000Z',
  },
  {
    status: 'active',
    is_test_data: true,
    slug: 'test-should-not-appear',
    title: 'Test Listing',
    published_at: '2026-09-04T12:00:00.000Z',
  },
]

const doc = buildBuyUsedGymEquipmentSeoDocument({ listings: sampleListings })

assert(doc.path === BUY_USED_GYM_EQUIPMENT_PATH, 'canonical path')
assert(doc.title === BUY_USED_GYM_EQUIPMENT_PAGE_TITLE, 'document title')
assert(doc.description === BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION, 'meta description')
assert(doc.canonicalPath === '/buy-used-gym-equipment', 'canonical path field')
assert(doc.openGraph?.['og:title'] === BUY_USED_GYM_EQUIPMENT_PAGE_TITLE, 'open graph title')
assert(
  doc.openGraph?.['og:image']?.endsWith('/buy-used-gym-equipment/buy-used-gym-equipment-og.png'),
  'dedicated open graph image',
)
assert(doc.robots === 'index, follow, max-image-preview:large', 'robots directive')
assert(doc.bodyHtml.includes(`<h1>${BUY_USED_GYM_EQUIPMENT_H1}</h1>`), 'single H1 in prerender body')
assert((doc.bodyHtml.match(/<h1/g) || []).length === 1, 'only one H1 in prerender body')
assert(doc.bodyHtml.includes(BROWSE_PATH), 'browse link in prerender')
assert(doc.bodyHtml.includes(VALUATION_PATH), 'valuation link in prerender')
assert(doc.bodyHtml.includes(SELL_GYM_EQUIPMENT_PATH), 'sell cross-link in prerender')
assert(doc.bodyHtml.includes(BUY_LISTINGS_HEADING), 'listings heading in prerender')
assert(doc.bodyHtml.includes('/listings/concept2-rower-demo-2'), 'crawlable listing link newest first')
assert(doc.bodyHtml.includes('/listings/life-fitness-treadmill-demo-1'), 'second crawlable listing link')
assert(!doc.bodyHtml.includes('/listings/should-not-appear'), 'draft listings excluded')
assert(!doc.bodyHtml.includes('/listings/test-should-not-appear'), 'test listings excluded')
assert(
  (doc.bodyHtml.match(/href="\/listings\//g) || []).length === 2,
  'exactly two active listing links prerendered from sample',
)
assert(doc.bodyHtml.includes('/used-commercial-treadmills'), 'equipment type SEO link')
assert(doc.bodyHtml.includes('/brands/life-fitness'), 'brand SEO link')
assert(doc.bodyHtml.includes('/commercial-gym-equipment'), 'commercial hub link')
assert(doc.bodyHtml.includes('/home-gym-equipment'), 'home hub link')
assert(!doc.bodyHtml.includes('/browse?category=treadmill'), 'no browse category filter cannibalisation')
assert(!doc.bodyHtml.includes('/browse?rating=full_commercial'), 'no browse rating filter cannibalisation')
assert(!/thousands of listings/i.test(doc.bodyHtml), 'no unsupported inventory claim in body')
assert(
  !/thousands of listings/i.test(BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION),
  'no unsupported inventory claim in meta',
)
assert(doc.bodyHtml.includes('Buyer Protection fee'), 'checkout journey mentions Buyer Protection fee')
assert(!doc.bodyHtml.includes('Seller Service Fee'), 'no seller fee on buyer page')
assert(
  /not an automatic return policy/i.test(doc.bodyHtml),
  'clarifies Buyer Protection is not automatic returns',
)
assert(!/verified sellers/i.test(doc.bodyHtml), 'no verified-sellers claim')

assert(
  formatPageTitle(BUY_USED_GYM_EQUIPMENT_META_TITLE) === doc.title,
  'React page title matches prerender title',
)

const journeyTitles = BUY_JOURNEY_STEPS.map((step) => step.title)
assert(journeyTitles[0] === 'Find your equipment', 'step 1 title')
assert(journeyTitles[1] === 'Agree a price', 'step 2 title')
assert(journeyTitles[2] === 'Secure your purchase', 'step 3 title')
assert(journeyTitles[3] === 'Collect with confidence', 'step 4 title')

for (const step of BUY_JOURNEY_STEPS) {
  assert(step.imageSrc.startsWith('/images/buy/'), `journey image path: ${step.title}`)
  assert(step.imageSrc.endsWith('.webp'), `journey image uses webp: ${step.title}`)
  assert(step.imageSrcMobile?.endsWith('-800.webp'), `mobile webp present: ${step.title}`)
  assert(step.imageWidth === 1536 && step.imageHeight === 1024, `consistent 3:2 size: ${step.title}`)
  assert(step.imageAlt, `journey alt text: ${step.title}`)
}

assert(BUY_VALUATION_STEPS.length === 4, 'valuation journey has four steps')
assert(BUY_BENEFITS.length === 3, 'three buyer benefits')
assert(BUY_FAQ_ITEMS.length === 11, 'eleven visible FAQs')
assert(BUY_LISTINGS_LIMIT === 12, 'hub shows up to 12 listings')
assert(BUY_EQUIPMENT_TYPES.length >= 8 && BUY_EQUIPMENT_TYPES.length <= 12, 'curated equipment types')
assert(BUY_FEATURED_BRAND_SLUGS.includes('life-fitness'), 'Life Fitness brand included')
assert(BUY_FEATURED_BRAND_SLUGS.includes('concept2'), 'Concept2 brand included')
assert(BUY_CONTEXT_HUBS.length === 2, 'commercial + home context hubs')

assert(
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION.length >= 140
    && BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION.length <= 170,
  'meta description length',
)
assert(doc.bodyHtml.includes('commercial gym equipment for sale'), 'commercial category link in prerender')
assert(doc.bodyHtml.includes('Buyer Protection after confirmed handover'), 'guide highlights in prerender')
assert(
  BUY_HERO_TRUST_ITEMS.join('|') ===
    'Buyer Protection|Secure payments|Sellers across the UK',
  'hero trust items',
)

assert(BUY_USED_GYM_EQUIPMENT_H1 === 'Buy Used Gym Equipment', 'H1 owns buy intent')
assert(BUY_USED_GYM_EQUIPMENT_LEAD.includes('Browse used gym equipment'), 'hero lead is transactional')

const mapped = mapBuyHubListingsForSeo(sampleListings)
assert(mapped.length === 2, 'mapBuyHubListingsForSeo filters inactive')
assert(mapped[0].href === '/listings/concept2-rower-demo-2', 'newest listing first')

const protectionFaq = BUY_FAQ_ITEMS.find((item) => item.question === 'How does Buyer Protection work?')
assert(/24-hour/i.test(protectionFaq?.answer || ''), '24-hour protection wording')

const pageJsx = readFileSync(join(process.cwd(), 'src', 'pages', 'BuyUsedGymEquipmentPage.jsx'), 'utf8')
assert(pageJsx.includes('ListingCard'), 'ListingCard reused for inventory')
assert(pageJsx.includes('BUY_LISTINGS_HEADING'), 'listings section rendered')
assert(pageJsx.includes('fetchActiveListings'), 'active listings fetch')
assert(pageJsx.includes('listing-card-grid'), 'homepage-style listing grid')
assert(pageJsx.includes('BUY_EQUIPMENT_TYPES'), 'equipment type destinations')
assert(pageJsx.includes('BUY_FEATURED_BRAND_SLUGS'), 'brand destinations')
assert(pageJsx.includes('BUY_CONTEXT_HUBS'), 'commercial/home discovery')
assert(pageJsx.includes('WANTED_REQUEST_SOURCES.BUY_PAGE'), 'wanted flow reused')
assert(pageJsx.includes('buildBuyUsedGymEquipmentCollectionSchema'), 'CollectionPage schema wired')
assert(pageJsx.includes('<picture>'), 'journey images use picture element')
assert(pageJsx.includes(`to={VALUATION_PATH}`), 'valuation CTAs present lower on page')
assert(pageJsx.includes('buy-page__seo'), 'combined SEO section present')
assert(pageJsx.includes('buy-page--marketplace-hub'), 'marketplace hub modifier')
assert(pageJsx.includes('<header className="buy-page__hero"'), 'semantic hero header')
assert(!/Product schema|@type:\s*['"]Product['"]/.test(pageJsx), 'no Product schema on page')
assert(!pageJsx.includes('Seller Service Fee'), 'no seller fee in page source')

const listingsIndex = pageJsx.indexOf('buy-listings-heading')
const journeyIndex = pageJsx.indexOf('buy-journey-heading')
assert(listingsIndex > 0 && journeyIndex > listingsIndex, 'inventory appears before journey')

const webPageSchema = buildBuyUsedGymEquipmentWebPageSchema()
assert(webPageSchema['@type'] === 'WebPage', 'WebPage schema type')
assert(webPageSchema.headline === BUY_USED_GYM_EQUIPMENT_H1, 'WebPage headline matches H1')

const collectionSchema = buildBuyUsedGymEquipmentCollectionSchema(sampleListings)
assert(collectionSchema['@type'] === 'CollectionPage', 'CollectionPage schema')
assert(collectionSchema.mainEntity['@type'] === 'ItemList', 'ItemList for listings')
assert(collectionSchema.mainEntity.itemListElement.length === 2, 'ItemList uses active listings')
assert(
  collectionSchema.mainEntity.itemListElement.every((item) => String(item.url).includes('/listings/')),
  'ItemList points at listing URLs',
)

assert(doc.jsonLd.some((entry) => entry['@type'] === 'CollectionPage'), 'CollectionPage in jsonLd')
assert(!doc.jsonLd.some((entry) => entry['@type'] === 'Product'), 'no Product schema')

const breadcrumbSchema = buildBuyUsedGymEquipmentBreadcrumbSchema()
assert(breadcrumbSchema['@type'] === 'BreadcrumbList', 'BreadcrumbList schema')
assert(breadcrumbSchema.itemListElement.length === 2, 'breadcrumb has Home + Buy')

const faqSchema = buildBuyUsedGymEquipmentFaqSchema()
assert(faqSchema['@type'] === 'FAQPage', 'FAQPage schema')
assert(faqSchema.mainEntity.length === BUY_FAQ_ITEMS.length, 'FAQ schema count matches content')

const { items: normalizedFaqs } = normalizeFaqItems(BUY_FAQ_ITEMS)
assert(normalizedFaqs.length === BUY_FAQ_ITEMS.length, 'all FAQs eligible for schema')

const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')
assert(appSource.includes('path="buy-used-gym-equipment"'), 'route registered in App.jsx')

const sitemap = readFileSync(join(process.cwd(), 'scripts', 'generate-sitemap.mjs'), 'utf8')
assert(sitemap.includes('/buy-used-gym-equipment'), 'sitemap generator includes route')

const prerender = readFileSync(join(process.cwd(), 'scripts', 'prerender-seo-catalogue.mjs'), 'utf8')
assert(
  prerender.includes('buildBuyUsedGymEquipmentSeoDocument({ listings: activeListings })'),
  'prerender passes active listings into buy hub',
)

const sellContent = readFileSync(join(process.cwd(), 'src', 'lib', 'sellGymEquipmentPage.js'), 'utf8')
assert(sellContent.includes('/buy-used-gym-equipment'), 'sell page cross-links to buy page')

assert(
  BUY_GUIDE_LINKS.some((item) => item.link.to === SELL_GYM_EQUIPMENT_PATH),
  'guide cross-links to sell page',
)

const journeyFiles = [
  'public/images/buy/step-1.webp',
  'public/images/buy/buy-journey-step-2.webp',
  'public/images/buy/buy-journey-step-3.webp',
  'public/images/buy/buy-journey-step-4.webp',
  'public/buy-used-gym-equipment/buy-used-gym-equipment-marketplace.webp',
  'public/buy-used-gym-equipment/buy-used-gym-equipment-og.png',
]
for (const relativePath of journeyFiles) {
  assert(existsSync(join(process.cwd(), relativePath)), `asset exists: ${relativePath}`)
}

assert(BUY_HERO_ARTWORK.src.includes('buy-used-gym-equipment-marketplace.webp'), 'hero artwork webp path')

const ogMeta = await sharp(join(process.cwd(), 'public', 'buy-used-gym-equipment', 'buy-used-gym-equipment-og.png')).metadata()
assert(ogMeta.width === 1200 && ogMeta.height === 630, 'og image dimensions')

const sampleHtml = `<!doctype html><html><head><title>Equipd</title></head><body><div id="root"></div></body></html>`
const injected = injectSeoIntoHtml(sampleHtml, doc)
assert(injected.includes('rel="canonical"'), 'canonical injected')
assert(injected.includes('https://www.equipd.co.uk/buy-used-gym-equipment'), 'canonical absolute url')
assert(injected.includes('FAQPage'), 'FAQ schema injected')
assert(injected.includes('CollectionPage'), 'CollectionPage schema injected')
assert(injected.includes(BUY_USED_GYM_EQUIPMENT_PAGE_TITLE), 'title injected')

console.log('test-buy-used-gym-equipment-page: ok')
