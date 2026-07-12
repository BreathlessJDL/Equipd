import {
  applyIdentityConfidenceCap,
  buildIdentityScoreBreakdown,
  evaluateImageCandidateIdentity,
  filterQueriesToRetainIdentity,
  requiredIdentityQueryTokens,
} from './equipmentProductImageIdentity.js'
import {
  buildTechnogymImageSearchQueries,
  isTechnogymBrand,
  rankTechnogymImageCandidates,
  resolveTechnogymImageImportMetadata,
  scoreTechnogymImageCandidate,
} from './technogymProductImageSearch.js'
import {
  buildMatrixImageSearchQueries,
  isMatrixBrand,
  rankMatrixImageCandidates,
  resolveMatrixImageImportMetadata,
  scoreMatrixImageCandidate,
} from './matrixProductImageSearch.js'
import { productHasBaselineYear, productHasRrp, PRODUCT_STATUS } from './intelligenceCanonicalProducts.js'
import {
  BLOCKED_DEALER_IMAGE_REJECTION_REASON,
  classifyEmbeddedImageSourceDomain,
  classifyImageSourceDomain,
  CONDITIONAL_RETAILER_IMAGE_DOMAINS,
  DEALER_WATERMARK_URL_PATTERNS,
  extractDomainFromUrl,
  findEmbeddedImageSourceDomains,
  getImageSourceDomainFromCandidate,
  hasSuspectedDealerWatermarkSignals,
  HIGH_RISK_REPLACEMENT_MANUAL_REVIEW_REASON,
  IMAGE_REVIEW_FILTER,
  isAutoApproveImageSourceDomain,
  isBlockedImageSourceDomain,
  isBlockedImageSourceUrl,
  isConditionalRetailerImageDomain,
  isExcludedReplacementCandidateDomain,
  isFitnessSuperstoreImageSourceDomain,
  isHighRiskImageSourceDomain,
  isManufacturerImageSourceDomain,
  isProtectedImageSourceDomain,
  isSuggestedRetailerImageSourceDomain,
  getReplacementImageSourceTier,
  MANUFACTURER_IMAGE_SOURCE_DOMAINS,
  normalizeHostname,
  AUTO_APPROVE_IMAGE_SOURCE_DOMAINS,
  REPLACEMENT_IMAGE_SOURCE_TIERS,
  SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS,
  resolveImageStatusForSourceDomain,
  scoreImageSourceDomain,
  shouldAutoSuggestImageCandidate,
  shouldUseReplacementImageCandidate,
} from './equipmentProductImageDomains.js'

export {
  BLOCKED_DEALER_IMAGE_REJECTION_REASON,
  BLOCKED_IMAGE_SOURCE_DOMAINS,
  AUTO_APPROVE_IMAGE_SOURCE_DOMAINS,
  CONDITIONAL_RETAILER_IMAGE_DOMAINS,
  IMAGE_REVIEW_FILTER,
  MANUFACTURER_IMAGE_SOURCE_DOMAINS,
  SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS,
  classifyImageSourceDomain,
  isAllowlistedImageSourceDomain,
  isAutoApproveImageSourceDomain,
  isBlockedImageSourceDomain,
  isBlockedImageSourceUrl,
  isHighRiskImageSourceDomain,
  isProtectedImageSourceDomain,
  isSuggestedRetailerImageSourceDomain,
  resolveImageStatusForSourceDomain,
  shouldAutoSuggestImageCandidate,
} from './equipmentProductImageDomains.js'

export const EQUIPMENT_PRODUCT_IMAGES_BUCKET = 'equipment-product-images'

export const MISSING_STORAGE_OBJECT_FAILURE_REASON = 'missing_storage_object'

export const EQUIPMENT_PRODUCT_IMAGE_STATUS = {
  MISSING: 'missing',
  SUGGESTED: 'suggested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
}

export const PRIORITY_IMAGE_SOURCE_DOMAINS = [
  ...MANUFACTURER_IMAGE_SOURCE_DOMAINS,
  ...CONDITIONAL_RETAILER_IMAGE_DOMAINS,
]

export const BROWSER_LIKE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const MIN_DOWNLOAD_BYTES = 8_000

const REJECTED_IMAGE_URL_PATTERN = /(?:logo|icon|favicon|sprite|placeholder|avatar|badge|banner-ad|pixel|spacer|1x1|blank|no-image|noimage|default-image|coming-soon|stock-photo|shutterstock|gettyimages|istockphoto|depositphotos|dreamstime|emoji|social-share)/i

const REJECTED_IMAGE_TITLE_PATTERN = /(?:logo|icon|placeholder|clipart|vector|badge|banner)/i

const MIN_IMAGE_WIDTH = 240
const MIN_IMAGE_HEIGHT = 180

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function tokenizeSearchText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
}

export function normalizeImageSourceDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const MANUFACTURER_SITE_BIAS_BY_BRAND = {
  technogym: 'technogym.com',
  'life fitness': 'lifefitness.com',
  precor: 'precor.com',
  'matrix fitness': 'matrixfitness.com',
  matrix: 'matrixfitness.com',
  cybex: 'cybexintl.com',
  'pulse fitness': 'pulsefitness.com',
  pulse: 'pulsefitness.com',
  'hammer strength': 'lifefitness.com',
  startrac: 'startrac.com',
}

function normalizeQueryKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function manufacturerSiteBiasForBrand(brand) {
  const key = normalizeWhitespace(brand).toLowerCase()
  return MANUFACTURER_SITE_BIAS_BY_BRAND[key] ?? null
}

function buildGenericEquipmentProductImageSearchQueries(product) {
  const queries = []
  const pushUnique = (query) => {
    const normalized = normalizeWhitespace(query)
    if (!normalized) return
    if (queries.some((existing) => normalizeQueryKey(existing) === normalizeQueryKey(normalized))) return
    queries.push(normalized)
  }

  const canonical = normalizeWhitespace(product?.canonical_product_name)
  const brand = normalizeWhitespace(product?.brand)
  const series = normalizeWhitespace(product?.product_family || product?.series)
  const model = normalizeWhitespace(product?.model)
  const equipmentType = normalizeWhitespace(product?.equipment_type)
  const required = requiredIdentityQueryTokens(product)

  pushUnique(canonical)
  pushUnique([brand, ...required, model, equipmentType].filter(Boolean).join(' '))
  pushUnique([brand, series, model].filter(Boolean).join(' '))

  const site = manufacturerSiteBiasForBrand(brand)
  if (site) {
    const siteNeedle = required[0] || model || canonical
    if (siteNeedle) pushUnique(`site:${site} "${siteNeedle}"`)
  }

  if (!queries.length) {
    pushUnique([brand, model, equipmentType].filter(Boolean).join(' ') || brand || 'commercial gym equipment')
  }

  return filterQueriesToRetainIdentity(queries, product)
}

