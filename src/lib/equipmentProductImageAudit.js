import {
  classifyImageSourceDomain,
  isBlockedImageSourceDomain,
  isBlockedImageSourceUrl,
  isConditionalRetailerImageDomain,
  isManufacturerImageSourceDomain,
} from './equipmentProductImageDomains.js'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  isSuspectedDealerWatermarkProduct,
  normalizeImageSourceDomain,
} from './equipmentProductImages.js'
import {
  compareProductIdentity,
  extractProductImageIdentity,
} from './equipmentProductImageIdentity.js'

export const IMAGE_AUDIT_RISK = {
  SAFE: 'safe',
  REVIEW: 'review',
  BLOCKED: 'blocked',
}

export const LOW_IMAGE_CONFIDENCE_THRESHOLD = 70

export const IMAGE_ADMIN_FILTER = {
  ALL: 'all',
  HAS_IMAGE: 'has_image',
  SUGGESTED: 'suggested',
  APPROVED: 'approved',
  NEEDS_REVIEW: 'needs_review',
  BLOCKED_REJECTED: 'blocked_rejected',
}

export const AUDIT_CSV_COLUMNS = [
  'productId',
  'canonicalProductName',
  'brand',
  'imageStatus',
  'imageSourceDomain',
  'imageSourceUrl',
  'imageUrl',
  'imageConfidence',
  'riskLevel',
  'reason',
]

function resolveProductImageDomain(product) {
  return product?.image_source_domain
    || normalizeImageSourceDomain(product?.image_source_url)
    || normalizeImageSourceDomain(product?.image_url)
    || null
}

export function productHasAuditableImageState(product) {
  if (!product) return false
  const status = product.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING
  return Boolean(product.image_url)
    || Boolean(product.image_source_url)
    || status !== EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING
}

export function assessEquipmentProductImageRisk(product) {
  const reasons = []
  const status = product?.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING
  const domain = resolveProductImageDomain(product)
  const confidence = Number(product?.image_confidence ?? 0)
  const hasImageAsset = Boolean(product?.image_url)
  const expectedIdentity = extractProductImageIdentity(product, { kind: 'product' })
  const identityCompare = compareProductIdentity(product, {
    title: null,
    sourceUrl: product?.image_source_url,
    imageUrl: product?.image_url,
  })
  const identityEvidence = {
    expectedIdentity,
    detectedCandidateIdentity: identityCompare.candidate,
    matchedTokens: (identityCompare.matched || []).map((entry) => entry.token),
    conflictingTokens: (identityCompare.conflicts || []).map((entry) => entry.token),
    identityResult: identityCompare.hasConflict ? 'Conflict' : identityCompare.evidenceLevel,
    approvalPermitted: !identityCompare.hasConflict && identityCompare.evidenceLevel === 'exact',
    decisionReason: identityCompare.hasConflict
      ? 'Candidate identifies a different product family/model'
      : identityCompare.evidenceLevel === 'exact'
        ? 'Exact product identity confirmed'
        : identityCompare.evidenceLevel === 'family'
          ? 'Family matched but exact model not fully confirmed'
          : 'Only brand/equipment-type level match',
  }

  if (!productHasAuditableImageState(product)) {
    return {
      riskLevel: null,
      reasons: ['no_image'],
      domain,
      classification: 'unknown',
      identityEvidence,
    }
  }

  if (identityCompare.hasConflict) {
    reasons.push(`conflicting product identity: ${(identityCompare.conflicts || []).map((entry) => entry.token).join(', ')}`)
  }

  if (domain && isBlockedImageSourceDomain(domain)) {
    reasons.push(`blocked domain: ${domain}`)
  }
  if (isBlockedImageSourceUrl(product?.image_source_url) || isBlockedImageSourceUrl(product?.image_url)) {
    reasons.push('blocked dealer/marketplace URL pattern')
  }
  if (isSuspectedDealerWatermarkProduct(product)) {
    reasons.push('suspected dealer/watermark source')
  }

  if (reasons.length > 0) {
    return {
      riskLevel: IMAGE_AUDIT_RISK.BLOCKED,
      reasons,
      domain,
      classification: classifyImageSourceDomain(domain),
      identityEvidence,
    }
  }

  if (
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
    && hasImageAsset
    && domain
    && isManufacturerImageSourceDomain(domain)
    && identityCompare.evidenceLevel === 'exact'
    && (product.image_confidence == null || confidence >= LOW_IMAGE_CONFIDENCE_THRESHOLD)
  ) {
    return {
      riskLevel: IMAGE_AUDIT_RISK.SAFE,
      reasons: ['approved manufacturer image with exact identity'],
      domain,
      classification: classifyImageSourceDomain(domain),
      identityEvidence,
    }
  }

  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) {
    reasons.push('suggested image not yet approved')
  }
  if (!domain) {
    reasons.push('missing source domain')
  }
  if (domain && !isManufacturerImageSourceDomain(domain)) {
    if (isConditionalRetailerImageDomain(domain)) {
      reasons.push(`conditional retailer domain: ${domain}`)
    } else {
      reasons.push(`non-manufacturer domain: ${domain}`)
    }
  }
  if (identityCompare.evidenceLevel !== 'exact') {
    reasons.push(`identity evidence: ${identityEvidence.decisionReason}`)
  }
  if (hasImageAsset && confidence > 0 && confidence < LOW_IMAGE_CONFIDENCE_THRESHOLD) {
    reasons.push('low image confidence')
  }
  if (
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
    && domain
    && !isManufacturerImageSourceDomain(domain)
  ) {
    reasons.push('approved non-manufacturer image')
  }
  if (
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
    || status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED
  ) {
    reasons.push(`image status: ${status}`)
  }

  if (reasons.length > 0) {
    return {
      riskLevel: IMAGE_AUDIT_RISK.REVIEW,
      reasons,
      domain,
      classification: classifyImageSourceDomain(domain),
      identityEvidence,
    }
  }

  return {
    riskLevel: IMAGE_AUDIT_RISK.SAFE,
    reasons: ['no issues detected'],
    domain,
    classification: classifyImageSourceDomain(domain),
    identityEvidence,
  }
}

