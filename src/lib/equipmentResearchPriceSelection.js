const RRP_CONFLICT_SPREAD_THRESHOLD = 0.20

export const EXPLICIT_RRP_LABELS = new Set([
  'RRP',
  'MSRP',
  'Original Price',
  'Original Retail Price',
  'Recommended Retail Price',
])

export function isExplicitRrpCandidate(item) {
  return item?.type === 'price'
    && !item.rejectionReason
    && item.eligibleForOriginalPrice !== false
    && item.brandModelMatch !== false
    && EXPLICIT_RRP_LABELS.has(item.label)
}

export function detectConflictingRrpCandidates(
  candidates = [],
  spreadThreshold = RRP_CONFLICT_SPREAD_THRESHOLD,
) {
  const rrpCandidates = candidates.filter(isExplicitRrpCandidate)
  const uniqueValues = [...new Set(rrpCandidates.map((item) => item.value))].sort((left, right) => left - right)

  if (uniqueValues.length < 2) {
    return {
      conflicting: false,
      rrpCandidates,
      uniqueValues,
      spreadPercent: 0,
    }
  }

  const min = uniqueValues[0]
  const max = uniqueValues[uniqueValues.length - 1]
  const spread = min > 0 ? (max - min) / min : 1

  return {
    conflicting: spread > spreadThreshold,
    rrpCandidates,
    uniqueValues,
    spreadPercent: Math.round(spread * 100),
  }
}

export function isResearchManualSelectionRequired(recommendation) {
  return recommendation?.v3_metadata?.price_selection_status === 'manual_required'
}

export function getAiAdvisoryPrice(recommendation) {
  const meta = recommendation?.v3_metadata ?? {}
  if (meta.ai_suggested_price != null) return meta.ai_suggested_price
  if (isResearchManualSelectionRequired(recommendation)) return null
  return recommendation?.original_new_price ?? null
}

export function getAiAdvisoryConfidence(recommendation) {
  const meta = recommendation?.v3_metadata ?? {}
  if (meta.ai_suggested_confidence != null) return meta.ai_suggested_confidence
  if (isResearchManualSelectionRequired(recommendation)) return null
  return recommendation?.price_confidence ?? recommendation?.confidence ?? null
}

export function normalizeSelectedManualPriceCandidate(candidate) {
  if (!candidate) return null
  const value = Number(candidate.value)
  if (!Number.isFinite(value) || value <= 0) return null

  return {
    id: candidate.id ?? null,
    label: candidate.label ?? 'RRP',
    value,
    currency: candidate.currency || 'GBP',
    confidence: Number(candidate.confidence) > 0 ? Math.trunc(Number(candidate.confidence)) : null,
    sourceUrl: candidate.sourceUrl ?? null,
    sourceDomain: candidate.sourceDomain ?? null,
    surroundingText: candidate.surroundingText ?? null,
  }
}

export function findPriceCandidateById(candidates, candidateId) {
  if (!candidateId) return null
  return candidates.find((item) => item.id === candidateId) ?? null
}

function parseOptionalYear(value) {
  if (value === '' || value == null) return null
  const year = Math.trunc(Number(value))
  return Number.isFinite(year) && year > 0 ? year : null
}

export function createEmptyManualProductRecommendation() {
  return {
    original_new_price: null,
    currency: 'GBP',
    price_confidence: null,
    price_reasoning: 'Manual admin entry.',
    price_sources_used: [],
    production_start_year: null,
    production_end_year: null,
    production_confidence: null,
    production_reasoning: '',
    production_sources_used: [],
    confidence: 0,
    confidence_reasoning: 'Manual admin entry.',
    reasoning: 'Manual admin entry.',
    supporting_urls: [],
    supporting_sources: [],
    baseline_manufacture_year: null,
    lifecycle_confidence: null,
    v3_metadata: {
      research_engine: 'manual',
      price_selection_status: 'admin_selected',
    },
  }
}

