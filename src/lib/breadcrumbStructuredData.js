/**
 * Shared Schema.org BreadcrumbList builders and HTML injection helpers.
 * Reuses EQUIPD_SITE_ORIGIN — do not introduce a second site-origin constant.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'

/** Matches siteStructuredData.SITE_SCHEMA_ATTR without importing that module (avoids cycles). */
export const SITE_SCHEMA_ATTR = 'data-equipd-schema'

export const BREADCRUMB_SCHEMA_KEY = 'breadcrumb'

export function absoluteBreadcrumbUrl(pathOrUrl = '/') {
  const raw = String(pathOrUrl ?? '').trim()
  if (!raw) return `${EQUIPD_SITE_ORIGIN}/`

  try {
    const parsed = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, EQUIPD_SITE_ORIGIN)

    // Canonical www origin; drop query/hash for breadcrumb item URLs.
    let pathname = parsed.pathname || '/'
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.replace(/\/+$/, '')
    }

    if (pathname === '/') return `${EQUIPD_SITE_ORIGIN}/`
    return `${EQUIPD_SITE_ORIGIN}${pathname}`
  } catch {
    return `${EQUIPD_SITE_ORIGIN}/`
  }
}

export function normalizeBreadcrumbName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * @param {Array<{ name?: string, label?: string, item?: string, url?: string, path?: string, href?: string, to?: string }>} items
 */
export function normalizeBreadcrumbItems(items = []) {
  const normalized = []
  for (const entry of items) {
    const name = normalizeBreadcrumbName(entry?.name ?? entry?.label)
    const item = absoluteBreadcrumbUrl(
      entry?.item ?? entry?.url ?? entry?.path ?? entry?.href ?? entry?.to,
    )
    if (!name || !item) continue
    normalized.push({ name, item })
  }
  return normalized
}

/**
 * Build a single BreadcrumbList JSON-LD object.
 * @param {Array} items Breadcrumb entries (name + path/url)
 * @param {{ canonicalUrl?: string }} [options]
 */
export function buildBreadcrumbSchema(items, { canonicalUrl = null } = {}) {
  const list = normalizeBreadcrumbItems(items)
  if (!list.length) return null

  const pageUrl = absoluteBreadcrumbUrl(canonicalUrl || list[list.length - 1].item)

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: list.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  }
}

export function buildBrandsIndexBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Equipment Values', path: '/brands' },
    ],
    { canonicalUrl: `${EQUIPD_SITE_ORIGIN}/brands` },
  )
}

export function buildBrandPageBreadcrumbSchema(brand) {
  const displayName = normalizeBreadcrumbName(brand?.displayName)
  const path = brand?.href || (brand?.slug ? `/brands/${brand.slug}` : null)
  const absolute = brand?.absoluteUrl || (path ? absoluteBreadcrumbUrl(path) : null)
  if (!displayName || !absolute) return null

  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Equipment Values', path: '/brands' },
      { name: displayName, item: absolute },
    ],
    { canonicalUrl: absolute },
  )
}

export function buildEquipmentBreadcrumbSchema(product, {
  brandSlug = null,
  brandDisplayName = null,
  productName = null,
  productUrl = null,
} = {}) {
  const name = normalizeBreadcrumbName(productName)
  const url = productUrl ? absoluteBreadcrumbUrl(productUrl) : null
  if (!name || !url) return null

  const items = [
    { name: 'Home', path: '/' },
    { name: 'Equipment Values', path: '/brands' },
  ]

  const resolvedBrandSlug = String(brandSlug ?? '').trim()
  const brandName = normalizeBreadcrumbName(brandDisplayName)
  if (resolvedBrandSlug && brandName) {
    items.push({
      name: brandName,
      path: `/brands/${resolvedBrandSlug}`,
    })
  }

  items.push({ name, item: url })
  return buildBreadcrumbSchema(items, { canonicalUrl: url })
}

export function buildHelpCentreBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Help Centre', path: '/help' },
    ],
    { canonicalUrl: `${EQUIPD_SITE_ORIGIN}/help` },
  )
}

export function buildHelpArticleBreadcrumbSchema(article) {
  const title = normalizeBreadcrumbName(article?.title)
  const slug = String(article?.slug ?? '').trim()
  if (!title || !slug) return null

  const path = `/help/${slug}`
  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Help Centre', path: '/help' },
      { name: title, path },
    ],
    { canonicalUrl: path },
  )
}

export function buildLocationPageBreadcrumbSchema(location) {
  const name = normalizeBreadcrumbName(location?.name || location?.regionName)
  const slug = String(location?.slug ?? '').trim()
  if (!name || !slug) return null

  const path = `/listings/${slug}`
  // No dedicated "Browse by Location" index route — do not invent one.
  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name, path },
    ],
    { canonicalUrl: path },
  )
}

/**
 * Marketplace listing trail. Category query URLs are not indexable landings,
 * so the hierarchy is Home → Browse → Listing.
 */
export function buildListingBreadcrumbSchema(listing) {
  const title = normalizeBreadcrumbName(listing?.title)
  const slug = String(listing?.slug ?? '').trim()
  const status = String(listing?.status ?? '').trim().toLowerCase()
  if (!title || !slug || status !== 'active') return null

  const path = `/listings/${slug}`
  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Browse', path: '/browse' },
      { name: title, path },
    ],
    { canonicalUrl: path },
  )
}

function escapeJsonForHtmlScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function renderBreadcrumbScriptTag(schema) {
  if (!schema || schema['@type'] !== 'BreadcrumbList') return ''
  return [
    `<script type="application/ld+json" ${SITE_SCHEMA_ATTR}="${BREADCRUMB_SCHEMA_KEY}">`,
    escapeJsonForHtmlScript(schema),
    '</script>',
  ].join('')
}

export function findBreadcrumbSchemas(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  return list.filter((node) => node && node['@type'] === 'BreadcrumbList')
}

export function excludeBreadcrumbSchemas(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  return list.filter((node) => node && node['@type'] !== 'BreadcrumbList')
}

/**
 * Idempotently ensure a single BreadcrumbList script exists for the given schema.
 * Replaces any existing breadcrumb scripts whose @id differs.
 */
export function syncBreadcrumbSchemaInDocument(doc, schema) {
  if (!doc?.head) return null
  const selector = `script[${SITE_SCHEMA_ATTR}="${BREADCRUMB_SCHEMA_KEY}"]`
  const existing = [...doc.head.querySelectorAll(selector)]

  if (!schema) {
    for (const node of existing) node.remove()
    return null
  }

  const expectedId = schema['@id']
  const matching = existing.filter((node) => {
    try {
      const raw = node.textContent || node.text || ''
      return JSON.parse(raw)['@id'] === expectedId
        && raw === JSON.stringify(schema)
    } catch {
      return false
    }
  })

  if (matching.length === 1 && existing.length === 1) {
    return matching[0]
  }

  for (const node of existing) node.remove()

  const script = doc.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute(SITE_SCHEMA_ATTR, BREADCRUMB_SCHEMA_KEY)
  const serialized = JSON.stringify(schema)
  script.text = serialized
  script.textContent = serialized
  doc.head.appendChild(script)
  return script
}
