/**
 * Focused tests for BreadcrumbList JSON-LD builders and duplicate prevention.
 */

import {
  BREADCRUMB_SCHEMA_KEY,
  absoluteBreadcrumbUrl,
  buildBrandPageBreadcrumbSchema,
  buildBreadcrumbSchema,
  buildBrandsIndexBreadcrumbSchema,
  buildEquipmentBreadcrumbSchema,
  buildHelpArticleBreadcrumbSchema,
  buildHelpCentreBreadcrumbSchema,
  buildListingBreadcrumbSchema,
  buildLocationPageBreadcrumbSchema,
  excludeBreadcrumbSchemas,
  findBreadcrumbSchemas,
  normalizeBreadcrumbItems,
  renderBreadcrumbScriptTag,
  syncBreadcrumbSchemaInDocument,
} from '../src/lib/breadcrumbStructuredData.js'
import { EQUIPD_SITE_ORIGIN } from '../src/lib/brandCatalogueCore.js'
import { buildEquipmentBreadcrumbJsonLd } from '../src/lib/equipmentPageSeo.js'
import { buildBrandPageJsonLd } from '../src/lib/brandCatalogueCore.js'
import { SITE_SCHEMA_ATTR } from '../src/lib/breadcrumbStructuredData.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertWwwOnly(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  assert(text.includes('https://www.equipd.co.uk'), `${label}: missing www`)
  assert(!/https:\/\/equipd\.co\.uk\//.test(text.replaceAll('https://www.equipd.co.uk', '')), `${label}: non-www`)
  assert(!text.includes('localhost'), `${label}: localhost`)
  assert(!text.includes('.vercel.app'), `${label}: preview host`)
  assert(!text.includes('//www.equipd.co.uk//'), `${label}: double slash`)
}

// A. Schema shape
const shaped = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Equipment Values', path: '/brands' },
  { name: 'Life Fitness & Co', path: '/brands/life-fitness' },
])
assert(shaped['@type'] === 'BreadcrumbList', 'type')
assert(shaped['@id'] === 'https://www.equipd.co.uk/brands/life-fitness#breadcrumb', '@id')
assert(shaped.itemListElement.length === 3, 'three items')
shaped.itemListElement.forEach((item, index) => {
  assert(item['@type'] === 'ListItem', `list item ${index}`)
  assert(item.position === index + 1, `position ${index}`)
  assert(Boolean(item.name), `name ${index}`)
  assert(item.item.startsWith('https://www.equipd.co.uk'), `absolute ${index}`)
})
assertWwwOnly(shaped, 'shaped schema')

// Dynamic / sanitisation
const weird = buildBreadcrumbSchema([
  { name: '  Home  ', path: '/' },
  { name: "Buyer's Guide & Tips", path: '/help/buyer-protection' },
  { name: 'Café Rowing Erg — 中文', path: '/equipment/cafe-rower' },
])
assert(weird.itemListElement[1].name === "Buyer's Guide & Tips", 'apostrophe + amp')
assert(weird.itemListElement[2].name.includes('中文'), 'unicode preserved')
assert(normalizeBreadcrumbItems([{ name: '', path: '/x' }]).length === 0, 'drop empty names')
assert(absoluteBreadcrumbUrl('https://equipd.co.uk/brands/?utm=1') === 'https://www.equipd.co.uk/brands', 'force www + strip query')
assert(absoluteBreadcrumbUrl('/brands/') === 'https://www.equipd.co.uk/brands', 'strip trailing slash')

// B. Route-specific hierarchies
const brandsIndex = buildBrandsIndexBreadcrumbSchema()
assert(brandsIndex.itemListElement.map((i) => i.name).join(' > ') === 'Home > Equipment Values', 'brands index')

const brand = buildBrandPageBreadcrumbSchema({
  displayName: 'Life Fitness',
  slug: 'life-fitness',
  absoluteUrl: 'https://www.equipd.co.uk/brands/life-fitness',
})
assert(brand.itemListElement.length === 3, 'brand depth')
assert(brand.itemListElement[2].name === 'Life Fitness', 'brand leaf')

const equipment = buildEquipmentBreadcrumbSchema({}, {
  brandSlug: 'life-fitness',
  brandDisplayName: 'Life Fitness',
  productName: 'Elevation Series PowerMill',
  productUrl: 'https://www.equipd.co.uk/equipment/life-fitness-elevation-series-powermill',
})
assert(equipment.itemListElement.length === 4, 'equipment depth')
assert(equipment.itemListElement[3].name === 'Elevation Series PowerMill', 'equipment leaf')
assert(
  !equipment.itemListElement.some((item) => item.name === 'Elevation Series' && item.item.endsWith('/elevation')),
  'no invented series page',
)

// Missing brand slug omits brand level
const equipmentNoBrand = buildEquipmentBreadcrumbSchema({}, {
  productName: 'Generic Bike',
  productUrl: '/equipment/generic-bike',
})
assert(equipmentNoBrand.itemListElement.length === 3, 'equipment without brand')

