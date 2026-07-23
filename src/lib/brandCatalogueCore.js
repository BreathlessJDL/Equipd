/**
 * Pure brand catalogue helpers (no Supabase client).
 * Safe for Node scripts (sitemap) and the Vite app.
 */

import { brandsMatch, normalizeBrandKey } from './consoleModifierMatch.js'
import {
  buildCanonicalProductDisplayNameFromProduct,
  cleanCanonicalProductDisplayName,
} from './canonicalProductDisplayName.js'

/** Preferred production canonical origin for SEO, sitemap, and absolute public URLs. */
export const EQUIPD_SITE_ORIGIN = 'https://www.equipd.co.uk'

export const FEATURED_BRAND_SLUGS = Object.freeze([
  'life-fitness',
  'technogym',
  'matrix-fitness',
  'precor',
  'cybex',
  'concept2',
  'wattbike',
  'woodway',
  'pulse-fitness',
  'hammer-strength',
  'peloton',
  'nordictrack',
  'bowflex',
  'horizon-fitness',
  'stairmaster',
  'york-fitness',
  'reebok',
  'bh-fitness',
  'powertec',
  'rep',
  'spirit-fitness',
  'waterrower',
  'proform',
  'schwinn',
  'sole-fitness',
])

export const BRAND_REGISTRY = Object.freeze([
  {
    key: 'lifefitness',
    displayName: 'Life Fitness',
    slug: 'life-fitness',
    aliases: ['Life Fitness', 'LifeFitness', 'life fitness'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/life-fitness.png',
    logoAlt: 'Life Fitness logo',
    logoScale: 1.47,
  },
  {
    key: 'technogym',
    displayName: 'Technogym',
    slug: 'technogym',
    aliases: ['Technogym', 'TechnoGym', 'techno gym'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/technogym.png',
    logoAlt: 'Technogym logo',
    logoScale: 1.36,
  },
  {
    key: 'matrixfitness',
    displayName: 'Matrix Fitness',
    slug: 'matrix-fitness',
    aliases: ['Matrix Fitness', 'Matrix', 'matrix'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/matrix-fitness.png',
    logoAlt: 'Matrix Fitness logo',
    logoScale: 1.5,
  },
  {
    key: 'precor',
    displayName: 'Precor',
    slug: 'precor',
    aliases: ['Precor'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/precor.png',
    logoAlt: 'Precor logo',
    logoScale: 1.29,
    logoMaxWidth: '96%',
  },
  {
    key: 'cybex',
    displayName: 'Cybex',
    slug: 'cybex',
    aliases: ['Cybex', 'Cybex International'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/cybex.png',
    logoAlt: 'Cybex logo',
    logoScale: 1.72,
  },
  {
    key: 'concept2',
    displayName: 'Concept2',
    slug: 'concept2',
    aliases: ['Concept2', 'Concept 2'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/concept2.png',
    logoAlt: 'Concept2 logo',
    logoScale: 1.55,
  },
  {
    key: 'wattbike',
    displayName: 'Wattbike',
    slug: 'wattbike',
    aliases: ['Wattbike'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/wattbike.png',
    logoAlt: 'Wattbike logo',
    logoScale: 1.78,
  },
  {
    key: 'woodway',
    displayName: 'Woodway',
    slug: 'woodway',
    aliases: ['Woodway', 'WOODWAY'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/woodway.png',
    logoAlt: 'Woodway logo',
    logoScale: 1.78,
  },
  {
    key: 'pulsefitness',
    displayName: 'Pulse Fitness',
    slug: 'pulse-fitness',
    aliases: ['Pulse Fitness', 'Pulse'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/pulse-fitness.png',
    logoAlt: 'Pulse Fitness logo',
    logoScale: 1.85,
    logoMaxWidth: '100%',
  },
  {
    key: 'hammerstrength',
    displayName: 'Hammer Strength',
    slug: 'hammer-strength',
    aliases: ['Hammer Strength'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/hammer-strength.png',
    logoAlt: 'Hammer Strength logo',
    logoScale: 1.47,
    logoMaxHeight: '100%',
  },
  {
    key: 'peloton',
    displayName: 'Peloton',
    slug: 'peloton',
    aliases: ['Peloton'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/peloton.png',
    logoAlt: 'Peloton logo',
    logoScale: 1.4,
  },
  {
    key: 'nordictrack',
    displayName: 'NordicTrack',
    slug: 'nordictrack',
    aliases: ['NordicTrack', 'Nordic Track'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/nordictrack.png',
    logoAlt: 'NordicTrack logo',
    logoScale: 1.45,
  },
  {
    key: 'bowflex',
    displayName: 'BowFlex',
    slug: 'bowflex',
    aliases: ['BowFlex', 'Bowflex', 'Bow Flex'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/bowflex.png',
    logoAlt: 'BowFlex logo',
    logoScale: 1.45,
  },
  {
    key: 'horizonfitness',
    displayName: 'Horizon Fitness',
    slug: 'horizon-fitness',
    aliases: ['Horizon Fitness', 'Horizon'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/horizon-fitness.png',
    logoAlt: 'Horizon Fitness logo',
    logoScale: 1.45,
  },
  {
    key: 'stairmaster',
    displayName: 'StairMaster',
    slug: 'stairmaster',
    aliases: ['StairMaster', 'Stair Master'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/stairmaster.png',
    logoAlt: 'StairMaster logo',
    logoScale: 1.45,
  },
  {
    key: 'yorkfitness',
    displayName: 'York Fitness',
    slug: 'york-fitness',
    aliases: ['York Fitness', 'York'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/york-fitness.png',
    logoAlt: 'York Fitness logo',
    logoScale: 1.72,
    logoMaxWidth: '100%',
  },
  {
    key: 'reebok',
    displayName: 'Reebok',
    slug: 'reebok',
    aliases: ['Reebok', 'Reebok Fitness'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/reebok.png',
    logoAlt: 'Reebok logo',
    logoScale: 1.4,
  },
  {
    key: 'bhfitness',
    displayName: 'BH Fitness',
    slug: 'bh-fitness',
    aliases: ['BH Fitness', 'BH'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/bh-fitness.png',
    logoAlt: 'BH Fitness logo',
    logoScale: 1.47,
  },
  {
    key: 'powertec',
    displayName: 'Powertec',
    slug: 'powertec',
    aliases: ['Powertec'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/powertec.png',
    logoAlt: 'Powertec logo',
    logoScale: 1.4,
  },
  {
    key: 'rep',
    displayName: 'REP',
    slug: 'rep',
    aliases: ['REP', 'REP Fitness', 'Rep Fitness'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/rep.png',
    logoAlt: 'REP logo',
    logoScale: 1.45,
  },
  {
    key: 'spiritfitness',
    displayName: 'Spirit Fitness',
    slug: 'spirit-fitness',
    aliases: ['Spirit Fitness', 'Spirit'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/spirit-fitness.png',
    logoAlt: 'Spirit Fitness logo',
    logoScale: 1.55,
  },
  {
    key: 'waterrower',
    displayName: 'WaterRower',
    slug: 'waterrower',
    aliases: ['WaterRower', 'Water Rower'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/waterrower.png',
    logoAlt: 'WaterRower logo',
    logoScale: 1.42,
  },
  {
    key: 'proform',
    displayName: 'ProForm',
    slug: 'proform',
    aliases: ['ProForm', 'Pro Form', 'Proform'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/proform.png',
    logoAlt: 'ProForm logo',
    logoScale: 1.78,
    logoMaxWidth: '100%',
  },
  {
    key: 'schwinn',
    displayName: 'Schwinn',
    slug: 'schwinn',
    aliases: ['Schwinn'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/schwinn.png',
    logoAlt: 'Schwinn logo',
    logoScale: 1.72,
    logoMaxWidth: '100%',
  },
  {
    key: 'solefitness',
    displayName: 'Sole Fitness',
    slug: 'sole-fitness',
    aliases: ['Sole Fitness', 'SOLE', 'Sole'],
    featured: true,
    shortDescription: 'Used equipment values and product information',
    logoPath: '/brand-logos/sole-fitness.png',
    logoAlt: 'Sole Fitness logo',
    logoScale: 1.47,
  },
  {
    key: 'roguefitness',
    displayName: 'Rogue Fitness',
    slug: 'rogue-fitness',
    aliases: ['Rogue Fitness', 'Rogue'],
    featured: false,
    logoPath: null,
    logoAlt: 'Rogue Fitness logo',
    logoScale: 1,
  },
  {
    key: 'eleiko',
    displayName: 'Eleiko',
    slug: 'eleiko',
    aliases: ['Eleiko'],
    featured: false,
    logoPath: null,
    logoAlt: 'Eleiko logo',
    logoScale: 1,
  },
  {
    key: 'jordan',
    displayName: 'Jordan',
    slug: 'jordan',
    aliases: ['Jordan'],
    featured: false,
    logoPath: null,
    logoAlt: 'Jordan logo',
    logoScale: 1,
  },
  {
    key: 'nautilus',
    displayName: 'Nautilus',
    slug: 'nautilus',
    aliases: ['Nautilus'],
    featured: false,
    logoPath: null,
    logoAlt: 'Nautilus logo',
    logoScale: 1,
  },
  {
    key: 'bodysolid',
    displayName: 'Body-Solid',
    slug: 'body-solid',
    aliases: ['Body-Solid', 'Body Solid'],
    featured: false,
    logoPath: null,
    logoAlt: 'Body-Solid logo',
    logoScale: 1,
  },
])

const REGISTRY_BY_KEY = new Map(BRAND_REGISTRY.map((entry) => [entry.key, entry]))
const REGISTRY_BY_SLUG = new Map(BRAND_REGISTRY.map((entry) => [entry.slug, entry]))

const EXCLUDED_BRAND_KEYS = new Set([
  'other',
  'unknown',
  'n/a',
  'na',
  'placeholder',
  'test',
  'brand',
])

const MEANINGLESS_SERIES = new Set([
  'base',
  'unknown',
  'other',
  'n/a',
  'na',
  'none',
  'null',
  'console',
  'consoles',
])

export function slugifyBrandName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function resolveBrandRegistryEntry(brandOrSlug) {
  const raw = String(brandOrSlug ?? '').trim()
  if (!raw) return null

  const asSlug = slugifyBrandName(raw)
  if (REGISTRY_BY_SLUG.has(asSlug)) return REGISTRY_BY_SLUG.get(asSlug)

  const key = normalizeBrandKey(raw)
  if (REGISTRY_BY_KEY.has(key)) return REGISTRY_BY_KEY.get(key)

  for (const entry of BRAND_REGISTRY) {
    if (entry.aliases.some((alias) => brandsMatch(alias, raw) || slugifyBrandName(alias) === asSlug)) {
      return entry
    }
  }

  return null
}

export function getBrandDisplayName(brand) {
  return resolveBrandRegistryEntry(brand)?.displayName || String(brand ?? '').trim()
}

export function getBrandSlug(brand) {
  const entry = resolveBrandRegistryEntry(brand)
  if (entry?.slug) return entry.slug
  return slugifyBrandName(brand)
}

export function getBrandPagePath(brandOrSlug) {
  const slug = getBrandSlug(brandOrSlug)
  return slug ? `/brands/${slug}` : '/brands'
}

export function getBrandAbsoluteUrl(brandOrSlug) {
  return `${EQUIPD_SITE_ORIGIN}${getBrandPagePath(brandOrSlug)}`
}

export function getBrowseBrandFilterHref(brand) {
  const display = getBrandDisplayName(brand)
  return `/browse?brand=${encodeURIComponent(display)}`
}

export const BRAND_CARD_DESCRIPTION = 'Used equipment values and product information'

export function buildBrandIntro(brandDisplayName, { hasCuratedDescription = false, curated = null } = {}) {
  if (hasCuratedDescription && curated) return curated
  return (
    `Explore estimated used values, original RRPs, production years and console `
    + `compatibility across ${brandDisplayName} equipment models.`
  )
}

export function buildBrandPageTitle(brandDisplayName) {
  return `${brandDisplayName} Equipment Values`
}

export function buildBrandPageMetaTitle(brandDisplayName) {
  return `${brandDisplayName} Equipment Values and Model Guides | Equipd`
}

export function buildBrandPageMetaDescription(brandDisplayName) {
  return (
    `Explore estimated used values, original RRPs, production years and console options `
    + `across ${brandDisplayName} equipment models.`
  )
}

export function isExcludedPublicBrandName(brand) {
  const trimmed = String(brand ?? '').trim()
  if (!trimmed) return true
  const key = normalizeBrandKey(trimmed)
  if (!key || EXCLUDED_BRAND_KEYS.has(key)) return true
  if (/^(unknown|other|n\/?a|test|placeholder|brand)$/i.test(trimmed)) return true
  return false
}

export function isPublicBrandCatalogueProduct(product) {
  if (!product || product.status !== 'approved') return false
  if (isExcludedPublicBrandName(product.brand)) return false

  const type = String(product.equipment_type ?? '').trim()
  if (/^(console|consoles)$/i.test(type)) return false
  if (/\bconsole\s+only\b/i.test(product.canonical_product_name || '')) return false
  if (/^(spare\s*part|accessory|placeholder)$/i.test(type)) return false

  return true
}

export function isMeaningfulSeriesValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return false
  const compact = text.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (!compact || MEANINGLESS_SERIES.has(text.toLowerCase()) || MEANINGLESS_SERIES.has(compact)) {
    return false
  }
  if (/^\d/.test(text) && /[gfh]/i.test(text) && text.length <= 18) return false
  if (/^(220|240|250|260|270|280)\b/i.test(text)) return false
  return true
}

export function getProductSeriesLabel(product) {
  const family = String(product?.product_family ?? '').trim()
  if (!isMeaningfulSeriesValue(family)) return null
  return normalizePublicSeriesDisplayLabel(product?.brand, family)
}

/**
 * Public-facing series labels (brand-page chips / filters).
 * Keep URLs/keys unchanged; only normalise display aliases.
 */
export function normalizePublicSeriesDisplayLabel(brand, family) {
  const brandKey = normalizeBrandKey(brand)
  const text = String(family ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  if (brandKey === 'precor' && /^discovery(\b|$)/i.test(text)) {
    return 'Discovery'
  }

  return text
}

/**
 * Soften “Discovery Series” wording in Precor public product titles without changing keys.
 * Also collapses duplicated brand/series/model wording via the shared display-name builder.
 */
export function formatPublicCanonicalProductDisplayName(product) {
  const built = buildCanonicalProductDisplayNameFromProduct(product)
    || cleanCanonicalProductDisplayName(product?.canonical_product_name, {
      brand: product?.brand,
      series: product?.product_family ?? product?.series,
    })
  const name = String(built ?? '').replace(/\s+/g, ' ').trim()
  if (!name) return name
  if (normalizeBrandKey(product?.brand) !== 'precor') return name
  return name
    .replace(/\bDiscovery Series\b/gi, 'Discovery')
    .replace(/\bDiscovery\s+-\s+/gi, 'Discovery ')
}

export function buildBrandDirectoryFromProducts(products = [], listingCountsByKey = {}) {
  const buckets = new Map()

  for (const product of products) {
    if (!isPublicBrandCatalogueProduct(product)) continue
    const registry = resolveBrandRegistryEntry(product.brand)
    const key = registry?.key || normalizeBrandKey(product.brand)
    if (!key || EXCLUDED_BRAND_KEYS.has(key)) continue

    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        displayName: registry?.displayName || String(product.brand).trim(),
        slug: registry?.slug || slugifyBrandName(product.brand),
        shortDescription: registry?.shortDescription || null,
        featured: Boolean(registry?.featured),
        logoPath: registry?.logoPath || null,
        logoAlt: registry?.logoAlt || null,
        logoScale: registry?.logoScale ?? 1,
        logoMaxWidth: registry?.logoMaxWidth || null,
        logoMaxHeight: registry?.logoMaxHeight || null,
        productCount: 0,
        listingCount: listingCountsByKey[key] || 0,
        href: getBrandPagePath(registry?.slug || product.brand),
        sampleBrandValues: new Set(),
      })
    }

    const bucket = buckets.get(key)
    bucket.productCount += 1
    bucket.sampleBrandValues.add(String(product.brand).trim())
  }

  const brands = [...buckets.values()]
    .map((entry) => ({
      ...entry,
      sampleBrandValues: [...entry.sampleBrandValues],
    }))
    .filter((entry) => entry.productCount > 0)
    .sort((left, right) => left.displayName.localeCompare(right.displayName))

  const featured = FEATURED_BRAND_SLUGS
    .map((slug) => brands.find((entry) => entry.slug === slug))
    .filter(Boolean)

  const byLetter = brands.reduce((acc, brand) => {
    const letter = brand.displayName.charAt(0).toUpperCase()
    const key = /[A-Z]/.test(letter) ? letter : '#'
    if (!acc[key]) acc[key] = []
    acc[key].push(brand)
    return acc
  }, {})

  return { brands, featured, byLetter }
}

export function findUnresolvedBrandDuplicates(products = []) {
  const byKey = new Map()
  for (const product of products) {
    if (!isPublicBrandCatalogueProduct(product)) continue
    const key = normalizeBrandKey(product.brand)
    if (!key) continue
    if (!byKey.has(key)) byKey.set(key, new Set())
    byKey.get(key).add(String(product.brand).trim())
  }
  return [...byKey.entries()]
    .map(([key, values]) => ({ key, values: [...values].sort() }))
    .filter((entry) => entry.values.length > 1)
}

export function buildBrandCollectionJsonLd(brands = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Gym Equipment Value Guides by Brand',
    url: `${EQUIPD_SITE_ORIGIN}/brands`,
    description:
      'Explore used gym equipment values by brand, including original RRPs, production years, compatible consoles and current marketplace listings.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: brands.map((brand, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: brand.displayName,
        url: `${EQUIPD_SITE_ORIGIN}${brand.href}`,
      })),
    },
  }
}

export function buildBrandPageJsonLd(brand, products = []) {
  if (!brand) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${brand.displayName} Equipment Values`,
    url: brand.absoluteUrl,
    description: brand.intro,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 100).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.displayName,
        url: `${EQUIPD_SITE_ORIGIN}${product.href}`,
      })),
    },
  }
}

export function aggregateBrandCategories(products = []) {
  const counts = new Map()
  for (const product of products) {
    const type = String(product.equipment_type ?? '').trim()
    if (!type) continue
    counts.set(type, (counts.get(type) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, productCount]) => ({ name, productCount, anchor: slugifyBrandName(name) }))
    .sort((left, right) => right.productCount - left.productCount || left.name.localeCompare(right.name))
}

export function getBrandLogoMeta(brandOrSlug) {
  const registry = resolveBrandRegistryEntry(brandOrSlug)
  const displayName = registry?.displayName
    || getBrandDisplayName(brandOrSlug)
    || String(brandOrSlug ?? '').trim()
  if (!displayName) return null

  return {
    displayName,
    slug: registry?.slug || slugifyBrandName(displayName),
    logoPath: registry?.logoPath || null,
    logoAlt: registry?.logoAlt || `${displayName} logo`,
    logoScale: registry?.logoScale ?? 1,
    logoMaxWidth: registry?.logoMaxWidth || null,
    logoMaxHeight: registry?.logoMaxHeight || null,
  }
}

export function listBrandLogoAssetPaths() {
  return BRAND_REGISTRY
    .filter((entry) => entry.logoPath)
    .map((entry) => ({
      slug: entry.slug,
      displayName: entry.displayName,
      logoPath: entry.logoPath,
    }))
}

export function aggregateBrandSeries(products = [], resolveImageUrl = () => null) {
  const counts = new Map()
  const images = new Map()
  // Deterministic order: name, then key — first usable approved image wins per series.
  const sorted = [...products].sort((left, right) => (
    String(left.canonical_product_name || '').localeCompare(String(right.canonical_product_name || ''))
    || String(left.canonical_product_key || '').localeCompare(String(right.canonical_product_key || ''))
  ))

  for (const product of sorted) {
    const series = getProductSeriesLabel(product)
    if (!series) continue
    counts.set(series, (counts.get(series) || 0) + 1)
    if (!images.has(series)) {
      const imageUrl = resolveImageUrl(product)
      if (imageUrl) images.set(series, imageUrl)
    }
  }

  const entries = [...counts.entries()]
    .map(([name, productCount]) => ({
      name,
      productCount,
      imageUrl: images.get(name) || null,
      anchor: slugifyBrandName(name),
    }))
    .sort((left, right) => right.productCount - left.productCount || left.name.localeCompare(right.name))

  if (entries.length < 2) return []
  return entries.slice(0, 16)
}

export function buildRelatedBrands(currentDisplayName, products = [], listingCountsByKey = {}) {
  const directory = buildBrandDirectoryFromProducts(products, listingCountsByKey)
  return directory.brands
    .filter((brand) => brand.displayName !== currentDisplayName)
    .sort((left, right) => right.productCount - left.productCount)
    .slice(0, 6)
}