export function createPriceSelectionFromCanonicalProduct(product) {
  const price = product?.original_base_price
  const hasPrice = price != null && Number(price) > 0

  return {
    ...createEmptyResearchPriceSelectionState(),
    manualPrice: hasPrice ? String(price) : '',
    manualCurrency: product?.original_base_price_currency || 'GBP',
    manualBaselineYear: product?.baseline_manufacture_year ?? '',
    manualProductionStart: product?.production_start_year ?? '',
    manualProductionEnd: product?.production_end_year ?? '',
    manualSourceUrl: '',
    manualNotes: '',
  }
}

export function canSaveManualProductData(selectionState, candidates = []) {
  const effective = resolveEffectiveApprovalPrice(selectionState, candidates)
  if (effective?.value > 0) return true

  return parseOptionalYear(selectionState?.manualBaselineYear) != null
    || parseOptionalYear(selectionState?.manualProductionStart) != null
    || parseOptionalYear(selectionState?.manualProductionEnd) != null
}

export function maybeAutoSelectObviousPriceCandidate(
  recommendation,
  candidates = [],
  existingSelection = null,
) {
  const baseSelection = existingSelection ?? createEmptyResearchPriceSelectionState(recommendation, candidates)

  if (hasManualPriceEntryDraft(baseSelection) || baseSelection?.selectedCandidateId) {
    return baseSelection
  }

  const rrpCandidates = candidates.filter(isExplicitRrpCandidate)
  if (rrpCandidates.length === 1 && Number(rrpCandidates[0].confidence) >= 80) {
    return applySelectPriceCandidate(baseSelection, rrpCandidates[0].id, candidates)
  }

  return createEmptyResearchPriceSelectionState(recommendation, candidates)
}

export function mergeEvidenceIntoManualPriceSelection(
  existingSelection,
  recommendation,
  candidates = [],
) {
  const hasExistingData = hasManualPriceEntryDraft(existingSelection)
    || existingSelection?.selectedCandidateId
    || parseOptionalYear(existingSelection?.manualBaselineYear) != null
    || parseOptionalYear(existingSelection?.manualProductionStart) != null
    || parseOptionalYear(existingSelection?.manualProductionEnd) != null

  if (hasExistingData) {
    return {
      ...existingSelection,
      manualCurrency: existingSelection.manualCurrency || recommendation?.currency || 'GBP',
    }
  }

  return maybeAutoSelectObviousPriceCandidate(recommendation, candidates, existingSelection)
}

export function buildValidatedManualProductSave(
  baseRecommendation,
  selectionState,
  candidates = [],
) {
  const base = baseRecommendation ?? createEmptyManualProductRecommendation()
  const recommendation = buildApprovalRecommendation(base, selectionState, candidates)

  recommendation.v3_metadata = {
    ...recommendation.v3_metadata,
    research_engine: 'manual',
    price_selection_status: 'admin_selected',
  }

  const price = Number(recommendation?.original_new_price)
  const hasPrice = Number.isFinite(price) && price > 0
  const hasBaseline = recommendation?.baseline_manufacture_year != null
  const hasProduction = recommendation?.production_start_year != null
    || recommendation?.production_end_year != null

  if (!hasPrice && !hasBaseline && !hasProduction) {
    return {
      recommendation: null,
      error: new Error('Enter an RRP or at least one year field before saving.'),
    }
  }

  if (hasPrice) {
    const confidence = Number(recommendation.price_confidence)
    if (!Number.isFinite(confidence) || confidence <= 0) {
      recommendation.price_confidence = 85
    }
  }

  if ((hasBaseline || hasProduction) && !Number.isFinite(Number(recommendation.lifecycle_confidence))) {
    recommendation.lifecycle_confidence = 85
    recommendation.production_confidence = 85
  }

  if (selectionState?.manualNotes) {
    recommendation.admin_selection_snippet = selectionState.manualNotes
  }

  return { recommendation, error: null }
}

