/**
 * Unit checks for curated brand-page selection helpers.
 */
import {
  buildBrandFaqItems,
  buildBrandFaqPageSchema,
  buildBrandPageStats,
  buildBrandSeriesTags,
  selectFeaturedBrandSeries,
  selectPopularBrandProducts,
  FEATURED_SERIES_LIMIT,
  POPULAR_LIMIT,
} from '../src/lib/brandPageCurated.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const products = [
  {
    id: '1',
    displayName: 'Life Fitness Elevation Treadmill',
    href: '/equipment/lf-elevation-treadmill',
    series: 'Elevation',
    equipmentType: 'Treadmill',
    estimatedValueLabel: '£536 – £656',
    imageUrl: '/img/a.jpg',
    originalRrp: 14900,
    yearLabel: '2010+',
  },
  {
    id: '2',
    displayName: 'Life Fitness Signature Leg Press',
    href: '/equipment/lf-signature-leg-press',
    series: 'Signature',
    equipmentType: 'Plate Loaded Strength',
    estimatedValueLabel: '£800 – £1,000',
    imageUrl: '/img/b.jpg',
    originalRrp: 6000,
    yearLabel: '2008+',
  },
  {
    id: '3',
    displayName: 'Life Fitness Base Bike',
    href: '/equipment/lf-base-bike',
    series: 'Integrity',
    equipmentType: 'Upright Bike',
    estimatedValueLabel: '£200 – £300',
    imageUrl: null,
    originalRrp: 2500,
  },
  {
    id: '4',
    displayName: 'Life Fitness Incomplete',
    href: '/equipment/lf-incomplete',
    series: 'Integrity',
    equipmentType: 'Treadmill',
    estimatedValueLabel: null,
    imageUrl: '/img/c.jpg',
    originalRrp: 9000,
  },
]

const listings = [
  { id: 'l1', title: 'Life Fitness Signature Leg Press' },
]

const popular = selectPopularBrandProducts(products, { listings })
assert(popular.length <= POPULAR_LIMIT, 'popular respects limit')
assert(popular.every((product) => product.estimatedValueLabel), 'popular requires valuation')
assert(popular[0].id === '2', 'listing overlap ranks first')
assert(!popular.some((product) => product.id === '4'), 'incomplete valuation excluded')

const again = selectPopularBrandProducts(products, { listings })
assert(
  again.map((product) => product.id).join(',') === popular.map((product) => product.id).join(','),
  'popular ordering is deterministic',
)

const series = [
  { name: 'Signature', productCount: 28 },
  { name: 'Elevation', productCount: 20 },
  { name: 'Integrity', productCount: 15 },
  { name: 'Optima', productCount: 8 },
  { name: 'Silver', productCount: 6 },
  { name: 'Club', productCount: 4 },
]
const featured = selectFeaturedBrandSeries(series)
assert(featured.length === FEATURED_SERIES_LIMIT, 'featured series capped')
assert(featured[0].name === 'Signature', 'keeps count order')

const tags = buildBrandSeriesTags('Signature', products)
assert(tags.includes('Plate loaded') || tags.includes('Strength'), `series tags derived: ${tags.join(',')}`)
const cardioTags = buildBrandSeriesTags('Elevation', products)
assert(cardioTags.includes('Treadmills') || cardioTags.includes('Cardio'), `cardio tags: ${cardioTags.join(',')}`)

const stats = buildBrandPageStats({
  productCount: 10,
  listingCount: 0,
  categories: [{ name: 'Treadmill' }],
  series: [{ name: 'Elevation' }],
})
assert(stats.every((stat) => stat.value > 0), 'stats omit zero counts')
assert(!stats.some((stat) => stat.key === 'listings'), 'zero listings omitted')
assert(stats.some((stat) => stat.key === 'models'), 'models included')

const faqs = buildBrandFaqItems('Life Fitness')
assert(faqs.length >= 4, 'brand faqs present')
assert(faqs.every((item) => item.question && item.answer), 'faq shape')
assert(faqs[0].question.includes('Life Fitness'), 'brand name in faq')

const schema = buildBrandFaqPageSchema(
  { absoluteUrl: 'https://www.equipd.co.uk/brands/life-fitness' },
  faqs,
)
assert(schema?.['@type'] === 'FAQPage', 'faq schema type')
assert(schema.mainEntity.length === faqs.length, 'faq schema synced to visible items')

console.log('brand-page-curated tests passed')