const location = buildLocationPageBreadcrumbSchema({ slug: 'manchester', name: 'Manchester' })
assert(location.itemListElement.map((i) => i.name).join(' > ') === 'Home > Manchester', 'location hierarchy')
assert(location.itemListElement[1].item === 'https://www.equipd.co.uk/listings/manchester', 'location url')

const helpIndex = buildHelpCentreBreadcrumbSchema()
assert(helpIndex.itemListElement.map((i) => i.name).join(' > ') === 'Home > Help Centre', 'help index')

const helpArticle = buildHelpArticleBreadcrumbSchema({
  slug: 'buyer-protection',
  title: 'Buyer Protection',
})
assert(helpArticle.itemListElement.length === 3, 'help article depth')

const listing = buildListingBreadcrumbSchema({
  slug: 'life-fitness-e1-go-console',
  title: 'Life Fitness E1 Elliptical Trainer with Go Console',
  status: 'active',
  category: { name: 'Crosstrainers', slug: 'crosstrainers' },
})
assert(listing.itemListElement.map((i) => i.name).join(' > ')
  === 'Home > Browse > Crosstrainers', 'listing hierarchy')
assert(
  listing.itemListElement[2].item.includes('/browse?category=crosstrainers'),
  'listing category breadcrumb links to browse filter',
)
assert(
  !buildListingBreadcrumbSchema({ slug: 'x', title: 'Draft', status: 'draft' }),
  'no breadcrumb for draft listing',
)

// Compatibility wrappers still work
const brandCollection = buildBrandPageJsonLd({
  displayName: 'Technogym',
  slug: 'technogym',
  absoluteUrl: 'https://www.equipd.co.uk/brands/technogym',
  intro: 'Technogym guides',
  href: '/brands/technogym',
}, [{ displayName: 'Skillrun', href: '/equipment/technogym-skillrun' }])
assert(brandCollection['@type'] === 'CollectionPage', 'brand collection page')
const brandTrail = buildBrandPageBreadcrumbSchema({
  displayName: 'Technogym',
  slug: 'technogym',
  absoluteUrl: 'https://www.equipd.co.uk/brands/technogym',
})
assert(findBreadcrumbSchemas([brandCollection, brandTrail]).length === 1, 'composed brand json-ld')
assert(excludeBreadcrumbSchemas([brandCollection, brandTrail]).length === 1, 'exclude works')

const equipmentCompat = buildEquipmentBreadcrumbJsonLd({
  canonical_product_key: 'concept2-exercise-bike-bikeerg',
  canonical_product_name: 'Concept2 BikeErg',
  brand: 'Concept2',
})
assert(equipmentCompat['@id']?.endsWith('#breadcrumb'), 'equipment wrapper @id')
assertWwwOnly(equipmentCompat, 'equipment wrapper')

// E. Duplication prevention helpers
const tag = renderBreadcrumbScriptTag(brand)
assert(tag.includes(`${SITE_SCHEMA_ATTR}="${BREADCRUMB_SCHEMA_KEY}"`), 'marker attr')
assert(tag.includes('BreadcrumbList'), 'tag body')

class FakeScript {
  constructor(head) {
    this.head = head
    this.type = ''
    this.attrs = {}
    this.text = ''
    this.textContent = ''
  }
  setAttribute(key, value) { this.attrs[key] = value }
  getAttribute(key) { return this.attrs[key] }
  remove() {
    this.head.nodes = this.head.nodes.filter((node) => node !== this)
  }
}

class FakeHead {
  constructor() { this.nodes = [] }
  querySelectorAll(selector) {
    if (selector === 'script') return [...this.nodes]
    if (!selector.includes(BREADCRUMB_SCHEMA_KEY)) return []
    return this.nodes.filter((node) => node.attrs[SITE_SCHEMA_ATTR] === BREADCRUMB_SCHEMA_KEY)
  }
  appendChild(node) { this.nodes.push(node); return node }
}

class FakeDoc {
  constructor() {
    this.head = new FakeHead()
  }
  createElement(tagName) {
    assert(tagName === 'script', 'creates script')
    return new FakeScript(this.head)
  }
}

const doc = new FakeDoc()
syncBreadcrumbSchemaInDocument(doc, brand)
syncBreadcrumbSchemaInDocument(doc, brand)
assert(doc.head.querySelectorAll('script').length === 1, 'idempotent same schema')
syncBreadcrumbSchemaInDocument(doc, location)
assert(doc.head.querySelectorAll('script').length === 1, 'replaces on navigation')
assert(JSON.parse(doc.head.nodes[0].text)['@id'] === location['@id'], 'updated @id')
syncBreadcrumbSchemaInDocument(doc, null)
assert(doc.head.querySelectorAll('script').length === 0, 'clears on private route')

console.log('breadcrumb structured data tests passed')
