/**
 * Shared SEO helpers for public equipment product pages.
 * Node-safe (no DOM). Used by client pages and build-time prerender/sitemap.
 */

import {
  EQUIPD_SITE_ORIGIN,
  getBrandAbsoluteUrl,
  getBrandDisplayName,
  getBrandPagePath,
  getBrandSlug,
  getProductSeriesLabel,
  isPublicBrandCatalogueProduct,
} from './brandCatalogueCore.js'
import { buildEquipmentBreadcrumbSchema } from './breadcrumbStructuredData.js'
import { LISTING_CATEGORY_OPTIONS } from './listingOptions.js'
import { supportsProductConsoleOptions } from './equipmentCardio.js'

export { EQUIPD_SITE_ORIGIN }

export const EQUIPD_DEFAULT_OG_IMAGE_PATH = '/email/equipd-full-logo.png'
const APPROVED_IMAGE_STATUS = 'approved'
const APPROVED_PRODUCT_STATUS = 'approved'

const TITLE_SUFFIX = 'Value, Original RRP & Information'

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function absoluteUrl(pathOrUrl) {
  const value = String(pathOrUrl ?? '').trim()
  if (!value) return EQUIPD_SITE_ORIGIN
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `${EQUIPD_SITE_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`
}

export function getEquipmentProductPublicName(product) {
  return normalizeWhitespace(product?.canonical_product_name)
    || [product?.brand, product?.model].filter(Boolean).join(' ')
    || 'Gym equipment'
}

export function buildEquipmentProductPagePath(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return null
  return `/equipment/${encodeURIComponent(key)}`
}

export function buildEquipmentCanonicalPath(product) {
  return buildEquipmentProductPagePath(product?.canonical_product_key)
}

export function buildEquipmentCanonicalUrl(product) {
  const path = buildEquipmentCanonicalPath(product)
  return path ? absoluteUrl(path) : null
}

export function stripEquipdTitleSuffix(title) {
  return normalizeWhitespace(String(title ?? '').replace(/\s*\|\s*Equipd\s*$/i, ''))
}

/**
 * Page title without site suffix (usePageTitle / formatPageTitle appends "| Equipd").
 * Full document title for prerender: pass { includeSiteName: true }.
 */
export function buildEquipmentPageTitle(product, { seoTitle = null, includeSiteName = false } = {}) {
  const fromContent = stripEquipdTitleSuffix(seoTitle)
  const displayName = getEquipmentProductPublicName(product)
  const base = fromContent
    || (displayName ? `${displayName} ${TITLE_SUFFIX}` : 'Equipment value guide')
  if (!includeSiteName) return base
  return `${base} | Equipd`
}

function productMentionsYears(product) {
  return Boolean(
    product?.production_start_year
    || product?.production_end_year
    || product?.baseline_manufacture_year,
  )
}

function productMentionsRrp(product) {
  const price = Number(product?.original_base_price)
  return Number.isFinite(price) && price > 0
}

/**
 * Unique meta description from real product fields only.
 */
export function buildEquipmentMetaDescription(product, {
  seoDescription = null,
  hasConsoleOptions = null,
} = {}) {
  const fromContent = normalizeWhitespace(seoDescription)
  if (fromContent) {
    return fromContent.length > 160 ? `${fromContent.slice(0, 157).trim()}…` : fromContent
  }

  const name = getEquipmentProductPublicName(product)
  const showConsoles = hasConsoleOptions == null
    ? supportsProductConsoleOptions(product)
    : Boolean(hasConsoleOptions)

  const parts = []
  if (productMentionsRrp(product)) parts.push('estimated original RRP')
  if (productMentionsYears(product)) parts.push('manufacture year')
  parts.push('used market value')
  if (showConsoles) parts.push('console options')
  else parts.push('product information')

  let description = `View the ${parts.slice(0, -1).join(', ')}`
  if (parts.length > 1) {
    description += ` and ${parts[parts.length - 1]}`
  } else {
    description = `View the ${parts[0]}`
  }
  description += ` for the ${name}.`

  if (description.length > 160) {
    description = `View original RRP, used market value and product information for the ${name}.`
  }
  if (description.length > 160) {
    description = `Used gym equipment values and product information for the ${name}.`
  }

  return description
}

export function getIndexabilityForProduct(product) {
  const status = String(product?.status ?? '').trim().toLowerCase()
  const key = String(product?.canonical_product_key ?? '').trim()
  const approved = status === APPROVED_PRODUCT_STATUS
  const publicOk = isPublicBrandCatalogueProduct(product)

  if (!key || !approved || !publicOk) {
    return {
      indexable: false,
      robots: 'noindex, follow',
      reason: !key
        ? 'missing_key'
        : !approved
          ? 'not_approved'
          : 'not_public_catalogue',
    }
  }

  return {
    indexable: true,
    robots: 'index, follow',
    reason: 'approved_public',
  }
}

