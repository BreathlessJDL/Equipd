import { BASELINE_STATUS, deriveBaselineManufactureYearStatus } from './baselineManufactureYear.js'
import {
  buildCoreProductGroups,
  expandCoreProductResearchTargets,
  mergeCoreProductEvidence,
} from './intelligenceCoreProductGrouping.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from './equipmentProductImages.js'

const EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD = 90

export const RESEARCH_QUEUE_MODES = {
  SKIP: 'skip',
  FULL: 'full',
  PRICE_ONLY: 'price_only',
  LIFECYCLE_ONLY: 'lifecycle_only',
}

export const RESEARCH_QUEUE_MODE_LABELS = {
  [RESEARCH_QUEUE_MODES.SKIP]: 'Skipped (complete)',
  [RESEARCH_QUEUE_MODES.FULL]: 'Full research',
  [RESEARCH_QUEUE_MODES.PRICE_ONLY]: 'Price only',
  [RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY]: 'Lifecycle only',
}

export function hasVerifiedOriginalPrice(equipment) {
  const price = Number(equipment?.best_original_price)
  const confidence = Number(equipment?.best_original_price_confidence)
  const currency = (
    equipment?.best_original_price_currency
    || equipment?.currency
    || ''
  ).toUpperCase()

  return Number.isFinite(price) && price > 0
    && Number.isFinite(confidence)
    && confidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD
    && (!currency || currency === 'GBP')
}

export function hasSufficientBaselineYear(equipment) {
  const status = deriveBaselineManufactureYearStatus(equipment)
  return status === BASELINE_STATUS.VERIFIED || status === BASELINE_STATUS.ESTIMATED
}

export function isEquipmentResearchComplete(equipment) {
  return hasVerifiedOriginalPrice(equipment)
    && hasSufficientBaselineYear(equipment)
}

export function deriveEquipmentResearchMode(
  equipment,
  {
    forceReResearch = false,
    skipCompleted = true,
  } = {},
) {
  if (!equipment) return RESEARCH_QUEUE_MODES.SKIP

  if (forceReResearch) {
    return RESEARCH_QUEUE_MODES.FULL
  }

  const hasPrice = hasVerifiedOriginalPrice(equipment)
  const hasBaseline = hasSufficientBaselineYear(equipment)

  if (skipCompleted && hasPrice && hasBaseline) {
    return RESEARCH_QUEUE_MODES.SKIP
  }

  if (!hasPrice && !hasBaseline) {
    return RESEARCH_QUEUE_MODES.FULL
  }

  if (hasPrice && !hasBaseline) {
    return RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY
  }

  if (!hasPrice && hasBaseline) {
    return RESEARCH_QUEUE_MODES.PRICE_ONLY
  }

  return RESEARCH_QUEUE_MODES.SKIP
}

export function buildIncompleteResearchQueue(
  groups = [],
  {
    targetCount = 100,
    skipCompleted = true,
    forceReResearch = false,
  } = {},
) {
  const summary = {
    scanned: 0,
    skipped: 0,
    priceOnly: 0,
    lifecycleOnly: 0,
    full: 0,
    toResearch: 0,
  }

  const queue = []

  for (const group of groups) {
    if (queue.length >= targetCount) break

    summary.scanned += 1

    const equipmentId = group.representative_equipment_id
    if (!equipmentId) continue

    const mode = deriveEquipmentResearchMode(
      {
        best_original_price: group.best_original_price,
        best_original_price_confidence: group.best_original_price_confidence,
        best_original_price_currency: group.best_original_price_currency,
        baseline_manufacture_year: group.baseline_manufacture_year,
        baseline_manufacture_year_source: group.baseline_manufacture_year_source,
        manufacture_start_year: group.manufacture_start_year,
        manufacture_end_year: group.manufacture_end_year,
      },
      {
        forceReResearch,
        skipCompleted,
      },
    )

    if (mode === RESEARCH_QUEUE_MODES.SKIP) {
      summary.skipped += 1
      continue
    }

    if (mode === RESEARCH_QUEUE_MODES.PRICE_ONLY) summary.priceOnly += 1
    if (mode === RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY) summary.lifecycleOnly += 1
    if (mode === RESEARCH_QUEUE_MODES.FULL) summary.full += 1

    queue.push({
      equipmentId,
      label: group.primary_keyword || group.label || 'Selected equipment',
      mode,
      group,
    })
  }

  summary.toResearch = queue.length

  return { queue, summary }
}

