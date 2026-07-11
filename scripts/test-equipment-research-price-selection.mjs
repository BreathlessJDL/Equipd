import {
  applyManualPriceFieldChange,
  applyRejectPriceCandidate,
  applySelectPriceCandidate,
  buildApprovalRecommendation,
  buildValidatedApprovalRecommendation,
  buildValidatedManualProductSave,
  canApproveResearchPriceSelection,
  canSaveManualProductData,
  createEmptyResearchPriceSelectionState,
  createPriceSelectionFromCanonicalProduct,
  formatEffectiveApprovalPrice,
  resolveEffectiveApprovalPrice,
} from '../src/lib/equipmentResearchPriceSelection.js'
import { buildCanonicalProductResearchApproveUpdate } from '../src/lib/equipmentCanonicalResearchApprove.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const conflictCandidates = [
  { id: 'fitkit', type: 'price', label: 'RRP', value: 1795, confidence: 90, sourceDomain: 'fitkituk.com', sourceUrl: 'https://fitkituk.com/p', surroundingText: 'RRP £1,795' },
  { id: 'fitshop', type: 'price', label: 'RRP', value: 6996, confidence: 88, sourceDomain: 'fitshop.co.uk', sourceUrl: 'https://fitshop.co.uk/p', surroundingText: 'RRP £6,996' },
  { id: 'powerhouse', type: 'price', label: 'RRP', value: 4175, confidence: 85, sourceDomain: 'powerhouse-fitness.co.uk', sourceUrl: 'https://powerhouse-fitness.co.uk/p', surroundingText: 'RRP £4,175' },
]

const recommendation = {
  original_new_price: null,
  currency: 'GBP',
  price_confidence: null,
  price_reasoning: 'Manual RRP selection required.',
  price_sources_used: [],
  production_start_year: 2015,
  production_end_year: null,
  production_confidence: 80,
  production_reasoning: '',
  production_sources_used: [],
  confidence: 80,
  confidence_reasoning: '',
  reasoning: '',
  supporting_urls: [],
  supporting_sources: [],
  baseline_manufacture_year: 2015,
  lifecycle_confidence: 80,
  v3_metadata: {
    price_selection_status: 'manual_required',
    conflicting_rrp_count: 3,
    conflicting_rrp_spread_percent: 289,
  },
}

const emptySelection = createEmptyResearchPriceSelectionState(recommendation)
assert(!emptySelection.selectedManualPriceCandidate, 'manual conflict should start without selected candidate')
assert(!canApproveResearchPriceSelection(emptySelection, conflictCandidates), 'approve blocked until selection')

const selectedSelection = applySelectPriceCandidate(emptySelection, 'fitshop', conflictCandidates)
assert(selectedSelection.selectedManualPriceCandidate?.value === 6996, 'select stores candidate snapshot')
assert(canApproveResearchPriceSelection(selectedSelection, conflictCandidates), 'approve enabled after candidate selection')

const displayed = resolveEffectiveApprovalPrice(selectedSelection, conflictCandidates)
assert(displayed?.value === 6996, 'displayed selected price updates to candidate value')
assert(formatEffectiveApprovalPrice(displayed).includes('6,996'), 'formatted display shows selected value')

const { recommendation: approved, error } = buildValidatedApprovalRecommendation(
  recommendation,
  selectedSelection,
  conflictCandidates,
)
assert(!error, 'validated approval should succeed after selection')
assert(approved.original_new_price === 6996, 'approve payload uses selected candidate')
assert(approved.price_confidence === 88, 'approve payload uses candidate confidence')
assert(approved.v3_metadata.price_selection_status === 'admin_selected', 'approve marks admin selection')
assert(approved.price_sources_used[0] === 'https://fitshop.co.uk/p', 'approve payload includes source URL')

const manualOverride = applyManualPriceFieldChange(selectedSelection, 'manualPrice', '7200')
const manualApproved = buildApprovalRecommendation(recommendation, manualOverride, conflictCandidates)
assert(manualApproved.original_new_price === 7200, 'manual entry overrides candidate selection')
assert(manualApproved.v3_metadata.structured_evidence_selected_id == null, 'manual entry clears candidate id')

const rejectedSelection = applyRejectPriceCandidate(selectedSelection, 'fitshop')
assert(rejectedSelection.selectedManualPriceCandidate == null, 'rejecting selected candidate clears selection')
assert(!canApproveResearchPriceSelection(rejectedSelection, conflictCandidates), 'rejected candidate cannot be approved')

const productUpdate = buildCanonicalProductResearchApproveUpdate(approved, { existingReviewNotes: null })
assert(productUpdate.original_base_price === 6996, 'canonical product update uses selected price')
assert(productUpdate.original_price_source === 'admin', 'admin-selected price uses admin source')
assert(productUpdate.review_notes?.includes('fitshop.co.uk/p'), 'review notes include selected source URL')

const manualSelection = createPriceSelectionFromCanonicalProduct({
  original_base_price: 4999,
  original_base_price_currency: 'GBP',
  baseline_manufacture_year: 2018,
  production_start_year: 2017,
  production_end_year: 2020,
})
assert(manualSelection.manualPrice === '4999', 'prefills RRP from canonical product')
assert(manualSelection.manualBaselineYear === 2018, 'prefills baseline year')

const manualOnly = createPriceSelectionFromCanonicalProduct({})
assert(canSaveManualProductData({ ...manualOnly, manualBaselineYear: 2015 }, []), 'year-only save allowed')

const { recommendation: manualSaved, error: manualError } = buildValidatedManualProductSave(
  null,
  { ...manualOnly, manualPrice: '3200', manualCurrency: 'GBP', manualBaselineYear: 2015 },
  [],
)
assert(!manualError, 'manual save without research succeeds')
assert(manualSaved.original_new_price === 3200, 'manual save uses typed RRP')
assert(manualSaved.v3_metadata.research_engine === 'manual', 'manual save marks manual engine')

const manualProductUpdate = buildCanonicalProductResearchApproveUpdate(manualSaved, { existingReviewNotes: null })
assert(manualProductUpdate.original_price_source === 'manual', 'manual engine uses manual source')

console.log('equipment research price selection tests passed')
