#!/usr/bin/env node
/**
 * Unit checks for order evidence path classification and preview rendering.
 *
 * Usage:
 *   npx vite-node scripts/test-order-evidence-path-helpers.mjs
 */

import {
  analyzeEvidenceImageBytes,
  getEvidenceFileLabel,
  getEvidencePathKind,
  getEvidencePreviewRenderMode,
  isEvidenceImageViableForThumbnail,
  isImageEvidencePath,
  isPdfEvidencePath,
  isVideoEvidencePath,
  normalizeEvidenceStoragePath,
} from '../src/lib/orderEvidence.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const orderId = '30d3f8e2-0000-4000-8000-000000000001'
const disputeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const sellerPath = `${orderId}/disputes/${disputeId}/seller/seller-test-abc123.jpg`
const buyerPath = `${orderId}/disputes/${disputeId}/buyer/buyer-proof.png`
const prefixedSellerPath = `order-evidence/${orderId}/disputes/${disputeId}/seller/seller-test.jpg`
const signedUrlPath = `${sellerPath}?token=abc123`

assert(
  normalizeEvidenceStoragePath(prefixedSellerPath) ===
    `${orderId}/disputes/${disputeId}/seller/seller-test.jpg`,
  'Strips order-evidence bucket prefix from seller path',
)
assert(
  normalizeEvidenceStoragePath(signedUrlPath) === sellerPath,
  'Strips query string from storage path',
)
assert(isImageEvidencePath(sellerPath), 'Seller jpg is an image path')
assert(isImageEvidencePath(prefixedSellerPath), 'Bucket-prefixed seller jpg is an image path')
assert(isImageEvidencePath(buyerPath), 'Buyer png is an image path')
assert(!isImageEvidencePath(`${sellerPath}.pdf`), 'Pdf path is not an image')
assert(isPdfEvidencePath(`${buyerPath.slice(0, -4)}.pdf`), 'Pdf extension detected from filename')
assert(isVideoEvidencePath(`${buyerPath.slice(0, -4)}.mp4`), 'Video extension detected from filename')
assert(getEvidencePathKind(sellerPath) === 'image', 'Seller path kind is image')
assert(getEvidencePathKind(prefixedSellerPath) === 'image', 'Prefixed seller path kind is image')
assert(getEvidenceFileLabel(sellerPath) === 'seller-test-abc123.jpg', 'Label uses filename not folder')
assert(
  getEvidenceFileLabel(prefixedSellerPath) === 'seller-test.jpg',
  'Label works with bucket-prefixed path',
)

assert(
  getEvidencePreviewRenderMode(prefixedSellerPath, {
    hasPreviewUrl: true,
    hasOpenUrl: true,
  }) === 'image-thumbnail',
  'Prefixed seller jpg renders as image thumbnail when preview URL exists',
)
assert(
  getEvidencePreviewRenderMode(prefixedSellerPath, {
    hasOpenUrl: true,
  }) === 'image-signed-url',
  'Prefixed seller jpg falls back to signed URL thumbnail',
)
assert(
  getEvidencePreviewRenderMode(prefixedSellerPath, {
    hasOpenUrl: true,
    thumbnailViable: false,
  }) === 'file-tile',
  'Non-viable seller jpg renders as file tile',
)
const tinyTestJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
  'base64',
)
const tinyAnalysis = analyzeEvidenceImageBytes(tinyTestJpeg, 'jpg')
assert(tinyAnalysis.bytes === 286, 'Test jpeg fixture is 286 bytes')
assert(tinyAnalysis.width === 1 && tinyAnalysis.height === 1, 'Test jpeg fixture is 1x1 pixels')
assert(tinyAnalysis.reason === 'image_too_small', 'Test jpeg fixture is too small for thumbnail')
assert(!isEvidenceImageViableForThumbnail(tinyAnalysis), 'Test jpeg fixture is not thumbnail viable')
assert(
  getEvidencePreviewRenderMode(`${buyerPath.slice(0, -4)}.pdf`, {
    hasOpenUrl: true,
  }) === 'file-tile',
  'Pdf evidence renders as file tile',
)

logPass('normalizeEvidenceStoragePath')
logPass('image/pdf/video path classification')
logPass('getEvidenceFileLabel')
logPass('seller prefixed path image thumbnail render mode')
console.log('All order evidence path helper checks passed.')
