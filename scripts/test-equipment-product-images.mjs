/**
 * Equipment product image sourcing tests.
 */

import { productHasBaselineYear, productHasRrp } from '../src/lib/intelligenceCanonicalProducts.js'
import {
  buildEquipmentProductImageImportMetadata,
  buildEquipmentProductImagePublicUrl,
  buildEquipmentProductImageStoragePath,
  buildVersionedEquipmentProductImageStoragePath,
  appendEquipmentProductImageCacheBuster,
  buildImageDownloadHeaders,
  buildImageDownloadReferer,
  buildSuggestedImageMetadata,
  downloadFirstAvailableImageCandidate,
  downloadImageCandidate,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  imageMetadataPreservesPricingFields,
  extractEquipmentProductImageStoragePathFromPublicUrl,
  inferEquipmentProductImageStoragePath,
  isBrowserLoadableImageUrl,
  isProductEligibleForImageBackfill,
  isRetryableImageDownloadStatus,
  normalizeEquipmentProductImageStoragePath,
  productHasDisplayableImage,
  productHasSuggestedImage,
  rankAutoSuggestImageCandidates,
  rankImageSearchCandidates,
  resolveEquipmentProductImageUrl,
  selectBestImageCandidate,
  shouldRejectImageCandidate,
  summarizeImageCandidateFailures,
} from '../src/lib/equipmentProductImages.js'
import { isBlockedImageSourceDomain, isAutoApproveImageSourceDomain, resolveImageStatusForSourceDomain } from '../src/lib/equipmentProductImageDomains.js'
import {
  assessEquipmentProductImageRisk,
  IMAGE_AUDIT_RISK,
} from '../src/lib/equipmentProductImageAudit.js'
import { buildBlockedImageRejectionMetadata } from '../src/lib/equipmentProductImages.js'
import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const completeProduct = {
  id: 'p1',
  status: PRODUCT_STATUS.APPROVED,
  canonical_product_name: 'Technogym Artis Bike',
  brand: 'Technogym',
  model: 'BIKE',
  original_base_price: 9000,
  baseline_manufacture_year: 2018,
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING,
}

const approvedImageProduct = {
  ...completeProduct,
  id: 'p2',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
  image_url: 'https://example.com/approved.jpg',
}

const rejectedImageProduct = {
  ...completeProduct,
  id: 'p3',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
  image_url: 'https://example.com/rejected.jpg',
}

assert(
  isProductEligibleForImageBackfill(completeProduct, { completeOnly: true, approvedOnly: true }),
  'completed product with no image is selected for backfill',
)
assert(
  !isProductEligibleForImageBackfill(approvedImageProduct, { completeOnly: true, approvedOnly: true }),
  'product with approved image is skipped',
)
assert(
  isProductEligibleForImageBackfill(rejectedImageProduct, { completeOnly: true, approvedOnly: true }),
  'rejected image product is eligible for a new search',
)
const suggestedImageProduct = {
  ...completeProduct,
  id: 'p4',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  image_url: 'https://example.com/suggested.jpg',
}

assert(
  !productHasDisplayableImage(rejectedImageProduct),
  'rejected image is not reused on public page',
)
assert(productHasDisplayableImage(approvedImageProduct), 'approved image is displayable')
assert(
  productHasDisplayableImage({
    ...completeProduct,
    id: 'p2b',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: null,
    image_storage_path: 'technogym/artis-bike.jpg',
  }),
  'approved storage-path image is displayable',
)
assert(
  !productHasDisplayableImage({
    ...completeProduct,
    id: 'p2c',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: null,
    image_storage_path: null,
  }),
  'approved status without image asset is not displayable',
)
assert(
  !productHasDisplayableImage(suggestedImageProduct),
  'suggested images are not shown publicly',
)
assert(productHasSuggestedImage(suggestedImageProduct), 'suggested image tracked for admin review')

const metadata = buildSuggestedImageMetadata({
  imageUrl: 'https://cdn.equipd.test/lifefitness/t5-treadmill.jpg',
  storagePath: 'lifefitness/t5-treadmill.jpg',
  sourceUrl: 'https://www.lifefitness.com/product/t5-treadmill',
  confidence: 82,
})
assert(
  imageMetadataPreservesPricingFields(metadata),
  'image metadata saves without touching price/year fields',
)
assert(metadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED, 'manufacturer source auto-approved')

