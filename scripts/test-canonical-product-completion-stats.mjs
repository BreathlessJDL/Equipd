/**
 * Canonical product completion dashboard stats tests.
 */

import {
  buildCanonicalProductCompletionStats,
  COMPLETION_DASHBOARD_FILTER,
  dedupeApprovedCanonicalProducts,
  formatCompletionPercentage,
} from '../src/lib/canonicalProductCompletionStats.js'
import { CANONICAL_COMPLETION_STATUS } from '../src/lib/equipmentResearchQueue.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const completeProduct = {
  id: 'prod-complete',
  status: 'approved',
  canonical_product_key: 'life-fitness-bike',
  brand: 'Life Fitness',
  equipment_type: 'Exercise Bike',
  original_base_price: 5200,
  baseline_manufacture_year: 2017,
}

const missingPriceProduct = {
  id: 'prod-missing-price',
  status: 'approved',
  canonical_product_key: 'life-fitness-treadmill',
  brand: 'Life Fitness',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2016,
}

const missingBaselineProduct = {
  id: 'prod-missing-baseline',
  status: 'approved',
  canonical_product_key: 'technogym-bike',
  brand: 'Technogym',
  equipment_type: 'Exercise Bike',
  original_base_price: 4800,
}

const missingBothProduct = {
  id: 'prod-missing-both',
  status: 'approved',
  canonical_product_key: 'technogym-rower',
  brand: 'Technogym',
  equipment_type: 'Rower',
}

const invalidBaselineProduct = {
  id: 'prod-invalid-baseline',
  status: 'approved',
  canonical_product_key: 'matrix-bike',
  brand: 'Matrix',
  equipment_type: 'Exercise Bike',
  original_base_price: 3900,
  baseline_manufacture_year: 1800,
}

const pendingProduct = {
  id: 'prod-pending',
  status: 'pending',
  canonical_product_key: 'pending-bike',
  brand: 'Matrix',
  original_base_price: 3900,
  baseline_manufacture_year: 2018,
}

const duplicateKeyProduct = {
  id: 'prod-duplicate',
  status: 'approved',
  canonical_product_key: 'life-fitness-bike',
  brand: 'Life Fitness',
  original_base_price: 9999,
  baseline_manufacture_year: 2020,
}

const products = [
  completeProduct,
  missingPriceProduct,
  missingBaselineProduct,
  missingBothProduct,
  invalidBaselineProduct,
  pendingProduct,
  duplicateKeyProduct,
]

const deduped = dedupeApprovedCanonicalProducts(products)
assert(deduped.length === 5, 'dedupes approved products and excludes non-approved rows')

const stats = buildCanonicalProductCompletionStats(products)
assert(stats.overall.totalApproved === 5, 'counts approved canonical products only')
assert(stats.overall.completed === 1, 'complete product counted correctly')
assert(stats.overall.breakdown.missingPriceOnly === 1, 'missing price only counted correctly')
assert(
  stats.overall.breakdown.missingBaselineOnly === 2,
  'missing baseline only counted correctly (includes invalid baseline year)',
)
assert(stats.overall.breakdown.missingBoth === 1, 'missing both counted correctly')
assert(
  stats.overall.completed + stats.overall.incomplete === stats.overall.totalApproved,
  'completed plus incomplete equals total approved',
)
assert(
  stats.overall.breakdown.missingPriceOnly
    + stats.overall.breakdown.missingBaselineOnly
    + stats.overall.breakdown.missingBoth === stats.overall.incomplete,
  'incomplete breakdown sums to incomplete total',
)

const brandTotals = stats.byBrand.reduce((sum, entry) => sum + entry.totalApproved, 0)
const brandCompleted = stats.byBrand.reduce((sum, entry) => sum + entry.completed, 0)
const brandIncomplete = stats.byBrand.reduce((sum, entry) => sum + entry.incomplete, 0)
assert(brandTotals === stats.overall.totalApproved, 'brand breakdown totals match overall totals')
assert(brandCompleted === stats.overall.completed, 'brand completed totals match overall completed')
assert(brandIncomplete === stats.overall.incomplete, 'brand incomplete totals match overall incomplete')

const lifeFitness = stats.byBrand.find((entry) => entry.brand === 'Life Fitness')
assert(lifeFitness?.totalApproved === 2, 'Life Fitness brand total is correct')
assert(lifeFitness?.completed === 1, 'Life Fitness completed count is correct')
assert(lifeFitness?.incomplete === 1, 'Life Fitness incomplete count is correct')
assert(
  lifeFitness?.completionPercentage === formatCompletionPercentage(1, 2),
  'brand completion percentage is calculated correctly',
)

const completeFilter = buildCanonicalProductCompletionStats(products, {
  completionFilter: COMPLETION_DASHBOARD_FILTER.COMPLETE,
})
assert(completeFilter.matchingProducts.length === 1, 'complete filter returns only complete products')
assert(
  completeFilter.matchingProducts[0].id === completeProduct.id,
  'complete filter matches the complete product',
)

const missingPriceFilter = buildCanonicalProductCompletionStats(products, {
  completionFilter: CANONICAL_COMPLETION_STATUS.MISSING_PRICE,
})
assert(missingPriceFilter.matchingProducts.length === 1, 'missing price filter returns one product')

const brandFilter = buildCanonicalProductCompletionStats(products, { brand: 'Technogym' })
assert(brandFilter.overall.totalApproved === 2, 'brand scope filter limits overall totals')
assert(brandFilter.byBrand.length === 1, 'brand scope filter limits brand breakdown')

console.log('canonical product completion stats tests passed')