function isPulseBrand(brand) {
  return /pulse/i.test(String(brand || ''))
}

function normalizePulseQueryName(value) {
  return normalizeWhitespace(value)
    .replace(/['’]/g, '')
    .replace(/\b(\d+)\s*(?:["”]|inch)\b/gi, '$1')
}

function extractPulseQueryModelCode(product) {
  const haystack = [
    product?.product_family,
    product?.series,
    product?.model,
    product?.canonical_product_name,
  ].filter(Boolean).join(' ')
  const match = haystack.match(/\b((?:220|240|250|260|270|280)[\s\-]?[gfi](?:[\s\-]?st)?|\d{3}[\s\-]?[gh])\b/i)
  if (!match) return null
  return match[1].replace(/[\s-]+/g, '').toUpperCase()
}

function buildPulseImageSearchQueries(product) {
  const queries = []
  const pushUnique = (query) => {
    const normalized = normalizeWhitespace(query)
    if (!normalized) return
    if (queries.some((existing) => normalizeQueryKey(existing) === normalizeQueryKey(normalized))) return
    queries.push(normalized)
  }

  const brand = 'Pulse Fitness'
  const canonical = normalizePulseQueryName(product?.canonical_product_name)
  const series = normalizePulseQueryName(product?.product_family || product?.series)
  const model = normalizePulseQueryName(product?.model)
  const equipmentType = normalizeWhitespace(product?.equipment_type)
  const modelCode = extractPulseQueryModelCode(product)
  const required = requiredIdentityQueryTokens(product)
  const hardSeries = required.find((token) => /^(g-range|h-range|f-st|classic|premium|club line)$/i.test(token))
  const station = model
    .replace(/\b(with|without)\b.*$/i, '')
    .replace(/\b\d+\s*(inch|monitor|screen)\b/gi, '')
    .replace(/\b(series\s*[123]|fusion)\b/gi, '')
    .trim()

  // Strongest identity-preserving variants first.
  pushUnique(canonical)
  pushUnique(`${brand} ${canonical.replace(/^pulse\s+fitness\s+/i, '')}`.trim())
  if (modelCode && station) pushUnique(`${brand} ${station} ${modelCode}`)
  if (modelCode) pushUnique(`${brand} ${modelCode} commercial gym equipment`)
  if (hardSeries && station) pushUnique(`${brand} ${hardSeries} ${station}`)
  if (hardSeries && equipmentType) pushUnique(`${brand} ${equipmentType} ${hardSeries}`)
  if (series && station) pushUnique(`${brand} ${series} ${station}`)
  if (station && equipmentType) pushUnique(`${brand} ${station} ${equipmentType}`)

  // Official-site oriented aliases for H-range strength.
  if (/h[\s\-]?range/i.test(`${series} ${canonical}`)) {
    for (const line of ['Club Line', 'Classic', 'Premium']) {
      if (station) pushUnique(`${brand} ${line} ${station}`)
      if (station) pushUnique(`site:pulsefitness.com "${line} ${station}"`)
    }
  }

  // Official cardio names drop the legacy "Fusion" prefix.
  if (/\bu[\s\-]?cycle/i.test(`${model} ${canonical}`)) {
    pushUnique(`${brand} U-Cycle ${modelCode || ''}`.trim())
    pushUnique(`site:pulsefitness.com "U-Cycle" ${modelCode || ''}`.trim())
  }
  if (/\br[\s\-]?cycle/i.test(`${model} ${canonical}`)) {
    pushUnique(`${brand} R-Cycle ${modelCode || ''}`.trim())
    pushUnique(`site:pulsefitness.com "R-Cycle" ${modelCode || ''}`.trim())
  }
  if (/\bx[\s\-]?train/i.test(`${model} ${canonical}`)) {
    pushUnique(`${brand} X-Trainer ${modelCode || ''}`.trim())
    pushUnique(`site:pulsefitness.com "X-Train" ${modelCode || ''}`.trim())
  }
  if (/\bl[\s\-]?train/i.test(`${model} ${canonical}`)) {
    pushUnique(`${brand} L-Train ${modelCode || ''}`.trim())
  }
  if (/\bfusion\s+run|run\s+treadmill/i.test(`${model} ${canonical}`)) {
    pushUnique(`${brand} Run ${modelCode || 'treadmill'}`.trim())
    pushUnique(`site:pulsefitness.com "Run" ${modelCode || ''}`.trim())
  }
  if (/\bfusion\s+step|pace/i.test(`${model} ${canonical}`)) {
    pushUnique(`${brand} Step ${modelCode || ''}`.trim())
    pushUnique(`site:pulsefitness.com "Stepper" ${modelCode || ''}`.trim())
  }

  pushUnique(`site:pulsefitness.com "${modelCode || station || series || canonical}"`)
  pushUnique(`${brand} ${modelCode || station || model} commercial gym equipment`)

  if (!queries.length) {
    pushUnique([brand, model, equipmentType].filter(Boolean).join(' '))
  }

  return filterQueriesToRetainIdentity(queries, product)
}

export function buildEquipmentProductImageSearchQuery(product) {
  if (isTechnogymBrand(product?.brand)) {
    return buildTechnogymImageSearchQueries(product)[0] ?? 'Technogym'
  }
  if (isMatrixBrand(product?.brand)) {
    return buildMatrixImageSearchQueries(product)[0] ?? 'Matrix'
  }
  if (isPulseBrand(product?.brand)) {
    return buildPulseImageSearchQueries(product)[0] ?? 'Pulse Fitness'
  }

  return buildGenericEquipmentProductImageSearchQueries(product)[0]
    || normalizeWhitespace(product?.canonical_product_name)
    || [product?.brand, product?.model, product?.equipment_type].filter(Boolean).join(' ').trim()
}

export function buildEquipmentProductImageSearchQueries(product) {
  if (isTechnogymBrand(product?.brand)) {
    return buildTechnogymImageSearchQueries(product)
  }
  if (isMatrixBrand(product?.brand)) {
    return buildMatrixImageSearchQueries(product)
  }
  if (isPulseBrand(product?.brand)) {
    return buildPulseImageSearchQueries(product)
  }
  return buildGenericEquipmentProductImageSearchQueries(product)
}

export function buildEquipmentProductImageStoragePath(product, extension = 'jpg', {
  versionKey = null,
} = {}) {
  const key = normalizeWhitespace(product?.canonical_product_key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const brand = normalizeWhitespace(product?.brand)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-brand'
  const safeKey = key || product?.id || 'unknown-product'
  const ext = String(extension ?? 'jpg').replace(/^\./, '').toLowerCase()
  const basePath = `${brand}/${safeKey}`
  if (versionKey) {
    const safeVersion = String(versionKey).replace(/[^a-z0-9_-]+/gi, '')
    return `${basePath}/${safeVersion}.${ext}`
  }
  return `${basePath}.${ext}`
}

export function buildVersionedEquipmentProductImageStoragePath(product, extension = 'jpg') {
  return buildEquipmentProductImageStoragePath(product, extension, {
    versionKey: Date.now().toString(36),
  })
}

export function extractEquipmentProductImageStoragePathFromPublicUrl(url) {
  const value = String(url ?? '').trim()
  if (!value) return null

  try {
    const parsed = new URL(value)
    const publicMarker = `/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/`
    const publicIndex = parsed.pathname.indexOf(publicMarker)
    if (publicIndex !== -1) {
      const rawPath = parsed.pathname.slice(publicIndex + publicMarker.length)
      return normalizeEquipmentProductImageStoragePath(decodeURIComponent(rawPath))
    }

    const signMarker = `/storage/v1/object/sign/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/`
    const signIndex = parsed.pathname.indexOf(signMarker)
    if (signIndex !== -1) {
      const rawPath = parsed.pathname.slice(signIndex + signMarker.length)
      return normalizeEquipmentProductImageStoragePath(decodeURIComponent(rawPath))
    }
  } catch {
    return null
  }

  return null
}

export function inferEquipmentProductImageStoragePath(product) {
  const fromField = normalizeEquipmentProductImageStoragePath(product?.image_storage_path)
  if (fromField) return fromField

  const imageUrl = normalizeWhitespace(product?.image_url)
  if (!imageUrl) return null

  const fromPublicUrl = extractEquipmentProductImageStoragePathFromPublicUrl(imageUrl)
  if (fromPublicUrl) return fromPublicUrl

  if (looksLikeStorageObjectPath(imageUrl)) {
    return normalizeEquipmentProductImageStoragePath(imageUrl)
  }

  return null
}

export function isSupabaseEquipmentProductImagePublicUrl(url) {
  return Boolean(extractEquipmentProductImageStoragePathFromPublicUrl(url))
}

export function normalizeEquipmentProductImageStoragePath(storagePath) {
  const trimmed = String(storagePath ?? '').trim().replace(/^\/+/, '')
  if (!trimmed) return null

  const bucketPrefix = `${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/`
  if (trimmed.startsWith(bucketPrefix)) {
    return trimmed.slice(bucketPrefix.length)
  }

  return trimmed
}

export function isBrowserLoadableImageUrl(url) {
  const value = String(url ?? '').trim()
  if (!value) return false

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function looksLikeStorageObjectPath(value) {
  const text = String(value ?? '').trim()
  if (!text || text.includes('://') || text.startsWith('data:')) return false
  return !text.includes(' ')
}

export function productHasDisplayableImage(product) {
  const imageStatus = String(product?.image_status ?? '').trim().toLowerCase()
  if (imageStatus !== EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) return false

  const imageUrl = normalizeWhitespace(product?.image_url)
  const storagePath = normalizeEquipmentProductImageStoragePath(product?.image_storage_path)
  return Boolean(imageUrl || storagePath)
}

export function productHasSuggestedImage(product) {
  return product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED && Boolean(product?.image_url)
}

export function isSuspectedDealerWatermarkProduct(product) {
  if (!product) return false
  const domain = product.image_source_domain
    || normalizeImageSourceDomain(product.image_source_url)
    || normalizeImageSourceDomain(product.image_url)
  if (domain && isBlockedImageSourceDomain(domain)) return true
  return hasSuspectedDealerWatermarkSignals({
    sourceUrl: product.image_source_url,
    imageUrl: product.image_url,
    title: product.canonical_product_name,
  })
}

export function isNonManufacturerSuggestedImage(product) {
  if (product?.image_status !== EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) return false
  const domain = product.image_source_domain
    || normalizeImageSourceDomain(product.image_source_url)
    || normalizeImageSourceDomain(product.image_url)
  return Boolean(domain) && !isManufacturerImageSourceDomain(domain)
}

export function matchesImageReviewFilter(product, filter = IMAGE_REVIEW_FILTER.ALL) {
  if (!filter || filter === IMAGE_REVIEW_FILTER.ALL) return true
  if (filter === IMAGE_REVIEW_FILTER.NON_MANUFACTURER) {
    return isNonManufacturerSuggestedImage(product)
  }
  if (filter === IMAGE_REVIEW_FILTER.SUSPECTED_WATERMARK) {
    return isSuspectedDealerWatermarkProduct(product)
  }
  if (filter === IMAGE_REVIEW_FILTER.FAILED_REJECTED) {
    return product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED
      || product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
  }
  return true
}

export function buildBlockedImageRejectionMetadata(reason = BLOCKED_DEALER_IMAGE_REJECTION_REASON) {
  return {
    image_url: null,
    image_storage_path: null,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
    image_failure_reason: reason,
    image_updated_at: new Date().toISOString(),
  }
}

export function isProductEligibleForImageBackfill(
  product,
  {
    completeOnly = false,
    approvedOnly = true,
    force = false,
  } = {},
) {
  if (!product) return false
  if (approvedOnly && product.status !== PRODUCT_STATUS.APPROVED) return false
  if (completeOnly && (!productHasRrp(product) || !productHasBaselineYear(product))) return false

  if (!force) {
    if (product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) return false
    if (product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED && product.image_url) return false
  }

  return true
}

export function shouldRejectImageCandidate(candidate) {
  const imageUrl = String(candidate?.imageUrl ?? candidate?.original ?? '').trim()
  const pageUrl = String(candidate?.sourceUrl ?? candidate?.link ?? '').trim()
  const title = String(candidate?.title ?? '').trim()
  const width = Number(candidate?.width)
  const height = Number(candidate?.height)

  if (!imageUrl) return { reject: true, reason: 'missing_image_url' }
  if (isBlockedImageSourceUrl(pageUrl) || isBlockedImageSourceUrl(imageUrl)) {
    return { reject: true, reason: 'blocked_dealer_source_domain' }
  }
  if (hasSuspectedDealerWatermarkSignals({ sourceUrl: pageUrl, imageUrl, title })) {
    return { reject: true, reason: 'suspected_dealer_watermark' }
  }
  if (REJECTED_IMAGE_URL_PATTERN.test(imageUrl) || REJECTED_IMAGE_URL_PATTERN.test(pageUrl)) {
    return { reject: true, reason: 'logo_or_placeholder_url' }
  }
  if (REJECTED_IMAGE_TITLE_PATTERN.test(title)) {
    return { reject: true, reason: 'logo_or_placeholder_title' }
  }
  if (Number.isFinite(width) && width > 0 && width < MIN_IMAGE_WIDTH) {
    return { reject: true, reason: 'image_too_small' }
  }
  if (Number.isFinite(height) && height > 0 && height < MIN_IMAGE_HEIGHT) {
    return { reject: true, reason: 'image_too_small' }
  }
  if (imageUrl.startsWith('data:')) {
    return { reject: true, reason: 'inline_data_url' }
  }

  return { reject: false, reason: null }
}

export function scoreImageSearchCandidate(candidate, product) {
  const rejection = shouldRejectImageCandidate(candidate)
  if (rejection.reject) {
    return {
      score: 0,
      rejection,
      domain: getImageSourceDomainFromCandidate(candidate),
    }
  }

  const identityGate = evaluateImageCandidateIdentity(product, candidate)
  if (!identityGate.eligible) {
    return {
      score: 0,
      rejection: {
        reject: true,
        reason: identityGate.reason,
        conflicts: identityGate.conflicts,
      },
      domain: getImageSourceDomainFromCandidate(candidate),
      identity: identityGate.identityResult,
      scoreBreakdown: identityGate.breakdown,
      confidenceBand: 'rejected',
    }
  }

  if (isTechnogymBrand(product?.brand)) {
    const technogymResult = scoreTechnogymImageCandidate(candidate, product, { baseRejection: rejection })
    return {
      score: applyIdentityConfidenceCap(technogymResult.score, identityGate.identityResult),
      rejection: technogymResult.rejection,
      domain: technogymResult.domain,
      warnings: technogymResult.warnings,
      reasons: technogymResult.reasons,
      confidenceBand: technogymResult.confidenceBand,
      productLine: technogymResult.productLine,
      identity: identityGate.identityResult,
      scoreBreakdown: identityGate.breakdown,
    }
  }

  if (isMatrixBrand(product?.brand)) {
    const matrixResult = scoreMatrixImageCandidate(candidate, product, { baseRejection: rejection })
    return {
      score: matrixResult.score,
      rejection: matrixResult.rejection,
      domain: matrixResult.domain,
      warnings: matrixResult.warnings,
      reasons: matrixResult.reasons,
      confidenceBand: matrixResult.confidenceBand,
      productFamily: matrixResult.productFamily,
      identity: matrixResult.identity,
      scoreBreakdown: matrixResult.scoreBreakdown,
    }
  }

  const productTokens = new Set(tokenizeSearchText(buildEquipmentProductImageSearchQuery(product)))
  const haystack = [
    candidate?.title,
    candidate?.sourceUrl,
    candidate?.imageUrl,
    candidate?.source,
  ].filter(Boolean).join(' ').toLowerCase()

  let score = 20
  let matchedTokens = 0
  for (const token of productTokens) {
    if (haystack.includes(token)) {
      matchedTokens += 1
      score += 8
    }
  }

  const domain = getImageSourceDomainFromCandidate(candidate)
  const imageDomain = normalizeImageSourceDomain(candidate?.imageUrl ?? candidate?.original)
  const domainScore = scoreImageSourceDomain(domain)
  if (domainScore < 0) {
    return { score: 0, rejection: { reject: true, reason: 'blocked_dealer_source_domain' } }
  }
  if (domainScore > 0) {
    score += domainScore
  } else if (domain) {
    score -= 40
  }

  if (domain && imageDomain && (imageDomain === domain || imageDomain.endsWith(`.${domain}`))) {
    score += 15
  }

  if (isConditionalRetailerImageDomain(domain)) {
    score -= 5
  }

  const width = Number(candidate?.width)
  const height = Number(candidate?.height)
  let qualityScore = 0
  if (Number.isFinite(width) && Number.isFinite(height) && width >= 480 && height >= 360) {
    qualityScore = 12
    score += 12
  }

  if (matchedTokens === 0) {
    score -= 25
  }

  const breakdown = buildIdentityScoreBreakdown(identityGate.identityResult, {
    domainScore: Math.max(0, domainScore),
    qualityScore,
  })

  return {
    score: applyIdentityConfidenceCap(Math.max(0, Math.min(100, score)), identityGate.identityResult),
    rejection: null,
    domain,
    identity: identityGate.identityResult,
    scoreBreakdown: breakdown,
    confidenceBand: identityGate.identityResult.evidenceLevel === 'exact'
      ? 'high_confidence'
      : identityGate.identityResult.evidenceLevel === 'family'
        ? 'suggested'
        : 'needs_review',
  }
}

export function rankImageSearchCandidates(candidates = [], product) {
  if (isTechnogymBrand(product?.brand)) {
    return rankTechnogymImageCandidates(candidates, product)
  }
  if (isMatrixBrand(product?.brand)) {
    return rankMatrixImageCandidates(candidates, product)
  }

  return candidates
    .map((candidate) => {
      const result = scoreImageSearchCandidate(candidate, product)
      return { candidate, ...result }
    })
    .filter((entry) => entry.score > 0 && !entry.rejection?.reject)
    .sort((left, right) => right.score - left.score)
}

export function rankAutoSuggestImageCandidates(candidates = [], product) {
  const ranked = rankImageSearchCandidates(candidates, product)
  if (isTechnogymBrand(product?.brand) || isMatrixBrand(product?.brand)) {
    return ranked
  }
  return ranked.filter((entry) => shouldAutoSuggestImageCandidate(entry.candidate))
}

export function selectBestImageCandidate(candidates = [], product) {
  return rankImageSearchCandidates(candidates, product)[0] ?? null
}

export function buildImageDownloadReferer(candidate) {
  const sourceUrl = String(candidate?.sourceUrl ?? candidate?.link ?? '').trim()
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl)
      return `${url.protocol}//${url.host}/`
    } catch {
      // fall through
    }
  }

  const imageDomain = normalizeImageSourceDomain(candidate?.imageUrl ?? candidate?.original)
  return imageDomain ? `https://${imageDomain}/` : null
}

export function buildImageDownloadHeaders(candidate, { browserLike = false } = {}) {
  const headers = {
    Accept: browserLike
      ? 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      : 'image/*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'User-Agent': browserLike ? BROWSER_LIKE_USER_AGENT : 'EquipdEquipmentImageBackfill/1.0',
  }

  const referer = buildImageDownloadReferer(candidate)
  if (referer) headers.Referer = referer

  return headers
}

export function isRetryableImageDownloadStatus(status) {
  return status === 403 || status === 401 || status === 406
}

export function inferImageContentType(contentType, imageUrl) {
  const normalized = String(contentType ?? '').toLowerCase()
  if (normalized.includes('png')) return { contentType: 'image/png', extension: 'png' }
  if (normalized.includes('webp')) return { contentType: 'image/webp', extension: 'webp' }
  if (normalized.includes('gif')) return { contentType: 'image/gif', extension: 'gif' }
  const lowerUrl = String(imageUrl ?? '').toLowerCase()
  if (lowerUrl.endsWith('.png')) return { contentType: 'image/png', extension: 'png' }
  if (lowerUrl.endsWith('.webp')) return { contentType: 'image/webp', extension: 'webp' }
  return { contentType: 'image/jpeg', extension: 'jpg' }
}

export class ImageDownloadError extends Error {
  constructor(reason, imageUrl, status = null) {
    super(reason)
    this.name = 'ImageDownloadError'
    this.reason = reason
    this.imageUrl = imageUrl
    this.status = status
  }
}

export function formatImageDownloadFailure(status, detail = '') {
  const suffix = detail ? `:${detail}` : ''
  return `http_${status}${suffix}`
}

async function parseImageDownloadResponse(response, imageUrl) {
  const contentType = response.headers.get('content-type')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < MIN_DOWNLOAD_BYTES) {
    throw new ImageDownloadError('image_too_small', imageUrl, response.status)
  }

  return {
    buffer,
    ...inferImageContentType(contentType, imageUrl),
  }
}

export async function downloadImageCandidate(candidate, fetchImpl = fetch) {
  const imageUrl = String(candidate?.imageUrl ?? candidate?.original ?? '').trim()
  if (!imageUrl) {
    throw new ImageDownloadError('missing_image_url', imageUrl)
  }

  const defaultResponse = await fetchImpl(imageUrl, {
    headers: buildImageDownloadHeaders(candidate, { browserLike: false }),
    redirect: 'follow',
  })

  if (defaultResponse.ok) {
    return {
      ...(await parseImageDownloadResponse(defaultResponse, imageUrl)),
      attempt: 'default',
    }
  }

  if (isRetryableImageDownloadStatus(defaultResponse.status)) {
    const browserResponse = await fetchImpl(imageUrl, {
      headers: buildImageDownloadHeaders(candidate, { browserLike: true }),
      redirect: 'follow',
    })

    if (browserResponse.ok) {
      return {
        ...(await parseImageDownloadResponse(browserResponse, imageUrl)),
        attempt: 'browser_like',
      }
    }

    throw new ImageDownloadError(
      formatImageDownloadFailure(browserResponse.status),
      imageUrl,
      browserResponse.status,
    )
  }

  throw new ImageDownloadError(
    formatImageDownloadFailure(defaultResponse.status),
    imageUrl,
    defaultResponse.status,
  )
}

export async function downloadFirstAvailableImageCandidate(rankedCandidates = [], {
  fetchImpl = fetch,
  onCandidateFailure = null,
} = {}) {
  const failures = []

  for (const entry of rankedCandidates) {
    try {
      const downloaded = await downloadImageCandidate(entry.candidate, fetchImpl)
      return {
        entry,
        downloaded,
        failures,
      }
    } catch (error) {
      const failure = {
        imageUrl: entry.candidate?.imageUrl ?? null,
        sourceUrl: entry.candidate?.sourceUrl ?? null,
        reason: error?.reason ?? error?.message ?? 'download_failed',
        status: error?.status ?? null,
      }
      failures.push(failure)
      if (typeof onCandidateFailure === 'function') {
        onCandidateFailure(failure, entry)
      }
    }
  }

  return {
    entry: null,
    downloaded: null,
    failures,
  }
}

export function summarizeImageCandidateFailures(failures = [], maxLength = 500) {
  if (!failures.length) return 'all_image_candidates_failed'
  const summary = failures
    .map((failure) => `${failure.imageUrl || 'unknown'} (${failure.reason})`)
    .join('; ')
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3)}...` : summary
}

export function buildEquipmentProductImagePublicUrl(supabase, storagePath) {
  if (!supabase) return null

  const normalizedPath = normalizeEquipmentProductImageStoragePath(storagePath)
  if (!normalizedPath) return null

  const { data } = supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(normalizedPath)

  const publicUrl = data?.publicUrl ?? null
  return isBrowserLoadableImageUrl(publicUrl) ? publicUrl : null
}

export function warnEquipmentProductImageResolution(product, supabase, resolvedUrl) {
  if (typeof console === 'undefined' || !console.warn) return

  const imageStatus = String(product?.image_status ?? '').trim().toLowerCase()
  if (imageStatus !== EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) return

  const imageUrl = normalizeWhitespace(product?.image_url)
  const storagePath = normalizeEquipmentProductImageStoragePath(product?.image_storage_path)
  const context = {
    canonical_product_key: product?.canonical_product_key ?? null,
    image_status: product?.image_status ?? null,
    image_url: product?.image_url ?? null,
    image_storage_path: product?.image_storage_path ?? null,
    bucket: EQUIPMENT_PRODUCT_IMAGES_BUCKET,
    resolvedUrl,
  }

  if (resolvedUrl) return

  if (!imageUrl && !storagePath) {
    console.warn('[equipment-product-image] Approved image has no image_url or image_storage_path.', context)
    return
  }

  if (storagePath && !supabase) {
    console.warn('[equipment-product-image] image_storage_path exists but Supabase client is unavailable.', context)
    return
  }

  if (storagePath && supabase) {
    const publicUrl = buildEquipmentProductImagePublicUrl(supabase, storagePath)
    if (!publicUrl) {
      console.warn('[equipment-product-image] image_storage_path did not resolve to a public URL. Check bucket name, object path, and bucket public access.', {
        ...context,
        normalized_storage_path: storagePath,
        publicUrl,
      })
      return
    }
  }

  if (imageUrl && !isBrowserLoadableImageUrl(imageUrl) && !storagePath) {
    console.warn('[equipment-product-image] image_url is not a browser-loadable URL and no storage path is available.', context)
    return
  }

  console.warn('[equipment-product-image] Approved image could not be resolved for display.', context)
}

export function appendEquipmentProductImageCacheBuster(url, product) {
  const value = String(url ?? '').trim()
  if (!value) return null

  const version = product?.image_updated_at || product?.updated_at
  if (!version) return value

  const cacheToken = String(new Date(version).getTime())
  try {
    const parsed = new URL(value)
    parsed.searchParams.set('v', cacheToken)
    return parsed.toString()
  } catch {
    const separator = value.includes('?') ? '&' : '?'
    return `${value}${separator}v=${encodeURIComponent(cacheToken)}`
  }
}

export function resolveEquipmentProductImageUrl(product, supabase = null, { warn = false } = {}) {
  if (!productHasDisplayableImage(product)) {
    if (warn) warnEquipmentProductImageResolution(product, supabase, null)
    return null
  }

  const imageUrl = normalizeWhitespace(product?.image_url)
  const storagePath = normalizeEquipmentProductImageStoragePath(product?.image_storage_path)

  if (storagePath && supabase) {
    const storagePublicUrl = buildEquipmentProductImagePublicUrl(supabase, storagePath)
    if (storagePublicUrl) {
      if (imageUrl && imageUrl !== storagePublicUrl && !isSupabaseEquipmentProductImagePublicUrl(imageUrl)) {
        if (warn && import.meta.env?.DEV) {
          console.debug('[equipment-product-image] Using storage_path over stale external image_url.', {
            canonical_product_key: product?.canonical_product_key ?? null,
            image_url: imageUrl,
            image_storage_path: storagePath,
            resolvedUrl: storagePublicUrl,
          })
        }
      }
      return storagePublicUrl
    }
  }

  if (imageUrl && isBrowserLoadableImageUrl(imageUrl)) {
    return imageUrl
  }

  if (imageUrl && looksLikeStorageObjectPath(imageUrl) && supabase) {
    const publicUrl = buildEquipmentProductImagePublicUrl(supabase, imageUrl)
    if (publicUrl) return publicUrl
  }

  if (warn) warnEquipmentProductImageResolution(product, supabase, null)
  return null
}

export function resolveEquipmentProductImageDisplayUrl(product, supabase = null, options = {}) {
  const resolvedUrl = resolveEquipmentProductImageUrl(product, supabase, options)
  if (!resolvedUrl) return null
  return appendEquipmentProductImageCacheBuster(resolvedUrl, product)
}

export function buildEquipmentProductImageImportMetadata({
  imageUrl,
  storagePath,
  sourceUrl,
  confidence,
  failureReason = null,
  product = null,
  scoreResult = null,
}) {
  if (isTechnogymBrand(product?.brand)) {
    return resolveTechnogymImageImportMetadata({
      imageUrl,
      storagePath,
      sourceUrl,
      scoreResult: scoreResult ?? { score: confidence, warnings: [], reasons: [], confidenceBand: 'needs_review' },
    })
  }

  if (isMatrixBrand(product?.brand)) {
    return resolveMatrixImageImportMetadata({
      imageUrl,
      storagePath,
      sourceUrl,
      scoreResult: scoreResult ?? { score: confidence, warnings: [], reasons: [], confidenceBand: 'needs_review' },
    })
  }

  const domain = sourceUrl
    ? normalizeImageSourceDomain(sourceUrl)
    : null
  const resolvedStatus = resolveImageStatusForSourceDomain(domain, { failureReason })

  if (resolvedStatus === 'rejected') {
    return {
      image_url: null,
      image_storage_path: null,
      image_source_url: sourceUrl ?? null,
      image_source_domain: domain,
      image_confidence: confidence,
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
      image_failure_reason: BLOCKED_DEALER_IMAGE_REJECTION_REASON,
      image_updated_at: new Date().toISOString(),
    }
  }

  const imageStatus = resolvedStatus === 'approved'
    ? EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
    : resolvedStatus === 'failed'
      ? EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED
      : EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED

  return {
    image_url: imageUrl,
    image_storage_path: storagePath,
    image_source_url: sourceUrl,
    image_source_domain: domain,
    image_confidence: confidence,
    image_status: imageStatus,
    image_failure_reason: imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
      ? null
      : failureReason,
    image_updated_at: new Date().toISOString(),
  }
}

export function resolveProductImageSourceDomain(product) {
  return resolveStoredImageDomain(product?.image_source_domain)
    || resolveStoredImageDomain(product?.image_source_url)
    || resolveStoredImageDomain(product?.image_url)
    || null
}

const IMAGE_REPLACEMENT_FAILURE_REASON_PATTERNS = [
  /blocked_dealer/i,
  /dealer_watermark/i,
  /high_risk_replacement/i,
  /suspected_dealer/i,
]

const PRODUCT_IMAGE_REPLACEMENT_FIELDS = [
  'image_source_domain',
  'image_source_url',
  'image_url',
  'image_storage_path',
]

function dedupeReplacementSignals(signals = []) {
  const seen = new Set()
  return signals.filter((signal) => {
    const key = [signal.field, signal.type, signal.domain ?? '', signal.detail ?? ''].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function pushReplacementSignal(signals, signal) {
  if (!signal) return
  signals.push(signal)
}

function inspectReplacementFieldValue(signals, field, value) {
  const text = String(value ?? '').trim()
  if (!text) return

  if (field === 'image_source_domain') {
    const domain = resolveStoredImageDomain(text)
    if (domain) {
      if (isHighRiskImageSourceDomain(domain)) {
        pushReplacementSignal(signals, { field, type: 'high_risk_domain', domain, detail: domain })
      } else if (isBlockedImageSourceDomain(domain)) {
        pushReplacementSignal(signals, { field, type: 'blocked_dealer_domain', domain, detail: domain })
      }
    }
  }

  const urlDomain = extractDomainFromUrl(text)
  if (urlDomain) {
    if (isHighRiskImageSourceDomain(urlDomain)) {
      pushReplacementSignal(signals, { field, type: 'high_risk_domain', domain: urlDomain, detail: urlDomain })
    } else if (isBlockedImageSourceDomain(urlDomain)) {
      pushReplacementSignal(signals, { field, type: 'blocked_dealer_domain', domain: urlDomain, detail: urlDomain })
    }
  }

  for (const embedded of findEmbeddedImageSourceDomains(text)) {
    const classification = classifyEmbeddedImageSourceDomain(embedded)
    pushReplacementSignal(signals, {
      field,
      type: classification === 'high_risk' ? 'high_risk_domain' : 'blocked_dealer_domain',
      domain: embedded,
      detail: `embedded:${embedded}`,
    })
  }

  if (isBlockedImageSourceUrl(text)) {
    pushReplacementSignal(signals, {
      field,
      type: 'blocked_dealer_url_pattern',
      domain: urlDomain,
      detail: 'blocked dealer/marketplace URL pattern',
    })
  }
}

export function collectHighRiskImageReplacementSignals(product) {
  const signals = []

  for (const field of PRODUCT_IMAGE_REPLACEMENT_FIELDS) {
    inspectReplacementFieldValue(signals, field, product?.[field])
  }

  if (hasSuspectedDealerWatermarkSignals({
    sourceUrl: product?.image_source_url,
    imageUrl: product?.image_url,
    title: product?.canonical_product_name,
  })) {
    pushReplacementSignal(signals, {
      field: 'combined',
      type: 'dealer_watermark_pattern',
      domain: null,
      detail: 'suspected dealer/watermark source',
    })
  }

  const failureReason = String(product?.image_failure_reason ?? '').trim()
  if (failureReason && IMAGE_REPLACEMENT_FAILURE_REASON_PATTERNS.some((pattern) => pattern.test(failureReason))) {
    pushReplacementSignal(signals, {
      field: 'image_failure_reason',
      type: 'failure_reason_flag',
      domain: null,
      detail: failureReason,
    })
  }

  const reviewNotes = String(product?.review_notes ?? '').trim()
  if (reviewNotes) {
    for (const embedded of findEmbeddedImageSourceDomains(reviewNotes)) {
      const classification = classifyEmbeddedImageSourceDomain(embedded)
      pushReplacementSignal(signals, {
        field: 'review_notes',
        type: classification === 'high_risk' ? 'high_risk_domain' : 'blocked_dealer_domain',
        domain: embedded,
        detail: `review_notes:${embedded}`,
      })
    }
    if (DEALER_WATERMARK_URL_PATTERNS.some((pattern) => pattern.test(reviewNotes))) {
      pushReplacementSignal(signals, {
        field: 'review_notes',
        type: 'dealer_watermark_pattern',
        domain: null,
        detail: 'dealer/watermark mention in review_notes',
      })
    }
  }

  return dedupeReplacementSignals(signals)
}

function resolveStoredImageDomain(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return normalizeImageSourceDomain(text)
    || extractDomainFromUrl(text)
    || normalizeHostname(text)
}

function collectDeclaredSourceDomains(product) {
  return [
    product?.image_source_domain,
    product?.image_source_url,
  ]
    .map((value) => resolveStoredImageDomain(value))
    .filter(Boolean)
}

function collectDetectedReplacementDomains(signals = []) {
  return [...new Set(signals.map((signal) => signal.domain).filter(Boolean))]
}


export function analyzeHighRiskImageReplacement(product) {
  const signals = collectHighRiskImageReplacementSignals(product)
  const hasImageAsset = Boolean(product?.image_url || product?.image_storage_path)
  const badDomainSignals = signals.filter((signal) => (
    signal.type === 'high_risk_domain'
    || signal.type === 'blocked_dealer_domain'
    || signal.type === 'blocked_dealer_url_pattern'
  ))
  const badSignals = signals.filter((signal) => (
    signal.type === 'high_risk_domain'
    || signal.type === 'blocked_dealer_domain'
    || signal.type === 'blocked_dealer_url_pattern'
    || signal.type === 'dealer_watermark_pattern'
    || signal.type === 'failure_reason_flag'
  ))
  const detectedDomains = collectDetectedReplacementDomains(signals)
  const declaredSourceDomains = collectDeclaredSourceDomains(product)
  const riskClassification = badSignals.length > 0
    ? (badDomainSignals.length > 0 ? 'high_risk_or_blocked' : 'dealer_watermark')
    : 'clean'

  if (!hasImageAsset && badSignals.length === 0) {
    return {
      eligible: false,
      skipReason: 'no_image',
      signals,
      detectedDomains,
      riskClassification: 'none',
      excludedDomains: [],
    }
  }

  if (badSignals.length === 0) {
    if (
      declaredSourceDomains.length > 0
      && declaredSourceDomains.every((domain) => isFitnessSuperstoreImageSourceDomain(domain))
    ) {
      return {
        eligible: false,
        skipReason: 'fitness_superstore_source',
        signals,
        detectedDomains,
        riskClassification: 'clean',
        excludedDomains: [],
      }
    }

    if (
      declaredSourceDomains.length > 0
      && declaredSourceDomains.every((domain) => isProtectedImageSourceDomain(domain))
    ) {
      return {
        eligible: false,
        skipReason: 'protected_manufacturer_source',
        signals,
        detectedDomains,
        riskClassification: 'clean',
        excludedDomains: [],
      }
    }

    return {
      eligible: false,
      skipReason: 'no_high_risk_or_dealer_signals',
      signals,
      detectedDomains,
      riskClassification: 'clean',
      excludedDomains: [],
    }
  }

  if (
    detectedDomains.length > 0
    && detectedDomains.every((domain) => isFitnessSuperstoreImageSourceDomain(domain))
    && badDomainSignals.length === 0
  ) {
    return {
      eligible: false,
      skipReason: 'fitness_superstore_source',
      signals,
      detectedDomains,
      riskClassification,
      excludedDomains: [],
    }
  }

  const hasExplicitBadDomain = badDomainSignals.length > 0
  if (
    !hasExplicitBadDomain
    && declaredSourceDomains.length > 0
    && declaredSourceDomains.every((domain) => isProtectedImageSourceDomain(domain))
  ) {
    return {
      eligible: false,
      skipReason: 'protected_manufacturer_source',
      signals,
      detectedDomains,
      riskClassification,
      excludedDomains: [],
    }
  }

  if (
    hasExplicitBadDomain
    && declaredSourceDomains.length > 0
    && declaredSourceDomains.every((domain) => isProtectedImageSourceDomain(domain))
    && badDomainSignals.every((signal) => declaredSourceDomains.includes(signal.domain))
  ) {
    return {
      eligible: false,
      skipReason: 'protected_manufacturer_source',
      signals,
      detectedDomains,
      riskClassification,
      excludedDomains: [],
    }
  }

  return {
    eligible: true,
    skipReason: null,
    signals,
    detectedDomains,
    riskClassification,
    excludedDomains: detectedDomains.filter((domain) => (
      !isProtectedImageSourceDomain(domain)
      && !isFitnessSuperstoreImageSourceDomain(domain)
    )),
  }
}

export function getHighRiskReplacementExcludedDomains(product) {
  const analysis = analyzeHighRiskImageReplacement(product)
  if (!analysis.eligible) return []
  const domains = [
    ...analysis.excludedDomains,
    resolveProductImageSourceDomain(product),
  ].filter(Boolean)
  return [...new Set(domains)]
}

export function isEligibleForHighRiskImageReplacement(product) {
  return analyzeHighRiskImageReplacement(product).eligible
}

export function filterHighRiskImageReplacementProducts(products = []) {
  return products.filter(isEligibleForHighRiskImageReplacement)
}

function scoreReplacementImageCandidate(candidate, product, excludedDomains = []) {
  const rejection = shouldRejectImageCandidate(candidate)
  if (rejection.reject) return { score: 0, rejection, domain: null, tier: null }

  const domain = getImageSourceDomainFromCandidate(candidate)
  if (!domain || isExcludedReplacementCandidateDomain(domain, excludedDomains)) {
    return { score: 0, rejection: { reject: true, reason: 'excluded_replacement_domain' }, domain, tier: null }
  }

  const tier = getReplacementImageSourceTier(domain)
  if (!tier) {
    return { score: 0, rejection: { reject: true, reason: 'not_replacement_source' }, domain, tier: null }
  }

  const productTokens = new Set(tokenizeSearchText(buildEquipmentProductImageSearchQuery(product)))
  const haystack = [
    candidate?.title,
    candidate?.sourceUrl,
    candidate?.imageUrl,
    candidate?.source,
  ].filter(Boolean).join(' ').toLowerCase()

  let score = 100 - tier.priority * 10
  for (const token of productTokens) {
    if (haystack.includes(token)) score += 6
  }

  const width = Number(candidate?.width)
  const height = Number(candidate?.height)
  if (Number.isFinite(width) && Number.isFinite(height) && width >= 480 && height >= 360) {
    score += 8
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    rejection: null,
    domain,
    tier: tier.label,
  }
}

export function rankReplacementImageCandidates(candidates = [], product, {
  excludedDomains = [],
} = {}) {
  const tierPriority = (label) => {
    const index = REPLACEMENT_IMAGE_SOURCE_TIERS.findIndex((tier) => tier.label === label)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }

  return candidates
    .map((candidate) => {
      const result = scoreReplacementImageCandidate(candidate, product, excludedDomains)
      return { candidate, ...result }
    })
    .filter((entry) => entry.score > 0 && !entry.rejection?.reject)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return tierPriority(left.tier) - tierPriority(right.tier)
    })
}

export function buildReplacementImageImportMetadata({
  imageUrl,
  storagePath,
  sourceUrl,
  confidence,
}) {
  return {
    image_url: imageUrl,
    image_storage_path: storagePath,
    image_source_url: sourceUrl,
    image_source_domain: sourceUrl ? normalizeImageSourceDomain(sourceUrl) : null,
    image_confidence: confidence,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    image_failure_reason: null,
    image_updated_at: new Date().toISOString(),
  }
}

export function buildHighRiskReplacementManualReviewMetadata(product, reason = HIGH_RISK_REPLACEMENT_MANUAL_REVIEW_REASON) {
  const previousDomain = resolveProductImageSourceDomain(product)
  return {
    image_url: null,
    image_storage_path: null,
    image_source_url: product?.image_source_url ?? null,
    image_source_domain: previousDomain,
    image_confidence: null,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED,
    image_failure_reason: reason,
    image_updated_at: new Date().toISOString(),
  }
}

export function buildSuggestedImageMetadata({
  imageUrl,
  storagePath,
  sourceUrl,
  confidence,
  failureReason = null,
  product = null,
  scoreResult = null,
}) {
  if (isTechnogymBrand(product?.brand) && scoreResult) {
    return resolveTechnogymImageImportMetadata({
      imageUrl,
      storagePath,
      sourceUrl,
      scoreResult,
    })
  }

  if (isMatrixBrand(product?.brand) && scoreResult) {
    return resolveMatrixImageImportMetadata({
      imageUrl,
      storagePath,
      sourceUrl,
      scoreResult,
    })
  }

  return buildEquipmentProductImageImportMetadata({
    imageUrl,
    storagePath,
    sourceUrl,
    confidence,
    failureReason,
    product,
    scoreResult,
  })
}

export function imageMetadataPreservesPricingFields(updatePayload) {
  const keys = Object.keys(updatePayload ?? {})
  const allowed = new Set([
    'image_url',
    'image_storage_path',
    'image_source_url',
    'image_source_domain',
    'image_confidence',
    'image_status',
    'image_failure_reason',
    'image_updated_at',
    'updated_at',
  ])
  return keys.every((key) => allowed.has(key))
}

function incrementDomainStatusCount(map, domain, status) {
  const key = domain || 'unknown'
  if (!map.has(key)) {
    map.set(key, {
      domain: key,
      approved: 0,
      suggested: 0,
      rejected: 0,
      failed: 0,
      missing: 0,
      total: 0,
      classification: classifyImageSourceDomain(key),
    })
  }
  const entry = map.get(key)
  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) entry.approved += 1
  else if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) entry.suggested += 1
  else if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED) entry.rejected += 1
  else if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED) entry.failed += 1
  else entry.missing += 1
  entry.total += 1
}

export function auditEquipmentProductImageCatalog(products = []) {
  const byDomain = new Map()
  const blockedDomainImages = []
  const suggestedNonManufacturerImages = []
  const dealerLogoImages = []

  for (const product of products) {
    const status = product?.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING
    const domain = product.image_source_domain
      || normalizeImageSourceDomain(product.image_source_url)
      || normalizeImageSourceDomain(product.image_url)

    if (status !== EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING || product.image_url || domain) {
      incrementDomainStatusCount(byDomain, domain, status)
    }

    const hasImageAsset = Boolean(product.image_url)
      || status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
      || status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED

    if (!hasImageAsset && !domain) continue

    if (domain && isBlockedImageSourceDomain(domain)) {
      blockedDomainImages.push(product)
    }
    if (isNonManufacturerSuggestedImage(product)) {
      suggestedNonManufacturerImages.push(product)
    }
    if (isSuspectedDealerWatermarkProduct(product)) {
      dealerLogoImages.push(product)
    }
  }

  const domainRows = [...byDomain.values()].sort((left, right) => right.total - left.total)

  return {
    byDomain: domainRows,
    blockedDomainImages,
    suggestedNonManufacturerImages,
    dealerLogoImages,
    summary: {
      productsAudited: products.length,
      domainsSeen: domainRows.length,
      blockedDomainCount: blockedDomainImages.length,
      suggestedNonManufacturerCount: suggestedNonManufacturerImages.length,
      dealerLogoCount: dealerLogoImages.length,
      approvedCount: products.filter((product) => product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED).length,
      suggestedCount: products.filter((product) => product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED).length,
    },
  }
}

export function listBlockedSuggestedProducts(products = []) {
  return products.filter((product) => (
    product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
    && isSuspectedDealerWatermarkProduct(product)
  ))
}