export function createEmptyResearchPriceSelectionState(recommendation = null, candidates = []) {
  const manualRequired = isResearchManualSelectionRequired(recommendation)
  const preselectedId = manualRequired
    ? null
    : (recommendation?.v3_metadata?.structured_evidence_selected_id ?? null)
  const preselectedCandidate = normalizeSelectedManualPriceCandidate(
    findPriceCandidateById(candidates, preselectedId),
  )

  return {
    selectedCandidateId: preselectedId,
    selectedManualPriceCandidate: preselectedCandidate,
    rejectedCandidateIds: [],
    usedRefurbCandidateIds: [],
    manualPrice: '',
    manualCurrency: recommendation?.currency || 'GBP',
    manualSourceUrl: '',
    manualBaselineYear: recommendation?.baseline_manufacture_year ?? '',
    manualProductionStart: recommendation?.production_start_year ?? '',
    manualProductionEnd: recommendation?.production_end_year ?? '',
    manualNotes: '',
  }
}

export function applySelectPriceCandidate(selectionState, candidateId, candidates = []) {
  const candidate = findPriceCandidateById(candidates, candidateId)
  const normalized = normalizeSelectedManualPriceCandidate(candidate)

  return {
    ...selectionState,
    selectedCandidateId: candidateId,
    selectedManualPriceCandidate: normalized,
    manualPrice: '',
    rejectedCandidateIds: selectionState.rejectedCandidateIds.filter((id) => id !== candidateId),
    usedRefurbCandidateIds: selectionState.usedRefurbCandidateIds.filter((id) => id !== candidateId),
    manualCurrency: normalized?.currency || selectionState.manualCurrency || 'GBP',
    manualSourceUrl: normalized?.sourceUrl || selectionState.manualSourceUrl || '',
  }
}

export function applySelectYearCandidate(selectionState, lifecycleItem) {
  if (!lifecycleItem) return selectionState

  const year = lifecycleItem.year ?? null
  const yearEnd = lifecycleItem.yearEnd ?? null

  return {
    ...selectionState,
    manualBaselineYear: year ?? selectionState.manualBaselineYear ?? '',
    manualProductionStart: year ?? selectionState.manualProductionStart ?? '',
    manualProductionEnd: yearEnd ?? selectionState.manualProductionEnd ?? '',
    manualSourceUrl: lifecycleItem.sourceUrl || selectionState.manualSourceUrl || '',
  }
}

export function applyRejectPriceCandidate(selectionState, candidateId) {
  const clearsSelection = selectionState.selectedCandidateId === candidateId
  return {
    ...selectionState,
    selectedCandidateId: clearsSelection ? null : selectionState.selectedCandidateId,
    selectedManualPriceCandidate: clearsSelection ? null : selectionState.selectedManualPriceCandidate,
    rejectedCandidateIds: [...new Set([...selectionState.rejectedCandidateIds, candidateId])],
    usedRefurbCandidateIds: selectionState.usedRefurbCandidateIds.filter((id) => id !== candidateId),
  }
}

export function applyMarkUsedRefurbCandidate(selectionState, candidateId) {
  const clearsSelection = selectionState.selectedCandidateId === candidateId
  return {
    ...selectionState,
    selectedCandidateId: clearsSelection ? null : selectionState.selectedCandidateId,
    selectedManualPriceCandidate: clearsSelection ? null : selectionState.selectedManualPriceCandidate,
    usedRefurbCandidateIds: [...new Set([...selectionState.usedRefurbCandidateIds, candidateId])],
    rejectedCandidateIds: selectionState.rejectedCandidateIds.filter((id) => id !== candidateId),
  }
}

export function applyManualPriceFieldChange(selectionState, field, value) {
  const next = {
    ...selectionState,
    [field]: value,
  }

  if (field === 'manualPrice' && value) {
    next.selectedCandidateId = null
    next.selectedManualPriceCandidate = null
  }

  return next
}