/**
 * Build research queue from core product groups (one research run per base product).
 */
export function buildCoreProductResearchQueue(
  rows = [],
  {
    targetCount = 100,
    skipCompleted = true,
    forceReResearch = false,
  } = {},
) {
  const summary = {
    scanned: 0,
    skipped: 0,
    priceOnly: 0,
    lifecycleOnly: 0,
    full: 0,
    toResearch: 0,
    variant_rows_merged: 0,
  }

  const groups = buildCoreProductGroups(rows)
  const targets = expandCoreProductResearchTargets(groups)
  const queue = []

  for (const target of targets) {
    if (queue.length >= targetCount) break

    summary.scanned += 1

    const { group, equipmentId, dedupeEligible } = target
    if (!equipmentId) continue

    if (dedupeEligible) {
      summary.variant_rows_merged += Math.max(0, group.member_count - 1)
    }

    const evidenceMembers = dedupeEligible
      ? group.members
      : group.members.filter((member) => member.id === equipmentId)
    const mergedEvidence = mergeCoreProductEvidence(evidenceMembers)
    const mode = deriveEquipmentResearchMode(mergedEvidence, {
      forceReResearch,
      skipCompleted,
    })

    if (mode === RESEARCH_QUEUE_MODES.SKIP) {
      summary.skipped += 1
      continue
    }

    if (mode === RESEARCH_QUEUE_MODES.PRICE_ONLY) summary.priceOnly += 1
    if (mode === RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY) summary.lifecycleOnly += 1
    if (mode === RESEARCH_QUEUE_MODES.FULL) summary.full += 1

    queue.push({
      equipmentId,
      label: target.label || group.core_product_name || 'Core product',
      mode,
      coreProductKey: group.core_product_key,
      memberCount: dedupeEligible ? group.member_count : 1,
      dedupeEligible,
      group,
    })
  }

  summary.toResearch = queue.length
  return { queue, summary, groups }
}

export function hasVerifiedOriginalBasePrice(product) {
  const price = Number(product?.original_base_price)
  const confidence = Number(product?.original_price_confidence)
  const currency = (product?.original_base_price_currency || 'GBP').toUpperCase()

  return Number.isFinite(price) && price > 0
    && Number.isFinite(confidence)
    && confidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD
    && (!currency || currency === 'GBP')
}

export const CANONICAL_BASELINE_YEAR_MIN = 1970

export function getCanonicalBaselineYearMax(now = new Date()) {
  return now.getFullYear() + 1
}

export function isValidCanonicalBaselineYear(year, now = new Date()) {
  const value = Number(year)
  if (!Number.isInteger(value)) return false
  return value >= CANONICAL_BASELINE_YEAR_MIN && value <= getCanonicalBaselineYearMax(now)
}

export function hasCanonicalProductBasePrice(product) {
  const price = Number(product?.original_base_price)
  return Number.isFinite(price) && price > 0
}

export function hasCanonicalProductBaselineYear(product) {
  return isValidCanonicalBaselineYear(product?.baseline_manufacture_year)
}

export const CANONICAL_COMPLETION_STATUS = {
  COMPLETE: 'complete',
  MISSING_PRICE: 'missing_price',
  MISSING_BASELINE: 'missing_baseline',
  MISSING_BOTH: 'missing_both',
}

