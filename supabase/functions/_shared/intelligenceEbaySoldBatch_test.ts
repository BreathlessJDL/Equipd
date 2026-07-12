import {
  dedupeObservations,
  getObservationDedupKey,
  isAutoSaveCandidate,
  selectBatchAutoSaveCandidates,
} from './intelligenceEbaySoldBatch.ts'
import type { EbaySoldCandidate } from './intelligenceEbaySoldSearch.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const acceptedCandidate: EbaySoldCandidate = {
  price: 1200,
  currency: 'GBP',
  title: 'Life Fitness 95Ti Commercial Treadmill',
  url: 'https://www.ebay.co.uk/itm/accepted-1',
  sold_at: '2026-01-15T00:00:00.000Z',
  condition: 'Used',
  source: 'ebay_sold',
  source_domain: 'ebay.co.uk',
  snippet: '',
  confidence: 94,
  status: 'accepted',
  reason: 'Exact/strong model match',
  score_breakdown: {
    title: 'Life Fitness 95Ti Commercial Treadmill',
    status: 'accepted',
    final_confidence: 94,
    confidence_before_warnings: 94,
    base_score: 0,
    brand_score: 40,
    model_score: 48,
    equipment_type_score: 6,
    series_range_bonus: 0,
    sold_completed_bonus: 2,
    service_working_bonus: 0,
    low_price_penalty: 0,
    parts_accessory_hard_reject: null,
    wrong_model_hard_reject: null,
    missing_model_result: null,
    expected_brand: 'Life Fitness',
    detected_brand: 'Life Fitness',
    brand_match: true,
    expected_model: '95Ti',
    detected_model_tokens: ['95Ti'],
    matched_alias: '95Ti',
    parts_terms_detected: [],
    faulty_terms_detected: [],
    reason: 'Exact/strong model match',
    score_path: 'exact_model_accept',
    scoring_steps: [],
  },
}

assert(isAutoSaveCandidate(acceptedCandidate), 'accepted high-confidence candidate should auto-save')

const lowConfidence: EbaySoldCandidate = {
  ...acceptedCandidate,
  confidence: 82,
  url: 'https://www.ebay.co.uk/itm/low-confidence',
}
assert(!isAutoSaveCandidate(lowConfidence), 'below 90 confidence should not auto-save')

const partsCandidate: EbaySoldCandidate = {
  ...acceptedCandidate,
  confidence: 94,
  url: 'https://www.ebay.co.uk/itm/parts',
  parts_terms_detected: ['roller'],
  score_breakdown: {
    ...acceptedCandidate.score_breakdown!,
    parts_accessory_hard_reject: 'Parts/accessory listing',
  },
}
assert(!isAutoSaveCandidate(partsCandidate), 'parts flagged candidate should not auto-save')

const reviewCandidate: EbaySoldCandidate = {
  ...acceptedCandidate,
  status: 'review',
  confidence: 70,
  url: 'https://www.ebay.co.uk/itm/review',
}
assert(!isAutoSaveCandidate(reviewCandidate), 'review candidate should not auto-save')

const existing = [
  {
    price: 1100,
    currency: 'GBP',
    source: 'ebay_sold',
    url: 'https://www.ebay.co.uk/itm/existing',
    observed_at: '2026-01-01T00:00:00.000Z',
    title: 'Existing listing',
  },
]

const selection = selectBatchAutoSaveCandidates(
  [acceptedCandidate, reviewCandidate, {
    ...acceptedCandidate,
    url: 'https://www.ebay.co.uk/itm/existing',
    title: 'Duplicate URL listing',
  }],
  existing,
  { targetObservations: 10 },
)

assert(selection.autoSave.length === 1, 'should auto-save one new accepted candidate')
assert(selection.skipped_duplicate_count === 1, 'should skip duplicate URL')
assert(selection.review.length === 1, 'should log one review candidate')

const deduped = dedupeObservations([
  ...existing,
  {
    price: 1200,
    currency: 'GBP',
    source: 'ebay_sold',
    url: 'https://www.ebay.co.uk/itm/existing',
    observed_at: '2026-02-01T00:00:00.000Z',
    title: 'Duplicate again',
  },
  {
    price: 1300,
    currency: 'GBP',
    source: 'ebay_sold',
    url: 'https://www.ebay.co.uk/itm/new',
    observed_at: '2026-02-02T00:00:00.000Z',
    title: 'New listing',
  },
])

assert(deduped.length === 2, 'dedupe should keep unique observations only')

const fallbackKey = getObservationDedupKey({
  price: 900,
  source: 'ebay_sold',
  title: 'Life Fitness Treadmill',
  observed_at: '2026-01-10T00:00:00.000Z',
})
assert(fallbackKey.startsWith('fallback:'), 'fallback dedupe key when URL missing')

console.log('intelligenceEbaySoldBatch tests passed')
