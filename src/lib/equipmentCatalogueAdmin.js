/**
 * Equipment Catalogue admin helpers — status labels, attention filters, summaries.
 */

import {
  PRODUCT_STATUS,
  productHasBaselineYear,
  productHasRrp,
} from './intelligenceCanonicalProducts.js'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  productHasDisplayableImage,
} from './equipmentProductImages.js'
import { EQUIPMENT_PRODUCT_CONTENT_STATUS } from './equipmentProductContentPage.js'
import { getEquipmentProductContentStatusLabel } from './equipmentProductContentAdmin.js'

export const CATALOGUE_ATTENTION = {
  ALL: 'all',
  READY: 'ready',
  NEEDS_IMAGE: 'needs_image',
  NEEDS_PRICE: 'needs_price',
  NEEDS_YEAR: 'needs_year',
  NEEDS_CONTENT: 'needs_content',
  NEEDS_REVIEW: 'needs_review',
  FAILED_CONTENT: 'failed_content',
  ATTENTION: 'attention',
}

export const CATALOGUE_ATTENTION_LABELS = {
  [CATALOGUE_ATTENTION.ALL]: 'All products',
  [CATALOGUE_ATTENTION.READY]: 'Ready',
  [CATALOGUE_ATTENTION.NEEDS_IMAGE]: 'Needs image',
  [CATALOGUE_ATTENTION.NEEDS_PRICE]: 'Needs original RRP',
  [CATALOGUE_ATTENTION.NEEDS_YEAR]: 'Needs manufacture year',
  [CATALOGUE_ATTENTION.NEEDS_CONTENT]: 'Needs content',
  [CATALOGUE_ATTENTION.NEEDS_REVIEW]: 'Needs review',
  [CATALOGUE_ATTENTION.FAILED_CONTENT]: 'Failed generation',
  [CATALOGUE_ATTENTION.ATTENTION]: 'Needs attention',
}

export const EQUIPMENT_CATALOGUE_NAV = [
  { to: '/admin/intelligence/products', label: 'Products', end: true },
  { to: '/admin/intelligence/needs-attention', label: 'Needs attention' },
  { to: '/admin/intelligence/consoles', label: 'Consoles' },
  { to: '/admin/intelligence/add-product', label: 'Add product' },
  { to: '/admin/intelligence/imports', label: 'Imports' },
]

export const EQUIPMENT_CATALOGUE_LEGACY_LINKS = [
  { to: '/admin/intelligence/original-prices-lifecycle', label: 'Research queue (RRP & lifecycle)' },
  { to: '/admin/intelligence/product-content', label: 'Content publish (legacy)' },
  { to: '/admin/intelligence/core-products', label: 'Core products (legacy)' },
  { to: '/admin/intelligence/source-rows', label: 'Source rows (debug)' },
  { to: '/admin/intelligence/market-sync', label: 'Market sync' },
  { to: '/admin/intelligence/batch-sync', label: 'Batch sync' },
]

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function productNeedsImage(product) {
  return !productHasDisplayableImage(product)
    || product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
}

export function productNeedsPrice(product) {
  return !productHasRrp(product)
}

export function productNeedsYear(product) {
  return !productHasBaselineYear(product)
}

export function productNeedsReview(product) {
  return product?.status === PRODUCT_STATUS.NEEDS_REVIEW
    || product?.status === PRODUCT_STATUS.PENDING
}

export function getContentStatusForProduct(product, contentByProductId = {}) {
  const row = contentByProductId[product?.id]
  return row?.generation_status ?? null
}

export function productNeedsContent(product, contentByProductId = {}) {
  const status = getContentStatusForProduct(product, contentByProductId)
  return !status
    || status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT
    || status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE
    || status === EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED
}

export function productHasFailedContent(product, contentByProductId = {}) {
  return getContentStatusForProduct(product, contentByProductId)
    === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED
}

export function productIsCatalogueReady(product, contentByProductId = {}) {
  if (product?.status !== PRODUCT_STATUS.APPROVED) return false
  if (productNeedsPrice(product) || productNeedsYear(product) || productNeedsImage(product)) {
    return false
  }
  const contentStatus = getContentStatusForProduct(product, contentByProductId)
  return contentStatus === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED
}

export function productNeedsAttention(product, contentByProductId = {}) {
  return !productIsCatalogueReady(product, contentByProductId)
}

/**
 * Primary catalogue status chip for a product row.
 */
export function getCatalogueStatusLabel(product, contentByProductId = {}) {
  if (product?.status === PRODUCT_STATUS.EXCLUDED) return 'Excluded'
  if (productNeedsReview(product)) return 'Needs review'
  if (productHasFailedContent(product, contentByProductId)) return 'Failed generation'
  if (productNeedsPrice(product)) return 'Needs price'
  if (productNeedsYear(product)) return 'Needs year'
  if (productNeedsImage(product)) return 'Needs image'
  if (productNeedsContent(product, contentByProductId)) return 'Needs content'
  if (productIsCatalogueReady(product, contentByProductId)) return 'Ready'
  return 'Needs attention'
}