export function deriveCanonicalProductCompletionStatus(product) {
  if (!product || product.status === 'excluded') return null

  const hasPrice = hasCanonicalProductBasePrice(product)
  const hasBaseline = hasCanonicalProductBaselineYear(product)

  if (hasPrice && hasBaseline) return CANONICAL_COMPLETION_STATUS.COMPLETE
  if (!hasPrice && !hasBaseline) return CANONICAL_COMPLETION_STATUS.MISSING_BOTH
  if (!hasPrice) return CANONICAL_COMPLETION_STATUS.MISSING_PRICE
  return CANONICAL_COMPLETION_STATUS.MISSING_BASELINE
}

export function formatCanonicalProductCompletionLabel(status) {
  switch (status) {
    case CANONICAL_COMPLETION_STATUS.COMPLETE:
      return 'Complete'
    case CANONICAL_COMPLETION_STATUS.MISSING_PRICE:
      return 'Missing price'
    case CANONICAL_COMPLETION_STATUS.MISSING_BASELINE:
      return 'Missing baseline'
    case CANONICAL_COMPLETION_STATUS.MISSING_BOTH:
      return 'Missing both'
    default:
      return '—'
  }
}

export function formatCanonicalProductCompletionReason(product) {
  const status = deriveCanonicalProductCompletionStatus(product)
  if (!status) return 'Excluded from research queue'

  if (status === CANONICAL_COMPLETION_STATUS.COMPLETE) {
    return `Complete — £${Number(product.original_base_price).toLocaleString('en-GB')} base price, baseline ${product.baseline_manufacture_year}`
  }

  const parts = []
  if (status === CANONICAL_COMPLETION_STATUS.MISSING_PRICE
    || status === CANONICAL_COMPLETION_STATUS.MISSING_BOTH) {
    parts.push('missing original_base_price')
  }

  if (status === CANONICAL_COMPLETION_STATUS.MISSING_BASELINE
    || status === CANONICAL_COMPLETION_STATUS.MISSING_BOTH) {
    if (product?.baseline_manufacture_year != null && !hasCanonicalProductBaselineYear(product)) {
      parts.push(`invalid baseline_manufacture_year (${product.baseline_manufacture_year})`)
    } else {
      parts.push('missing baseline_manufacture_year')
    }
  }

  if ((product?.production_start_year != null || product?.production_end_year != null)
    && !hasCanonicalProductBaselineYear(product)) {
    const period = product.production_end_year != null
      ? `${product.production_start_year ?? '—'}–${product.production_end_year}`
      : `${product.production_start_year ?? product.production_end_year}`
    parts.push(`production years ${period} present but baseline missing`)
  }

  return parts.join('; ')
}

export function isCanonicalProductResearchComplete(product) {
  if (!product || product.status === 'excluded' || product.status !== 'approved') {
    return false
  }

  return hasCanonicalProductBasePrice(product) && hasCanonicalProductBaselineYear(product)
}

export function deriveCanonicalProductResearchMode(
  product,
  {
    forceReResearch = false,
    skipCompleted = true,
  } = {},
) {
  if (!product) return RESEARCH_QUEUE_MODES.SKIP

  if (forceReResearch) {
    return RESEARCH_QUEUE_MODES.FULL
  }

  if (skipCompleted && isCanonicalProductResearchComplete(product)) {
    return RESEARCH_QUEUE_MODES.SKIP
  }

  const hasPrice = hasCanonicalProductBasePrice(product)
  const hasBaseline = hasCanonicalProductBaselineYear(product)

  if (!hasPrice && !hasBaseline) {
    return RESEARCH_QUEUE_MODES.FULL
  }

  if (hasPrice && !hasBaseline) {
    return RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY
  }

  if (!hasPrice && hasBaseline) {
    return RESEARCH_QUEUE_MODES.PRICE_ONLY
  }

  return RESEARCH_QUEUE_MODES.SKIP
}

export function deriveCanonicalProductPriceStatus(product) {
  if (hasCanonicalProductBasePrice(product)) return 'verified'
  return 'missing'
}