const technogymMetadata = buildSuggestedImageMetadata({
  imageUrl: 'https://cdn.equipd.test/technogym/artis-bike.jpg',
  storagePath: 'technogym/artis-bike.jpg',
  sourceUrl: 'https://www.fitkituk.com/technogym-artis-bike',
  confidence: 88,
  product: completeProduct,
  scoreResult: {
    score: 88,
    warnings: [],
    reasons: ['product line matched (Artis)'],
    confidenceBand: 'high_confidence',
  },
})
assert(
  technogymMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  'Technogym images are suggested not auto-approved',
)
assert(
  resolveImageStatusForSourceDomain('technogym.com') === 'approved',
  'technogym.com resolves to approved',
)
assert(
  resolveImageStatusForSourceDomain('shop.lifefitness.com') === 'approved',
  'shop.lifefitness.com resolves to approved',
)
assert(
  resolveImageStatusForSourceDomain('fitshop.co.uk') === 'suggested',
  'fitshop retailer remains suggested',
)
assert(
  resolveImageStatusForSourceDomain('powerhouse-fitness.co.uk') === 'suggested',
  'powerhouse retailer remains suggested',
)
assert(
  resolveImageStatusForSourceDomain('fitkit.co.uk') === 'suggested',
  'fitkit retailer remains suggested',
)
assert(isAutoApproveImageSourceDomain('lifefitness.com'), 'lifefitness.com is auto-approved domain')

const fitshopMetadata = buildEquipmentProductImageImportMetadata({
  imageUrl: 'https://www.fitshop.co.uk/images/bike.jpg',
  storagePath: 'technogym/bike.jpg',
  sourceUrl: 'https://www.fitshop.co.uk/bike',
  confidence: 70,
})
assert(fitshopMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED, 'fitshop image stays suggested')

const blockedMetadata = buildEquipmentProductImageImportMetadata({
  imageUrl: 'https://www.equip4gyms.com/media/treadmill.jpg',
  storagePath: 'life-fitness/treadmill.jpg',
  sourceUrl: 'https://www.equip4gyms.com/product/treadmill/',
  confidence: 70,
})
assert(blockedMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED, 'blocked domain immediately rejected')
assert(blockedMetadata.image_url == null, 'blocked import clears public image url')
assert(
  completeProduct.original_base_price === 9000
    && completeProduct.baseline_manufacture_year === 2018,
  'pricing fields remain unchanged in memory when building image metadata only',
)
assert(productHasRrp(completeProduct) && productHasBaselineYear(completeProduct), 'complete product still has RRP and baseline')

const logoCandidate = {
  title: 'Technogym logo',
  sourceUrl: 'https://www.technogym.com/media/logo.png',
  imageUrl: 'https://www.technogym.com/media/logo.png',
  width: 800,
  height: 600,
}
assert(shouldRejectImageCandidate(logoCandidate).reject, 'logo candidate rejected')

const equip4gymsCandidate = {
  title: 'Life Fitness Treadmill',
  sourceUrl: 'https://www.equip4gyms.com/product/life-fitness-treadmill/',
  imageUrl: 'https://www.equip4gyms.com/media/life-fitness-treadmill.jpg',
  width: 800,
  height: 600,
}
assert(shouldRejectImageCandidate(equip4gymsCandidate).reject, 'Equip4Gyms image rejected')
assert(isBlockedImageSourceDomain('equip4gyms.com'), 'Equip4Gyms domain blocked')

const productCandidate = {
  title: 'Technogym Artis Bike',
  sourceUrl: 'https://www.technogym.com/product/artis-bike',
  imageUrl: 'https://www.technogym.com/images/artis-bike.jpg',
  width: 800,
  height: 600,
}
const best = selectBestImageCandidate([productCandidate], completeProduct)
assert(best?.candidate?.imageUrl.includes('artis-bike'), 'manufacturer product image preferred')

const blockedCandidate = {
  title: 'Technogym Artis Bike',
  sourceUrl: 'https://www.technogym.com/product/artis-bike',
  imageUrl: 'https://cdn.technogym.com/blocked.jpg',
  width: 800,
  height: 600,
}
const openCandidate = {
  title: 'Technogym Artis Bike retailer',
  sourceUrl: 'https://www.fitshop.co.uk/technogym-artis-bike',
  imageUrl: 'https://www.fitshop.co.uk/images/artis-bike.jpg',
  width: 800,
  height: 600,
}
const ranked = rankImageSearchCandidates([equip4gymsCandidate, blockedCandidate, openCandidate], completeProduct)
assert(ranked.every((entry) => !entry.candidate.sourceUrl?.includes('equip4gyms')), 'blocked domain skipped during ranking')
const autoRanked = rankAutoSuggestImageCandidates(
  [equip4gymsCandidate, blockedCandidate, openCandidate, productCandidate],
  completeProduct,
)
assert(
  autoRanked.some((entry) => entry.candidate.sourceUrl?.includes('technogym.com')),
  'manufacturer candidate kept for backfill',
)
assert(
  !autoRanked.some((entry) => entry.candidate.sourceUrl?.includes('equip4gyms')),
  'blocked domain skipped during backfill',
)
assert(autoRanked.length >= 2, 'allowlisted candidates remain for backfill')