/**
 * Approved product image URL for SEO/social. Prefers absolute public URLs only.
 * Does not invent images; returns null when none approved.
 */
export function getApprovedEquipmentImage(product) {
  const status = String(product?.image_status ?? '').trim().toLowerCase()
  if (status !== APPROVED_IMAGE_STATUS) return null

  const imageUrl = normalizeWhitespace(product?.image_url)
  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    return imageUrl
  }

  return null
}

export function getEquipmentSocialImageUrl(product) {
  return getApprovedEquipmentImage(product) || absoluteUrl(EQUIPD_DEFAULT_OG_IMAGE_PATH)
}

function stripHtmlToPlainText(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeProductSchemaDescription(value) {
  const text = stripHtmlToPlainText(value)
  return text || null
}

function normalizeProductSchemaCategory(equipmentType) {
  const category = normalizeWhitespace(equipmentType)
  if (!category) return null
  if (category.toLowerCase() === 'unknown') return null
  // Reject raw enum-like codes (snake_case / internal taxonomy).
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(category)) return null
  return category
}

/**
 * Absolute https image suitable for Product schema.
 * Rejects placeholders, preview hosts, and the site-wide OG logo fallback.
 */
export function resolveProductSchemaImageUrl(imageUrl = null, product = null) {
  const candidates = [
    normalizeWhitespace(imageUrl),
    getApprovedEquipmentImage(product),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (!/^https:\/\//i.test(candidate)) continue
    if (/localhost|\.vercel\.app/i.test(candidate)) continue
    if (candidate.includes(EQUIPD_DEFAULT_OG_IMAGE_PATH)) continue
    return candidate
  }
  return null
}

/**
 * Conservative Product JSON-LD for canonical equipment guide pages.
 * Describes the model guide — never invents retail offers, ratings, or identifiers.
 */
export function buildEquipmentProductJsonLd(product, {
  description = null,
  imageUrl = null,
  brandDisplayName = null,
} = {}) {
  if (!getIndexabilityForProduct(product).indexable) return null

  const name = getEquipmentProductPublicName(product)
  const url = buildEquipmentCanonicalUrl(product)
  if (!name || !url) return null
  // Reject totally generic fallback name with no brand/model identity.
  if (name === 'Gym equipment' && !normalizeWhitespace(product?.brand) && !normalizeWhitespace(product?.model)) {
    return null
  }

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name,
    url,
    mainEntityOfPage: url,
  }

  const resolvedDescription = normalizeProductSchemaDescription(description)
  if (resolvedDescription) {
    productLd.description = resolvedDescription
  }

  const brandName = normalizeWhitespace(brandDisplayName || getBrandDisplayName(product.brand))
  if (brandName) {
    productLd.brand = {
      '@type': 'Brand',
      name: brandName,
    }
  }

  const image = resolveProductSchemaImageUrl(imageUrl, product)
  if (image) {
    productLd.image = [image]
  }

  const model = normalizeWhitespace(product.model)
  if (model) {
    productLd.model = model
  }

  const category = normalizeProductSchemaCategory(product.equipment_type)
  if (category) {
    productLd.category = category
  }

  // Intentionally omit: sku/mpn/gtin (no genuine manufacturer IDs),
  // offers/price/availability, aggregateRating/review, manufacturer (no separate field).

  return productLd
}

export function buildFactualOverviewFallback(product) {
  const name = getEquipmentProductPublicName(product)
  const brand = normalizeWhitespace(product?.brand)
  const type = normalizeWhitespace(product?.equipment_type)
  const series = getProductSeriesLabel(product)
  const bits = [`${name} is a commercial fitness product listed on Equipd.`]

  if (brand && type) bits.push(`It is a ${brand} ${type.toLowerCase()}.`)
  else if (brand) bits.push(`Brand: ${brand}.`)

  if (series) bits.push(`Series: ${series}.`)

  if (product.production_start_year && product.production_end_year) {
    bits.push(`Production years: ${product.production_start_year}–${product.production_end_year}.`)
  } else if (product.baseline_manufacture_year) {
    bits.push(`Manufactured from around ${product.baseline_manufacture_year}.`)
  }

  if (productMentionsRrp(product)) {
    const currency = product.original_base_price_currency || 'GBP'
    bits.push(`Estimated original RRP is recorded in ${currency}.`)
  }

  bits.push('Use Equipd to review estimated used market value and related product information.')
  return bits.join(' ')
}

