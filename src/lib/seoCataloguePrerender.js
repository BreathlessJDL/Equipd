/**
 * Build-time SEO HTML helpers for public catalogue routes.
 * Node-safe (no DOM / Supabase client).
 */

import { brandsMatch } from './consoleModifierMatch.js'
import {
  EQUIPD_SITE_ORIGIN,
  buildBrandCollectionJsonLd,
  buildBrandIntro,
  buildBrandPageJsonLd,
  getBrandAbsoluteUrl,
  getBrandDisplayName,
  getBrandPagePath,
  getBrandSlug,
  getProductSeriesLabel,
  isPublicBrandCatalogueProduct,
  resolveBrandRegistryEntry,
  slugifyBrandName,
} from './brandCatalogueCore.js'
import {
  buildEquipmentCanonicalPath,
  buildEquipmentInternalLinks,
  buildEquipmentPageSeoBundle,
  buildEquipmentProductPagePath,
  getEquipmentProductPublicName,
} from './equipmentPageSeo.js'
import {
  buildBrandsIndexBreadcrumbSchema,
  buildBrandPageBreadcrumbSchema,
  renderBreadcrumbScriptTag,
} from './breadcrumbStructuredData.js'
import {
  buildFaqPageSchemaNode,
  normalizeFaqItems,
  renderFaqPageScriptTag,
} from './faqPageStructuredData.js'
import { renderProductScriptTag } from './productPageStructuredData.js'
import { injectSiteStructuredDataIntoHtml } from './siteStructuredData.js'