export function buildEquipmentProductImageAuditRow(product) {
  const assessment = assessEquipmentProductImageRisk(product)
  return {
    productId: product.id,
    canonicalProductName: product.canonical_product_name ?? '',
    brand: product.brand ?? '',
    imageStatus: product.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING,
    imageSourceDomain: assessment.domain ?? '',
    imageSourceUrl: product.image_source_url ?? '',
    imageUrl: product.image_url ?? '',
    imageConfidence: product.image_confidence ?? '',
    riskLevel: assessment.riskLevel ?? '',
    reason: assessment.reasons.join('; '),
    classification: assessment.classification,
  }
}

function matchesBrand(product, brand) {
  if (!brand) return true
  return String(product.brand ?? '').toLowerCase() === String(brand).toLowerCase()
}

export function filterEquipmentProductImageAuditRows(rows = [], {
  brand = null,
  imageStatus = null,
  risk = null,
} = {}) {
  return rows.filter((row) => {
    if (brand && String(row.brand ?? '').toLowerCase() !== String(brand).toLowerCase()) return false
    if (imageStatus && row.imageStatus !== imageStatus) return false
    if (risk && row.riskLevel !== risk) return false
    return true
  })
}

function incrementDomainRiskCount(map, domain, riskLevel) {
  const key = domain || 'unknown'
  if (!map.has(key)) {
    map.set(key, {
      domain: key,
      classification: classifyImageSourceDomain(key),
      total: 0,
      safe: 0,
      review: 0,
      blocked: 0,
    })
  }
  const entry = map.get(key)
  entry.total += 1
  if (riskLevel === IMAGE_AUDIT_RISK.SAFE) entry.safe += 1
  else if (riskLevel === IMAGE_AUDIT_RISK.REVIEW) entry.review += 1
  else if (riskLevel === IMAGE_AUDIT_RISK.BLOCKED) entry.blocked += 1
}

