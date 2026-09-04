/**
 * Brand buyer-intent SEO config checks (Phase 1A Concept2 + Phase 1B brands).
 */
import {
  BRAND_BUYER_SEO,
  getBrandBuyerSeoConfig,
  getConfiguredBrandModelKeys,
  isBuyerIntentBrand,
  mapBrandListingsForSeo,
  selectConfiguredBrandModelGroups,
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

const BUYER_SLUGS = [
  'concept2',
  'wattbike',
  'cybex',
  'life-fitness',
  'hammer-strength',
]

for (const slug of BUYER_SLUGS) {
  assert(isBuyerIntentBrand(slug), `${slug} is buyer-intent`)
  assert(getBrandBuyerSeoConfig(slug) === BRAND_BUYER_SEO[slug], `${slug} config lookup`)
  const config = getBrandBuyerSeoConfig(slug)
  assert(config.heroCta?.label, `${slug} hero CTA`)
  assert(config.heroSecondaryCta?.label, `${slug} secondary CTA`)
  assert(config.searchPlaceholder?.includes('Search'), `${slug} search placeholder`)
  assert(config.heroContextBody, `${slug} hero context`)
  assert(config.valuesHeading?.startsWith('Research'), `${slug} values heading`)
  assert(config.buyingGuide?.checkpoints?.length >= 4, `${slug} buying checkpoints`)
  assert(getConfiguredBrandModelKeys(config).length >= 4, `${slug} curated models`)
  assert(
    !config.metaDescription.toLowerCase().includes('listing')
      || !/\d+\s+listing/.test(config.metaDescription),
    `${slug} meta does not hardcode stock count`,
  )
}

assert(!isBuyerIntentBrand('technogym'), 'Technogym remains valuation-led')

// ── Concept2 regression ──────────────────────────────────
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
  buildBrandIntro('Concept2', { slug: 'concept2' }).includes('from UK sellers'),
  'Concept2 intro is buyer-led',
)
assert(
  getBrandBuyerSeoConfig('concept2').heroCta?.label === 'Browse Concept2 for sale',
  'Concept2 buyer hero CTA',
)
assert(
  getBrandBuyerSeoConfig('concept2').heroSecondaryCta?.label === 'Explore Concept2 values',
  'Concept2 buyer secondary CTA',
)
assert(
  getBrandBuyerSeoConfig('concept2').searchPlaceholder === 'Search Concept2 equipment and models...',
  'Concept2 search placeholder',
)
assert(
  getBrandBuyerSeoConfig('concept2').heroContextBody?.includes('UK sellers on Equipd'),
  'Concept2 hero context body',
)
assert(
  getBrandBuyerSeoConfig('concept2').modelsHeading === 'Explore Concept2 equipment',
  'Concept2 explore models heading',
)
assert(
  getBrandBuyerSeoConfig('concept2').valuesHeading === 'Research Concept2 equipment values',
  'Concept2 values research heading',
)

const faq = buildBrandFaqItems('Concept2', { slug: 'concept2' })
assert(faq.some((item) => item.question.includes('buy used Concept2')), 'buyer FAQ present')
assert(
  buildBrandFaqItems('Cybex', { slug: 'cybex' }).some((item) => item.question.includes('buy used Cybex')),
  'Cybex uses buyer FAQs',
)

// ── Phase 1B titles / H1s ────────────────────────────────
assert(
  buildBrandPageTitle('Wattbike', { slug: 'wattbike' }) === 'Used Wattbikes for Sale',
  'Wattbike H1',
)
assert(
  buildBrandPageMetaTitle('Wattbike', { slug: 'wattbike' }) === 'Used Wattbikes for Sale',
  'Wattbike meta title',
)
assert(
  buildBrandPageTitle('Cybex', { slug: 'cybex' }) === 'Used Cybex Equipment for Sale',
  'Cybex H1',
)
assert(
  buildBrandPageMetaTitle('Cybex', { slug: 'cybex' }) === 'Used Cybex Gym Equipment for Sale',
  'Cybex meta title',
)
assert(
  buildBrandPageTitle('Life Fitness', { slug: 'life-fitness' })
    === 'Used Life Fitness Equipment for Sale',
  'Life Fitness H1',
)
assert(
  buildBrandPageMetaTitle('Life Fitness', { slug: 'life-fitness' })
    === 'Used Life Fitness Equipment for Sale',
  'Life Fitness meta title',
)
assert(
  buildBrandPageTitle('Hammer Strength', { slug: 'hammer-strength' })
    === 'Used Hammer Strength Equipment for Sale',
  'Hammer Strength H1',
)
assert(
  buildBrandPageMetaTitle('Hammer Strength', { slug: 'hammer-strength' })
    === 'Used Hammer Strength Equipment for Sale',
  'Hammer Strength meta title',
)