export function applyConfirmManualPriceEntry(selectionState) {
  const manualPrice = parseManualPriceValue(selectionState?.manualPrice)
  if (!Number.isFinite(manualPrice) || manualPrice <= 0) {
    return { state: selectionState, error: 'Enter a valid manual RRP before applying.' }
  }

  return {
    state: {
      ...selectionState,
      selectedCandidateId: null,
      selectedManualPriceCandidate: {
        id: 'manual-entry',
        label: 'Manual RRP',
        value: manualPrice,
        currency: selectionState.manualCurrency || 'GBP',
        confidence: 85,
        sourceUrl: selectionState.manualSourceUrl || null,
        sourceDomain: null,
        surroundingText: selectionState.manualNotes || null,
      },
      manualPrice: String(manualPrice),
    },
    error: null,
  }
}

export function hasManualPriceEntryDraft(selectionState) {
  const manualPrice = parseManualPriceValue(selectionState?.manualPrice)
  return Number.isFinite(manualPrice) && manualPrice > 0
}

export function getCandidateAdminStatus(candidateId, selectionState) {
  if (!candidateId || !selectionState) return null
  if (selectionState.selectedCandidateId === candidateId) return 'selected'
  if (selectionState.rejectedCandidateIds.includes(candidateId)) return 'rejected'
  if (selectionState.usedRefurbCandidateIds.includes(candidateId)) return 'used_refurb'
  return null
}

function parseManualPriceValue(manualPrice) {
  return Number(String(manualPrice ?? '').replace(/,/g, ''))
}

export function resolveEffectiveApprovalPrice(selectionState, candidates = []) {
  if (!selectionState) return null

  const manualPrice = parseManualPriceValue(selectionState.manualPrice)
  if (Number.isFinite(manualPrice) && manualPrice > 0) {
    return {
      source: 'manual_entry',
      value: manualPrice,
      currency: selectionState.manualCurrency || 'GBP',
      confidence: normalizePositiveConfidence(selectionState.manualConfidence, 85),
      label: 'Manual RRP',
      sourceUrl: selectionState.manualSourceUrl || null,
      sourceDomain: null,
      surroundingText: selectionState.manualNotes || null,
      candidateId: null,
    }
  }

  const snapshot = selectionState.selectedManualPriceCandidate
    ?? normalizeSelectedManualPriceCandidate(
      findPriceCandidateById(candidates, selectionState.selectedCandidateId),
    )

  if (!snapshot) return null
  if (selectionState.rejectedCandidateIds.includes(snapshot.id)) return null
  if (selectionState.usedRefurbCandidateIds.includes(snapshot.id)) return null
  if (Number(snapshot.confidence) <= 0) return null

  return {
    source: 'candidate',
    value: snapshot.value,
    currency: snapshot.currency || 'GBP',
    confidence: normalizePositiveConfidence(snapshot.confidence),
    label: snapshot.label || 'RRP',
    sourceUrl: snapshot.sourceUrl,
    sourceDomain: snapshot.sourceDomain,
    surroundingText: snapshot.surroundingText,
    candidateId: snapshot.id,
  }
}

export function canApproveResearchPriceSelection(selectionState, candidates = []) {
  const effective = resolveEffectiveApprovalPrice(selectionState, candidates)
  return effective != null && effective.value > 0 && effective.confidence > 0
}

function normalizePositiveConfidence(value, fallback = 85) {
  const confidence = Number(value)
  if (!Number.isFinite(confidence) || confidence <= 0) {
    return fallback
  }
  return Math.trunc(confidence)
}

