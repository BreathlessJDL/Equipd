import {
  CANONICAL_COMPLETION_STATUS,
  deriveCanonicalProductCompletionStatus,
  mapCanonicalProductToDisplayGroup,
} from './equipmentResearchQueue.js'
import { dedupeCanonicalProductsForWorkflow } from './canonicalProductDedupe.js'

export const COMPLETION_DASHBOARD_FILTER = {
  ALL: 'all',
  COMPLETE: 'complete',
  INCOMPLETE: 'incomplete',
  MISSING_PRICE: CANONICAL_COMPLETION_STATUS.MISSING_PRICE,
  MISSING_BASELINE: CANONICAL_COMPLETION_STATUS.MISSING_BASELINE,
  MISSING_BOTH: CANONICAL_COMPLETION_STATUS.MISSING_BOTH,
}

export function formatCompletionPercentage(completed, total) {
  if (!total) return 0
  return Math.round((completed / total) * 1000) / 10
}

export function dedupeApprovedCanonicalProducts(products = [], intelligenceRowsById = new Map()) {
  return dedupeCanonicalProductsForWorkflow(products, intelligenceRowsById)
}

function matchesScopeFilters(product, { brand = '', equipmentType = '' } = {}) {
  if (brand && product.brand !== brand) return false
  if (equipmentType && product.equipment_type !== equipmentType) return false
  return true
}

function matchesCompletionFilter(product, completionFilter = COMPLETION_DASHBOARD_FILTER.ALL) {
  const status = deriveCanonicalProductCompletionStatus(product)
  if (!status) return false

  switch (completionFilter) {
    case COMPLETION_DASHBOARD_FILTER.COMPLETE:
      return status === CANONICAL_COMPLETION_STATUS.COMPLETE
    case COMPLETION_DASHBOARD_FILTER.INCOMPLETE:
      return status !== CANONICAL_COMPLETION_STATUS.COMPLETE
    case COMPLETION_DASHBOARD_FILTER.MISSING_PRICE:
    case COMPLETION_DASHBOARD_FILTER.MISSING_BASELINE:
    case COMPLETION_DASHBOARD_FILTER.MISSING_BOTH:
      return status === completionFilter
    default:
      return true
  }
}

function buildOverallStats(products = []) {
  let completed = 0
  let missingPriceOnly = 0
  let missingBaselineOnly = 0
  let missingBoth = 0

  for (const product of products) {
    const status = deriveCanonicalProductCompletionStatus(product)
    if (status === CANONICAL_COMPLETION_STATUS.COMPLETE) {
      completed += 1
      continue
    }
    if (status === CANONICAL_COMPLETION_STATUS.MISSING_PRICE) missingPriceOnly += 1
    else if (status === CANONICAL_COMPLETION_STATUS.MISSING_BASELINE) missingBaselineOnly += 1
    else if (status === CANONICAL_COMPLETION_STATUS.MISSING_BOTH) missingBoth += 1
  }

  const totalApproved = products.length
  const incomplete = totalApproved - completed

  return {
    totalApproved,
    completed,
    incomplete,
    completionPercentage: formatCompletionPercentage(completed, totalApproved),
    breakdown: {
      missingPriceOnly,
      missingBaselineOnly,
      missingBoth,
    },
  }
}

function buildBrandStats(products = []) {
  const byBrand = new Map()

  for (const product of products) {
    const brand = product.brand || 'Unknown'
    if (!byBrand.has(brand)) {
      byBrand.set(brand, [])
    }
    byBrand.get(brand).push(product)
  }

  return [...byBrand.entries()]
    .map(([brand, brandProducts]) => {
      const overall = buildOverallStats(brandProducts)
      return {
        brand,
        totalApproved: overall.totalApproved,
        completed: overall.completed,
        incomplete: overall.incomplete,
        completionPercentage: overall.completionPercentage,
        breakdown: overall.breakdown,
      }
    })
    .sort((left, right) => {
      if (right.incomplete !== left.incomplete) return right.incomplete - left.incomplete
      if (right.totalApproved !== left.totalApproved) return right.totalApproved - left.totalApproved
      return left.brand.localeCompare(right.brand)
    })
}

export function buildCanonicalProductCompletionStats(
  products = [],
  {
    brand = '',
    equipmentType = '',
    completionFilter = COMPLETION_DASHBOARD_FILTER.ALL,
  } = {},
) {
  const approvedProducts = dedupeApprovedCanonicalProducts(products)
  const scopeProducts = approvedProducts.filter((product) => matchesScopeFilters(product, {
    brand,
    equipmentType,
  }))
  const matchingProducts = scopeProducts.filter((product) => matchesCompletionFilter(
    product,
    completionFilter,
  ))

  const brands = [...new Set(approvedProducts.map((product) => product.brand).filter(Boolean))].sort()
  const equipmentTypes = [...new Set(
    approvedProducts.map((product) => product.equipment_type).filter(Boolean),
  )].sort()

  return {
    overall: buildOverallStats(scopeProducts),
    byBrand: buildBrandStats(scopeProducts),
    scopeProducts,
    matchingProducts,
    filters: {
      brand,
      equipmentType,
      completionFilter,
    },
    filterOptions: {
      brands,
      equipmentTypes,
    },
  }
}

export async function fetchCanonicalProductCompletionStats(filters = {}) {
  const { fetchDedupedApprovedCanonicalProducts } = await import('./equipmentProducts.js')
  const { products, error } = await fetchDedupedApprovedCanonicalProducts()
  if (error) {
    return { stats: null, products: [], error }
  }

  return {
    stats: buildCanonicalProductCompletionStats(products, filters),
    products,
    error: null,
  }
}

export function buildCanonicalProductExportGroups(products = []) {
  return products.map((product, index) => mapCanonicalProductToDisplayGroup(product, index + 1))
}

export async function exportCanonicalProductsSpreadsheet(
  products = [],
  {
    label = 'filtered',
    origin = '',
  } = {},
) {
  const { exportCanonicalProductListSpreadsheet } = await import('./canonicalProductListExport.js')
  const groups = buildCanonicalProductExportGroups(products)
  const stamp = new Date().toISOString().slice(0, 10)
  return exportCanonicalProductListSpreadsheet(groups, {
    origin,
    filename: `equipd-canonical-products-${label}-${stamp}.xlsx`,
  })
}
