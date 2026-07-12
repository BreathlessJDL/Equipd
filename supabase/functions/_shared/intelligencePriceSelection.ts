import type { EquipmentResearchRecommendation } from './intelligenceEquipmentResearch.ts'
import type { StructuredEvidenceItem } from './intelligenceStructuredEvidence.ts'

export const ORIGINAL_PRICE_LABEL_PRIORITY: Record<string, number> = {
  RRP: 1,
  MSRP: 2,
  'Original Price': 3,
  'Original Retail Price': 4,
  'Recommended Retail Price': 5,
  'List Price': 6,
  'Retail Price': 7,
  'Launch Price': 8,
  'Was Price': 9,
  Was: 10,
  'Discontinued Price': 11,
  'Dealer Price': 20,
  'Listed Price': 21,
  'Our Price': 22,
  'Sale Price': 23,
}

const HIGH_CONFIDENCE_RRP_THRESHOLD = 70
const RRP_CONFLICT_SPREAD_THRESHOLD = 0.20

export const EXPLICIT_RRP_LABELS = new Set([
  'RRP',
  'MSRP',
  'Original Price',
  'Original Retail Price',
  'Recommended Retail Price',
])

export function isExplicitRrpCandidate(item: StructuredEvidenceItem): boolean {
  return item.type === 'price'
    && item.rejectionReason == null
    && item.eligibleForOriginalPrice
    && item.brandModelMatch
    && EXPLICIT_RRP_LABELS.has(item.label)
}