export function buildApprovalRecommendation(
  baseRecommendation,
  selectionState,
  candidates = [],
) {
  if (!baseRecommendation || !selectionState) {
    return baseRecommendation
  }

  const merged = { ...baseRecommendation }
  const effective = resolveEffectiveApprovalPrice(selectionState, candidates)
  const manualRequired = isResearchManualSelectionRequired(baseRecommendation)

  if (!effective) {
    if (manualRequired) {
      merged.original_new_price = null
      merged.source_original_price = null
      merged.price_confidence = null
      merged.price_sources_used = []
    }
    return merged
  }

  merged.original_new_price = effective.value
  merged.source_original_price = effective.value
  merged.currency = effective.currency || 'GBP'
  merged.source_original_currency = effective.currency || 'GBP'
  merged.price_confidence = effective.confidence
  merged.price_sources_used = effective.sourceUrl ? [effective.sourceUrl] : []
  merged.admin_selection_snippet = effective.surroundingText ?? null
  merged.price_reasoning = effective.source === 'manual_entry'
    ? [
      'Admin manual RRP entry.',
      selectionState.manualNotes,
      baseRecommendation.price_reasoning,
    ].filter(Boolean).join(' ')
    : [
      `Admin selected ${effective.label} £${Number(effective.value).toLocaleString('en-GB')} from ${effective.sourceDomain || 'source'}.`,
      selectionState.manualNotes,
      baseRecommendation.price_reasoning,
    ].filter(Boolean).join(' ')

  merged.v3_metadata = {
    ...merged.v3_metadata,
    price_selection_status: 'admin_selected',
    structured_evidence_selected_id: effective.candidateId,
    price_label_detected: effective.label,
    source_domain: effective.sourceDomain ?? merged.v3_metadata?.source_domain ?? null,
    evidence_confidence: merged.price_confidence,
  }

  if (selectionState.manualBaselineYear !== '' && selectionState.manualBaselineYear != null) {
    merged.baseline_manufacture_year = Math.trunc(Number(selectionState.manualBaselineYear))
  }
  if (selectionState.manualProductionStart !== '' && selectionState.manualProductionStart != null) {
    merged.production_start_year = Math.trunc(Number(selectionState.manualProductionStart))
  }
  if (selectionState.manualProductionEnd !== '' && selectionState.manualProductionEnd != null) {
    merged.production_end_year = Math.trunc(Number(selectionState.manualProductionEnd))
  }

  if (merged.price_confidence != null && Number(merged.price_confidence) <= 0) {
    merged.price_confidence = null
  }

  return merged
}

export function validateBuiltApprovalRecommendation(recommendation, baseRecommendation = null) {
  const price = Number(recommendation?.original_new_price)
  if (!Number.isFinite(price) || price <= 0) {
    return {
      error: new Error('Select an RRP candidate or enter a manual price before approving.'),
    }
  }

  const confidence = Number(recommendation?.price_confidence)
  if (!Number.isFinite(confidence) || confidence <= 0) {
    return {
      error: new Error('Cannot approve with 0% confidence. Select a different candidate or enter a manual RRP.'),
    }
  }

  if (isResearchManualSelectionRequired(baseRecommendation)
    && recommendation?.v3_metadata?.price_selection_status !== 'admin_selected') {
    return {
      error: new Error('Manual RRP selection is required before approving.'),
    }
  }

  return { error: null }
}

export function buildValidatedApprovalRecommendation(
  baseRecommendation,
  selectionState,
  candidates = [],
) {
  const recommendation = buildApprovalRecommendation(baseRecommendation, selectionState, candidates)
  const validation = validateBuiltApprovalRecommendation(recommendation, baseRecommendation)
  if (validation.error) {
    return { recommendation: null, error: validation.error }
  }
  return { recommendation, error: null }
}

export function formatEffectiveApprovalPrice(effective) {
  if (!effective) return '—'
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: effective.currency || 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(effective.value)
  } catch {
    return `£${Number(effective.value).toLocaleString('en-GB')}`
  }
}

export function formatManualSelectionRequiredMessage(recommendation, candidates = []) {
  const conflict = detectConflictingRrpCandidates(candidates)
  const meta = recommendation?.v3_metadata ?? {}
  const spread = meta.conflicting_rrp_spread_percent ?? conflict.spreadPercent
  const count = meta.conflicting_rrp_count ?? conflict.rrpCandidates.length
  if (count >= 2 && spread > 20) {
    return `Manual selection required — ${count} conflicting RRP candidates differ by ${spread}%.`
  }
  return 'Manual selection required — choose the correct original RRP before approving.'
}
