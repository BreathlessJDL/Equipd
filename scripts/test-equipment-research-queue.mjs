import {
  CANONICAL_COMPLETION_STATUS,
  RESEARCH_QUEUE_MODES,
  buildCanonicalProductDisplayGroups,
  buildCanonicalProductResearchQueue,
  buildIncompleteResearchQueue,
  deriveCanonicalProductResearchMode,
  deriveEquipmentResearchMode,
  evaluateCanonicalProductTop100Eligibility,
  filterCanonicalProductsForTop100Queue,
  formatCanonicalProductCompletionReason,
  isCanonicalProductResearchComplete,
  isCanonicalProductTop100Incomplete,
  isEquipmentResearchComplete,
} from '../src/lib/equipmentResearchQueue.js'
import {
  buildBatchResearchQueueAfterApprove,
  resolveBatchResearchAdvanceAfterApprove,
} from '../src/lib/equipmentCanonicalResearchApprove.js'
import { BASELINE_MANUFACTURE_YEAR_SOURCE } from '../src/lib/baselineManufactureYear.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const completeRow = {
  best_original_price: 7544,
  best_original_price_confidence: 95,
  baseline_manufacture_year: 2005,
  baseline_manufacture_year_source: 'ai_research_approved',
}

const estimatedBaselineRow = {
  best_original_price: 5000,
  best_original_price_confidence: 95,
  baseline_manufacture_year: 2012,
  baseline_manufacture_year_source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX,
}

assert(isEquipmentResearchComplete(completeRow), 'verified price + verified baseline is complete')
assert(isEquipmentResearchComplete(estimatedBaselineRow), 'verified price + estimated baseline is complete')

assert(
  deriveEquipmentResearchMode(completeRow, { skipCompleted: true }) === RESEARCH_QUEUE_MODES.SKIP,
  'complete row should skip when skipCompleted enabled',
)
assert(
  deriveEquipmentResearchMode(completeRow, { forceReResearch: true }) === RESEARCH_QUEUE_MODES.FULL,
  'force re-research should run full mode',
)
assert(
  deriveEquipmentResearchMode(
    { best_original_price: 5000, best_original_price_confidence: 95 },
    { skipCompleted: true },
  ) === RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY,
  'price only should trigger lifecycle research',
)
assert(
  deriveEquipmentResearchMode(
    { baseline_manufacture_year: 2012, baseline_manufacture_year_source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX },
    { skipCompleted: true },
  ) === RESEARCH_QUEUE_MODES.PRICE_ONLY,
  'baseline only should trigger price research',
)

const groups = [
  { keyword_key: 'complete', representative_equipment_id: '1', label: 'Complete', ...completeRow },
  { keyword_key: 'missing', representative_equipment_id: '2', label: 'Missing', best_original_price: null, baseline_manufacture_year: null },
  { keyword_key: 'price-only', representative_equipment_id: '3', label: 'Price only', baseline_manufacture_year: 2010, baseline_manufacture_year_source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX },
]

const { queue, summary } = buildIncompleteResearchQueue(groups, {
  targetCount: 100,
  skipCompleted: true,
  forceReResearch: false,
})

assert(summary.skipped === 1, 'one complete group should be skipped')
assert(summary.toResearch === 2, 'two incomplete groups should be queued')
assert(queue[0].mode === RESEARCH_QUEUE_MODES.FULL, 'missing both should be full research')
assert(queue[1].mode === RESEARCH_QUEUE_MODES.PRICE_ONLY, 'baseline only should be price only')

const baseProduct = {
  id: 'prod-complete',
  status: 'approved',
  canonical_product_key: 'lf-treadmill',
  canonical_product_name: 'Life Fitness Treadmill',
  source_intelligence_row_ids: ['row-1'],
}

const completeProduct = {
  ...baseProduct,
  id: 'prod-complete',
  canonical_product_key: 'lf-complete',
  original_base_price: 10995,
  original_base_price_currency: 'GBP',
  baseline_manufacture_year: 2018,
}