assert(
  getBrandBuyerSeoConfig('wattbike').searchPlaceholder
    === 'Search Wattbike equipment and models...',
  'Wattbike search placeholder',
)
assert(
  getBrandBuyerSeoConfig('cybex').searchPlaceholder
    === 'Search Cybex equipment and models...',
  'Cybex search placeholder',
)
assert(
  getBrandBuyerSeoConfig('life-fitness').searchPlaceholder
    === 'Search Life Fitness equipment and models...',
  'Life Fitness search placeholder',
)
assert(
  getBrandBuyerSeoConfig('hammer-strength').searchPlaceholder
    === 'Search Hammer Strength equipment and models...',
  'Hammer Strength search placeholder',
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

const wattbikeProducts = [
  { canonicalProductKey: 'wattbike-exercise-bike-atom-atom', href: '/equipment/wattbike-exercise-bike-atom-atom' },
  { canonicalProductKey: 'wattbike-exercise-bike-atom-atomx', href: '/equipment/wattbike-exercise-bike-atom-atomx' },
  { canonicalProductKey: 'wattbike-exercise-bike-pro-pro', href: '/equipment/wattbike-exercise-bike-pro-pro' },
  { canonicalProductKey: 'wattbike-exercise-bike-pro-trainer', href: '/equipment/wattbike-exercise-bike-pro-trainer' },
  { canonicalProductKey: 'wattbike-exercise-bike-nucleus-nucleus', href: '/equipment/wattbike-exercise-bike-nucleus-nucleus' },
]
assert(
  selectConfiguredBrandModels(getBrandBuyerSeoConfig('wattbike'), wattbikeProducts).length === 5,
  'Wattbike all five models',
)

const cybexGroups = selectConfiguredBrandModelGroups(
  getBrandBuyerSeoConfig('cybex'),
  getConfiguredBrandModelKeys(getBrandBuyerSeoConfig('cybex')).map((key) => ({
    canonicalProductKey: key,
    href: `/equipment/${key}`,
  })),
)
assert(cybexGroups.length === 2, 'Cybex cardio + strength groups')
assert(
  cybexGroups.reduce((sum, group) => sum + group.items.length, 0) === 14,
  'Cybex curated model count',
)

const hammerGroups = selectConfiguredBrandModelGroups(
  getBrandBuyerSeoConfig('hammer-strength'),
  getConfiguredBrandModelKeys(getBrandBuyerSeoConfig('hammer-strength')).map((key) => ({
    canonicalProductKey: key,
    href: `/equipment/${key}`,
  })),
)
assert(hammerGroups.length === 2, 'Hammer Strength grouped discovery')
assert(
  hammerGroups.reduce((sum, group) => sum + group.items.length, 0) === 10,
  'Hammer Strength curated model count stays bounded',
)

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
assert(doc.bodyHtml.includes('Condition &amp; wear') || doc.bodyHtml.includes('Condition & wear'), 'buying checkpoints in prerender')
assert(doc.bodyHtml.includes('Research Concept2 equipment values'), 'values research heading')
assert(!doc.bodyHtml.includes('Typical value today'), 'no typical-value label in prerender')
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
    productCount: 15,
    listingCount: 0,
    browseListingsHref: '/browse?brand=Life%20Fitness',
  },
  products: getConfiguredBrandModelKeys(getBrandBuyerSeoConfig('life-fitness')).map((key) => ({
    displayName: key,
    href: `/equipment/${key}`,
    canonicalProductKey: key,
  })),
})
assert(
  lfDoc.bodyHtml.includes('<h1>Used Life Fitness Equipment for Sale</h1>'),
  'Life Fitness prerender H1 is buyer-intent',
)
assert(
  lfDoc.title === 'Used Life Fitness Equipment for Sale | Equipd',
  'Life Fitness title is buyer-intent',
)
assert(lfDoc.bodyHtml.includes('Looking for used Life Fitness equipment?'), 'LF empty marketplace')
assert(lfDoc.bodyHtml.includes('Research Life Fitness equipment values'), 'LF values research')
assert(!lfDoc.bodyHtml.includes('Typical value today'), 'LF no typical-value headline')

const wattDoc = buildBrandPageSeoDocument({
  brand: {
    displayName: 'Wattbike',
    slug: 'wattbike',
    href: '/brands/wattbike',
    absoluteUrl: 'https://www.equipd.co.uk/brands/wattbike',
    intro: buildBrandIntro('Wattbike', { slug: 'wattbike' }),
    productCount: 5,
    listingCount: 0,
    browseListingsHref: '/browse?brand=Wattbike',
  },
  products: wattbikeProducts.map((product) => ({
    ...product,
    displayName: product.canonicalProductKey,
  })),
})
assert(wattDoc.bodyHtml.includes('<h1>Used Wattbikes for Sale</h1>'), 'Wattbike prerender H1')
assert(wattDoc.bodyHtml.includes('/used-commercial-indoor-cycles'), 'Wattbike category link')
assert(wattDoc.bodyHtml.includes('/equipment/wattbike-exercise-bike-atom-atom'), 'Wattbike model link')

const jsonLd = buildBrandPageJsonLd(brand, products)
assert(jsonLd.name === 'Used Concept2 Equipment for Sale', 'JSON-LD collection name')

console.log('test-brand-buyer-seo: ok')