export { buildEquipmentProductPagePath }
export const SEO_PRERENDER_MARKER = 'data-equipd-seo-prerender'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absoluteUrl(path) {
  if (!path) return EQUIPD_SITE_ORIGIN
  if (path.startsWith('http')) return path
  return `${EQUIPD_SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildSeoRouteList({ brands = [], products = [] } = {}) {
  const routes = [
    { path: '/brands', type: 'brands-index' },
  ]

  for (const brand of brands) {
    if (!brand?.slug) continue
    routes.push({
      path: getBrandPagePath(brand.slug),
      type: 'brand',
      brandSlug: brand.slug,
    })
  }

  for (const product of products) {
    if (!isPublicBrandCatalogueProduct(product)) continue
    const key = String(product.canonical_product_key ?? '').trim()
    if (!key) continue
    routes.push({
      path: buildEquipmentProductPagePath(key),
      type: 'equipment',
      canonicalProductKey: key,
    })
  }

  return routes
}

export function buildProductPageJsonLd(product, {
  description = null,
  brandSlug = null,
  brandDisplayName = null,
  imageUrl = null,
  hasConsoleOptions = null,
} = {}) {
  const bundle = buildEquipmentPageSeoBundle(product, {
    seoDescription: description,
    brandSlug,
    brandDisplayName,
    imageUrl,
    hasConsoleOptions,
  })
  return bundle.jsonLd
}

function renderOpenGraphTags(openGraph = {}) {
  return Object.entries(openGraph)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      if (key.startsWith('twitter:')) {
        return `<meta name="${escapeHtml(key)}" content="${escapeHtml(value)}" />`
      }
      return `<meta property="${escapeHtml(key)}" content="${escapeHtml(value)}" />`
    })
    .join('\n    ')
}

/** Optional <link> tags from SEO documents (e.g. LCP image preload). */
function renderHeadLinks(links = []) {
  if (!Array.isArray(links) || !links.length) return ''
  return links
    .filter((link) => link?.rel && link?.href)
    .map((link) => {
      const attrs = [
        `rel="${escapeHtml(link.rel)}"`,
        link.as ? `as="${escapeHtml(link.as)}"` : '',
        `href="${escapeHtml(link.href)}"`,
        link.type ? `type="${escapeHtml(link.type)}"` : '',
        link.media ? `media="${escapeHtml(link.media)}"` : '',
        link.fetchPriority ? `fetchpriority="${escapeHtml(link.fetchPriority)}"` : '',
        link.crossOrigin ? `crossorigin="${escapeHtml(link.crossOrigin === true ? '' : link.crossOrigin)}"` : '',
      ]
        .filter(Boolean)
        .join(' ')
      return `<link ${attrs} />`
    })
    .join('\n    ')
}

function renderBreadcrumbs(items = []) {
  const parts = items.map((item, index) => {
    const isLast = index === items.length - 1
    if (isLast || !item.href) {
      return `<span>${escapeHtml(item.label)}</span>`
    }
    return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
  })
  return `<nav aria-label="Breadcrumb"><p>${parts.join(' <span aria-hidden="true">/</span> ')}</p></nav>`
}

function renderLinkList(links = [], { labelledBy = null } = {}) {
  if (!links.length) return ''
  const items = links.map((link) => (
    `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`
  )).join('')
  const labelled = labelledBy ? ` aria-labelledby="${escapeHtml(labelledBy)}"` : ''
  return `<ul${labelled}>${items}</ul>`
}

function renderJsonLd(data) {
  if (!data) return ''
  const payload = Array.isArray(data) ? data.filter(Boolean) : [data]
  return payload.map((entry) => {
    if (entry?.['@type'] === 'BreadcrumbList') {
      return renderBreadcrumbScriptTag(entry)
    }
    if (entry?.['@type'] === 'FAQPage') {
      return renderFaqPageScriptTag(entry)
    }
    if (entry?.['@type'] === 'Product') {
      return renderProductScriptTag(entry)
    }
    return `<script type="application/ld+json">${JSON.stringify(entry).replace(/</g, '\\u003c')}</script>`
  }).join('\n')
}

function renderFaqSection(faqs = []) {
  const { items } = normalizeFaqItems(faqs)
  if (!items.length) return ''

  const entries = items.map((entry) => (
    `<details>
      <summary>${escapeHtml(entry.question)}</summary>
      <p>${escapeHtml(entry.answer)}</p>
    </details>`
  )).join('')

  return `<section aria-labelledby="seo-product-faq-heading">
    <h2 id="seo-product-faq-heading">Common questions</h2>
    ${entries}
  </section>`
}

export function buildBrandsIndexSeoDocument({ brands = [] } = {}) {
  const title = 'Instant Gym Equipment Valuation | Value Your Equipment Online | Equipd'
  const description =
    'Value commercial and home gym equipment online. Search by brand or model to receive an instant estimated used value based on original RRP, manufacture year, depreciation models and UK market data. Browse equipment guides or sell your equipment on Equipd.'
  const path = '/brands'
  const brandLinks = brands.map((brand) => ({
    href: brand.href || getBrandPagePath(brand.slug),
    label: `${brand.displayName} (${brand.productCount} equipment models covered)`,
  }))

  const body = `
<article class="seo-prerender" ${SEO_PRERENDER_MARKER}="brands-index">
  ${renderBreadcrumbs([
    { label: 'Home', href: '/' },
    { label: 'Equipment Values' },
  ])}
  <header>
    <h1>Instant Gym Equipment Valuation</h1>
    <p>Search by brand or model to estimate today's used market value. You can also browse equipment by manufacturer below.</p>
  </header>
  <section aria-labelledby="seo-brands-list-heading">
    <h2 id="seo-brands-list-heading">Browse equipment by brand</h2>
    ${renderLinkList(brandLinks, { labelledBy: 'seo-brands-list-heading' })}
  </section>
  <p><a href="/browse">View current marketplace listings</a> · <a href="/valuation">Value your equipment</a></p>
</article>`.trim()

  return {
    path,
    title,
    description,
    canonicalPath: path,
    jsonLd: [
      buildBrandCollectionJsonLd(brands),
      buildBrandsIndexBreadcrumbSchema(),
    ].filter(Boolean),
    bodyHtml: body,
  }
}

export function buildBrandPageSeoDocument({ brand, products = [], categories = [] } = {}) {
  if (!brand?.slug) return null

  const title = `${brand.displayName} Equipment Values and Model Guides | Equipd`
  const description = `Explore estimated used values, original RRPs, production years and console options across ${brand.displayName} equipment models.`
  const intro = brand.intro || buildBrandIntro(brand.displayName)
  const path = getBrandPagePath(brand.slug)
  const productLinks = products.map((product) => ({
    href: product.href || buildEquipmentProductPagePath(product.canonicalProductKey || product.canonical_product_key),
    label: `${product.displayName || product.canonical_product_name} value guide`,
  })).filter((link) => link.href && link.label)

  const categoryBits = categories.length
    ? `<section aria-labelledby="seo-brand-categories-heading">
    <h2 id="seo-brand-categories-heading">Browse by equipment type</h2>
    <ul>${categories.map((category) => (
      `<li>${escapeHtml(category.label || category.name || category.equipmentType)} (${escapeHtml(category.count ?? category.productCount)})</li>`
    )).join('')}</ul>
  </section>`
    : ''

  const body = `
<article class="seo-prerender" ${SEO_PRERENDER_MARKER}="brand" data-brand-slug="${escapeHtml(brand.slug)}">
  ${renderBreadcrumbs([
    { label: 'Home', href: '/' },
    { label: 'Equipment Values', href: '/brands' },
    { label: brand.displayName },
  ])}
  <header>
    <h1>${escapeHtml(brand.displayName)} Equipment Values</h1>
    <p>${escapeHtml(intro)}</p>
    <p>${escapeHtml(brand.productCount)} equipment models covered${brand.listingCount ? ` · ${escapeHtml(brand.listingCount)} current marketplace listings` : ''}</p>
  </header>
  ${categoryBits}
  <section aria-labelledby="seo-brand-products-heading">
    <h2 id="seo-brand-products-heading">Explore ${escapeHtml(brand.displayName)} equipment values</h2>
    ${renderLinkList(productLinks, { labelledBy: 'seo-brand-products-heading' })}
  </section>
  <p>
    <a href="${escapeHtml(brand.browseListingsHref || `/browse?brand=${encodeURIComponent(brand.displayName)}`)}">View current ${escapeHtml(brand.displayName)} marketplace listings</a>
    · <a href="/valuation">Value your equipment</a>
    · <a href="/brands">All brand value guides</a>
  </p>
</article>`.trim()

  return {
    path,
    title,
    description,
    canonicalPath: path,
    jsonLd: [
      buildBrandPageJsonLd(brand, products),
      buildBrandPageBreadcrumbSchema(brand),
    ].filter(Boolean),
    bodyHtml: body,
  }
}

export function buildEquipmentPageSeoDocument({
  product,
  content = null,
  brandSlug = null,
  brandDisplayName = null,
  hasConsoleOptions = null,
  imageUrl = null,
} = {}) {
  if (!product?.canonical_product_key) return null

  const displayName = getEquipmentProductPublicName(product)
  const path = buildEquipmentCanonicalPath(product)
  const resolvedBrandSlug = brandSlug || getBrandSlug(product.brand)
  const brandName = brandDisplayName || getBrandDisplayName(product.brand)
  const overview = String(content?.overview_text || '').trim()
  const faqSource = Array.isArray(content?.faq_json) ? content.faq_json : []
  const { items: faqItems } = normalizeFaqItems(faqSource)

  const seo = buildEquipmentPageSeoBundle(product, {
    seoTitle: content?.seo_title || null,
    seoDescription: content?.seo_meta_description || null,
    overviewText: content?.overview_text || null,
    hasConsoleOptions,
    brandSlug: resolvedBrandSlug,
    brandDisplayName: brandName,
    imageUrl,
  })

  const faqSchema = seo.indexability.indexable
    ? buildFaqPageSchemaNode(faqItems, { canonicalUrl: seo.canonicalUrl })
    : null

  const series = getProductSeriesLabel(product)
  const yearBits = []
  if (product.production_start_year && product.production_end_year) {
    yearBits.push(`${product.production_start_year}–${product.production_end_year}`)
  } else if (product.baseline_manufacture_year) {
    yearBits.push(String(product.baseline_manufacture_year))
  }

  const facts = [
    product.equipment_type
      && String(product.equipment_type).toLowerCase() !== 'unknown'
      ? `<li><strong>Type:</strong> ${escapeHtml(product.equipment_type)}</li>`
      : '',
    series ? `<li><strong>Series:</strong> ${escapeHtml(series)}</li>` : '',
    yearBits.length ? `<li><strong>Production years:</strong> ${escapeHtml(yearBits.join(', '))}</li>` : '',
    product.original_base_price != null
      ? `<li><strong>Original RRP:</strong> ${escapeHtml(product.original_base_price_currency || 'GBP')} ${escapeHtml(product.original_base_price)}</li>`
      : '',
  ].filter(Boolean).join('')

  const about = overview
    ? `<section aria-labelledby="seo-product-overview-heading">
    <h2 id="seo-product-overview-heading">Overview</h2>
    <p>${escapeHtml(overview)}</p>
  </section>`
    : ''

  const internalLinks = (seo.internalLinks?.length
    ? seo.internalLinks
    : buildEquipmentInternalLinks(product, { hasConsoleOptions }))
  const related = internalLinks.length
    ? `<section aria-labelledby="seo-product-related-heading">
    <h2 id="seo-product-related-heading">Related on Equipd</h2>
    ${renderLinkList(internalLinks, { labelledBy: 'seo-product-related-heading' })}
  </section>`
    : ''

  const body = `
<article class="seo-prerender" ${SEO_PRERENDER_MARKER}="equipment" data-canonical-product-key="${escapeHtml(product.canonical_product_key)}">
  ${renderBreadcrumbs([
    { label: 'Home', href: '/' },
    { label: 'Equipment Values', href: '/brands' },
    ...(resolvedBrandSlug
      ? [{ label: brandName, href: getBrandPagePath(resolvedBrandSlug) }]
      : []),
    { label: displayName },
  ])}
  <header>
    <p>${escapeHtml(brandName)}</p>
    <h1>${escapeHtml(displayName)}</h1>
    <p>${escapeHtml(seo.description)}</p>
  </header>
  <section aria-labelledby="seo-product-identity-heading">
    <h2 id="seo-product-identity-heading">Product details</h2>
    <ul>${facts}</ul>
  </section>
  ${about}
  ${seo.indexability.indexable ? renderFaqSection(faqItems) : ''}
  ${related}
</article>`.trim()

  return {
    path,
    title: seo.titleForDocument,
    description: seo.description,
    canonicalPath: path,
    robots: seo.indexability.robots,
    openGraph: seo.openGraph,
    jsonLd: [...(seo.jsonLd || []), faqSchema].filter(Boolean),
    bodyHtml: body,
  }
}

/**
 * Inject SEO head tags + body content into a Vite-built index.html template.
 */
export function injectSeoIntoHtml(templateHtml, document) {
  if (!templateHtml || !document) {
    throw new Error('injectSeoIntoHtml requires templateHtml and document')
  }

  let html = templateHtml

  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(document.title)}</title>`,
  )

  // Drop homepage defaults so page-specific description/canonical/social tags win.
  html = html
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')

  const headExtras = [
    `<meta name="description" content="${escapeHtml(document.description)}" />`,
    document.robots
      ? `<meta name="robots" content="${escapeHtml(document.robots)}" />`
      : '',
    `<link rel="canonical" href="${escapeHtml(absoluteUrl(document.canonicalPath))}" />`,
    renderHeadLinks(document.headLinks),
    renderOpenGraphTags(document.openGraph || {}),
    renderJsonLd(document.jsonLd),
    `<style id="equipd-seo-prerender-style">.seo-prerender{max-width:48rem;margin:1.5rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.5;color:#111}.seo-prerender a{color:#0b57d0}.seo-prerender ul{padding-left:1.25rem}</style>`,
  ].filter(Boolean).join('\n    ')

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `    ${headExtras}\n  </head>`)
  } else {
    html = `${headExtras}\n${html}`
  }

  const rootWithBody = `<div id="root">${document.bodyHtml}</div>`
  if (/<div id="root"><\/div>/i.test(html)) {
    html = html.replace(/<div id="root"><\/div>/i, rootWithBody)
  } else if (/<div id="root">[\s\S]*?<\/div>/i.test(html)) {
    html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, rootWithBody)
  } else {
    throw new Error('Could not find #root in index.html template')
  }

  // Ensure Organization + WebSite JSON-LD exist exactly once in <head>
  // (template may already include them after the post-Vite inject step).
  return injectSiteStructuredDataIntoHtml(html)
}

