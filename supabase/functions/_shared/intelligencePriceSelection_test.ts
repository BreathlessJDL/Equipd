import type { StructuredEvidenceItem } from './intelligenceStructuredEvidence.ts'
import {
  applyManualPriceSelectionRequirement,
  finalizeV3PriceRecommendation,
  resolveV3PriceSelection,
  selectBestOriginalPriceCandidate,
} from './intelligencePriceSelection.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

function makeCandidate(overrides: Partial<StructuredEvidenceItem>): StructuredEvidenceItem {
  return {
    id: overrides.id ?? 'price-1',
    type: 'price',
    label: overrides.label ?? 'RRP',
    value: overrides.value ?? 10995,
    currency: overrides.currency ?? 'GBP',
    year: null,
    yearEnd: null,
    surroundingText: overrides.surroundingText ?? 'RRP £10,995',
    sourceUrl: overrides.sourceUrl ?? 'https://www.fitkituk.com/product',
    sourceDomain: overrides.sourceDomain ?? 'fitkituk.com',
    sourceType: overrides.sourceType ?? 'dealer_catalogue',
    sourceScore: overrides.sourceScore ?? 12,
    confidence: overrides.confidence ?? 100,
    score: overrides.score ?? 100,
    eligibleForOriginalPrice: overrides.eligibleForOriginalPrice ?? true,
    rejectionReason: overrides.rejectionReason ?? null,
    extractionMethod: 'structured',
    nearModelName: true,
    brandModelMatch: overrides.brandModelMatch ?? true,
    productFamilyMatch: true,
    isMarketplace: false,
    isFinancePrice: false,
  }
}

const candidates = [
  makeCandidate({
    id: 'listed',
    label: 'List Price',
    value: 795,
    confidence: 55,
    score: 55,
    surroundingText: 'Now £795 List Price for current stock',
  }),
  makeCandidate({
    id: 'rrp',
    label: 'RRP',
    value: 10995,
    confidence: 100,
    score: 100,
    surroundingText: 'RRP £10,995 inc VAT',
  }),
  makeCandidate({
    id: 'was',
    label: 'Was',
    value: 895,
    confidence: 90,
    score: 90,
    surroundingText: 'Was £895 Now £795',
  }),
]

const best = selectBestOriginalPriceCandidate(candidates)
assert(best?.id === 'rrp', 'RRP £10,995 must beat listed £795 and was £895')
assert(best?.value === 10995, 'selected original price must be £10,995')

const overridden = finalizeV3PriceRecommendation({
  original_new_price: 795,
  currency: 'GBP',
  price_confidence: 55,
  price_reasoning: 'picked current list price',
  price_sources_used: [],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: '',
  production_sources_used: [],
  confidence: 55,
  confidence_reasoning: '',
  reasoning: '',
  supporting_urls: [],
  supporting_sources: [],
}, candidates, best)

assert(
  overridden.original_new_price === 10995,
  'deterministic override must replace AI-selected £795 with RRP £10,995',
)

const wasBeatsRrp = selectBestOriginalPriceCandidate([
  makeCandidate({ id: 'rrp', label: 'RRP', value: 10995, confidence: 100 }),
  makeCandidate({
    id: 'was',
    label: 'Was',
    value: 895,
    confidence: 90,
    surroundingText: 'Was £895 before promotion',
  }),
])
assert(wasBeatsRrp?.id === 'rrp', 'was price must not beat RRP')

const currentBeatsRrp = selectBestOriginalPriceCandidate([
  makeCandidate({ id: 'rrp', label: 'RRP', value: 10995, confidence: 100 }),
  makeCandidate({
    id: 'listed',
    label: 'Listed Price',
    value: 795,
    confidence: 55,
    surroundingText: 'Listed Price £795',
  }),
])
assert(currentBeatsRrp?.id === 'rrp', 'current/listed price must not beat RRP')

const fitKitSnippet = selectBestOriginalPriceCandidate([
  makeCandidate({
    id: 'now',
    label: 'Listed Price',
    value: 795,
    confidence: 55,
    surroundingText: 'Now £795 Was £895 ex-demo unit',
    rejectionReason: 'current_sale_price_context',
    eligibleForOriginalPrice: false,
  }),
  makeCandidate({
    id: 'rrp-fitkit',
    label: 'RRP',
    value: 10995,
    confidence: 100,
    surroundingText: 'RRP £10,995 Now £795 Was £895',
  }),
])
assert(fitKitSnippet?.id === 'rrp-fitkit', 'FitKit RRP must win over Now/Was amounts in same snippet')
assert(fitKitSnippet?.value === 10995, 'FitKit RRP £10,995 must win over Now/Was amounts')

const conflictCandidates = [
  makeCandidate({ id: 'fitkit', label: 'RRP', value: 1795, confidence: 90, sourceDomain: 'fitkituk.com' }),
  makeCandidate({ id: 'fitshop', label: 'RRP', value: 6996, confidence: 88, sourceDomain: 'fitshop.co.uk' }),
  makeCandidate({ id: 'powerhouse', label: 'RRP', value: 4175, confidence: 85, sourceDomain: 'powerhouse-fitness.co.uk' }),
]

const conflictResolution = resolveV3PriceSelection(conflictCandidates)
assert(conflictResolution.manualSelectionRequired, 'conflicting RRPs must require manual selection')
assert(conflictResolution.autoSelectedCandidate == null, 'conflicting RRPs must not auto-select')
assert(conflictResolution.conflictingRrpCandidates.length === 3, 'all three RRP candidates should be listed')

const conflictRecommendation = applyManualPriceSelectionRequirement({
  original_new_price: 1795,
  currency: 'GBP',
  price_confidence: 55,
  price_reasoning: 'AI picked lowest',
  price_sources_used: [],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: '',
  production_sources_used: [],
  confidence: 55,
  confidence_reasoning: '',
  reasoning: '',
  supporting_urls: [],
  supporting_sources: [],
}, conflictResolution)
assert(conflictRecommendation.original_new_price == null, 'manual selection must clear auto-selected price')
assert(
  conflictRecommendation.v3_metadata?.price_selection_status === 'manual_required',
  'manual selection status must be set',
)

const listOnly = selectBestOriginalPriceCandidate([
  makeCandidate({
    id: 'list',
    label: 'List Price',
    value: 4200,
    confidence: 60,
    surroundingText: 'List Price £4,200 for commercial treadmill',
  }),
])
assert(listOnly?.value === 4200, 'list price may be used when no RRP exists')

console.log('price selection tests passed')