const priceOnlyProduct = {
  ...baseProduct,
  id: 'prod-price',
  canonical_product_key: 'lf-price',
  original_base_price: 5000,
}

const baselineOnlyProduct = {
  ...baseProduct,
  id: 'prod-baseline',
  canonical_product_key: 'lf-baseline',
  baseline_manufacture_year: 2015,
}

const productionYearsOnlyProduct = {
  ...baseProduct,
  id: 'prod-production',
  canonical_product_key: 'lf-production',
  production_start_year: 2010,
  production_end_year: 2018,
}

const lowConfidencePriceProduct = {
  ...baseProduct,
  id: 'prod-low-conf',
  canonical_product_key: 'lf-low-conf',
  original_base_price: 8000,
  original_price_confidence: 50,
  baseline_manufacture_year: 2012,
}

assert(
  isCanonicalProductResearchComplete(completeProduct),
  'product with price + baseline on equipment_products is complete',
)
assert(
  !isCanonicalProductResearchComplete(priceOnlyProduct),
  'product with price only is not complete',
)
assert(
  !isCanonicalProductResearchComplete(baselineOnlyProduct),
  'product with baseline only is not complete',
)
assert(
  !isCanonicalProductResearchComplete(productionYearsOnlyProduct),
  'product with production years but no baseline is not complete',
)
assert(
  isCanonicalProductResearchComplete(lowConfidencePriceProduct),
  'completion must not require original_price_confidence threshold',
)

assert(
  deriveCanonicalProductResearchMode(completeProduct, { skipCompleted: true }) === RESEARCH_QUEUE_MODES.SKIP,
  'complete canonical product should skip when skipCompleted enabled',
)
assert(
  deriveCanonicalProductResearchMode(priceOnlyProduct, { skipCompleted: true }) === RESEARCH_QUEUE_MODES.LIFECYCLE_ONLY,
  'price-only canonical product should not skip',
)

const canonicalProducts = [
  completeProduct,
  priceOnlyProduct,
  baselineOnlyProduct,
  productionYearsOnlyProduct,
]

const skipQueue = buildCanonicalProductResearchQueue(canonicalProducts, {
  targetCount: 10,
  skipCompleted: true,
})
assert(skipQueue.queue.length === 3, 'skip completed should queue only incomplete products')
assert(skipQueue.summary.skipped === 1, 'one completed product should be skipped')
assert(skipQueue.summary.completedSkipped === 1, 'completedSkipped count should reflect completed products')
assert(
  !skipQueue.queue.some((entry) => entry.productId === completeProduct.id),
  'completed product must not appear in queue',
)

const noSkipQueue = buildCanonicalProductResearchQueue(canonicalProducts, {
  targetCount: 10,
  skipCompleted: false,
})
assert(noSkipQueue.queue.length === 3, 'complete products stay out of queue unless force re-research is enabled')

const forceQueue = buildCanonicalProductResearchQueue([completeProduct], {
  targetCount: 10,
  skipCompleted: true,
  forceReResearch: true,
})
assert(forceQueue.queue.length === 1, 'force re-research should queue complete product')

const refreshedQueue = buildCanonicalProductResearchQueue([completeProduct], {
  targetCount: 10,
  skipCompleted: true,
})
assert(refreshedQueue.queue.length === 0, 'refreshed queue must skip completed product')
assert(refreshedQueue.summary.completedSkipped === 1, 'refreshed queue should count completed skip')

const productionReason = formatCanonicalProductCompletionReason(productionYearsOnlyProduct)
assert(
  productionReason.includes('production years'),
  'completion reason should mention production years without baseline',
)

const batchQueue = [
  { productId: 'prod-1', equipmentId: 'row-1', label: 'Product 1' },
  { productId: 'prod-2', equipmentId: 'row-2', label: 'Product 2' },
]