export function mapProductForBrandSeo(product) {
  return {
    id: product.id,
    brand: product.brand,
    displayName: product.canonical_product_name,
    canonicalProductKey: product.canonical_product_key,
    href: buildEquipmentProductPagePath(product.canonical_product_key),
    equipmentType: product.equipment_type || null,
    series: getProductSeriesLabel(product),
  }
}

export function buildBrandPayloadFromProducts(brandSlug, products = [], listingCount = 0) {
  const slug = slugifyBrandName(brandSlug)
  const registry = resolveBrandRegistryEntry(slug)
  const matched = products.filter((product) => {
    if (!isPublicBrandCatalogueProduct(product)) return false
    const productSlug = getBrandSlug(product.brand)
    if (productSlug === slug) return true
    if (registry) return brandsMatch(registry.displayName, product.brand)
    return false
  })

  if (!matched.length) return null

  const displayName = registry?.displayName || getBrandDisplayName(matched[0].brand)
  const brand = {
    key: registry?.key || displayName,
    displayName,
    slug,
    href: getBrandPagePath(slug),
    absoluteUrl: getBrandAbsoluteUrl(slug),
    shortDescription: registry?.shortDescription || null,
    intro: buildBrandIntro(displayName),
    productCount: matched.length,
    listingCount,
    browseListingsHref: `/browse?brand=${encodeURIComponent(displayName)}`,
  }

  const categoryMap = new Map()
  for (const product of matched) {
    const type = String(product.equipment_type || '').trim() || 'Other'
    categoryMap.set(type, (categoryMap.get(type) || 0) + 1)
  }

  return {
    brand,
    products: matched.map(mapProductForBrandSeo)
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    categories: [...categoryMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  }
}