function resolveBrowseCategorySlug(equipmentType) {
  const text = normalizeWhitespace(equipmentType).toLowerCase()
  if (!text || text === 'unknown') return null

  const exact = LISTING_CATEGORY_OPTIONS.find((option) => (
    option.slug === text
    || option.label.toLowerCase() === text
    || option.label.toLowerCase().replace(/s$/, '') === text.replace(/s$/, '')
  ))
  if (exact) return exact.slug

  if (text.includes('treadmill')) return 'treadmill'
  if (text.includes('cross')) return 'crosstrainers'
  if (text.includes('upright')) return 'upright-bikes'
  if (text.includes('recumbent')) return 'recumbent-bikes'
  if (text.includes('spin') || text.includes('indoor cycle')) return 'spin-bikes'
  if (text.includes('stair') || text.includes('climber') || text.includes('stepmill')) return 'stairclimbers'
  if (text.includes('rower') || text.includes('row')) return 'rowers'
  if (text.includes('skierg') || text.includes('ski erg')) return 'skierg'
  if (text.includes('plate')) return 'plate-loaded-machine'
  if (text.includes('pin')) return 'pin-loaded-machine'
  return null
}

/**
 * Natural internal links for product pages. Only includes destinations that exist.
 */
export function buildEquipmentInternalLinks(product, {
  hasConsoleOptions = null,
} = {}) {
  const links = []
  const name = getEquipmentProductPublicName(product)
  const brandName = getBrandDisplayName(product?.brand)
  const brandSlug = getBrandSlug(product?.brand)
  const type = normalizeWhitespace(product?.equipment_type)
  const series = getProductSeriesLabel(product)
  const key = String(product?.canonical_product_key ?? '').trim()
  const showConsoles = hasConsoleOptions == null
    ? supportsProductConsoleOptions(product)
    : Boolean(hasConsoleOptions)

  if (brandSlug && brandName) {
    links.push({
      href: getBrandPagePath(brandSlug),
      label: `More ${brandName} equipment`,
      kind: 'brand',
    })
  }

  const categorySlug = resolveBrowseCategorySlug(type)
  if (categorySlug && type) {
    links.push({
      href: `/browse?category=${encodeURIComponent(categorySlug)}`,
      label: `Browse used ${type.toLowerCase()}s`.replace(/ss$/, 's'),
      kind: 'type-browse',
    })
  }

  if (brandName && type) {
    const params = new URLSearchParams()
    params.set('brand', brandName)
    if (categorySlug) params.set('category', categorySlug)
    links.push({
      href: `/browse?${params.toString()}`,
      label: `Browse used ${brandName} ${type.toLowerCase()}s`.replace(/ss$/, 's'),
      kind: 'marketplace',
    })
  } else if (brandName) {
    links.push({
      href: `/browse?brand=${encodeURIComponent(brandName)}`,
      label: `Browse used ${brandName} equipment`,
      kind: 'marketplace',
    })
  }

  if (key) {
    links.push({
      href: `/valuation?product=${encodeURIComponent(key)}`,
      label: `Value your ${name}`,
      kind: 'valuation',
    })
  }

  if (series && brandSlug) {
    links.push({
      href: `${getBrandPagePath(brandSlug)}?series=${encodeURIComponent(series)}`,
      label: `More ${series} equipment`,
      kind: 'series',
    })
  }

  // Note: related product cards are selected separately via selectRelatedEquipmentProducts.

  // De-dupe by href
  const seen = new Set()
  return links.filter((link) => {
    if (!link.href || seen.has(link.href)) return false
    seen.add(link.href)
    return true
  }).map((link) => {
    if (link.kind === 'type-browse' || link.kind === 'marketplace') {
      // Avoid awkward "treadmills" doubling when type already plural-ish
      return {
        ...link,
        label: link.label
          .replace(/\btreadmillss\b/i, 'treadmills')
          .replace(/\bbikess\b/i, 'bikes')
          .replace(/\bmachinees\b/i, 'machines'),
      }
    }
    if (link.kind === 'series' && !showConsoles) return link
    return link
  })
}

export function buildEquipmentBreadcrumbJsonLd(product, {
  brandSlug = null,
  brandDisplayName = null,
} = {}) {
  if (!product?.canonical_product_key) return null

  return buildEquipmentBreadcrumbSchema(product, {
    brandSlug: brandSlug || getBrandSlug(product.brand),
    brandDisplayName: brandDisplayName || getBrandDisplayName(product.brand),
    productName: getEquipmentProductPublicName(product),
    productUrl: buildEquipmentCanonicalUrl(product),
  })
}

