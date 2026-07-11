import {
  hasVerifiedOriginalBasePrice,
  isCanonicalProductResearchComplete,
  mapCanonicalProductToDisplayGroup,
} from './equipmentResearchQueue.js'

export const CANONICAL_ORIGINAL_PRICE_SOURCE = {
  AI_RESEARCH_APPROVED: 'ai_research_approved',
  ADMIN: 'admin',
  MANUAL: 'manual',
}

const MANUAL_PRICE_SOURCES = new Set([
  CANONICAL_ORIGINAL_PRICE_SOURCE.ADMIN,
  CANONICAL_ORIGINAL_PRICE_SOURCE.MANUAL,
  'admin_manual',
  'admin_verified',
])

export function isManuallyVerifiedCanonicalProductPrice(product) {
  const source = String(product?.original_price_source ?? '').toLowerCase()
  if (MANUAL_PRICE_SOURCES.has(source)) return true
  if (source && source !== CANONICAL_ORIGINAL_PRICE_SOURCE.AI_RESEARCH_APPROVED && hasVerifiedOriginalBasePrice(product)) {
    return true
  }
  return false
}

export function isManuallyVerifiedCanonicalProductLifecycle(product) {
  if (product?.baseline_manufacture_year == null) return false
  const confidence = Number(product?.lifecycle_confidence)
  return Number.isFinite(confidence)
    && confidence >= 90
    && isCanonicalProductResearchComplete({
      ...product,
      original_price_confidence: product?.original_price_confidence ?? confidence,
    })
}

export function appendCanonicalResearchMetadataNote(existingNotes, recommendation, researchMeta) {
  const engine = researchMeta?.research_engine
    ?? researchMeta?.debug_log?.research_engine
    ?? 'v3'
  const priceConfidence = recommendation?.price_confidence ?? recommendation?.confidence
  const lifecycleConfidence = recommendation?.lifecycle_confidence
    ?? recommendation?.production_confidence
    ?? recommendation?.confidence
  const sourceUrl = recommendation?.price_sources_used?.[0] ?? null
  const snippet = recommendation?.admin_selection_snippet
    ? String(recommendation.admin_selection_snippet).slice(0, 240)
    : null
  const stamp = `[research_approved ${new Date().toISOString().slice(0, 10)}]`
  const line = [
    stamp,
    `engine=${engine}`,
    `price_conf=${priceConfidence ?? '—'}`,
    `lifecycle_conf=${lifecycleConfidence ?? '—'}`,
    sourceUrl ? `source=${sourceUrl}` : null,
    snippet ? `snippet=${snippet}` : null,
  ].filter(Boolean).join(' ')

  if (existingNotes?.includes(stamp)) return existingNotes ?? null
  return existingNotes ? `${existingNotes}\n${line}` : line
}

export function buildCanonicalProductResearchApproveUpdate(
  recommendation,
  {
    researchMeta = null,
    now = new Date().toISOString(),
    existingReviewNotes = null,
  } = {},
) {
  const sourcePrice = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  const sourceCurrency = (
    recommendation?.source_original_currency
    || recommendation?.currency
    || 'GBP'
  ).toUpperCase()
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  const priceConfidence = Number(
    recommendation?.price_confidence ?? recommendation?.confidence,
  )
  const productionConfidence = Number(
    recommendation?.production_confidence ?? recommendation?.confidence,
  )
  const lifecycleConfidence = Number(
    recommendation?.lifecycle_confidence ?? productionConfidence,
  )
  const hasPrice = Number.isFinite(sourcePrice) && sourcePrice > 0
  const baselineYear = recommendation?.baseline_manufacture_year
    ?? recommendation?.production_start_year

  const update = {
    updated_at: now,
  }

  if (hasPrice) {
    let valuationGbp = sourcePrice
    let valuationCurrency = sourceCurrency || 'GBP'

    if (sourceCurrency === 'USD') {
      if (!Number.isFinite(convertedGbp) || convertedGbp <= 0) {
        throw new Error('USD research price is missing a converted GBP valuation.')
      }
      valuationGbp = convertedGbp
      valuationCurrency = 'GBP'
    } else if (sourceCurrency !== 'GBP' && Number.isFinite(convertedGbp) && convertedGbp > 0) {
      valuationGbp = convertedGbp
      valuationCurrency = 'GBP'
    }

    update.original_base_price = valuationGbp
    update.original_base_price_currency = valuationCurrency
    update.original_price_confidence = Number.isFinite(priceConfidence) && priceConfidence > 0
      ? Math.trunc(priceConfidence)
      : null
    if (recommendation?.v3_metadata?.research_engine === 'manual') {
      update.original_price_source = CANONICAL_ORIGINAL_PRICE_SOURCE.MANUAL
    } else if (recommendation?.v3_metadata?.price_selection_status === 'admin_selected') {
      update.original_price_source = CANONICAL_ORIGINAL_PRICE_SOURCE.ADMIN
    } else {
      update.original_price_source = CANONICAL_ORIGINAL_PRICE_SOURCE.AI_RESEARCH_APPROVED
    }
  }

  if (baselineYear != null) {
    update.baseline_manufacture_year = Math.trunc(Number(baselineYear))
  }
  if (recommendation?.production_start_year != null) {
    update.production_start_year = Math.trunc(Number(recommendation.production_start_year))
  }
  if (recommendation?.production_end_year != null) {
    update.production_end_year = Math.trunc(Number(recommendation.production_end_year))
  }
  if (Number.isFinite(lifecycleConfidence)) {
    update.lifecycle_confidence = Math.trunc(lifecycleConfidence)
  }

  const reviewNotes = appendCanonicalResearchMetadataNote(
    existingReviewNotes,
    recommendation,
    researchMeta,
  )
  if (reviewNotes) {
    update.review_notes = reviewNotes
  }

  return update
}

