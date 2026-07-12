/**
 * Tests for canonical product research approval persistence.
 */

import {
  applyCanonicalProductResearchProtection,
  buildBatchResearchQueueAfterApprove,
  buildCanonicalProductResearchApproveUpdate,
  isManuallyVerifiedCanonicalProductPrice,
  resolveBatchResearchAdvanceAfterApprove,
} from '../src/lib/equipmentCanonicalResearchApprove.js'
import {
  buildCanonicalProductResearchQueue,
  isCanonicalProductResearchComplete,
} from '../src/lib/equipmentResearchQueue.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const recommendation = {
  original_new_price: 10995,
  currency: 'GBP',
  price_confidence: 95,
  baseline_manufacture_year: 2015,
  production_start_year: 2015,
  production_end_year: null,
  production_confidence: 88,
  price_sources_used: ['https://www.fitkituk.com/example'],
}

const update = buildCanonicalProductResearchApproveUpdate(recommendation, {
  researchMeta: { research_engine: 'v3' },
  now: '2026-07-06T12:00:00.000Z',
  existingReviewNotes: null,
})

assert(update.original_base_price === 10995, 'approve update must persist original_base_price')
assert(update.original_base_price_currency === 'GBP', 'approve update must persist currency')
assert(update.original_price_source === 'ai_research_approved', 'approve update must set original_price_source')
assert(update.original_price_confidence === 95, 'approve update must persist price confidence')
assert(update.baseline_manufacture_year === 2015, 'approve update must persist baseline year')
assert(update.production_start_year === 2015, 'approve update must persist production start')
assert(update.lifecycle_confidence === 88, 'approve update must persist lifecycle confidence')
assert(update.review_notes?.includes('research_approved'), 'approve update must append research metadata note')

const incompleteProduct = {
  id: 'prod-1',
  status: 'approved',
  canonical_product_key: 'life-fitness-crosstrainer',
  canonical_product_name: 'Life Fitness Discover Crosstrainer',
  source_intelligence_row_ids: ['row-1'],
  original_base_price: null,
  original_price_confidence: null,
  baseline_manufacture_year: null,
}

const savedProduct = {
  ...incompleteProduct,
  original_base_price: update.original_base_price,
  original_base_price_currency: update.original_base_price_currency,
  original_price_confidence: update.original_price_confidence,
  original_price_source: update.original_price_source,
  baseline_manufacture_year: update.baseline_manufacture_year,
  production_start_year: update.production_start_year,
  lifecycle_confidence: update.lifecycle_confidence,
}

assert(
  isCanonicalProductResearchComplete(savedProduct),
  'approved canonical product with price and baseline must be marked research complete',
)

const queueBefore = buildCanonicalProductResearchQueue([incompleteProduct], {
  targetCount: 10,
  skipCompleted: true,
})
assert(queueBefore.queue.length === 1, 'incomplete product should be queued when skip completed is on')

const queueAfter = buildCanonicalProductResearchQueue([savedProduct], {
  targetCount: 10,
  skipCompleted: true,
})
assert(queueAfter.queue.length === 0, 'approved complete product must be skipped on queue refresh')
assert(queueAfter.summary.skipped === 1, 'completed product should count as skipped')

const manualProduct = {
  id: 'prod-manual',
  status: 'approved',
  original_base_price: 12000,
  original_price_confidence: 100,
  original_price_source: 'admin',
  baseline_manufacture_year: 2010,
  lifecycle_confidence: 95,
  production_start_year: 2010,
}

assert(isManuallyVerifiedCanonicalProductPrice(manualProduct), 'admin price source must be protected')

const protectedUpdate = applyCanonicalProductResearchProtection(manualProduct, update)
assert(protectedUpdate.original_base_price == null, 'manual admin price must not be overwritten')
assert(protectedUpdate.baseline_manufacture_year == null, 'verified lifecycle must not be overwritten')

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
const filtered = buildBatchResearchQueueAfterApprove(batchQueue, 'prod-1', {
  savedProduct: completeSaved,
})
assert(filtered.length === 1 && filtered[0].productId === 'prod-2', 'completed product must be removed from active batch queue')

const failedAdvance = resolveBatchResearchAdvanceAfterApprove({
  batchResearchActive: true,
  saveError: new Error('db write failed'),
  batchResearchQueue: batchQueue,
  batchResearchIndex: 0,
  canonicalProductId: 'prod-1',
})
assert(!failedAdvance.shouldAdvance, 'batch must not advance when save fails')
assert(!failedAdvance.shouldCloseModal, 'modal must stay open when save fails')
assert(failedAdvance.nextQueue.length === 2, 'queue must be unchanged after failed save')

const successAdvance = resolveBatchResearchAdvanceAfterApprove({
  batchResearchActive: true,
  saveError: null,
  batchResearchQueue: batchQueue,
  batchResearchIndex: 0,
  canonicalProductId: 'prod-1',
  savedProduct: completeSaved,
})
assert(successAdvance.shouldAdvance, 'batch should advance after successful canonical save')
assert(successAdvance.nextQueue.length === 1, 'completed product should be removed before advancing')
assert(successAdvance.nextIndex === 0, 'next product should remain at same index after removal')

console.log('canonical research approve tests passed')
