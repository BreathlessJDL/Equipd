/**
 * Unit checks for shared equipment product SEO helpers.
 */
import {
  buildEquipmentBreadcrumbJsonLd,
  buildEquipmentCanonicalUrl,
  buildEquipmentInternalLinks,
  buildEquipmentMetaDescription,
  buildEquipmentOpenGraph,
  buildEquipmentPageSeoBundle,
  buildEquipmentPageTitle,
  buildEquipmentProductJsonLd,
  buildFactualOverviewFallback,
  getApprovedEquipmentImage,
  getIndexabilityForProduct,
  selectRelatedEquipmentProducts,
} from '../src/lib/equipmentPageSeo.js'
import {
  buildEquipmentPageSeoDocument,
  injectSeoIntoHtml,
} from '../src/lib/seoCataloguePrerender.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const cardio = {
  id: 'lf1',
  brand: 'Life Fitness',
  status: 'approved',
  equipment_type: 'Treadmill',
  product_family: 'Integrity Series',
  model: 'Integrity Series Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
  canonical_product_key: 'life-fitness-integrity-series-treadmill',
  original_base_price: 9000,
  original_base_price_currency: 'GBP',
  production_start_year: 2015,
  production_end_year: 2020,
  image_status: 'approved',
  image_url: 'https://cdn.example.com/lf-integrity.jpg',
}

const strength = {
  id: 'tg1',
  brand: 'Technogym',
  status: 'approved',
  equipment_type: 'Chest Press',
  model: 'Element Chest Press',
  canonical_product_name: 'Technogym Element Chest Press',
  canonical_product_key: 'technogym-element-chest-press',
  original_base_price: 4500,
  original_base_price_currency: 'GBP',
  baseline_manufacture_year: 2018,
  image_status: 'suggested',
  image_url: 'https://cdn.example.com/suggested-only.jpg',
}

const pending = {
  ...cardio,
  status: 'pending',
  canonical_product_key: 'pending-key',
}

const matrixWithImage = {
  id: 'mx1',
  brand: 'Matrix Fitness',
  status: 'approved',
  equipment_type: 'Treadmill',
  canonical_product_name: 'Matrix T3x Treadmill',
  canonical_product_key: 'matrix-t3x-treadmill',
  image_status: 'approved',
  image_url: 'https://cdn.example.com/matrix.jpg',
}

assert(
  buildEquipmentPageTitle(cardio) === 'Life Fitness Integrity Series Treadmill Used Value & Price Guide',
  'cardio title hook form',
)
assert(
  buildEquipmentPageTitle(cardio, { includeSiteName: true }).endsWith('| Equipd'),
  'document title includes Equipd',
)

const cardioDesc = buildEquipmentMetaDescription(cardio, { hasConsoleOptions: true })
assert(cardioDesc.includes('console options'), 'cardio mentions consoles')
assert(cardioDesc.includes('Life Fitness Integrity Series Treadmill'), 'cardio desc uses name')
assert(!cardioDesc.toLowerCase().includes('canonical'), 'no internal words')

const strengthDesc = buildEquipmentMetaDescription(strength, { hasConsoleOptions: false })
assert(!strengthDesc.includes('console options'), 'strength omits consoles')
assert(strengthDesc.includes('product information'), 'strength fallback phrase')

assert(
  buildEquipmentCanonicalUrl(cardio)
    === 'https://www.equipd.co.uk/equipment/life-fitness-integrity-series-treadmill',
  'canonical url production www domain',
)
assert(!buildEquipmentCanonicalUrl(cardio).includes('localhost'), 'no localhost')
assert(
  !buildEquipmentCanonicalUrl(cardio).includes('://equipd.co.uk/'),
  'canonical does not use non-www host',
)
assert(getIndexabilityForProduct(cardio).indexable === true, 'approved indexable')
assert(getIndexabilityForProduct(pending).indexable === false, 'pending noindex')
assert(getIndexabilityForProduct(pending).robots === 'noindex, follow', 'pending robots')

assert(getApprovedEquipmentImage(cardio) === cardio.image_url, 'approved image')
assert(getApprovedEquipmentImage(strength) == null, 'suggested image excluded')

const productLd = buildEquipmentProductJsonLd(cardio)
assert(productLd['@type'] === 'Product', 'product schema')
assert(productLd['@id']?.endsWith('#product'), 'product @id')
assert(productLd.brand.name === 'Life Fitness', 'brand')
assert(productLd.image[0] === cardio.image_url, 'image in json-ld')
assert(!('offers' in productLd), 'no invented offers')
assert(!('aggregateRating' in productLd), 'no invented ratings')
assert(!('sku' in productLd), 'no fake sku from product key')
assert(!('mpn' in productLd), 'no invented mpn')