export function applyCanonicalProductResearchProtection(currentProduct, update) {
  const protectedUpdate = { ...update }

  if (isManuallyVerifiedCanonicalProductPrice(currentProduct)) {
    delete protectedUpdate.original_base_price
    delete protectedUpdate.original_base_price_currency
    delete protectedUpdate.original_price_confidence
    delete protectedUpdate.original_price_source
  }

  if (isManuallyVerifiedCanonicalProductLifecycle(currentProduct)) {
    delete protectedUpdate.baseline_manufacture_year
    delete protectedUpdate.production_start_year
    delete protectedUpdate.production_end_year
    delete protectedUpdate.lifecycle_confidence
  }

  return protectedUpdate
}

export function hasCanonicalProductResearchFieldsToSave(update) {
  const keys = Object.keys(update ?? {}).filter((key) => key !== 'updated_at')
  return keys.length > 0
}

export function patchCanonicalProductGroupAfterResearchApprove(group, product) {
  if (!group?.isCanonicalProduct || !product?.id) return group
  if (group.productId !== product.id && group.keyword_key !== product.id) return group

  const patched = mapCanonicalProductToDisplayGroup(product, group.rank ?? 1)
  return {
    ...patched,
    product,
  }
}

export function patchCanonicalProductGroupsAfterResearchApprove(groups, product) {
  if (!Array.isArray(groups) || !product?.id) return groups ?? []
  return groups.map((group) => patchCanonicalProductGroupAfterResearchApprove(group, product))
}

export function buildBatchResearchQueueAfterApprove(queue, productId, { savedProduct = null } = {}) {
  if (!productId) return [...(queue ?? [])]

  const shouldRemove = savedProduct
    ? isCanonicalProductResearchComplete(savedProduct)
    : true

  if (!shouldRemove) return [...(queue ?? [])]
  return (queue ?? []).filter((entry) => entry.productId !== productId)
}

export function resolveBatchResearchAdvanceAfterApprove({
  batchResearchActive = false,
  saveError = null,
  batchResearchQueue = [],
  batchResearchIndex = 0,
  canonicalProductId = null,
  savedProduct = null,
} = {}) {
  if (!batchResearchActive) {
    return {
      shouldAdvance: false,
      shouldCloseModal: !saveError,
      nextQueue: batchResearchQueue,
      nextIndex: batchResearchIndex,
      batchComplete: false,
    }
  }

  if (saveError) {
    return {
      shouldAdvance: false,
      shouldCloseModal: false,
      nextQueue: batchResearchQueue,
      nextIndex: batchResearchIndex,
      batchComplete: false,
    }
  }

  if (canonicalProductId) {
    const nextQueue = buildBatchResearchQueueAfterApprove(
      batchResearchQueue,
      canonicalProductId,
      { savedProduct },
    )
    const productComplete = savedProduct
      ? isCanonicalProductResearchComplete(savedProduct)
      : true
    const nextIndex = productComplete ? batchResearchIndex : batchResearchIndex + 1

    if (nextQueue.length === 0 || nextIndex >= nextQueue.length) {
      return {
        shouldAdvance: true,
        shouldCloseModal: true,
        nextQueue,
        nextIndex: 0,
        batchComplete: true,
      }
    }

    return {
      shouldAdvance: true,
      shouldCloseModal: false,
      nextQueue,
      nextIndex: productComplete ? batchResearchIndex : nextIndex,
      batchComplete: false,
    }
  }

  const nextIndex = batchResearchIndex + 1
  if (nextIndex >= batchResearchQueue.length) {
    return {
      shouldAdvance: true,
      shouldCloseModal: true,
      nextQueue: batchResearchQueue,
      nextIndex,
      batchComplete: true,
    }
  }

  return {
    shouldAdvance: true,
    shouldCloseModal: false,
    nextQueue: batchResearchQueue,
    nextIndex,
    batchComplete: false,
  }
}

export function formatCanonicalResearchSavedMessage(product) {
  const parts = []
  if (product?.original_base_price != null) {
    parts.push(`price £${Number(product.original_base_price).toLocaleString('en-GB')}`)
  }
  if (product?.baseline_manufacture_year != null) {
    parts.push(`baseline ${product.baseline_manufacture_year}`)
  }
  return parts.length > 0
    ? `Saved to canonical product (${parts.join(', ')}).`
    : 'Saved to canonical product.'
}
