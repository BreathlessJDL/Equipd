/**
 * Unit checks for SEO catalogue prerender helpers.
 */
import {
  buildBrandPageSeoDocument,
  buildBrandsIndexSeoDocument,
  buildEquipmentPageSeoDocument,
  buildSeoRouteList,
  injectSeoIntoHtml,
} from '../src/lib/seoCataloguePrerender.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const brands = [
  {
    displayName: 'Life Fitness',
    slug: 'life-fitness',
    href: '/brands/life-fitness',
    productCount: 2,
    listingCount: 1,
    absoluteUrl: 'https://www.equipd.co.uk/brands/life-fitness',
    intro: 'Explore Life Fitness equipment.',
  },
]

const products = [
  {
    id: 'p1',
    brand: 'Life Fitness',
    status: 'approved',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Treadmill',
    canonical_product_key: 'life-fitness-integrity-treadmill',
    original_base_price: 9000,
    original_base_price_currency: 'GBP',
    production_start_year: 2015,
    production_end_year: 2020,
  },
  {
    id: 'p2',
    brand: 'Life Fitness',
    status: 'approved',
    equipment_type: 'Console',
    canonical_product_name: 'Life Console Only',
    canonical_product_key: 'life-console',
  },
]

const routes = buildSeoRouteList({ brands, products })
assert(routes.some((route) => route.path === '/brands'), 'includes /brands')
assert(routes.some((route) => route.path === '/brands/life-fitness'), 'includes brand route')
assert(
  routes.some((route) => route.path === '/equipment/life-fitness-integrity-treadmill'),
  'includes product route',
)
assert(!routes.some((route) => route.path.includes('life-console')), 'excludes console-only product')

const brandsDoc = buildBrandsIndexSeoDocument({ brands })
assert(brandsDoc.title.includes('Used Gym Equipment Values by Brand'), 'brands title')
assert(brandsDoc.title.endsWith('| Equipd'), 'brands title ends with Equipd')
assert(brandsDoc.description.includes('equipment value guides by brand'), 'brands meta description')
assert(brandsDoc.bodyHtml.includes('<h1>Used Gym Equipment Values by Brand</h1>'), 'brands h1')
assert(brandsDoc.bodyHtml.includes('Browse equipment by brand'), 'brands browse section')
assert(brandsDoc.openGraph['og:image'].includes('sell-gym-equipment-og.png'), 'brands og image')
assert(brandsDoc.canonicalPath === '/brands', 'brands canonical unchanged')
assert(brandsDoc.bodyHtml.includes('/brands/life-fitness'), 'brands crawlable link')
assert(
  Array.isArray(brandsDoc.jsonLd)
    && brandsDoc.jsonLd.some((entry) => entry['@type'] === 'BreadcrumbList'),
  'brands index breadcrumb json-ld',
)
assert(
  brandsDoc.jsonLd.some((entry) => entry['@type'] === 'BreadcrumbList' && entry['@id']?.endsWith('#breadcrumb')),
  'brands index breadcrumb @id',
)

const brandDoc = buildBrandPageSeoDocument({
  brand: brands[0],
  products: [{
    displayName: products[0].canonical_product_name,
    href: '/equipment/life-fitness-integrity-treadmill',
    canonicalProductKey: products[0].canonical_product_key,
  }],
  categories: [{ label: 'Treadmill', count: 1 }],
})
assert(brandDoc.canonicalPath === '/brands/life-fitness', 'brand canonical')
assert(brandDoc.bodyHtml.includes('Life Fitness Equipment Values'), 'brand identity')
assert(brandDoc.bodyHtml.includes('life-fitness-integrity-treadmill'), 'brand product link')
assert(brandDoc.bodyHtml.includes('value guide'), 'value guide anchor')
assert(brandDoc.title.includes('Equipment Values'), 'brand meta title')
assert(brandDoc.bodyHtml.includes('Common questions'), 'brand faq section')
assert(
  brandDoc.jsonLd.some((entry) => entry['@type'] === 'FAQPage'),
  'brand faq json-ld',
)
assert(
  brandDoc.jsonLd.filter((entry) => entry['@type'] === 'FAQPage').length === 1,
  'single brand FAQPage entity',
)

