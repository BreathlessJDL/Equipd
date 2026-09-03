/**
 * Concept2 / brand buyer-intent SEO config checks (Phase 1A).
 */
import {
  BRAND_BUYER_SEO,
  getBrandBuyerSeoConfig,
  isBuyerIntentBrand,
  mapBrandListingsForSeo,
  selectConfiguredBrandModels,
} from '../src/lib/brandBuyerSeo.js'
import {
  buildBrandIntro,
  buildBrandPageJsonLd,
  buildBrandPageMetaDescription,
  buildBrandPageMetaTitle,
  buildBrandPageTitle,
} from '../src/lib/brandCatalogueCore.js'
import { buildBrandFaqItems } from '../src/lib/brandPageCurated.js'
import { buildBrandPageSeoDocument } from '../src/lib/seoCataloguePrerender.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

assert(isBuyerIntentBrand('concept2'), 'Concept2 is buyer-intent')
assert(!isBuyerIntentBrand('wattbike'), 'Wattbike not yet buyer-intent')
assert(!isBuyerIntentBrand('life-fitness'), 'Life Fitness remains valuation-led')
assert(getBrandBuyerSeoConfig('concept2') === BRAND_BUYER_SEO.concept2, 'config lookup')

assert(
  buildBrandPageTitle('Concept2', { slug: 'concept2' }) === 'Used Concept2 Equipment for Sale',
  'Concept2 H1',
)
assert(
  buildBrandPageMetaTitle('Concept2', { slug: 'concept2' })
    === 'Used Concept2 Rowers & Gym Equipment for Sale',
  'Concept2 meta title',
)
assert(
  buildBrandPageMetaDescription('Concept2', { slug: 'concept2' }).includes('UK marketplace'),
  'Concept2 meta mentions UK marketplace',
)
assert(
  !buildBrandPageMetaDescription('Concept2', { slug: 'concept2' }).includes('3 listing'),
  'Concept2 meta does not claim a stock count',
)
assert(
  buildBrandPageTitle('Life Fitness', { slug: 'life-fitness' })
    === 'Used Life Fitness Gym Equipment Values',
  'Life Fitness H1 unchanged',
)
assert(
  buildBrandPageMetaTitle('Wattbike', { slug: 'wattbike' })
    === 'Used Wattbike Gym Equipment Values & Listings',
  'Wattbike meta unchanged',
)
assert(
  buildBrandIntro('Concept2', { slug: 'concept2' }).includes('live marketplace listings'),
  'Concept2 intro is buyer-led',
)

const faq = buildBrandFaqItems('Concept2', { slug: 'concept2' })
assert(faq.some((item) => item.question.includes('buy used Concept2')), 'buyer FAQ present')
assert(
  !buildBrandFaqItems('Cybex', { slug: 'cybex' })[0].question.includes('buy used Cybex'),
  'Cybex still uses valuation FAQs',
)

const products = [
  {
    displayName: 'Concept2 Rowerg Model D',
    canonicalProductKey: 'concept2-rowers-rowerg-model-d',
    href: '/equipment/concept2-rowers-rowerg-model-d',
  },
  {
    displayName: 'Concept2 BikeErg',
    canonicalProductKey: 'concept2-exercise-bike-bikeerg',
    href: '/equipment/concept2-exercise-bike-bikeerg',
  },
  {
    displayName: 'Concept2 SkiErg',
    canonicalProductKey: 'concept2-skierg-skierg',
    href: '/equipment/concept2-skierg-skierg',
  },
  {
    displayName: 'Concept2 Rowerg Model E',
    canonicalProductKey: 'concept2-rowers-rowerg-model-e',
    href: '/equipment/concept2-rowers-rowerg-model-e',
  },
  {
    displayName: 'Concept2 Rowerg Model C',
    canonicalProductKey: 'concept2-rowers-rowerg-model-c',
    href: '/equipment/concept2-rowers-rowerg-model-c',
  },
  {
    displayName: 'Concept2 Dynamic RowErg',
    canonicalProductKey: 'concept2-rowers-dynamic-rowerg',
    href: '/equipment/concept2-rowers-dynamic-rowerg',
  },
]

