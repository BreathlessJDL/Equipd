/**
 * Focused tests for hardened Product JSON-LD on equipment guide pages.
 */

import {
  buildEquipmentPageSeoBundle,
  buildEquipmentProductJsonLd,
  getApprovedEquipmentImage,
  resolveProductSchemaImageUrl,
} from '../src/lib/equipmentPageSeo.js'
import {
  PRODUCT_SCHEMA_KEY,
  SITE_SCHEMA_ATTR,
  excludeProductSchemas,
  findProductSchemas,
  renderProductScriptTag,
  syncProductSchemaInDocument,
} from '../src/lib/productPageStructuredData.js'
import { buildEquipmentPageSeoDocument } from '../src/lib/seoCataloguePrerender.js'
import { EQUIPD_SITE_ORIGIN } from '../src/lib/brandCatalogueCore.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertWwwOnly(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  assert(text.includes('https://www.equipd.co.uk'), `${label}: missing www`)
  assert(!/https:\/\/equipd\.co\.uk\//.test(text.replaceAll('https://www.equipd.co.uk', '')), `${label}: non-www`)
  assert(!text.includes('localhost'), `${label}: localhost`)
  assert(!text.includes('.vercel.app'), `${label}: preview`)
}

function assertNoRetailFields(schema, label) {
  for (const key of [
    'offers',
    'aggregateRating',
    'review',
    'sku',
    'mpn',
    'gtin',
    'gtin8',
    'gtin12',
    'gtin13',
    'gtin14',
    'availability',
    'price',
    'priceCurrency',
    'seller',
  ]) {
    assert(!(key in schema), `${label}: must omit ${key}`)
  }
}

const cardio = {
  id: 'lf-1',
  brand: 'Life Fitness',
  model: 'Integrity Series Treadmill',
  status: 'approved',
  equipment_type: 'Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
  canonical_product_key: 'life-fitness-integrity-series-treadmill',
  image_url: 'https://cdn.example.com/lf-integrity.jpg',
  image_status: 'approved',
  original_base_price: 9000,
  original_base_price_currency: 'GBP',
  production_start_year: 2015,
  production_end_year: 2020,
}

const strength = {
  id: 'mx-1',
  brand: 'Matrix Fitness',
  model: 'G3 Chest Press',
  status: 'approved',
  equipment_type: 'Selectorised Strength',
  canonical_product_name: 'Matrix Fitness G3 Chest Press',
  canonical_product_key: 'matrix-fitness-g3-chest-press',
  image_url: null,
  image_status: 'suggested',
}

const concept2 = {
  id: 'c2-1',
  brand: 'Concept2',
  model: 'BikeErg',
  status: 'approved',
  equipment_type: 'Exercise Bike',
  canonical_product_name: 'Concept2 BikeErg',
  canonical_product_key: 'concept2-exercise-bike-bikeerg',
  image_url: 'https://www.equipd.co.uk/equipment-product-images/concept2-bikeerg.jpg',
  image_status: 'approved',
}

const draft = {
  ...cardio,
  status: 'draft',
  canonical_product_key: 'life-fitness-draft-treadmill',
}

// A/B shape + accuracy
const overview = 'The Life Fitness Integrity Series Treadmill is a commercial cardio machine.'
const product = buildEquipmentProductJsonLd(cardio, {
  description: overview,
  brandDisplayName: 'Life Fitness',
})
assert(product['@type'] === 'Product', 'type')
assert(product['@id'] === `${EQUIPD_SITE_ORIGIN}/equipment/life-fitness-integrity-series-treadmill#product`, '@id')
assert(product.url === `${EQUIPD_SITE_ORIGIN}/equipment/life-fitness-integrity-series-treadmill`, 'url')
assert(product.mainEntityOfPage === product.url, 'mainEntityOfPage')
assert(product.name === 'Life Fitness Integrity Series Treadmill', 'name')
assert(product.description === overview, 'description from overview')
assert(product.brand['@type'] === 'Brand' && product.brand.name === 'Life Fitness', 'brand')
assert(product.model === 'Integrity Series Treadmill', 'model')
assert(product.category === 'Treadmill', 'category')
assert(product.image[0] === cardio.image_url, 'approved image')
assertNoRetailFields(product, 'cardio')
assertWwwOnly(product, 'cardio')

// C missing optional
const noImage = buildEquipmentProductJsonLd(strength, {
  description: 'Matrix strength overview.',
})
assert(!('image' in noImage), 'omit image when unapproved')
assert(noImage.category === 'Selectorised Strength', 'human category')
assertNoRetailFields(noImage, 'strength')