const referer = buildImageDownloadReferer(productCandidate)
assert(referer === 'https://www.technogym.com/', 'referer derived from source page domain')

const browserHeaders = buildImageDownloadHeaders(productCandidate, { browserLike: true })
assert(browserHeaders['User-Agent'].includes('Chrome'), 'browser-like User-Agent set')
assert(browserHeaders.Accept.includes('image/'), 'Accept header set for images')
assert(browserHeaders['Accept-Language'], 'Accept-Language header set')
assert(browserHeaders.Referer === referer, 'Referer header matches source domain')

assert(isRetryableImageDownloadStatus(403), '403 is retryable')
assert(!isRetryableImageDownloadStatus(404), '404 is not retryable')

const fakeImageBytes = Buffer.alloc(10_000, 1)
function mockOkResponse(contentType = 'image/jpeg') {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'content-type' ? contentType : null) },
    arrayBuffer: async () => fakeImageBytes,
  }
}

function mockStatusResponse(status) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => Buffer.alloc(0),
  }
}

let fetchCalls = []
async function mockFetchBlockedThenOk(url, options = {}) {
  fetchCalls.push({ url, headers: options.headers ?? {} })
  if (fetchCalls.length === 1) return mockStatusResponse(403)
  return mockOkResponse()
}

fetchCalls = []
const blockedThenOk = await downloadImageCandidate(productCandidate, mockFetchBlockedThenOk)
assert(fetchCalls.length === 2, '403 triggers browser-like retry')
assert(blockedThenOk.attempt === 'browser_like', '403 retry succeeds with browser headers')
assert(fetchCalls[1].headers.Referer === 'https://www.technogym.com/', 'retry uses Referer header')
assert(fetchCalls[1].headers['User-Agent'].includes('Chrome'), 'retry uses browser User-Agent')

async function mockFetch403ThenOkForFitshop(url, options = {}) {
  fetchCalls.push({ url, headers: options.headers ?? {} })
  if (fetchCalls.length === 1) return mockStatusResponse(403)
  return mockOkResponse()
}

fetchCalls = []
const retrySuccess = await downloadImageCandidate({
  ...productCandidate,
  imageUrl: 'https://www.fitshop.co.uk/images/artis-bike.jpg',
}, mockFetch403ThenOkForFitshop)
assert(retrySuccess.attempt === 'browser_like', 'second attempt succeeds with browser headers')

async function mockFetchFallback(url, options = {}) {
  fetchCalls.push({ url, headers: options.headers ?? {} })
  if (url.includes('blocked.jpg')) {
    return mockStatusResponse(403)
  }
  if (url.includes('fitshop.co.uk')) {
    if (fetchCalls.filter((call) => call.url.includes('fitshop.co.uk')).length === 1) {
      return mockStatusResponse(403)
    }
    return mockOkResponse()
  }
  return mockStatusResponse(404)
}

fetchCalls = []
const fallbackResult = await downloadFirstAvailableImageCandidate(ranked, { fetchImpl: mockFetchFallback })
assert(fallbackResult.downloaded != null, 'fallback downloads second candidate after first blocked')
assert(fallbackResult.failures.length === 1, 'first candidate failure recorded')
assert(
  fallbackResult.failures[0].imageUrl.includes('blocked.jpg'),
  'failed candidate URL logged',
)
assert(fallbackResult.failures[0].reason.includes('403'), 'failed candidate reason logged')

fetchCalls = []
const allFailResult = await downloadFirstAvailableImageCandidate(
  ranked.map((entry) => ({
    ...entry,
    candidate: { ...entry.candidate, imageUrl: 'https://cdn.technogym.com/blocked.jpg' },
  })),
  {
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, headers: options.headers ?? {} })
      return mockStatusResponse(403)
    },
  },
)
assert(allFailResult.downloaded == null, 'no download when all candidates fail')
assert(allFailResult.failures.length === 2, 'all candidate failures collected')

const failureSummary = summarizeImageCandidateFailures(allFailResult.failures)
const failedMetadata = buildSuggestedImageMetadata({
  imageUrl: null,
  storagePath: null,
  sourceUrl: null,
  confidence: 0,
  failureReason: failureSummary,
})
assert(failedMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED, 'product marked failed only after all candidates fail')
assert(failedMetadata.image_failure_reason.includes('blocked.jpg'), 'failure reason includes candidate URLs')