export function buildEquipmentOpenGraph(product, {
  title = null,
  description = null,
  imageUrl = null,
} = {}) {
  const resolvedTitle = title || buildEquipmentPageTitle(product, { includeSiteName: true })
  const resolvedDescription = description || buildEquipmentMetaDescription(product)
  const url = buildEquipmentCanonicalUrl(product)
  const image = imageUrl || getEquipmentSocialImageUrl(product)

  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:title': resolvedTitle,
    'og:description': resolvedDescription,
    'og:url': url,
    'og:image': image,
    'twitter:card': 'summary_large_image',
    'twitter:title': resolvedTitle,
    'twitter:description': resolvedDescription,
    'twitter:image': image,
  }
}

/**
 * Pick a small set of related public products for internal linking.
 * Prefers same series, then same type + brand, then same brand.
 */
export function selectRelatedEquipmentProducts(product, candidates = [], { limit = 6 } = {}) {
  const key = String(product?.canonical_product_key ?? '').trim()
  const brand = normalizeWhitespace(product?.brand).toLowerCase()
  const type = normalizeWhitespace(product?.equipment_type).toLowerCase()
  const series = normalizeWhitespace(getProductSeriesLabel(product)).toLowerCase()
  const max = Math.max(0, Number(limit) || 0)
  if (!key || !max) return []

  const scored = []
  for (const candidate of candidates) {
    if (!isPublicBrandCatalogueProduct(candidate)) continue
    const candidateKey = String(candidate.canonical_product_key ?? '').trim()
    if (!candidateKey || candidateKey === key) continue

    let score = 0
    const candidateBrand = normalizeWhitespace(candidate.brand).toLowerCase()
    const candidateType = normalizeWhitespace(candidate.equipment_type).toLowerCase()
    const candidateSeries = normalizeWhitespace(getProductSeriesLabel(candidate)).toLowerCase()

    if (brand && candidateBrand === brand) score += 4
    if (type && candidateType === type && type !== 'unknown') score += 3
    if (series && candidateSeries === series) score += 5
    if (score <= 0) continue

    scored.push({
      product: candidate,
      score,
      name: getEquipmentProductPublicName(candidate),
      href: buildEquipmentProductPagePath(candidateKey),
    })
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.name.localeCompare(right.name)
  })

  const seen = new Set()
  const selected = []
  for (const entry of scored) {
    if (seen.has(entry.href)) continue
    seen.add(entry.href)
    selected.push(entry)
    if (selected.length >= max) break
  }
  return selected
}

export function buildEquipmentPageSeoBundle(product, {
  seoTitle = null,
  seoDescription = null,
  overviewText = null,
  hasConsoleOptions = null,
  brandSlug = null,
  brandDisplayName = null,
  imageUrl = null,
} = {}) {
  const titleForDocument = buildEquipmentPageTitle(product, {
    seoTitle,
    includeSiteName: true,
  })
  const titleForHook = buildEquipmentPageTitle(product, {
    seoTitle,
    includeSiteName: false,
  })
  const description = buildEquipmentMetaDescription(product, {
    seoDescription,
    hasConsoleOptions,
  })
  const canonicalPath = buildEquipmentCanonicalPath(product)
  const canonicalUrl = buildEquipmentCanonicalUrl(product)
  const indexability = getIndexabilityForProduct(product)
  const socialImage = imageUrl || getEquipmentSocialImageUrl(product)
  const openGraph = buildEquipmentOpenGraph(product, {
    title: titleForDocument,
    description,
    imageUrl: socialImage,
  })
  // Product description: approved visible overview first, then approved SEO meta text.
  // Never invent a meta-style fallback solely to fill Product.description.
  const productDescription = normalizeWhitespace(overviewText)
    || normalizeWhitespace(seoDescription)
    || null
  const productJsonLd = buildEquipmentProductJsonLd(product, {
    description: productDescription,
    // Only approved catalogue images — never OG logo / display fallbacks.
    imageUrl: getApprovedEquipmentImage(product),
    brandSlug,
    brandDisplayName,
  })
  const breadcrumbJsonLd = buildEquipmentBreadcrumbJsonLd(product, {
    brandSlug,
    brandDisplayName,
  })
  const internalLinks = buildEquipmentInternalLinks(product, { hasConsoleOptions })

  return {
    titleForDocument,
    titleForHook,
    description,
    canonicalPath,
    canonicalUrl,
    indexability,
    openGraph,
    jsonLd: [productJsonLd, breadcrumbJsonLd].filter(Boolean),
    productJsonLd,
    breadcrumbJsonLd,
    internalLinks,
    socialImage,
  }
}