export function deriveCanonicalProductLifecycleStatus(product) {
  if (hasCanonicalProductBaselineYear(product)) return 'verified'
  if (product?.baseline_manufacture_year != null || product?.production_start_year != null) {
    return 'needs_review'
  }
  return 'missing'
}

export function hasCanonicalProductApprovedImage(product) {
  const imageStatus = String(product?.image_status ?? '').trim().toLowerCase()
  if (imageStatus !== EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) return false

  const imageUrl = String(product?.image_url ?? '').trim()
  const storagePath = String(product?.image_storage_path ?? '').trim()
  return Boolean(imageUrl || storagePath)
}

export function buildActiveBrandNameSet({ brands = [], products = [] } = {}) {
  const names = new Set()

  for (const brand of brands) {
    const name = String(brand?.name ?? brand ?? '').trim()
    if (name) names.add(name)
  }

  for (const product of products) {
    if (product?.status !== 'approved') continue
    const name = String(product.brand ?? '').trim()
    if (name) names.add(name)
  }

  return names
}

export function isActiveBrandForTop100(brand, activeBrands = null) {
  if (!activeBrands) return true
  const name = String(brand ?? '').trim()
  if (!name) return false
  return activeBrands.has(name)
}

export function isCanonicalProductTop100Incomplete(product) {
  if (!product || product.status !== 'approved') return false

  return !hasCanonicalProductBasePrice(product)
    || !hasCanonicalProductBaselineYear(product)
    || !hasCanonicalProductApprovedImage(product)
}

export function evaluateCanonicalProductTop100Eligibility(
  product,
  {
    activeBrands = null,
    intelligenceRowsById = null,
  } = {},
) {
  const checks = {
    exists: Boolean(product),
    approved: product?.status === 'approved',
    hasCanonicalKey: Boolean(String(product?.canonical_product_key ?? '').trim()),
    activeBrand: isActiveBrandForTop100(product?.brand, activeBrands),
    isCanonicalProduct: Boolean(product?.canonical_product_key),
    hasIntelligenceProxy: Boolean(
      product?.representative_intelligence_row_id
      || product?.source_intelligence_row_ids?.[0],
    ),
    rrpPresent: hasCanonicalProductBasePrice(product),
    baselinePresent: hasCanonicalProductBaselineYear(product),
    imageApproved: hasCanonicalProductApprovedImage(product),
  }

  if (intelligenceRowsById) {
    const sourceIds = product?.source_intelligence_row_ids ?? []
    checks.isBaseProduct = sourceIds.length === 0
      || sourceIds.some((id) => intelligenceRowsById.get(id)?.is_base_product === true)
      || sourceIds.length === 1
  }

  if (!checks.exists) {
    return { included: false, reason: 'not found in equipment_products', checks }
  }

  if (product.status === 'excluded') {
    return { included: false, reason: 'status is excluded', checks }
  }

  if (!checks.approved) {
    return { included: false, reason: `status is ${product.status ?? 'unknown'}`, checks }
  }

  if (!checks.hasCanonicalKey) {
    return { included: false, reason: 'missing canonical_product_key', checks }
  }

  if (!checks.activeBrand) {
    return { included: false, reason: 'brand is not active', checks }
  }

  if (!checks.hasIntelligenceProxy) {
    return { included: false, reason: 'no linked intelligence row for research proxy', checks }
  }

  if (!isCanonicalProductTop100Incomplete(product)) {
    return {
      included: false,
      reason: 'complete for Top 100 (price, baseline, and approved image present)',
      checks,
    }
  }

  const missing = []
  if (!checks.rrpPresent) missing.push('original_base_price')
  if (!checks.baselinePresent) missing.push('baseline_manufacture_year')
  if (!checks.imageApproved) missing.push('approved image')

  return {
    included: true,
    reason: `included — missing ${missing.join(', ')}`,
    checks,
    missing,
  }
}