export function detectConflictingRrpCandidates(
  candidates: StructuredEvidenceItem[],
  spreadThreshold = RRP_CONFLICT_SPREAD_THRESHOLD,
) {
  const rrpCandidates = candidates.filter(isExplicitRrpCandidate)
  const uniqueValues = [...new Set(rrpCandidates.map((item) => item.value))].sort((left, right) => left - right)

  if (uniqueValues.length < 2) {
    return {
      conflicting: false,
      rrpCandidates,
      uniqueValues,
      spread: 0,
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
    spread,
    spreadPercent: Math.round(spread * 100),
  }
}

export type V3PriceSelectionResolution = {
  manualSelectionRequired: boolean
  autoSelectedCandidate: StructuredEvidenceItem | null
  conflictingRrpCandidates: StructuredEvidenceItem[]
  priceSelectionStatus: 'auto_selected' | 'manual_required'
  conflictSpreadPercent: number | null
  aiSuggestedCandidate: StructuredEvidenceItem | null
}

export function resolveV3PriceSelection(
  candidates: StructuredEvidenceItem[],
): V3PriceSelectionResolution {
  const conflict = detectConflictingRrpCandidates(candidates)
  const aiSuggestedCandidate = selectBestOriginalPriceCandidate(candidates)

  if (conflict.conflicting) {
    return {
      manualSelectionRequired: true,
      autoSelectedCandidate: null,
      conflictingRrpCandidates: conflict.rrpCandidates,
      priceSelectionStatus: 'manual_required',
      conflictSpreadPercent: conflict.spreadPercent,
      aiSuggestedCandidate,
    }
  }

  return {
    manualSelectionRequired: !aiSuggestedCandidate,
    autoSelectedCandidate: aiSuggestedCandidate,
    conflictingRrpCandidates: conflict.rrpCandidates,
    priceSelectionStatus: aiSuggestedCandidate ? 'auto_selected' : 'manual_required',
    conflictSpreadPercent: null,
    aiSuggestedCandidate,
  }
}

export function applyManualPriceSelectionRequirement(
  recommendation: EquipmentResearchRecommendation,
  selection: V3PriceSelectionResolution,
): EquipmentResearchRecommendation {
  if (!selection.manualSelectionRequired) {
    return recommendation
  }

  const aiSuggestedPrice = recommendation.original_new_price
  const aiSuggestedConfidence = recommendation.price_confidence
  const conflictNote = selection.conflictingRrpCandidates.length >= 2
    ? `${selection.conflictingRrpCandidates.length} conflicting RRP candidates differ by ${selection.conflictSpreadPercent ?? 0}%`
    : 'No single RRP candidate could be auto-selected'

  return {
    ...recommendation,
    original_new_price: null,
    price_confidence: null,
    price_review_status: 'needs_review',
    price_reasoning: [
      'Manual RRP selection required.',
      conflictNote,
      aiSuggestedPrice != null
        ? `AI suggestion £${Number(aiSuggestedPrice).toLocaleString('en-GB')} kept for reference only.`
        : null,
      recommendation.price_reasoning,
    ].filter(Boolean).join(' '),
    v3_metadata: {
      research_engine: 'v3',
      price_inference_method: recommendation.v3_metadata?.price_inference_method ?? 'ai_inference',
      price_label_detected: recommendation.v3_metadata?.price_label_detected ?? null,
      source_domain: recommendation.v3_metadata?.source_domain ?? null,
      evidence_confidence: null,
      core_product_group_research: recommendation.v3_metadata?.core_product_group_research ?? false,
      dedupe_eligible: recommendation.v3_metadata?.dedupe_eligible ?? false,
      price_scope: recommendation.v3_metadata?.price_scope ?? null,
      structured_evidence_selected_id: null,
      price_selection_status: 'manual_required',
      ai_suggested_price: aiSuggestedPrice,
      ai_suggested_confidence: aiSuggestedConfidence,
      conflicting_rrp_count: selection.conflictingRrpCandidates.length,
      conflicting_rrp_spread_percent: selection.conflictSpreadPercent,
    },
  }
}

export function getOriginalPriceLabelPriority(label: string): number {
  return ORIGINAL_PRICE_LABEL_PRIORITY[label] ?? 15
}

export function isCurrentOrSalePriceContext(context: string): boolean {
  const lower = context.toLowerCase()
  return /\b(?:now|only)\s*£[\d,]+/i.test(context)
    || /\bour\s+price\b/i.test(lower)
    || /\b(?:sale|clearance|current)\s+price\b/i.test(lower)
    || /\b(?:used|refurbished|reconditioned|pre[\s-]?owned|ex[\s-]?demo|second[\s-]?hand)\b/i.test(lower)
    || (/\bwas\b/i.test(lower) && /\b(?:now|only|from)\s*£/i.test(context))
}

export function isWeakListPriceForOriginalRrp(context: string): boolean {
  return /\blist\s+price\b/i.test(context)
    && isCurrentOrSalePriceContext(context)
    && !/\b(?:rrp|msrp|original\s+(?:retail\s+)?price)\b/i.test(context)
}

export function priceMatchesExplicitOriginalLabel(item: StructuredEvidenceItem): boolean {
  if (!['RRP', 'MSRP', 'Original Price', 'Original Retail Price', 'Recommended Retail Price'].includes(item.label)) {
    return false
  }

  const valuePattern = item.value.toLocaleString('en-GB').replace(/,/g, '[,]?')
  const labelPattern = item.label === 'MSRP'
    ? 'msrp'
    : item.label === 'RRP'
      ? 'rrp'
      : item.label.toLowerCase().replace(/\s+/g, '\\s+')

  return new RegExp(
    `\\b${labelPattern}\\b[^£$€\\d]{0,40}(?:£|gbp|\\$|usd|€|eur)?\\s*${valuePattern}\\b`,
    'i',
  ).test(item.surroundingText.replace(/,/g, ''))
    || new RegExp(
      `\\b${labelPattern}\\b[^£$€\\d]{0,40}${valuePattern}\\b`,
      'i',
    ).test(item.surroundingText)
}

export function explainPriceCandidateRejection(
  item: StructuredEvidenceItem,
  allCandidates: StructuredEvidenceItem[],
  selectedId: string | null,
): string | null {
  if (item.id === selectedId) return null
  if (item.rejectionReason) {
    switch (item.rejectionReason) {
      case 'marketplace_not_rrp':
        return 'Marketplace listing — not valid RRP'
      case 'finance_or_monthly_price':
        return 'Finance/monthly price — not RRP'
      case 'ineligible_price_label':
        return 'Current/sale/our price label — not original RRP'
      case 'unrelated_model':
        return 'Unrelated model or product'
      case 'current_sale_price_context':
        return 'Current/used/refurbished price context — not RRP'
      case 'weaker_than_selected_rrp':
        return 'Lower-priority price while explicit RRP exists'
      default:
        return item.rejectionReason
    }
  }

  if (!item.eligibleForOriginalPrice) {
    return 'Not eligible as original RRP'
  }

  const selected = selectedId
    ? allCandidates.find((candidate) => candidate.id === selectedId)
    : null
  if (selected && selected.value !== item.value) {
    const selectedPriority = getOriginalPriceLabelPriority(selected.label)
    const itemPriority = getOriginalPriceLabelPriority(item.label)
    if (selectedPriority < itemPriority) {
      return `Superseded by ${selected.label} £${selected.value.toLocaleString('en-GB')}`
    }
    if (selectedPriority === itemPriority && selected.confidence > item.confidence) {
      return `Lower confidence than selected ${selected.label}`
    }
  }

  if (isCurrentOrSalePriceContext(item.surroundingText)) {
    return 'Current/used/refurbished price context — not RRP'
  }

  return null
}

function effectivePricePriority(item: StructuredEvidenceItem): number {
  let priority = getOriginalPriceLabelPriority(item.label)

  if (item.rejectionReason) return 100
  if (!item.eligibleForOriginalPrice) return 90
  if (!item.brandModelMatch) return 85
  if (priceMatchesExplicitOriginalLabel(item)) return priority
  if (isCurrentOrSalePriceContext(item.surroundingText)) return 80
  if (isWeakListPriceForOriginalRrp(item.surroundingText)) return 75
  if (item.label === 'List Price' || item.label === 'Listed Price' || item.label === 'Dealer Price') {
    priority = Math.max(priority, 18)
  }
  if (item.label === 'Was' || item.label === 'Was Price') {
    priority = Math.max(priority, 10)
  }

  return priority
}

export function compareOriginalPriceCandidates(
  left: StructuredEvidenceItem,
  right: StructuredEvidenceItem,
): number {
  const leftPriority = effectivePricePriority(left)
  const rightPriority = effectivePricePriority(right)
  if (leftPriority !== rightPriority) return leftPriority - rightPriority

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence
  }

  if (left.score !== right.score) {
    return right.score - left.score
  }

  return left.value - right.value
}