const noDesc = buildEquipmentProductJsonLd(concept2, { description: null })
assert(!('description' in noDesc), 'omit description when missing')
assert(noDesc.name === 'Concept2 BikeErg', 'concept2 name')

// Meta invent fallback must not become Product description
const metaOnlyBundle = buildEquipmentPageSeoBundle(cardio, {
  overviewText: null,
  seoDescription: null,
})
const metaProduct = findProductSchemas(metaOnlyBundle.jsonLd)[0]
assert(metaProduct, 'product still emitted when indexable')
assert(!('description' in metaProduct), 'no invented meta description on Product')

const withOverview = buildEquipmentPageSeoBundle(cardio, {
  overviewText: overview,
  seoDescription: 'Short SEO meta.',
})
assert(findProductSchemas(withOverview.jsonLd)[0].description === overview, 'overview preferred')

// D/E/F retail + identifier exclusions already asserted; fake sku gone
assert(!('sku' in product), 'no canonical-key sku')

// Reject snake_case category
const snake = buildEquipmentProductJsonLd({
  ...cardio,
  equipment_type: 'selectorised_strength',
})
assert(!('category' in snake), 'reject enum category')

// Image safety
assert(resolveProductSchemaImageUrl('https://www.equipd.co.uk/email/equipd-full-logo.png', cardio) === cardio.image_url
  || resolveProductSchemaImageUrl(null, cardio) === cardio.image_url, 'approved product image wins')
assert(resolveProductSchemaImageUrl('https://www.equipd.co.uk/email/equipd-full-logo.png', strength) == null, 'reject logo alone')
assert(resolveProductSchemaImageUrl('http://localhost/x.jpg', strength) == null, 'reject localhost')
assert(getApprovedEquipmentImage(strength) == null, 'suggested excluded')

// H eligibility
assert(!buildEquipmentProductJsonLd(draft), 'draft has no Product')
assert(findProductSchemas(buildEquipmentPageSeoBundle(draft).jsonLd).length === 0, 'draft bundle no product')

const doc = buildEquipmentPageSeoDocument({
  product: cardio,
  content: {
    overview_text: overview,
    seo_meta_description: 'SEO meta',
    faq_json: [{ question: 'Q?', answer: 'A.' }],
  },
})
assert(findProductSchemas(doc.jsonLd).length === 1, 'prerender one Product')
assert(doc.jsonLd.some((n) => n['@type'] === 'FAQPage'), 'faq retained')
assert(doc.jsonLd.some((n) => n['@type'] === 'BreadcrumbList'), 'breadcrumb retained')
assert(findProductSchemas(doc.jsonLd)[0]['@id'].endsWith('#product'), 'prerender @id')

// I lifecycle helpers
const tag = renderProductScriptTag(product)
assert(tag.includes(`${SITE_SCHEMA_ATTR}="${PRODUCT_SCHEMA_KEY}"`), 'marker')
assert(excludeProductSchemas(doc.jsonLd).every((n) => n['@type'] !== 'Product'), 'exclude')

class FakeScript {
  constructor(head) {
    this.head = head
    this.type = ''
    this.attrs = {}
    this.text = ''
    this.textContent = ''
  }
  setAttribute(key, value) { this.attrs[key] = value }
  remove() { this.head.nodes = this.head.nodes.filter((n) => n !== this) }
}
class FakeHead {
  constructor() { this.nodes = [] }
  querySelectorAll(selector) {
    if (selector === 'script') return [...this.nodes]
    if (!selector.includes(PRODUCT_SCHEMA_KEY)) return []
    return this.nodes.filter((n) => n.attrs[SITE_SCHEMA_ATTR] === PRODUCT_SCHEMA_KEY)
  }
  appendChild(node) { this.nodes.push(node); return node }
}
class FakeDoc {
  constructor() { this.head = new FakeHead() }
  createElement() { return new FakeScript(this.head) }
}

const fake = new FakeDoc()
syncProductSchemaInDocument(fake, product)
syncProductSchemaInDocument(fake, product)
assert(fake.head.querySelectorAll('script').length === 1, 'idempotent')
syncProductSchemaInDocument(fake, noImage)
assert(JSON.parse(fake.head.nodes[0].text)['@id'] === noImage['@id'], 'replace')
syncProductSchemaInDocument(fake, null)
assert(fake.head.querySelectorAll('script').length === 0, 'clear')

console.log('product page structured data tests passed')