export function buildEquipmentProductImageAuditReport(products = [], filters = {}) {
  const rows = filterEquipmentProductImageAuditRows(
    products
      .filter(productHasAuditableImageState)
      .map(buildEquipmentProductImageAuditRow),
    filters,
  )

  const byDomain = new Map()
  const summary = {
    productsAudited: products.length,
    rowsIncluded: rows.length,
    safe: 0,
    review: 0,
    blocked: 0,
  }

  for (const row of rows) {
    if (row.riskLevel === IMAGE_AUDIT_RISK.SAFE) summary.safe += 1
    else if (row.riskLevel === IMAGE_AUDIT_RISK.REVIEW) summary.review += 1
    else if (row.riskLevel === IMAGE_AUDIT_RISK.BLOCKED) summary.blocked += 1
    incrementDomainRiskCount(byDomain, row.imageSourceDomain || null, row.riskLevel)
  }

  return {
    rows,
    byDomain: [...byDomain.values()].sort((left, right) => right.total - left.total),
    summary,
    generatedAt: new Date().toISOString(),
    filters,
  }
}

export function listProductsForImageCleanup(products = [], {
  risk = IMAGE_AUDIT_RISK.BLOCKED,
} = {}) {
  return products.filter((product) => {
    const assessment = assessEquipmentProductImageRisk(product)
    if (assessment.riskLevel !== risk) return false
    return Boolean(product.image_url) || product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
  })
}

export function matchesImageAdminFilter(product, filter = IMAGE_ADMIN_FILTER.ALL) {
  if (!filter || filter === IMAGE_ADMIN_FILTER.ALL) return true

  const status = product?.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING
  const hasImage = Boolean(product?.image_url)
  const assessment = assessEquipmentProductImageRisk(product)

  switch (filter) {
    case IMAGE_ADMIN_FILTER.HAS_IMAGE:
      return hasImage
    case IMAGE_ADMIN_FILTER.SUGGESTED:
      return status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
    case IMAGE_ADMIN_FILTER.APPROVED:
      return status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED && hasImage
    case IMAGE_ADMIN_FILTER.NEEDS_REVIEW:
      return assessment.riskLevel === IMAGE_AUDIT_RISK.REVIEW
        || assessment.riskLevel === IMAGE_AUDIT_RISK.BLOCKED
        || status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
    case IMAGE_ADMIN_FILTER.BLOCKED_REJECTED:
      return assessment.riskLevel === IMAGE_AUDIT_RISK.BLOCKED
        || status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
        || status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED
    default:
      return true
  }
}

function escapeCsvValue(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function serializeEquipmentProductImageAuditCsv(rows = []) {
  const header = AUDIT_CSV_COLUMNS.join(',')
  const lines = rows.map((row) => AUDIT_CSV_COLUMNS.map((column) => {
    if (column === 'productId') return escapeCsvValue(row.productId)
    if (column === 'canonicalProductName') return escapeCsvValue(row.canonicalProductName)
    if (column === 'brand') return escapeCsvValue(row.brand)
    if (column === 'imageStatus') return escapeCsvValue(row.imageStatus)
    if (column === 'imageSourceDomain') return escapeCsvValue(row.imageSourceDomain)
    if (column === 'imageSourceUrl') return escapeCsvValue(row.imageSourceUrl)
    if (column === 'imageUrl') return escapeCsvValue(row.imageUrl)
    if (column === 'imageConfidence') return escapeCsvValue(row.imageConfidence)
    if (column === 'riskLevel') return escapeCsvValue(row.riskLevel)
    if (column === 'reason') return escapeCsvValue(row.reason)
    return ''
  }).join(','))
  return [header, ...lines].join('\n')
}

export function defaultEquipmentProductImageAuditPaths(prefix = 'equipment-product-image-audit') {
  return {
    csv: `${prefix}.csv`,
    json: `${prefix}.json`,
  }
}