export function getCatalogueImageStatusLabel(product) {
  if (productHasDisplayableImage(product)
    && product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
    return 'Approved'
  }
  if (product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) return 'Suggested'
  if (product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED) return 'Rejected'
  if (product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED) return 'Failed'
  if (productNeedsImage(product)) return 'Missing'
  return product?.image_status ? String(product.image_status) : 'Missing'
}

export function getCatalogueContentStatusLabel(product, contentByProductId = {}) {
  const status = getContentStatusForProduct(product, contentByProductId)
  if (!status) return 'Missing'
  return getEquipmentProductContentStatusLabel(status)
}

export function matchesCatalogueAttentionFilter(product, attention, contentByProductId = {}) {
  const key = attention || CATALOGUE_ATTENTION.ALL
  if (key === CATALOGUE_ATTENTION.ALL) return true
  if (key === CATALOGUE_ATTENTION.READY) {
    return productIsCatalogueReady(product, contentByProductId)
  }
  if (key === CATALOGUE_ATTENTION.ATTENTION) {
    return productNeedsAttention(product, contentByProductId)
  }
  if (key === CATALOGUE_ATTENTION.NEEDS_IMAGE) return productNeedsImage(product)
  if (key === CATALOGUE_ATTENTION.NEEDS_PRICE) return productNeedsPrice(product)
  if (key === CATALOGUE_ATTENTION.NEEDS_YEAR) return productNeedsYear(product)
  if (key === CATALOGUE_ATTENTION.NEEDS_CONTENT) {
    return productNeedsContent(product, contentByProductId)
  }
  if (key === CATALOGUE_ATTENTION.NEEDS_REVIEW) return productNeedsReview(product)
  if (key === CATALOGUE_ATTENTION.FAILED_CONTENT) {
    return productHasFailedContent(product, contentByProductId)
  }
  return true
}

export function buildCatalogueSummary(products = [], contentByProductId = {}) {
  const total = products.length
  let ready = 0
  let needsAttention = 0
  let withImage = 0
  let withRrp = 0
  let withYear = 0
  let withContent = 0
  let missingImage = 0
  let missingRrp = 0
  let missingYear = 0
  let missingContent = 0
  let failedGeneration = 0
  let needsReview = 0

  for (const product of products) {
    if (productIsCatalogueReady(product, contentByProductId)) ready += 1
    else needsAttention += 1

    if (productHasDisplayableImage(product)
      && product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
      withImage += 1
    } else {
      missingImage += 1
    }

    if (productHasRrp(product)) withRrp += 1
    else missingRrp += 1

    if (productHasBaselineYear(product)) withYear += 1
    else missingYear += 1

    const contentStatus = getContentStatusForProduct(product, contentByProductId)
    if (contentStatus === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) withContent += 1
    else missingContent += 1

    if (productHasFailedContent(product, contentByProductId)) failedGeneration += 1
    if (productNeedsReview(product)) needsReview += 1
  }

  const pct = (count) => (total > 0 ? Math.round((count / total) * 100) : 0)

  return {
    total,
    ready,
    needsAttention,
    missingImage,
    missingRrp,
    missingYear,
    missingContent,
    failedGeneration,
    needsReview,
    imageCoveragePct: pct(withImage),
    rrpCoveragePct: pct(withRrp),
    yearCoveragePct: pct(withYear),
    contentCoveragePct: pct(withContent),
  }
}

export function findLikelyDuplicateProducts(products = [], {
  brand,
  model,
  canonicalProductName,
  canonicalProductKey,
} = {}) {
  const brandKey = normalizeText(brand)
  const modelKey = normalizeText(model)
  const nameKey = normalizeText(canonicalProductName)
  const productKey = normalizeText(canonicalProductKey)

  return products.filter((product) => {
    if (productKey && normalizeText(product.canonical_product_key) === productKey) {
      return true
    }
    if (nameKey && normalizeText(product.canonical_product_name) === nameKey) {
      return true
    }
    if (
      brandKey
      && modelKey
      && normalizeText(product.brand) === brandKey
      && normalizeText(product.model) === modelKey
    ) {
      return true
    }
    return false
  })
}

export function buildProductsPathWithAttention(attention = CATALOGUE_ATTENTION.ALL) {
  if (!attention || attention === CATALOGUE_ATTENTION.ALL) {
    return '/admin/intelligence/products'
  }
  return `/admin/intelligence/products?attention=${encodeURIComponent(attention)}`
}