const approvedManufacturerProduct = {
  ...completeProduct,
  id: 'p5',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
  image_url: 'https://www.technogym.com/images/artis-bike.jpg',
  image_source_url: 'https://www.technogym.com/product/artis-bike',
  image_source_domain: 'technogym.com',
  image_confidence: 88,
}
const equip4gymsProduct = {
  ...completeProduct,
  id: 'p6',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  image_url: 'https://www.equip4gyms.com/media/treadmill.jpg',
  image_source_url: 'https://www.equip4gyms.com/product/treadmill/',
  image_source_domain: 'equip4gyms.com',
  image_confidence: 72,
}

const manufacturerRisk = assessEquipmentProductImageRisk(approvedManufacturerProduct)
assert(manufacturerRisk.riskLevel === IMAGE_AUDIT_RISK.SAFE, 'approved manufacturer image remains safe')
assert(productHasDisplayableImage(approvedManufacturerProduct), 'approved manufacturer image shown publicly')

const dealerRisk = assessEquipmentProductImageRisk(equip4gymsProduct)
assert(dealerRisk.riskLevel === IMAGE_AUDIT_RISK.BLOCKED, 'Equip4Gyms domain is blocked in audit risk')
assert(!productHasDisplayableImage(equip4gymsProduct), 'blocked suggested image is admin-only')

const rejectionMetadata = buildBlockedImageRejectionMetadata()
assert(rejectionMetadata.image_url == null, 'blocked image cleanup clears public image')
assert(rejectionMetadata.image_storage_path == null, 'blocked image cleanup clears storage path')
assert(rejectionMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED, 'blocked image cleanup rejects image')

const mockSupabase = {
  storage: {
    from(bucket) {
      return {
        getPublicUrl(path) {
          return {
            data: {
              publicUrl: `https://cdn.example.test/storage/v1/object/public/${bucket}/${path}`,
            },
          }
        },
      }
    },
  },
}

assert(
  resolveEquipmentProductImageUrl(approvedImageProduct, mockSupabase)
    === 'https://example.com/approved.jpg',
  'approved external image_url renders when no storage path exists',
)
assert(
  resolveEquipmentProductImageUrl({
    ...approvedImageProduct,
    image_storage_path: 'life-fitness/integrity-treadmill/mdj8x1.jpg',
  }, mockSupabase)
    === `https://cdn.example.test/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/life-fitness/integrity-treadmill/mdj8x1.jpg`,
  'approved storage path takes priority over stale external image_url',
)
assert(
  resolveEquipmentProductImageUrl({
    ...completeProduct,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: null,
    image_storage_path: 'technogym/artis-bike.jpg',
  }, mockSupabase)
    === `https://cdn.example.test/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/technogym/artis-bike.jpg`,
  'approved storage path resolves to public URL',
)
assert(
  resolveEquipmentProductImageUrl(suggestedImageProduct, mockSupabase) == null,
  'suggested image_status does not render on public page',
)
assert(
  resolveEquipmentProductImageUrl(rejectedImageProduct, mockSupabase) == null,
  'rejected image_status does not render on public page',
)
assert(
  normalizeEquipmentProductImageStoragePath(`/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/technogym/artis-bike.jpg`)
    === 'technogym/artis-bike.jpg',
  'storage path normalization strips bucket prefix and leading slash',
)
assert(
  isBrowserLoadableImageUrl(buildEquipmentProductImagePublicUrl(mockSupabase, 'technogym/artis-bike.jpg')),
  'resolved public URL is browser-loadable',
)
assert(
  resolveEquipmentProductImageUrl({
    ...completeProduct,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: 'technogym/artis-bike.jpg',
    image_storage_path: null,
  }, mockSupabase)
    === `https://cdn.example.test/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/technogym/artis-bike.jpg`,
  'storage-like image_url falls back to Supabase public URL',
)
assert(
  extractEquipmentProductImageStoragePathFromPublicUrl(
    `https://cdn.example.test/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/technogym/artis-bike.jpg`,
  ) === 'technogym/artis-bike.jpg',
  'extracts storage path from Supabase public URL',
)
assert(
  inferEquipmentProductImageStoragePath({
    image_url: `https://cdn.example.test/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/life-fitness/t5.jpg`,
    image_storage_path: null,
  }) === 'life-fitness/t5.jpg',
  'infers storage path from public image_url when storage path missing',
)

const stablePath = buildEquipmentProductImageStoragePath(completeProduct, 'jpg')
const versionedPath = buildVersionedEquipmentProductImageStoragePath(completeProduct, 'jpg')
assert(stablePath === 'technogym/p1.jpg', 'stable storage path remains deterministic')
assert(versionedPath.startsWith('technogym/p1/'), 'versioned storage path uses unique folder segment')
assert(
  appendEquipmentProductImageCacheBuster('https://cdn.example.test/image.jpg', {
    image_updated_at: '2026-07-08T10:00:00.000Z',
  }).includes('v='),
  'display cache buster appends version query param',
)

console.log('equipment product image tests passed')