const completeSaved = {
  id: 'prod-1',
  status: 'approved',
  original_base_price: 12000,
  baseline_manufacture_year: 2010,
}
const incompleteSaved = {
  id: 'prod-1',
  status: 'approved',
  original_base_price: 12000,
}

const filteredComplete = buildBatchResearchQueueAfterApprove(batchQueue, 'prod-1', {
  savedProduct: completeSaved,
})
assert(
  filteredComplete.length === 1 && filteredComplete[0].productId === 'prod-2',
  'completed product must be removed from active batch queue after approve',
)

const filteredIncomplete = buildBatchResearchQueueAfterApprove(batchQueue, 'prod-1', {
  savedProduct: incompleteSaved,
})
assert(
  filteredIncomplete.length === 2,
  'incomplete product must remain in batch queue after partial approve',
)

const completeAdvance = resolveBatchResearchAdvanceAfterApprove({
  batchResearchActive: true,
  saveError: null,
  batchResearchQueue: batchQueue,
  batchResearchIndex: 0,
  canonicalProductId: 'prod-1',
  savedProduct: completeSaved,
})
assert(completeAdvance.shouldAdvance, 'batch should advance after successful complete save')
assert(completeAdvance.nextQueue.length === 1, 'completed product should be removed before advancing')
assert(completeAdvance.nextIndex === 0, 'next product should remain at same index after removal')

const partialAdvance = resolveBatchResearchAdvanceAfterApprove({
  batchResearchActive: true,
  saveError: null,
  batchResearchQueue: batchQueue,
  batchResearchIndex: 0,
  canonicalProductId: 'prod-1',
  savedProduct: incompleteSaved,
})
assert(partialAdvance.nextQueue.length === 2, 'partial save must keep product in queue')
assert(partialAdvance.nextIndex === 1, 'partial save should advance index without removing item')

const incompleteTop100Product = {
  id: 'woodway-curve',
  status: 'approved',
  brand: 'Woodway',
  canonical_product_key: 'woodway-curve',
  canonical_product_name: 'Woodway Curve',
  source_intelligence_row_ids: ['intel-1'],
  image_status: 'missing',
}

const completeTop100Product = {
  ...incompleteTop100Product,
  id: 'woodway-complete',
  canonical_product_key: 'woodway-complete',
  original_base_price: 12000,
  baseline_manufacture_year: 2015,
  image_status: 'approved',
  image_url: 'https://example.com/image.jpg',
}

assert(
  isCanonicalProductTop100Incomplete(incompleteTop100Product),
  'missing price, baseline, and image should be Top 100 incomplete',
)
assert(
  !isCanonicalProductTop100Incomplete(completeTop100Product),
  'price, baseline, and approved image should not be Top 100 incomplete',
)

const pendingEligibility = evaluateCanonicalProductTop100Eligibility({
  ...incompleteTop100Product,
  status: 'pending',
})
assert(!pendingEligibility.included, 'pending products must be excluded from Top 100')
assert(pendingEligibility.reason.includes('pending'), 'pending exclusion reason should mention status')

const includedEligibility = evaluateCanonicalProductTop100Eligibility(incompleteTop100Product)
assert(includedEligibility.included, 'approved incomplete canonical product should be included')
assert(includedEligibility.missing.includes('original_base_price'), 'included reason should list missing price')

const top100OnlyIncomplete = buildCanonicalProductDisplayGroups(
  [completeTop100Product, incompleteTop100Product],
  { limit: 10 },
)
assert(top100OnlyIncomplete.length === 1, 'Top 100 display should exclude valuation-complete products')
assert(top100OnlyIncomplete[0].productId === incompleteTop100Product.id, 'Top 100 should keep incomplete product')

const filteredQueue = filterCanonicalProductsForTop100Queue([completeTop100Product, incompleteTop100Product])
assert(filteredQueue.length === 1, 'Top 100 filter should return only incomplete canonical products')

console.log('equipment research queue tests passed')