export function filterCanonicalProductsForTop100Queue(
  products = [],
  { activeBrands = null } = {},
) {
  const approved = products.filter((product) => product.status === 'approved')
  const seenKeys = new Set()
  const unique = []

  for (const product of [...approved].sort(compareCanonicalProductsForResearch)) {
    const canonicalKey = String(product.canonical_product_key ?? '').trim()
    if (!canonicalKey || seenKeys.has(canonicalKey)) continue

    const eligibility = evaluateCanonicalProductTop100Eligibility(product, { activeBrands })
    if (!eligibility.included) continue

    seenKeys.add(canonicalKey)
    unique.push(product)
  }

  return unique
}

export function deriveCanonicalProductImageStatus(product) {
  if (hasCanonicalProductApprovedImage(product)) return 'verified'
  if (product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED && product?.image_url) {
    return 'needs_review'
  }
  return 'missing'
}

export function mapCanonicalProductToDisplayGroup(product, rank) {
  const sourceRowCount = product.source_intelligence_row_ids?.length ?? 0
  const variantProductCount = product.collapsed_variant_count ?? 0
  const completionStatus = deriveCanonicalProductCompletionStatus(product)

  return {
    keyword_key: product.id,
    productId: product.id,
    primary_keyword: product.canonical_product_name,
    label: product.canonical_product_name,
    member_count: sourceRowCount,
    variant_product_count: variantProductCount,
    representative_equipment_id: product.representative_intelligence_row_id
      ?? product.source_intelligence_row_ids?.[0]
      ?? null,
    best_original_price: product.original_base_price,
    best_original_price_currency: product.original_base_price_currency,
    best_original_price_confidence: product.original_price_confidence,
    baseline_manufacture_year: product.baseline_manufacture_year,
    manufacture_start_year: product.production_start_year,
    manufacture_end_year: product.production_end_year,
    priceStatus: deriveCanonicalProductPriceStatus(product),
    lifecycleStatus: deriveCanonicalProductLifecycleStatus(product),
    imageStatus: deriveCanonicalProductImageStatus(product),
    completionStatus,
    completionLabel: formatCanonicalProductCompletionLabel(completionStatus),
    completionReason: formatCanonicalProductCompletionReason(product),
    isResearchComplete: isCanonicalProductResearchComplete(product),
    productStatus: product.status,
    popularity_score: sourceRowCount,
    rank,
    isCanonicalProduct: true,
    product,
  }
}

function countMissingTop100Fields(product) {
  let missing = 0
  if (!hasCanonicalProductBasePrice(product)) missing += 1
  if (!hasCanonicalProductBaselineYear(product)) missing += 1
  if (!hasCanonicalProductApprovedImage(product)) missing += 1
  return missing
}

function compareCanonicalProductsForResearch(left, right) {
  const leftMissing = countMissingTop100Fields(left)
  const rightMissing = countMissingTop100Fields(right)
  if (leftMissing !== rightMissing) return rightMissing - leftMissing

  const leftSources = left.source_intelligence_row_ids?.length ?? 0
  const rightSources = right.source_intelligence_row_ids?.length ?? 0
  if (leftSources !== rightSources) return rightSources - leftSources

  return String(left.canonical_product_name).localeCompare(String(right.canonical_product_name))
}

export function buildCanonicalProductDisplayGroups(
  products = [],
  { limit = 100, incompleteOnly = true, activeBrands = null } = {},
) {
  const candidates = incompleteOnly
    ? filterCanonicalProductsForTop100Queue(products, { activeBrands })
    : (() => {
      const approved = products.filter((product) => product.status === 'approved')
      const seenKeys = new Set()
      const unique = []

      for (const product of [...approved].sort(compareCanonicalProductsForResearch)) {
        if (!product.canonical_product_key || seenKeys.has(product.canonical_product_key)) continue
        seenKeys.add(product.canonical_product_key)
        unique.push(product)
      }

      return unique
    })()

  return candidates
    .slice(0, limit)
    .map((product, index) => mapCanonicalProductToDisplayGroup(product, index + 1))
}

