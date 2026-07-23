/**
 * Curated brand-page selection helpers (popular products, featured series, FAQs).
 * Deterministic — no random ordering.
 */

import { buildFaqPageSchema } from './faqPageStructuredData.js'

const POPULAR_LIMIT = 6
const FEATURED_SERIES_LIMIT = 5

/** Map raw equipment_type strings to short card tags. */
const TYPE_TAG_ALIASES = [
  { tag: 'Treadmills', pattern: /\btreadmill/i },
  { tag: 'Bikes', pattern: /\bbike|cycle|spin/i },
  { tag: 'Cross trainers', pattern: /\bcross[\s-]?trainer|elliptical/i },
  { tag: 'Rowers', pattern: /\brower|rowing/i },
  { tag: 'Steppers', pattern: /\bstepper|stair|climber|powermill/i },
  { tag: 'Cable machines', pattern: /\bcable|functional\s+trainer|dual\s+adjustable/i },
  { tag: 'Plate loaded', pattern: /\bplate[\s-]?loaded|plate\s+load/i },
  { tag: 'Strength', pattern: /\bstrength|selectori[sz]ed|multi[\s-]?gym|smith|leg\s+press|chest\s+press|lat\s+pulldown|bench|rack/i },
  { tag: 'Cardio', pattern: /\bcardio|elliptical|arc\s*trainer|ascend/i },
]

function scorePopularProduct(product, listingTitleBlob) {
  let score = 0
  if (product.estimatedValueLabel) score += 40
  if (product.imageUrl) score += 25
  if (product.originalRrp) score += 10
  if (product.yearLabel) score += 5

  const name = String(product.displayName || '').toLowerCase()
  const series = String(product.series || '').toLowerCase()
  if (listingTitleBlob && (name || series)) {
    if (name && listingTitleBlob.includes(name)) score += 30
    else if (series && listingTitleBlob.includes(series)) score += 18
    else {
      // Partial token overlap with listing titles (common models).
      const tokens = name.split(/\s+/).filter((token) => token.length > 3)
      const hits = tokens.filter((token) => listingTitleBlob.includes(token)).length
      if (hits >= 2) score += 12
    }
  }

  // Prefer commercially significant models without inventing popularity.
  const rrp = Number(product.originalRrp)
  if (Number.isFinite(rrp) && rrp > 0) {
    score += Math.min(15, Math.round(rrp / 2000))
  }

  return score
}

/**
 * Deterministic popular product pick for the curated brand section.
 */
export function selectPopularBrandProducts(products = [], {
  limit = POPULAR_LIMIT,
  listings = [],
} = {}) {
  const listingTitleBlob = listings
    .map((listing) => String(listing.title || listing.listing_title || '').toLowerCase())
    .filter(Boolean)
    .join(' | ')

  return [...products]
    .filter((product) => product?.href && product.estimatedValueLabel)
    .map((product) => ({
      product,
      score: scorePopularProduct(product, listingTitleBlob),
    }))
    .sort((left, right) => (
      right.score - left.score
      || String(left.product.displayName || '').localeCompare(String(right.product.displayName || ''))
    ))
    .slice(0, limit)
    .map((entry) => entry.product)
}

export function selectFeaturedBrandSeries(series = [], { limit = FEATURED_SERIES_LIMIT } = {}) {
  // Series are already sorted by productCount desc from aggregateBrandSeries.
  return series.slice(0, limit)
}

/**
 * Up to 3 short category tags derived from products in a series.
 */
export function buildBrandSeriesTags(seriesName, products = [], { limit = 3 } = {}) {
  const typeCounts = new Map()
  for (const product of products) {
    if (product.series !== seriesName) continue
    const type = String(product.equipmentType || '').trim()
    if (!type) continue
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  }

  const tags = []
  const seen = new Set()

  const rankedTypes = [...typeCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))

  for (const [type] of rankedTypes) {
    for (const { tag, pattern } of TYPE_TAG_ALIASES) {
      if (!pattern.test(type)) continue
      if (seen.has(tag)) continue
      seen.add(tag)
      tags.push(tag)
      break
    }
    if (tags.length >= limit) break
  }

  // Fallback: use concise equipment type names when no alias matched.
  if (!tags.length) {
    for (const [type] of rankedTypes.slice(0, limit)) {
      tags.push(type)
    }
  }

  return tags.slice(0, limit)
}

export function enrichBrandSeriesWithTags(series = [], products = []) {
  return series.map((entry) => ({
    ...entry,
    tags: buildBrandSeriesTags(entry.name, products),
  }))
}

export function buildBrandPageStats({
  productCount = 0,
  listingCount = 0,
  categories = [],
  series = [],
} = {}) {
  const stats = []
  if (productCount > 0) {
    stats.push({
      key: 'models',
      value: productCount,
      label: productCount === 1 ? 'Equipment model' : 'Equipment models',
    })
  }
  if (listingCount > 0) {
    stats.push({
      key: 'listings',
      value: listingCount,
      label: listingCount === 1 ? 'Marketplace listing' : 'Marketplace listings',
    })
  }
  if (categories.length > 0) {
    stats.push({
      key: 'types',
      value: categories.length,
      label: categories.length === 1 ? 'Equipment type' : 'Equipment types',
    })
  }
  if (series.length > 0) {
    stats.push({
      key: 'series',
      value: series.length,
      label: series.length === 1 ? 'Series' : 'Series',
    })
  }
  return stats
}

/**
 * Brand FAQs aligned with Equipd valuation + marketplace behaviour.
 * Same array must drive visible accordion and FAQPage JSON-LD.
 */
export function buildBrandFaqItems(brandDisplayName) {
  const brand = String(brandDisplayName || '').trim() || 'this brand'
  return [
    {
      question: `How are ${brand} equipment values calculated?`,
      answer: (
        `Equipd estimates used values from the model’s original RRP, manufacture year, `
        + `condition and (where relevant) console configuration, using residual depreciation `
        + `curves calibrated for commercial and home gym equipment.`
      ),
    },
    {
      question: `What affects the value of ${brand} equipment?`,
      answer: (
        `Age, condition, original specification and console options have the largest impact. `
        + `Higher-spec consoles and well-maintained machines typically hold more value than `
        + `base configurations of the same model year.`
      ),
    },
    {
      question: `Do valuations include console compatibility?`,
      answer: (
        `Where Equipd has mapped compatible consoles for a model, the valuation flow lets you `
        + `select the console so the estimate reflects that configuration. Models with a fixed `
        + `console use the base valuation without a selector.`
      ),
    },
    {
      question: 'How often are values updated?',
      answer: (
        `Value guides update as catalogue data, RRP baselines and depreciation inputs are `
        + `reviewed. Marketplace listings reflect live seller prices and may differ from the `
        + `typical value range shown on a model guide.`
      ),
    },
    {
      question: `Can I sell my ${brand} equipment on Equipd?`,
      answer: (
        `Yes. You can create a listing from a valuation or from the sell flow. Equipd supports `
        + `secure offers, handover tracking and seller payouts for eligible equipment.`
      ),
    },
  ]
}

export function buildBrandFaqPageSchema(brand, faqItems) {
  if (!brand?.absoluteUrl && !brand?.href) return null
  const canonicalUrl = brand.absoluteUrl || brand.href
  const built = buildFaqPageSchema(faqItems, { canonicalUrl })
  return built?.schema || null
}

export function pickBrandHeroVisual(products = [], popularProducts = []) {
  const preferred = [...popularProducts, ...products]
  return preferred.find((product) => product?.imageUrl) || null
}

export { POPULAR_LIMIT, FEATURED_SERIES_LIMIT }
