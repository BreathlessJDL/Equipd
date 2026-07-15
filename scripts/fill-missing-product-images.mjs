#!/usr/bin/env node
/**
 * Fill approved canonical products that lack an approved usable hero image.
 *
 * Reuses the existing SerpApi → rank → download → storage → metadata pipeline
 * from equipmentProductImages.js (same path as backfill-equipment-product-images.mjs).
 *
 * Usage:
 *   node scripts/fill-missing-product-images.mjs --dry-run
 *   node scripts/fill-missing-product-images.mjs --dry-run --preview-search --limit 5
 *   node scripts/fill-missing-product-images.mjs --apply --limit 10
 *   node scripts/fill-missing-product-images.mjs --apply --brand "Matrix Fitness" --resume
 *   node scripts/fill-missing-product-images.mjs --apply --limit 50 --resume --approve
 *
 *   node scripts/fill-missing-product-images.mjs --audit-recent-matrix
 *   node scripts/fill-missing-product-images.mjs --repair-recent-matrix --dry-run
 *   node scripts/fill-missing-product-images.mjs --repair-recent-matrix --apply
 *
 * Optional:
 *   --product-id <uuid>
 *   --delay-ms 750
 *   --max-queries 3
 *   --replace-failed
 *   --report
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildEquipmentProductImageImportMetadata,
  buildEquipmentProductImageSearchQueries,
  buildEquipmentProductImageStoragePath,
  buildSuggestedImageMetadata,
  downloadFirstAvailableImageCandidate,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  isAutoApproveImageSourceDomain,
  isAllowlistedImageSourceDomain,
  normalizeImageSourceDomain,
  productHasDisplayableImage,
  rankAutoSuggestImageCandidates,
  summarizeImageCandidateFailures,
} from '../src/lib/equipmentProductImages.js'
import {
  canAutoApproveByIdentity,
  compareProductIdentity,
  extractProductImageIdentity,
} from '../src/lib/equipmentProductImageIdentity.js'
import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'image_updated_at',
].join(', ')

const REPORTS_DIR = join(process.cwd(), 'reports')
const PROGRESS_PATH = join(REPORTS_DIR, 'fill-missing-product-images-progress.json')
const BEFORE_PATH = join(REPORTS_DIR, 'missing-product-images-before.json')
const AFTER_PATH = join(REPORTS_DIR, 'missing-product-images-after.json')
const RESULTS_JSON_PATH = join(REPORTS_DIR, 'product-image-import-results.json')
const RESULTS_CSV_PATH = join(REPORTS_DIR, 'product-image-import-results.csv')

const RESULT_CLASS = {
  AUTO_APPROVED: 'auto_approved',
  CANDIDATE_NEEDS_REVIEW: 'candidate_found_needs_review',
  NO_SUITABLE: 'no_suitable_result',
  SEARCH_FAILED: 'search_failed',
  DOWNLOAD_FAILED: 'download_failed',
  UPLOAD_FAILED: 'upload_failed',
  MAPPING_FAILED: 'mapping_failed',
  SKIPPED_EXISTING: 'skipped_existing_image',
  REUSED_EXISTING: 'reused_existing_candidate',
  QUOTA_STOPPED: 'quota_exhausted_not_processed',
  PREVIEW: 'preview_search',
  DRY_RUN_SCOPED: 'dry_run_scoped',
}

const CONSOLE_TYPE_PATTERN = /^(console|consoles)$/i
const EXCLUDED_TYPE_PATTERN = /^(spare\s*part|accessory|brand|family|placeholder)$/i
const CONSOLE_NAME_PATTERN = /\b(console only|console package)\b/i
const DEFAULT_APPROVE_SCORE = 70

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    let value = trimmed.slice(idx + 1)
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

const MATRIX_AUDIT_JSON = join(REPORTS_DIR, 'matrix-image-backfill-audit.json')
const MATRIX_AUDIT_CSV = join(REPORTS_DIR, 'matrix-image-backfill-audit.csv')

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    brand: null,
    nameContains: null,
    limit: null,
    productId: null,
    resume: false,
    previewSearch: false,
    maxQueries: 3,
    delayMs: 750,
    approve: false,
    replaceFailed: false,
    report: true,
    approveScore: DEFAULT_APPROVE_SCORE,
    auditRecentMatrix: false,
    repairRecentMatrix: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (token === '--resume') {
      args.resume = true
    } else if (token === '--preview-search') {
      args.previewSearch = true
    } else if (token === '--approve') {
      args.approve = true
    } else if (token === '--replace-failed') {
      args.replaceFailed = true
    } else if (token === '--report') {
      args.report = true
    } else if (token === '--no-report') {
      args.report = false
    } else if (token === '--audit-recent-matrix') {
      args.auditRecentMatrix = true
    } else if (token === '--repair-recent-matrix') {
      args.repairRecentMatrix = true
    } else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--name-contains') {
      args.nameContains = argv[index + 1] ?? null
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1] ?? NaN)
      index += 1
    } else if (token === '--product-id') {
      args.productId = argv[index + 1] ?? null
      index += 1
    } else if (token === '--max-queries' || token === '--max-results') {
      args.maxQueries = Number(argv[index + 1] ?? 3)
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 750)
      index += 1
    } else if (token === '--approve-score') {
      args.approveScore = Number(argv[index + 1] ?? DEFAULT_APPROVE_SCORE)
      index += 1
    }
  }

  if (args.limit != null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive number')
  }
  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ensureReportsDir() {
  mkdirSync(REPORTS_DIR, { recursive: true })
}

function loadProgress() {
  if (!existsSync(PROGRESS_PATH)) {
    return { completedIds: {}, updated_at: null }
  }
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'))
  } catch {
    return { completedIds: {}, updated_at: null }
  }
}

function saveProgress(progress) {
  ensureReportsDir()
  writeFileSync(PROGRESS_PATH, `${JSON.stringify({
    ...progress,
    updated_at: new Date().toISOString(),
  }, null, 2)}\n`)
}

function hasUsableAsset(product) {
  return Boolean(
    String(product?.image_url ?? '').trim()
    || String(product?.image_storage_path ?? '').trim(),
  )
}

function isExcludedProductKind(product) {
  const type = String(product?.equipment_type ?? '').trim()
  const name = String(product?.canonical_product_name ?? '')
  const key = String(product?.canonical_product_key ?? '')

  if (CONSOLE_TYPE_PATTERN.test(type) || EXCLUDED_TYPE_PATTERN.test(type)) {
    return { excluded: true, reason: `excluded_equipment_type:${type || '(empty)'}` }
  }
  if (CONSOLE_NAME_PATTERN.test(name) || /(?:^|-)console(?:-|$)/i.test(key)) {
    return { excluded: true, reason: 'excluded_console_product' }
  }
  if (product?.status !== PRODUCT_STATUS.APPROVED) {
    return { excluded: true, reason: `product_status:${product?.status ?? 'unknown'}` }
  }
  return { excluded: false, reason: null }
}

function classifyScope(product) {
  const kind = isExcludedProductKind(product)
  if (kind.excluded) {
    return { inScope: false, reason: kind.reason, reusable: false }
  }
  if (productHasDisplayableImage(product)) {
    return { inScope: false, reason: 'already_has_approved_image', reusable: false }
  }

  const imageStatus = String(product?.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING)
    .trim()
    .toLowerCase()

  // Rejected / failed assets must not be reused; they remain eligible for a fresh search.
  if (
    imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
    || imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED
  ) {
    return {
      inScope: true,
      reason: imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
        ? 'rejected_image_needs_research'
        : 'failed_without_usable_approved_image',
      reusable: false,
    }
  }

  if (hasUsableAsset(product)) {
    return {
      inScope: true,
      reason: 'has_unapproved_usable_asset',
      reusable: true,
    }
  }
  return { inScope: true, reason: 'no_usable_image_asset', reusable: false }
}

function countBy(items, keyFn) {
  const out = {}
  for (const item of items) {
    const key = keyFn(item) || '(none)'
    out[key] = (out[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function writeCsv(path, rows) {
  const headers = [
    'product_id',
    'brand',
    'series',
    'model',
    'equipment_type',
    'canonical_display_name',
    'search_queries',
    'serp_api_calls',
    'candidate_title',
    'candidate_source_url',
    'candidate_image_url',
    'candidate_dimensions',
    'candidate_score',
    'outcome',
    'rejection_reason',
    'download_result',
    'storage_path',
    'image_record_id',
    'mapping_status',
    'approval_status',
    'primary_image_status',
    'result_class',
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','))
  }
  writeFileSync(path, `${lines.join('\n')}\n`)
}

async function fetchAllProducts(supabase, { brand = null, productId = null } = {}) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)

    if (brand) query = query.ilike('brand', brand)
    if (productId) query = query.eq('id', productId)

    const { data, error } = await query
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

async function searchImageCandidates(query, serpApiKey) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_images')
  url.searchParams.set('q', query)
  url.searchParams.set('ijn', '0')
  url.searchParams.set('api_key', serpApiKey)

  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = payload?.error || `SerpAPI image search failed (${response.status})`
    const quota = /quota|credit|limit|exhausted|billing/i.test(String(message))
      || response.status === 429
      || response.status === 402
    const error = new Error(message)
    error.quotaExhausted = quota
    throw error
  }

  if (payload?.error) {
    const error = new Error(payload.error)
    error.quotaExhausted = /quota|credit|limit|exhausted|billing/i.test(String(payload.error))
    throw error
  }

  return (payload.images_results ?? []).map((result) => ({
    title: result.title,
    sourceUrl: result.link,
    imageUrl: result.original,
    thumbnail: result.thumbnail,
    source: result.source,
    width: result.original_width,
    height: result.original_height,
  }))
}

const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024
const MAX_IMAGE_EDGE = 1800

async function prepareImageForUpload(buffer, contentType, extension) {
  let outputBuffer = buffer
  let outputType = contentType
  let outputExt = extension

  if (buffer.length > MAX_UPLOAD_BYTES || /png|webp|jpeg|jpg/i.test(String(contentType || extension || ''))) {
    try {
      const sharp = (await import('sharp')).default
      let pipeline = sharp(buffer, { failOn: 'none' }).rotate()
      const meta = await pipeline.metadata()
      const widest = Math.max(meta.width || 0, meta.height || 0)
      if (widest > MAX_IMAGE_EDGE) {
        pipeline = pipeline.resize({
          width: MAX_IMAGE_EDGE,
          height: MAX_IMAGE_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
      outputBuffer = await pipeline
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
      outputType = 'image/jpeg'
      outputExt = 'jpg'
    } catch (error) {
      if (buffer.length > MAX_UPLOAD_BYTES) throw error
      // Keep original when sharp fails and size is already acceptable.
    }
  }

  if (outputBuffer.length > MAX_UPLOAD_BYTES) {
    const sharp = (await import('sharp')).default
    outputBuffer = await sharp(outputBuffer, { failOn: 'none' })
      .resize({
        width: 1400,
        height: 1400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()
    outputType = 'image/jpeg'
    outputExt = 'jpg'
  }

  return {
    buffer: outputBuffer,
    contentType: outputType,
    extension: outputExt,
  }
}

async function uploadImage(supabase, product, buffer, contentType, extension) {
  const prepared = await prepareImageForUpload(buffer, contentType, extension)
  const storagePath = buildEquipmentProductImageStoragePath(product, prepared.extension)
  const { error } = await supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, prepared.buffer, {
      contentType: prepared.contentType,
      upsert: true,
    })
  if (error) throw error

  const { data } = supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(storagePath)

  return {
    storagePath,
    publicUrl: data?.publicUrl ?? null,
  }
}

async function saveImageMetadata(supabase, productId, metadata) {
  const { error } = await supabase
    .from('equipment_products')
    .update({
      ...metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
  if (error) throw error
}

function maybeForceApprove(metadata, scoreResult, candidate, product, { approve, approveScore }) {
  if (!metadata.image_url && !metadata.image_storage_path) return metadata

  const domain = metadata.image_source_domain
    || normalizeImageSourceDomain(metadata.image_source_url)
  const score = Number(scoreResult?.score ?? metadata.image_confidence ?? 0)
  const band = scoreResult?.confidenceBand
  const identity = scoreResult?.identity
    || compareProductIdentity(product, candidate || {
      title: null,
      sourceUrl: metadata.image_source_url,
      imageUrl: metadata.image_url,
    })

  if (identity.hasConflict || identity.evidenceLevel === 'brand_type_only') {
    if (metadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
      return {
        ...metadata,
        image_status: identity.hasConflict
          ? EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
          : EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
        image_failure_reason: identity.hasConflict
          ? 'conflicting_product_identity'
          : 'auto_approve_blocked_weak_product_identity',
      }
    }
    return {
      ...metadata,
      image_status: identity.hasConflict
        ? EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
        : EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
      image_failure_reason: identity.hasConflict
        ? 'conflicting_product_identity'
        : (metadata.image_failure_reason || 'candidate_found_needs_review_weak_identity'),
    }
  }

  const trusted = isAutoApproveImageSourceDomain(domain) || isAllowlistedImageSourceDomain(domain)

  // Never auto-approve manufacturer category / collection landing pages.
  const sourceUrl = String(metadata.image_source_url || candidate?.sourceUrl || '')
  const categoryLanding = /\/(strength|selectorized|plate-loaded|glutebuilder|core-and-stretching|commercial-club|season-of-strength)(\/|$|\?)/i.test(sourceUrl)
    || /\/discovery\/all(\/|$|\?)/i.test(sourceUrl)
    || /\/cardio\/ellipticals(\/|$|\?)/i.test(sourceUrl)
    || /\/cardio\/precor-bikes(\/|$|\?)/i.test(sourceUrl)
    || /\/ellipticals\/\d+-line(\/|$|\?)/i.test(sourceUrl)
    || /\/collections\//i.test(sourceUrl)
    || /\/product-category\//i.test(sourceUrl)
    || /pulsefitness\.com\/shop\/?$/i.test(sourceUrl)
    || /\/products\/?$/i.test(sourceUrl)
  if (categoryLanding && !/\/products\/[A-Z0-9]/i.test(sourceUrl)) {
    return {
      ...metadata,
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
      image_failure_reason: 'auto_approve_blocked_category_landing_page',
    }
  }

  // C-line must not auto-approve Infinity / Competition / Discovery / Vitality pages.
  const brandKey = String(product?.brand || '').toLowerCase()
  if (/precor/.test(brandKey) && /c-line/i.test(String(product?.canonical_product_name || ''))) {
    const cLineHaystack = [sourceUrl, candidate?.title].filter(Boolean).join(' ')
    if (!/c[-\s]?line/i.test(cLineHaystack)
      || /\b(infinity|competition|vitality|discovery|icarian|resolute|s-line)\b/i.test(cLineHaystack)) {
      return {
        ...metadata,
        image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
        image_failure_reason: 'auto_approve_blocked_c_line_identity',
      }
    }
  }

  // Require at least one distinctive model token in the source URL/title for Precor/Pulse.
  const model = String(product?.model || '').trim()
  const canonical = String(product?.canonical_product_name || '').trim()
  const family = String(product?.product_family || '').trim()
  const haystack = [sourceUrl, candidate?.title].filter(Boolean).join(' ')
  if ((/precor|pulse/.test(brandKey))) {
    const modelTokens = [...`${model} ${canonical} ${family}`.matchAll(/\b((?:trm|efx|amt|rbk|ubk|clm|dbr|dpl|dsl|vbr|vsl|rsl)[-\s]?\d{2,4}i?|c[-\s]?\d{3,4}i?|\d{3,4}i|(?:220|240|250|260|270|280)[-\s]?[gfi](?:[-\s]?st)?|\d{3}[-\s]?[gh]|u-?cycle|r-?cycle|x-?train(?:er)?|l-?train|fusion\s+step|fusion\s+run)\b/gi)]
      .map((match) => match[1].replace(/[\s-]+/g, '').toLowerCase())
    const genericTokens = model
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !['press', 'curl', 'machine', 'series', 'strength', 'precor', 'pulse', 'fusion', 'with', 'without', 'monitor', 'screen'].includes(token))
    const tokens = [...new Set([...modelTokens, ...genericTokens])]
    const compactHaystack = haystack.toLowerCase().replace(/[\s-]+/g, '')
    if (tokens.length && !tokens.some((token) => compactHaystack.includes(token.replace(/[\s-]+/g, '')))) {
      return {
        ...metadata,
        image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
        image_failure_reason: 'auto_approve_blocked_model_token_missing',
      }
    }
  }

  const allowApprove = canAutoApproveByIdentity(identity, {
    trustedSource: trusted,
    officialExactPage: isAutoApproveImageSourceDomain(domain),
  }) && (
    band === 'high_confidence'
    || isAutoApproveImageSourceDomain(domain)
    || (approve && score >= approveScore && trusted)
  )

  if (allowApprove) {
    return {
      ...metadata,
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
      image_failure_reason: null,
    }
  }

  return {
    ...metadata,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    image_failure_reason: metadata.image_failure_reason || 'identity_needs_review',
  }
}

function loadImportResultRows() {
  if (!existsSync(RESULTS_JSON_PATH)) return []
  try {
    const payload = JSON.parse(readFileSync(RESULTS_JSON_PATH, 'utf8'))
    return payload.results ?? []
  } catch {
    return []
  }
}

function classifyMatrixBackfillRow(product, importRow = null) {
  const expected = extractProductImageIdentity(product, { kind: 'product' })
  const candidate = {
    title: importRow?.candidate_title || null,
    sourceUrl: importRow?.candidate_source_url || product.image_source_url,
    imageUrl: importRow?.candidate_image_url || product.image_url,
  }
  const identity = compareProductIdentity(product, candidate)
  const conflicts = (identity.conflicts || []).map((entry) => entry.token)

  let classification = 'ambiguous'
  let recommendedAction = 'move_to_suggested_for_review'

  if (identity.hasConflict) {
    classification = 'confirmed_wrong'
    recommendedAction = 'clear_or_reject_and_retry'
  } else if (
    identity.evidenceLevel === 'exact'
    && productHasDisplayableImage(product)
    && Number(product.image_confidence ?? 0) > 0
  ) {
    classification = 'confirmed_correct'
    recommendedAction = 'preserve'
  } else if (!product.image_url && !product.image_storage_path) {
    classification = 'ambiguous'
    recommendedAction = 'eligible_for_reprocess'
  } else if (identity.evidenceLevel === 'brand_type_only') {
    classification = 'confirmed_wrong'
    recommendedAction = 'clear_or_reject_and_retry'
  }

  return {
    product_id: product.id,
    canonical_name: product.canonical_product_name,
    expected_family: expected.family,
    expected_series: product.product_family,
    expected_model: product.model,
    equipment_type: product.equipment_type,
    image_source_title: importRow?.candidate_title || null,
    image_source_url: product.image_source_url,
    image_url: product.image_url,
    image_storage_path: product.image_storage_path,
    image_confidence: product.image_confidence,
    image_status: product.image_status,
    detected_candidate_identity: {
      family: identity.candidate?.family ?? null,
      families: identity.candidate?.families ?? [],
      modelCodes: identity.candidate?.modelCodes ?? [],
    },
    conflicting_tokens: conflicts,
    evidence_level: identity.evidenceLevel,
    classification,
    recommended_action: recommendedAction,
  }
}

async function auditRecentMatrix(supabase) {
  const progress = loadProgress()
  const importRows = loadImportResultRows()
  const importById = new Map(importRows.map((row) => [row.product_id, row]))
  const recentIds = Object.keys(progress.completedIds || {})
  const matrixProducts = (await fetchAllProducts(supabase, { brand: 'Matrix Fitness' }))
    .filter((product) => recentIds.includes(product.id) || importById.has(product.id))

  const rows = matrixProducts.map((product) => classifyMatrixBackfillRow(product, importById.get(product.id)))
  const summary = {
    audited: rows.length,
    confirmed_correct: rows.filter((row) => row.classification === 'confirmed_correct').length,
    confirmed_wrong: rows.filter((row) => row.classification === 'confirmed_wrong').length,
    ambiguous: rows.filter((row) => row.classification === 'ambiguous').length,
  }

  writeFileSync(MATRIX_AUDIT_JSON, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    summary,
    rows,
  }, null, 2)}\n`)
  writeFileSync(MATRIX_AUDIT_CSV, `${[
    'product_id,canonical_name,expected_family,expected_series,expected_model,equipment_type,image_source_title,image_source_url,image_url,image_storage_path,image_confidence,image_status,detected_candidate_identity,conflicting_tokens,classification,recommended_action',
    ...rows.map((row) => [
      row.product_id,
      row.canonical_name,
      row.expected_family,
      row.expected_series,
      row.expected_model,
      row.equipment_type,
      row.image_source_title,
      row.image_source_url,
      row.image_url,
      row.image_storage_path,
      row.image_confidence,
      row.image_status,
      JSON.stringify(row.detected_candidate_identity),
      (row.conflicting_tokens || []).join('|'),
      row.classification,
      row.recommended_action,
    ].map(csvEscape).join(',')),
  ].join('\n')}\n`)

  console.log('Matrix backfill audit summary:', summary)
  console.log(`Wrote ${MATRIX_AUDIT_JSON}`)
  console.log(`Wrote ${MATRIX_AUDIT_CSV}`)
  return { summary, rows }
}

async function repairRecentMatrix(supabase, { dryRun = true } = {}) {
  const { rows } = await auditRecentMatrix(supabase)
  const progress = loadProgress()
  const proposed = []

  for (const row of rows) {
    if (row.recommended_action === 'preserve') continue

    if (row.recommended_action === 'clear_or_reject_and_retry') {
      const update = {
        image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
        image_failure_reason: row.conflicting_tokens?.length
          ? `conflicting_product_identity:${row.conflicting_tokens.join(',')}`
          : 'identity_rejected_insufficient_or_conflicting',
        image_updated_at: new Date().toISOString(),
        // Keep assets for audit, but demote from public display.
        image_confidence: 0,
      }
      proposed.push({ product_id: row.product_id, canonical_name: row.canonical_name, update, action: 'reject_wrong_image' })
      if (!dryRun) {
        await saveImageMetadata(supabase, row.product_id, update)
        progress.completedIds[row.product_id] = {
          result_class: 'identity_rejected',
          at: new Date().toISOString(),
        }
      }
      continue
    }

    if (row.recommended_action === 'move_to_suggested_for_review') {
      const update = {
        image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
        image_failure_reason: 'identity_needs_review',
        image_updated_at: new Date().toISOString(),
      }
      proposed.push({ product_id: row.product_id, canonical_name: row.canonical_name, update, action: 'demote_ambiguous' })
      if (!dryRun) {
        await saveImageMetadata(supabase, row.product_id, update)
        progress.completedIds[row.product_id] = {
          result_class: 'suggested',
          at: new Date().toISOString(),
        }
      }
    }
  }

  if (!dryRun) saveProgress(progress)

  console.log(`Repair mode: ${dryRun ? 'dry-run' : 'apply'}`)
  console.log(`Proposed changes: ${proposed.length}`)
  for (const entry of proposed) {
    console.log(`${entry.action} | ${entry.canonical_name} | ${entry.update.image_status} | ${entry.update.image_failure_reason}`)
  }
  return proposed
}

function buildResultRow(product, extras = {}) {
  return {
    product_id: product.id,
    brand: product.brand,
    series: product.product_family ?? null,
    model: product.model,
    equipment_type: product.equipment_type,
    canonical_display_name: product.canonical_product_name,
    search_queries: (extras.queries ?? []).join(' | '),
    serp_api_calls: extras.serpApiCalls ?? 0,
    candidate_title: extras.candidate?.title ?? '',
    candidate_source_url: extras.candidate?.sourceUrl ?? '',
    candidate_image_url: extras.candidate?.imageUrl ?? '',
    candidate_dimensions: extras.candidate?.width && extras.candidate?.height
      ? `${extras.candidate.width}x${extras.candidate.height}`
      : '',
    candidate_score: extras.candidate?.score ?? '',
    outcome: extras.outcome ?? '',
    rejection_reason: extras.rejectionReason ?? '',
    download_result: extras.downloadResult ?? '',
    storage_path: extras.storagePath ?? '',
    image_record_id: product.id,
    mapping_status: extras.mappingStatus ?? '',
    approval_status: extras.approvalStatus ?? '',
    primary_image_status: extras.primaryImageStatus ?? '',
    result_class: extras.resultClass ?? '',
  }
}

async function searchProgressively(product, serpApiKey, maxQueries) {
  const queries = buildEquipmentProductImageSearchQueries(product).slice(0, Math.max(1, maxQueries))
  const byImageUrl = new Map()
  const usedQueries = []
  let serpApiCalls = 0

  for (const query of queries) {
    usedQueries.push(query)
    serpApiCalls += 1
    const candidates = await searchImageCandidates(query, serpApiKey)
    for (const candidate of candidates) {
      const key = candidate.imageUrl || candidate.sourceUrl
      if (!key || byImageUrl.has(key)) continue
      byImageUrl.set(key, { ...candidate, searchQuery: query })
    }

    const ranked = rankAutoSuggestImageCandidates([...byImageUrl.values()], product)
    if (ranked.length) {
      return {
        queries: usedQueries,
        allQueries: queries,
        serpApiCalls,
        candidates: [...byImageUrl.values()],
        ranked,
      }
    }
  }

  return {
    queries: usedQueries,
    allQueries: queries,
    serpApiCalls,
    candidates: [...byImageUrl.values()],
    ranked: [],
  }
}

async function reuseExistingCandidate(product, { supabase, dryRun, approve, approveScore }) {
  const domain = product.image_source_domain
    || normalizeImageSourceDomain(product.image_source_url)
    || normalizeImageSourceDomain(product.image_url)
  const score = Number(product.image_confidence ?? 0)
  const metadata = {
    image_url: product.image_url,
    image_storage_path: product.image_storage_path,
    image_source_url: product.image_source_url,
    image_source_domain: domain,
    image_confidence: product.image_confidence,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    image_failure_reason: null,
    image_updated_at: new Date().toISOString(),
  }

  const candidate = {
    title: null,
    sourceUrl: product.image_source_url,
    imageUrl: product.image_url,
  }
  const identity = compareProductIdentity(product, candidate)
  const canApprove = canAutoApproveByIdentity(identity, {
    trustedSource: isAutoApproveImageSourceDomain(domain) || isAllowlistedImageSourceDomain(domain),
    officialExactPage: isAutoApproveImageSourceDomain(domain),
  }) && (
    isAutoApproveImageSourceDomain(domain)
    || (approve && Number(score) >= approveScore)
  )

  if (!canApprove) {
    return {
      resultClass: RESULT_CLASS.CANDIDATE_NEEDS_REVIEW,
      row: buildResultRow(product, {
        outcome: 'existing_asset_needs_review',
        approvalStatus: product.image_status,
        mappingStatus: 'existing',
        primaryImageStatus: 'not_primary_until_approved',
        resultClass: RESULT_CLASS.CANDIDATE_NEEDS_REVIEW,
        candidate: {
          sourceUrl: product.image_source_url,
          imageUrl: product.image_url,
          score,
        },
        rejectionReason: identity.hasConflict
          ? 'conflicting_product_identity'
          : 'existing_candidate_not_strong_enough_to_auto_approve',
      }),
    }
  }

  if (!dryRun) {
    await saveImageMetadata(supabase, product.id, {
      ...metadata,
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
      image_failure_reason: null,
    })
  }

  return {
    resultClass: RESULT_CLASS.REUSED_EXISTING,
    row: buildResultRow(product, {
      outcome: dryRun ? 'would_reuse_and_approve' : 'reused_and_approved',
      approvalStatus: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
      mappingStatus: 'existing',
      primaryImageStatus: 'primary',
      storagePath: product.image_storage_path,
      resultClass: RESULT_CLASS.REUSED_EXISTING,
      candidate: {
        sourceUrl: product.image_source_url,
        imageUrl: product.image_url,
        score,
      },
    }),
  }
}

async function processProduct(product, {
  supabase,
  serpApiKey,
  dryRun,
  previewSearch,
  maxQueries,
  approve,
  approveScore,
  replaceFailed = false,
}) {
  const scope = classifyScope(product)
  if (!scope.inScope) {
    return {
      resultClass: RESULT_CLASS.SKIPPED_EXISTING,
      row: buildResultRow(product, {
        outcome: 'skipped',
        rejectionReason: scope.reason,
        resultClass: RESULT_CLASS.SKIPPED_EXISTING,
      }),
    }
  }

  if (scope.reusable && !replaceFailed) {
    return reuseExistingCandidate(product, {
      supabase,
      dryRun,
      approve,
      approveScore,
    })
  }

  if (dryRun && !previewSearch) {
    const queries = buildEquipmentProductImageSearchQueries(product)
    return {
      resultClass: RESULT_CLASS.DRY_RUN_SCOPED,
      row: buildResultRow(product, {
        queries,
        serpApiCalls: 0,
        outcome: 'would_search',
        resultClass: RESULT_CLASS.DRY_RUN_SCOPED,
        mappingStatus: 'pending',
        approvalStatus: product.image_status,
      }),
      estimatedMinSearches: 1,
      estimatedMaxSearches: Math.min(maxQueries, queries.length),
    }
  }

  let search
  try {
    search = await searchProgressively(product, serpApiKey, maxQueries)
  } catch (error) {
    if (error.quotaExhausted) throw error
    if (!dryRun) {
      await saveImageMetadata(supabase, product.id, buildSuggestedImageMetadata({
        imageUrl: null,
        storagePath: null,
        sourceUrl: null,
        confidence: 0,
        failureReason: error.message,
      }))
    }
    return {
      resultClass: RESULT_CLASS.SEARCH_FAILED,
      row: buildResultRow(product, {
        queries: [],
        serpApiCalls: 1,
        outcome: 'search_failed',
        rejectionReason: error.message,
        resultClass: RESULT_CLASS.SEARCH_FAILED,
      }),
    }
  }

  if (!search.ranked.length) {
    if (!dryRun && !previewSearch) {
      await saveImageMetadata(supabase, product.id, buildSuggestedImageMetadata({
        imageUrl: null,
        storagePath: null,
        sourceUrl: null,
        confidence: 0,
        failureReason: 'no_allowlisted_image_candidate',
      }))
    }
    return {
      resultClass: RESULT_CLASS.NO_SUITABLE,
      row: buildResultRow(product, {
        queries: search.queries,
        serpApiCalls: search.serpApiCalls,
        outcome: 'no_suitable_result',
        rejectionReason: 'no_allowlisted_image_candidate',
        resultClass: RESULT_CLASS.NO_SUITABLE,
      }),
    }
  }

  const best = search.ranked[0]
  if (dryRun && previewSearch) {
    const identity = best.identity || compareProductIdentity(product, best.candidate)
    const decision = best.rejection?.reject
      ? 'reject'
      : identity.evidenceLevel === 'exact'
        ? 'would_approve'
        : identity.evidenceLevel === 'family'
          ? 'would_suggest'
          : 'would_leave_missing'
    return {
      resultClass: RESULT_CLASS.PREVIEW,
      row: buildResultRow(product, {
        queries: search.queries,
        serpApiCalls: search.serpApiCalls,
        outcome: decision,
        candidate: {
          title: best.candidate.title,
          sourceUrl: best.candidate.sourceUrl,
          imageUrl: best.candidate.imageUrl,
          width: best.candidate.width,
          height: best.candidate.height,
          score: best.score,
        },
        resultClass: RESULT_CLASS.PREVIEW,
        approvalStatus: decision,
        rejectionReason: best.rejection?.reason
          || (identity.hasConflict ? 'conflicting_product_identity' : ''),
        mappingStatus: JSON.stringify({
          expected: identity.target,
          detected: identity.candidate,
          matched: identity.matched,
          conflicts: identity.conflicts,
          evidenceLevel: identity.evidenceLevel,
          scoreBreakdown: best.scoreBreakdown ?? null,
        }),
      }),
    }
  }

  let downloadResult
  try {
    downloadResult = await downloadFirstAvailableImageCandidate(search.ranked)
  } catch (error) {
    return {
      resultClass: RESULT_CLASS.DOWNLOAD_FAILED,
      row: buildResultRow(product, {
        queries: search.queries,
        serpApiCalls: search.serpApiCalls,
        outcome: 'download_failed',
        rejectionReason: error.message,
        resultClass: RESULT_CLASS.DOWNLOAD_FAILED,
        candidate: {
          title: best.candidate.title,
          sourceUrl: best.candidate.sourceUrl,
          imageUrl: best.candidate.imageUrl,
          score: best.score,
        },
      }),
    }
  }

  if (!downloadResult.downloaded || !downloadResult.entry) {
    const failureReason = summarizeImageCandidateFailures(downloadResult.failures)
    if (!dryRun) {
      await saveImageMetadata(supabase, product.id, buildSuggestedImageMetadata({
        imageUrl: null,
        storagePath: null,
        sourceUrl: null,
        confidence: 0,
        failureReason,
      }))
    }
    return {
      resultClass: RESULT_CLASS.DOWNLOAD_FAILED,
      row: buildResultRow(product, {
        queries: search.queries,
        serpApiCalls: search.serpApiCalls,
        outcome: 'download_failed',
        rejectionReason: failureReason,
        downloadResult: 'failed',
        resultClass: RESULT_CLASS.DOWNLOAD_FAILED,
        candidate: {
          title: best.candidate.title,
          sourceUrl: best.candidate.sourceUrl,
          imageUrl: best.candidate.imageUrl,
          score: best.score,
        },
      }),
    }
  }

  const { entry, downloaded } = downloadResult
  let uploaded
  try {
    uploaded = await uploadImage(
      supabase,
      product,
      downloaded.buffer,
      downloaded.contentType,
      downloaded.extension,
    )
  } catch (error) {
    return {
      resultClass: RESULT_CLASS.UPLOAD_FAILED,
      row: buildResultRow(product, {
        queries: search.queries,
        serpApiCalls: search.serpApiCalls,
        outcome: 'upload_failed',
        rejectionReason: error.message,
        downloadResult: 'ok',
        resultClass: RESULT_CLASS.UPLOAD_FAILED,
        candidate: {
          title: entry.candidate.title,
          sourceUrl: entry.candidate.sourceUrl,
          imageUrl: entry.candidate.imageUrl,
          score: entry.score,
        },
      }),
    }
  }

  let metadata = buildEquipmentProductImageImportMetadata({
    imageUrl: uploaded.publicUrl,
    storagePath: uploaded.storagePath,
    sourceUrl: entry.candidate.sourceUrl ?? entry.candidate.imageUrl,
    confidence: entry.score,
    product,
    scoreResult: entry,
  })
  metadata = maybeForceApprove(metadata, entry, entry.candidate, product, { approve, approveScore })

  try {
    await saveImageMetadata(supabase, product.id, metadata)
  } catch (error) {
    return {
      resultClass: RESULT_CLASS.MAPPING_FAILED,
      row: buildResultRow(product, {
        queries: search.queries,
        serpApiCalls: search.serpApiCalls,
        outcome: 'mapping_failed',
        rejectionReason: error.message,
        downloadResult: 'ok',
        storagePath: uploaded.storagePath,
        resultClass: RESULT_CLASS.MAPPING_FAILED,
      }),
    }
  }

  const approved = metadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
  return {
    resultClass: approved ? RESULT_CLASS.AUTO_APPROVED : RESULT_CLASS.CANDIDATE_NEEDS_REVIEW,
    row: buildResultRow(product, {
      queries: search.queries,
      serpApiCalls: search.serpApiCalls,
      outcome: approved ? 'imported_and_approved' : 'imported_needs_review',
      downloadResult: 'ok',
      storagePath: uploaded.storagePath,
      mappingStatus: 'updated',
      approvalStatus: metadata.image_status,
      primaryImageStatus: approved ? 'primary' : 'pending_approval',
      resultClass: approved ? RESULT_CLASS.AUTO_APPROVED : RESULT_CLASS.CANDIDATE_NEEDS_REVIEW,
      rejectionReason: metadata.image_failure_reason || '',
      candidate: {
        title: entry.candidate.title,
        sourceUrl: entry.candidate.sourceUrl,
        imageUrl: uploaded.publicUrl,
        width: entry.candidate.width,
        height: entry.candidate.height,
        score: entry.score,
      },
    }),
  }
}

function buildCoverageSnapshot(products) {
  const approvedProducts = products.filter((product) => product.status === PRODUCT_STATUS.APPROVED)
  const withImage = approvedProducts.filter((product) => productHasDisplayableImage(product))
  const missing = []
  const excluded = []
  const reusable = []

  for (const product of approvedProducts) {
    const scope = classifyScope(product)
    if (!scope.inScope) {
      if (scope.reason !== 'already_has_approved_image') {
        excluded.push({ product, reason: scope.reason })
      }
      continue
    }
    missing.push(product)
    if (scope.reusable) reusable.push(product)
  }

  return {
    generated_at: new Date().toISOString(),
    totals: {
      total_canonical_products: approvedProducts.length,
      products_with_approved_image: withImage.length,
      products_without_approved_image: missing.length,
      coverage_percent: approvedProducts.length
        ? Math.round((withImage.length / approvedProducts.length) * 1000) / 10
        : 0,
      reusable_existing_candidates: reusable.length,
      excluded_from_fill: excluded.length,
    },
    missing_by_brand: countBy(missing, (product) => product.brand),
    missing_by_category: countBy(missing, (product) => product.equipment_type),
    missing_by_reason: countBy(missing, (product) => classifyScope(product).reason),
    excluded_by_reason: countBy(excluded, (entry) => entry.reason),
    products: missing.map((product) => ({
      product_id: product.id,
      brand: product.brand,
      series: product.product_family,
      model: product.model,
      equipment_type: product.equipment_type,
      canonical_product_name: product.canonical_product_name,
      image_status: product.image_status,
      image_url: product.image_url,
      image_storage_path: product.image_storage_path,
      image_source_domain: product.image_source_domain,
      missing_reason: classifyScope(product).reason,
      reusable: classifyScope(product).reusable,
      planned_queries: buildEquipmentProductImageSearchQueries(product),
    })),
  }
}

function summarizeResults(rows) {
  const summary = {
    products_processed: rows.length,
    auto_approved: 0,
    needs_review: 0,
    no_suitable_result: 0,
    search_failed: 0,
    download_failed: 0,
    upload_failed: 0,
    mapping_failed: 0,
    skipped_existing_image: 0,
    reused_existing_candidate: 0,
    dry_run_scoped: 0,
    preview_search: 0,
    quota_exhausted_not_processed: 0,
    serp_api_searches_used: 0,
    by_brand: {},
    by_category: {},
    by_result_class: {},
  }

  for (const row of rows) {
    summary.serp_api_searches_used += Number(row.serp_api_calls || 0)
    const cls = row.result_class || 'unknown'
    summary.by_result_class[cls] = (summary.by_result_class[cls] ?? 0) + 1
    summary.by_brand[row.brand || '(none)'] = (summary.by_brand[row.brand || '(none)'] ?? 0) + 1
    summary.by_category[row.equipment_type || '(none)'] = (
      summary.by_category[row.equipment_type || '(none)'] ?? 0
    ) + 1

    if (cls === RESULT_CLASS.AUTO_APPROVED) summary.auto_approved += 1
    else if (cls === RESULT_CLASS.CANDIDATE_NEEDS_REVIEW) summary.needs_review += 1
    else if (cls === RESULT_CLASS.NO_SUITABLE) summary.no_suitable_result += 1
    else if (cls === RESULT_CLASS.SEARCH_FAILED) summary.search_failed += 1
    else if (cls === RESULT_CLASS.DOWNLOAD_FAILED) summary.download_failed += 1
    else if (cls === RESULT_CLASS.UPLOAD_FAILED) summary.upload_failed += 1
    else if (cls === RESULT_CLASS.MAPPING_FAILED) summary.mapping_failed += 1
    else if (cls === RESULT_CLASS.SKIPPED_EXISTING) summary.skipped_existing_image += 1
    else if (cls === RESULT_CLASS.REUSED_EXISTING) summary.reused_existing_candidate += 1
    else if (cls === RESULT_CLASS.DRY_RUN_SCOPED) summary.dry_run_scoped += 1
    else if (cls === RESULT_CLASS.PREVIEW) summary.preview_search += 1
    else if (cls === RESULT_CLASS.QUOTA_STOPPED) summary.quota_exhausted_not_processed += 1
  }

  return summary
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const serpApiKey = env.SERPAPI_API_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  ensureReportsDir()

  if (args.auditRecentMatrix) {
    await auditRecentMatrix(supabase)
    return
  }
  if (args.repairRecentMatrix) {
    await repairRecentMatrix(supabase, { dryRun: args.dryRun })
    return
  }

  if ((args.apply || args.previewSearch) && !serpApiKey) {
    throw new Error('Missing SERPAPI_API_KEY in .env.local')
  }
  const products = await fetchAllProducts(supabase, {
    brand: args.brand,
    productId: args.productId,
  })
  const before = buildCoverageSnapshot(products)
  if (args.report) {
    writeFileSync(BEFORE_PATH, `${JSON.stringify(before, null, 2)}\n`)
  }

  const progress = args.resume ? loadProgress() : { completedIds: {} }
  let missing = before.products
    .map((entry) => products.find((product) => product.id === entry.product_id))
    .filter(Boolean)

  if (!args.replaceFailed) {
    // still include failed; replace-failed only changes whether we clear prior failure notes
  }

  if (args.resume) {
    missing = missing.filter((product) => {
      const prior = progress.completedIds?.[product.id]
      return !prior || ![
        RESULT_CLASS.AUTO_APPROVED,
        RESULT_CLASS.REUSED_EXISTING,
        RESULT_CLASS.CANDIDATE_NEEDS_REVIEW,
      ].includes(prior.result_class)
    })
  }

  if (args.nameContains) {
    const needle = String(args.nameContains).toLowerCase()
    missing = missing.filter((product) => (
      String(product.canonical_product_name || '').toLowerCase().includes(needle)
      || String(product.product_family || '').toLowerCase().includes(needle)
      || String(product.model || '').toLowerCase().includes(needle)
    ))
    console.log(`Filtered to name-contains "${args.nameContains}": ${missing.length}`)
  }

  if (args.limit != null) {
    missing = missing.slice(0, args.limit)
  }

  const estimatedMin = missing.filter((product) => !classifyScope(product).reusable).length
  const estimatedMax = missing.reduce((sum, product) => {
    if (classifyScope(product).reusable) return sum
    return sum + Math.min(args.maxQueries, buildEquipmentProductImageSearchQueries(product).length)
  }, 0)

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}${args.previewSearch ? ' + preview-search' : ''}`)
  console.log(`Approved canonical products: ${before.totals.total_canonical_products}`)
  console.log(`With approved images: ${before.totals.products_with_approved_image}`)
  console.log(`Genuinely missing images: ${before.totals.products_without_approved_image}`)
  console.log(`Reusable existing candidates: ${before.totals.reusable_existing_candidates}`)
  console.log('Missing by brand:', before.missing_by_brand)
  console.log('Missing by category (top):', Object.fromEntries(Object.entries(before.missing_by_category).slice(0, 12)))
  console.log(`This run will process: ${missing.length}`)
  console.log(`Estimated SerpApi searches: min ${estimatedMin}, max ${estimatedMax}`)
  if (args.dryRun && !args.previewSearch) {
    console.log('Dry-run does not call SerpApi (use --preview-search for a small paid sample).')
  }

  const rows = []
  let quotaStopped = false

  for (let index = 0; index < missing.length; index += 1) {
    const product = missing[index]
    try {
      const result = await processProduct(product, {
        supabase,
        serpApiKey,
        dryRun: args.dryRun,
        previewSearch: args.previewSearch,
        maxQueries: args.maxQueries,
        approve: args.approve,
        approveScore: args.approveScore,
        replaceFailed: args.replaceFailed,
      })
      rows.push(result.row)
      progress.completedIds[product.id] = {
        result_class: result.resultClass,
        at: new Date().toISOString(),
      }
      if (!args.dryRun || args.previewSearch) {
        saveProgress(progress)
      }
      console.log([
        `[${index + 1}/${missing.length}]`,
        product.canonical_product_name,
        result.resultClass,
        result.row.candidate_score || '—',
        result.row.candidate_source_url || '',
        result.row.rejection_reason || '',
      ].filter(Boolean).join(' | '))
    } catch (error) {
      if (error.quotaExhausted) {
        quotaStopped = true
        console.error(`SerpApi quota exhausted: ${error.message}`)
        for (let rest = index; rest < missing.length; rest += 1) {
          const remaining = missing[rest]
          rows.push(buildResultRow(remaining, {
            outcome: 'not_processed_quota',
            rejectionReason: error.message,
            resultClass: RESULT_CLASS.QUOTA_STOPPED,
          }))
        }
        break
      }
      rows.push(buildResultRow(product, {
        outcome: 'search_failed',
        rejectionReason: error.message,
        resultClass: RESULT_CLASS.SEARCH_FAILED,
        serpApiCalls: 1,
      }))
      console.error(`FAILED ${product.canonical_product_name}: ${error.message}`)
    }

    if ((args.apply || args.previewSearch) && args.delayMs > 0 && index < missing.length - 1) {
      await sleep(args.delayMs)
    }
  }

  const summary = summarizeResults(rows)
  let after = before
  if (args.apply) {
    const refreshed = await fetchAllProducts(supabase, {
      brand: args.brand,
      productId: args.productId,
    })
    after = buildCoverageSnapshot(refreshed)
  }

  if (args.report) {
    writeFileSync(RESULTS_JSON_PATH, `${JSON.stringify({
      generated_at: new Date().toISOString(),
      mode: args.dryRun ? (args.previewSearch ? 'dry-run-preview-search' : 'dry-run') : 'apply',
      args: {
        brand: args.brand,
        limit: args.limit,
        productId: args.productId,
        resume: args.resume,
        approve: args.approve,
        maxQueries: args.maxQueries,
        delayMs: args.delayMs,
      },
      coverage_before: before.totals,
      coverage_after: after.totals,
      estimated_serp_api: { min: estimatedMin, max: estimatedMax },
      quota_stopped: quotaStopped,
      summary,
      results: rows,
    }, null, 2)}\n`)
    writeCsv(RESULTS_CSV_PATH, rows)
    writeFileSync(AFTER_PATH, `${JSON.stringify(after, null, 2)}\n`)
  }

  console.log('Summary:', summary)
  console.log(`Coverage before: ${before.totals.products_with_approved_image}/${before.totals.total_canonical_products} (${before.totals.coverage_percent}%)`)
  console.log(`Coverage after:  ${after.totals.products_with_approved_image}/${after.totals.total_canonical_products} (${after.totals.coverage_percent}%)`)
  if (args.report) {
    console.log(`Wrote ${BEFORE_PATH}`)
    console.log(`Wrote ${RESULTS_JSON_PATH}`)
    console.log(`Wrote ${RESULTS_CSV_PATH}`)
    console.log(`Wrote ${AFTER_PATH}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