const crumbs = buildEquipmentBreadcrumbJsonLd(cardio)
assert(crumbs['@type'] === 'BreadcrumbList', 'breadcrumb schema')
assert(crumbs.itemListElement.length >= 3, 'breadcrumb trail')

const og = buildEquipmentOpenGraph(cardio)
assert(og['og:site_name'] === 'Equipd', 'og site')
assert(og['twitter:card'] === 'summary_large_image', 'twitter card')
assert(og['og:image'].startsWith('https://'), 'absolute og image')

const links = buildEquipmentInternalLinks(cardio, { hasConsoleOptions: true })
assert(links.some((link) => link.kind === 'brand'), 'brand link')
assert(links.some((link) => link.kind === 'valuation'), 'valuation link')
assert(links.some((link) => link.href.includes('/brands/life-fitness')), 'brand path')

const related = selectRelatedEquipmentProducts(cardio, [
  strength,
  matrixWithImage,
  {
    ...cardio,
    id: 'lf2',
    canonical_product_key: 'life-fitness-integrity-series-elliptical',
    canonical_product_name: 'Life Fitness Integrity Series Elliptical',
    equipment_type: 'Cross Trainer',
  },
], { limit: 3 })
assert(related.length >= 1, 'related products selected')
assert(!related.some((entry) => entry.href.includes(cardio.canonical_product_key)), 'excludes self')

const fallback = buildFactualOverviewFallback(strength)
assert(fallback.includes('Technogym Element Chest Press'), 'fallback name')
assert(!fallback.toLowerCase().includes('draft'), 'fallback no draft status')

const missingType = {
  ...strength,
  equipment_type: 'Unknown',
  production_start_year: null,
  production_end_year: null,
  baseline_manufacture_year: 2012,
}
assert(
  buildEquipmentMetaDescription(missingType, { hasConsoleOptions: false }).includes('2012') === false,
  'meta does not invent years as words but still useful',
)
assert(buildFactualOverviewFallback(missingType).includes('2012'), 'fallback uses manufactured-from')

const bothYears = {
  ...cardio,
  production_start_year: 2010,
  production_end_year: 2018,
}
assert(buildFactualOverviewFallback(bothYears).includes('2010–2018'), 'both years in fallback')

const bundle = buildEquipmentPageSeoBundle(cardio, { hasConsoleOptions: true })
assert(Array.isArray(bundle.jsonLd) && bundle.jsonLd.length === 2, 'bundle json-ld')
assert(bundle.openGraph['og:url'].includes('/equipment/'), 'og url')

const doc = buildEquipmentPageSeoDocument({
  product: cardio,
  content: {
    overview_text: 'Approved commercial treadmill overview.',
    seo_title: null,
    seo_meta_description: null,
  },
  hasConsoleOptions: true,
  imageUrl: cardio.image_url,
})
assert(doc.title.includes('Used Value & Price Guide'), 'prerender title pattern')
assert(doc.title.endsWith('| Equipd'), 'prerender site suffix once')
assert(doc.bodyHtml.includes('<h1>Life Fitness Integrity Series Treadmill</h1>'), 'h1')
assert(doc.bodyHtml.includes('Overview'), 'overview h2')
assert(doc.bodyHtml.includes('Related on Equipd'), 'related section')
assert(!doc.bodyHtml.toLowerCase().includes('canonical key'), 'no internal key in body')
assert(doc.openGraph['og:image'] === cardio.image_url, 'doc og image')
assert(doc.robots === 'index, follow', 'indexable robots')

const strengthDoc = buildEquipmentPageSeoDocument({
  product: strength,
  hasConsoleOptions: false,
})
assert(!strengthDoc.description.includes('console options'), 'strength prerender desc')
assert(strengthDoc.openGraph['og:image'].includes('sell-gym-equipment-og.png'), 'fallback social image')

const template = `<!doctype html>
<html lang="en">
  <head>
    <title>Equipd — Used Gym Equipment</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

const html = injectSeoIntoHtml(template, doc)
assert(html.includes('property="og:title"'), 'injected og title')
assert(html.includes('name="twitter:card"'), 'injected twitter')
assert(html.includes('name="robots"'), 'injected robots')
assert(html.includes('application/ld+json'), 'injected json-ld')
assert(html.includes('data-equipd-schema="product"'), 'product marker')
const productScript = html.match(/data-equipd-schema="product">([^<]+)/)
assert(productScript, 'product script body')
const parsedProduct = JSON.parse(productScript[1])
assert(parsedProduct['@type'] === 'Product', 'parsed product type')
assert(!('sku' in parsedProduct), 'parsed product has no sku')

console.log('equipment-page-seo tests passed')