const configured = selectConfiguredBrandModels(getBrandBuyerSeoConfig('concept2'), products)
assert(configured.length === 6, 'all six Concept2 models selected')
assert(
  configured[0].product.canonicalProductKey === 'concept2-rowers-rowerg-model-d',
  'Model D featured first',
)
assert(configured[0].blurb.includes('Model D'), 'Model D blurb present')

const brand = {
  displayName: 'Concept2',
  slug: 'concept2',
  href: '/brands/concept2',
  absoluteUrl: 'https://www.equipd.co.uk/brands/concept2',
  intro: buildBrandIntro('Concept2', { slug: 'concept2' }),
  productCount: 6,
  listingCount: 2,
  browseListingsHref: '/browse?brand=Concept2',
}

const listings = [
  { title: 'Concept 2 Model D PM5', slug: 'concept-2-model-d-pm5', price_pence: 65000, brand: 'Concept2' },
  { title: 'Concept2 rower', slug: 'concept2-rower', price_pence: 50000, brand: 'Concept2' },
]

const doc = buildBrandPageSeoDocument({
  brand,
  products,
  listings,
  categories: [{ label: 'Rowers', count: 4 }],
})

assert(doc.title === 'Used Concept2 Rowers & Gym Equipment for Sale | Equipd', 'prerender title')
assert(doc.description.includes('RowErg'), 'prerender meta')
assert(doc.bodyHtml.includes('<h1>Used Concept2 Equipment for Sale</h1>'), 'prerender H1 matches client')
assert(
  doc.bodyHtml.indexOf('seo-brand-listings-heading')
    < doc.bodyHtml.indexOf('seo-brand-models-heading'),
  'listings section before models in prerender',
)
assert(doc.bodyHtml.includes('/listings/concept-2-model-d-pm5'), 'listing href in prerender')
assert(doc.bodyHtml.includes('/equipment/concept2-rowers-rowerg-model-d'), 'model link in prerender')
assert(doc.bodyHtml.includes('/used-commercial-rowing-machines'), 'category link in prerender')
assert(doc.bodyHtml.includes('What to check when buying used Concept2'), 'buying guide in prerender')
assert(
  doc.jsonLd.some((entry) => entry['@type'] === 'CollectionPage'
    && entry.name === 'Used Concept2 Equipment for Sale'),
  'CollectionPage name is buyer-intent',
)

const emptyDoc = buildBrandPageSeoDocument({
  brand: { ...brand, listingCount: 0 },
  products,
  listings: [],
})
assert(emptyDoc.bodyHtml.includes('Looking for used Concept2 equipment?'), 'empty inventory heading')
assert(emptyDoc.bodyHtml.includes('/browse?brand=Concept2'), 'empty state still links to browse')

assert(
  mapBrandListingsForSeo(listings).length === 2,
  'listing SEO mapper keeps titles/hrefs',
)

const lfDoc = buildBrandPageSeoDocument({
  brand: {
    displayName: 'Life Fitness',
    slug: 'life-fitness',
    href: '/brands/life-fitness',
    absoluteUrl: 'https://www.equipd.co.uk/brands/life-fitness',
    intro: buildBrandIntro('Life Fitness', { slug: 'life-fitness' }),
    productCount: 2,
    listingCount: 0,
    browseListingsHref: '/browse?brand=Life%20Fitness',
  },
  products: [{
    displayName: 'Life Fitness Integrity Treadmill',
    href: '/equipment/life-fitness-integrity-treadmill',
    canonicalProductKey: 'life-fitness-integrity-treadmill',
  }],
})
assert(
  lfDoc.bodyHtml.includes('<h1>Used Life Fitness Gym Equipment Values</h1>'),
  'Life Fitness prerender H1 remains valuation-led',
)
assert(
  lfDoc.title.includes('Equipment Values & Listings'),
  'Life Fitness title unchanged',
)

const jsonLd = buildBrandPageJsonLd(brand, products)
assert(jsonLd.name === 'Used Concept2 Equipment for Sale', 'JSON-LD collection name')

console.log('test-brand-buyer-seo: ok')