export function selectBestOriginalPriceCandidate(
  candidates: StructuredEvidenceItem[],
): StructuredEvidenceItem | null {
  const eligible = candidates.filter((item) => (
    item.type === 'price'
    && item.rejectionReason == null
    && item.eligibleForOriginalPrice
    && item.brandModelMatch
    && (priceMatchesExplicitOriginalLabel(item)
      || (!isCurrentOrSalePriceContext(item.surroundingText)
        && !isWeakListPriceForOriginalRrp(item.surroundingText)))
  ))

  if (eligible.length === 0) {
    const fallback = candidates
      .filter((item) => (
        item.type === 'price'
        && item.rejectionReason == null
        && item.eligibleForOriginalPrice
        && item.brandModelMatch
      ))
      .sort(compareOriginalPriceCandidates)
    return fallback[0] ?? null
  }

  const sorted = [...eligible].sort(compareOriginalPriceCandidates)
  const best = sorted[0]

  const strongRrp = sorted.find((item) => (
    (item.label === 'RRP' || item.label === 'MSRP')
    && item.confidence >= HIGH_CONFIDENCE_RRP_THRESHOLD
    && item.brandModelMatch
  ))
  if (strongRrp) return strongRrp

  return best
}

export function shouldOverrideAiPriceChoice(
  best: StructuredEvidenceItem | null,
  recommendation: EquipmentResearchRecommendation,
  candidates: StructuredEvidenceItem[],
): boolean {
  if (!best) return false

  const aiPrice = recommendation.original_new_price
  if (aiPrice == null) return true
  if (aiPrice === best.value) return false

  const aiCandidate = candidates.find((item) => item.value === aiPrice) ?? null
  if (!aiCandidate) {
    return best.confidence >= HIGH_CONFIDENCE_RRP_THRESHOLD
      && (best.label === 'RRP' || best.label === 'MSRP')
  }

  return compareOriginalPriceCandidates(best, aiCandidate) < 0
}

export function finalizeV3PriceRecommendation(
  recommendation: EquipmentResearchRecommendation,
  candidates: StructuredEvidenceItem[],
  best: StructuredEvidenceItem | null,
  {
    manualSelectionRequired = false,
  }: { manualSelectionRequired?: boolean } = {},
): EquipmentResearchRecommendation {
  if (manualSelectionRequired || !best || !shouldOverrideAiPriceChoice(best, recommendation, candidates)) {
    return recommendation
  }

  const overrideNote = recommendation.original_new_price != null
    && recommendation.original_new_price !== best.value
    ? `Deterministic override: selected ${best.label} £${best.value.toLocaleString('en-GB')} over AI choice £${Number(recommendation.original_new_price).toLocaleString('en-GB')}.`
    : null

  return {
    ...recommendation,
    original_new_price: best.value,
    currency: best.currency ?? recommendation.currency,
    price_confidence: best.confidence > 0 ? best.confidence : null,
    price_sources_used: best.sourceUrl
      ? [...new Set([best.sourceUrl, ...recommendation.price_sources_used])]
      : recommendation.price_sources_used,
    price_reasoning: overrideNote
      ? `${overrideNote} ${recommendation.price_reasoning}`.trim()
      : recommendation.price_reasoning,
  }
}

export function annotatePriceEvidenceForAdmin(
  candidates: StructuredEvidenceItem[],
  selectedId: string | null,
) {
  return candidates.map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
    currency: item.currency,
    sourceDomain: item.sourceDomain,
    sourceUrl: item.sourceUrl,
    confidence: item.confidence,
    score: item.score,
    extractionMethod: item.extractionMethod,
    rejectionReason: item.rejectionReason,
    identityScore: item.identityScore,
    identityLevel: item.identityLevel,
    identityLabel: item.identityLabel,
    selected: item.id === selectedId,
    selectionNote: explainPriceCandidateRejection(item, candidates, selectedId),
  }))
}

export function ensureBestCandidateInEvidenceList(
  items: StructuredEvidenceItem[],
  best: StructuredEvidenceItem | null,
  limit: number,
): StructuredEvidenceItem[] {
  if (!best) return items.slice(0, limit)

  const withoutBest = items.filter((item) => item.id !== best.id)
  const trimmed = withoutBest.slice(0, Math.max(0, limit - 1))
  return [best, ...trimmed]
}
