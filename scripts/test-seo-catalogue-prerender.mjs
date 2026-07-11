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
    absoluteUrl: 'https://equipd.co.uk/brands/life-fitness',
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
assert(brandsDoc.title.includes('Value Guides'), 'brands title')
assert(brandsDoc.bodyHtml.includes('<h1>Gym Equipment Value Guides by Brand</h1>'), 'brands h1')
assert(brandsDoc.bodyHtml.includes('/brands/life-fitness'), 'brands crawlable link')

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
assert(productDoc.openGraph['og:site_name'] === 'Equipd', 'product og')
assert(productDoc.robots === 'index, follow', 'product robots')

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
assert(html.includes('A commercial treadmill overview.'), 'injected body')
assert(html.includes('id="root"'), 'keeps root')
assert(html.includes('/assets/index.js'), 'keeps spa script')

console.log('seo-catalogue-prerender tests passed')