const productDoc = buildEquipmentPageSeoDocument({
  product: products[0],
  content: {
    overview_text: 'A commercial treadmill overview.',
    seo_title: 'Integrity Treadmill SEO Title',
    seo_meta_description: 'Integrity meta description.',
  },
  hasConsoleOptions: true,
})
assert(productDoc.title === 'Integrity Treadmill SEO Title | Equipd', 'product seo title')
assert(productDoc.description === 'Integrity meta description.', 'product seo description')
assert(productDoc.bodyHtml.includes('<h1>Life Fitness Integrity Treadmill</h1>'), 'product h1')
assert(productDoc.bodyHtml.includes('A commercial treadmill overview.'), 'product about')
assert(productDoc.bodyHtml.includes('data-canonical-product-key'), 'product identity attr')
assert(productDoc.jsonLd.some((entry) => entry['@type'] === 'Product'), 'product json-ld')
assert(productDoc.jsonLd.some((entry) => entry['@type'] === 'BreadcrumbList'), 'breadcrumb json-ld')
assert(
  productDoc.jsonLd.some((entry) => entry['@type'] === 'BreadcrumbList' && entry['@id']?.includes('#breadcrumb')),
  'breadcrumb @id',
)
assert(!productDoc.jsonLd.some((entry) => entry['@type'] === 'FAQPage'), 'no FAQPage without faq_json')
assert(productDoc.openGraph['og:site_name'] === 'Equipd', 'product og')
assert(productDoc.robots === 'index, follow', 'product robots')

const productDocWithFaqs = buildEquipmentPageSeoDocument({
  product: products[0],
  content: {
    overview_text: 'A commercial treadmill overview.',
    seo_title: 'Integrity Treadmill SEO Title',
    seo_meta_description: 'Integrity meta description.',
    faq_json: [
      { question: 'When was it made?', answer: 'From 2015 according to Equipd records.' },
      { question: 'What affects value?', answer: 'Year, condition and console configuration.' },
    ],
  },
  hasConsoleOptions: true,
})
assert(productDocWithFaqs.jsonLd.some((entry) => entry['@type'] === 'FAQPage'), 'FAQPage when faqs present')
assert(
  (productDocWithFaqs.jsonLd.filter((entry) => entry['@type'] === 'FAQPage') || []).length === 1,
  'exactly one FAQPage',
)
assert(productDocWithFaqs.bodyHtml.includes('Common questions'), 'FAQ section in prerender body')
assert(productDocWithFaqs.bodyHtml.includes('When was it made?'), 'FAQ question in body')

const template = `<!doctype html>
<html lang="en">
  <head>
    <title>Equipd — Used Gym Equipment</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`

const html = injectSeoIntoHtml(template, productDoc)
assert(html.includes('<title>Integrity Treadmill SEO Title | Equipd</title>'), 'injected title')
assert(html.includes('name="description"'), 'injected description')
assert(html.includes('rel="canonical"'), 'injected canonical')
assert(html.includes('property="og:title"'), 'injected og')
assert(html.includes('name="twitter:card"'), 'injected twitter')
assert(html.includes('application/ld+json'), 'injected json-ld')
assert(html.includes('data-equipd-schema="organization"'), 'site organization schema')
assert(html.includes('data-equipd-schema="website"'), 'site website schema')
assert(html.includes('data-equipd-schema="breadcrumb"'), 'breadcrumb schema marker')
assert((html.match(/data-equipd-schema="breadcrumb"/g) || []).length === 1, 'single breadcrumb')
assert(html.includes('data-equipd-schema="product"'), 'product schema marker')
assert((html.match(/data-equipd-schema="product"/g) || []).length === 1, 'single product')
assert(html.includes('https://www.equipd.co.uk/browse?search={search_term_string}'), 'search action')
assert((html.match(/data-equipd-schema="organization"/g) || []).length === 1, 'single organization')
assert((html.match(/data-equipd-schema="website"/g) || []).length === 1, 'single website')
assert(!html.includes('https://equipd.co.uk/'), 'prerender html avoids non-www host')
assert(!html.includes('localhost'), 'prerender html avoids localhost')
assert(!html.includes('vercel.app'), 'prerender html avoids preview hosts')
assert(html.includes('A commercial treadmill overview.'), 'injected body')
assert(html.includes('id="root"'), 'keeps root')
assert(html.includes('/assets/index.js'), 'keeps spa script')

const htmlWithFaqs = injectSeoIntoHtml(template, productDocWithFaqs)
assert(htmlWithFaqs.includes('data-equipd-schema="faq"'), 'faq schema marker')
assert((htmlWithFaqs.match(/data-equipd-schema="faq"/g) || []).length === 1, 'single faq')
assert((htmlWithFaqs.match(/data-equipd-schema="product"/g) || []).length === 1, 'faq page keeps single product')
assert((htmlWithFaqs.match(/data-equipd-schema="organization"/g) || []).length === 1, 'faq page keeps single org')
assert((htmlWithFaqs.match(/data-equipd-schema="website"/g) || []).length === 1, 'faq page keeps single website')
assert((htmlWithFaqs.match(/data-equipd-schema="breadcrumb"/g) || []).length === 1, 'faq page keeps breadcrumb')

console.log('seo catalogue prerender tests passed')