export function filterApprovedCanonicalProducts(products = []) {
  return products.filter((product) => product.status === 'approved')
}

/**
 * Build research queue from canonical equipment_products (one research run per product).
 * Uses the first linked intelligence row as the research proxy until product-level research lands.
 */
export function buildCanonicalProductResearchQueue(
  products = [],
  {
    targetCount = 100,
    skipCompleted = true,
    forceReResearch = false,
    activeBrands = null,
  } = {},
) {
  const summary = {
    scanned: 0,
    skipped: 0,
    excluded: 0,
    notApproved: 0,
    duplicateKeys: 0,
    ineligible: 0,
    imageOnly: 0,
    priceOnly: 0,
    lifecycleOnly: 0,
    full: 0,
    toResearch: 0,
    completedSkipped: 0,
    intelligence_rows_skipped: 0,
    queueType: 'canonical_products',
  }

  const queue = []
  const preview = []
  const top100Candidates = filterCanonicalProductsForTop100Queue(products, { activeBrands })
  const candidateIdSet = new Set(top100Candidates.map((product) => product.id))

  for (const product of products) {
    if (product.status === 'excluded') {
      summary.excluded += 1
      continue
    }
    if (product.status !== 'approved') {
      summary.notApproved += 1
      continue
    }
    if (product.canonical_product_key && !candidateIdSet.has(product.id)) {
      summary.ineligible += 1
    }
  }

  for (const product of top100Candidates) {
    if (queue.length >= targetCount) break

    summary.scanned += 1

    const representativeEquipmentId = product.representative_intelligence_row_id
      ?? product.source_intelligence_row_ids?.[0]
      ?? null
    if (!representativeEquipmentId) continue

    const sourceRowCount = product.source_intelligence_row_ids?.length ?? 1
    const canonicalLabel = product.canonical_product_name || 'Canonical product'

    const mode = deriveCanonicalProductResearchMode(product, { forceReResearch, skipCompleted })
    const completionStatus = deriveCanonicalProductCompletionStatus(product)

    const queueItem = {
      equipmentId: representativeEquipmentId,
      productId: product.id,
      label: canonicalLabel,
      canonicalProductName: canonicalLabel,
      mode,
      canonicalProductKey: product.canonical_product_key,
      sourceRowCount,
      productStatus: product.status,
      originalBasePrice: product.original_base_price,
      originalBasePriceCurrency: product.original_base_price_currency,
      baselineManufactureYear: product.baseline_manufacture_year,
      priceStatus: deriveCanonicalProductPriceStatus(product),
      lifecycleStatus: deriveCanonicalProductLifecycleStatus(product),
      completionStatus,
      completionLabel: formatCanonicalProductCompletionLabel(completionStatus),
      completionReason: formatCanonicalProductCompletionReason(product),
      isResearchComplete: isCanonicalProductResearchComplete(product),
      dedupeEligible: true,
      product,
    }

    if (mode === RESEARCH_QUEUE_MODES.SKIP) {
      summary.skipped += 1
      if (isCanonicalProductResearchComplete(product) && !hasCanonicalProductApprovedImage(product)) {
        summary.imageOnly = (summary.imageOnly ?? 0) + 1
      }
      if (isCanonicalProductResearchComplete(product)) {
        summary.completedSkipped = (summary.completedSkipped ?? 0) + 1
      }
      summary.intelligence_rows_skipped += Math.max(0, sourceRowCount - 1)
      preview.push({ ...queueItem, queued: false })
      continue
    }

    if (mode === RESEARCH_QUEUE_MODES.PRICE_ONLY) summary.priceOnly += 1
    if (mode === RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY) summary.lifecycleOnly += 1
    if (mode === RESEARCH_QUEUE_MODES.FULL) summary.full += 1

    queue.push(queueItem)
    preview.push({ ...queueItem, queued: true })
  }

  summary.toResearch = queue.length
  return { queue, summary, preview }
}
