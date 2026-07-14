#!/usr/bin/env node
/**
 * Find images for products listed in a research export/import CSV that do not
 * already have an approved catalogue image.
 *
 * Presentation / search only for image metadata:
 *   - Does not auto-approve images
 *   - Does not regenerate products
 *   - Does not modify prices, years, or content
 *   - Never overwrites approved images
 *   - Never bypasses duplicate / identity rejection in the ranking pipeline
 *
 * Workflow:
 *   1. Read CSV
 *   2. Match products by product_id
 *   3. Skip products already with approved images
 *   4. Search manufacturer websites first
 *   5. Search trusted commercial dealers second
 *   6. Reuse Equipd image search / scoring / download pipeline
 *   7. Save successful matches as pending (suggested) candidates on --apply
 *
 * Usage:
 *   node scripts/find-missing-product-images-from-csv.mjs \
 *     --csv reports/product-research-import.csv \
 *     --dry-run
 *
 *   node scripts/find-missing-product-images-from-csv.mjs \
 *     --csv reports/product-research-import.csv \
 *     --apply
 *
 * Optional:
 *   --brand "Matrix Fitness"
 *   --limit 25
 *   --resume
 *   --delay-ms 750
 *   --max-queries 4
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  buildEquipmentProductImageSearchQueries,
  buildEquipmentProductImageStoragePath,
  buildSuggestedImageMetadata,
  downloadFirstAvailableImageCandidate,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  imageMetadataPreservesPricingFields,
  normalizeImageSourceDomain,
  productHasDisplayableImage,
  rankAutoSuggestImageCandidates,
  scoreImageSearchCandidate,
  summarizeImageCandidateFailures,
} from '../src/lib/equipmentProductImages.js'
import {
  CONDITIONAL_RETAILER_IMAGE_DOMAINS,
  MANUFACTURER_IMAGE_SOURCE_DOMAINS,
  SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS,
  isConditionalRetailerImageDomain,
  isManufacturerImageSourceDomain,
} from '../src/lib/equipmentProductImageDomains.js'
import { parseResearchCsv } from '../src/lib/equipmentProductResearchCsv.js'

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
const PROGRESS_PATH = join(REPORTS_DIR, 'find-missing-product-images-from-csv-progress.json')
const REPORT_JSON_PATH = join(REPORTS_DIR, 'find-missing-product-images-from-csv-report.json')
const REPORT_MD_PATH = join(REPORTS_DIR, 'find-missing-product-images-from-csv-report.md')

const OUTCOME = Object.freeze({
  SKIPPED_APPROVED: 'skipped_already_had_image',
  SKIPPED_RESUME: 'skipped_resume',
  SKIPPED_NOT_FOUND: 'skipped_product_not_found',
  SKIPPED_BRAND: 'skipped_brand_filter',
  FOUND_HIGH: 'found_high_confidence',
  FOUND_MEDIUM: 'found_medium_confidence',
  FOUND_LOW: 'found_low_confidence',
  FAILED_NO_CANDIDATE: 'failed_no_suitable_candidate',
  FAILED_SEARCH: 'failed_search',
  FAILED_DOWNLOAD: 'failed_download',
  FAILED_UPLOAD: 'failed_upload',
  FAILED_MAPPING: 'failed_mapping',
  FAILED_APPROVED_GUARD: 'failed_approved_guard',
  SKIPPED_QUALITY_GATE: 'skipped_quality_gate',
  SKIPPED_BATCH_DUPLICATE_IMAGE: 'skipped_batch_duplicate_image',
  DRY_RUN_WOULD_SEARCH: 'dry_run_would_search',
  QUOTA_STOPPED: 'quota_exhausted_not_processed',
})

const CONFIDENCE_RANK = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
})

function meetsMinConfidence(bucket, minConfidence) {
  return (CONFIDENCE_RANK[bucket] || 0) >= (CONFIDENCE_RANK[minConfidence] || 1)
}

function normalizeImageDedupeKey(url) {
  return String(url || '').trim().split('?')[0].toLowerCase()
}

function hasConflictingFamilySignal(product, candidate) {
  const name = String(product?.canonical_product_name || '').toLowerCase()
  const haystack = [
    candidate?.sourceUrl,
    candidate?.imageUrl,
    candidate?.title,
  ].filter(Boolean).join(' ').toLowerCase()

  if (/selection\s+line/.test(name) && /biostrength/.test(haystack)) return true
  if (/selection\s+personal/.test(name) && /biostrength/.test(haystack)) return true
  if (/selection\s+pro/.test(name) && /biostrength|pure\s+strength/.test(haystack)) return true
  if (/\b700\b/.test(name) && /personal(?!\s*700)/.test(haystack) && !/700/.test(haystack)) return true
  if (/art-collection|mytechnogym-paulo|paulo.?dybala/.test(haystack)) return true
  return false
}

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

function parseArgs(argv) {
  const args = {
    csv: null,
    dryRun: true,
    apply: false,
    brand: null,
    limit: null,
    resume: false,
    delayMs: 750,
    maxQueries: 4,
    minConfidence: 'low', // low | medium | high — apply/dry-run keep-results threshold
    requireExact: false,
    manufacturerOnly: false,
    dedupeBatchImages: true,
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
    } else if (token === '--require-exact') {
      args.requireExact = true
    } else if (token === '--manufacturer-only') {
      args.manufacturerOnly = true
    } else if (token === '--no-dedupe-batch-images') {
      args.dedupeBatchImages = false
    } else if (token === '--csv') {
      args.csv = argv[index + 1] ?? null
      index += 1
    } else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1] ?? NaN)
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 750)
      index += 1
    } else if (token === '--max-queries') {
      args.maxQueries = Number(argv[index + 1] ?? 4)
      index += 1
    } else if (token === '--min-confidence') {
      args.minConfidence = String(argv[index + 1] ?? 'low').toLowerCase()
      index += 1
    }
  }

  if (!args.csv) {
    throw new Error('--csv <path> is required')
  }
  if (args.limit != null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive number')
  }
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error('--delay-ms must be a non-negative number')
  }
  if (!Number.isFinite(args.maxQueries) || args.maxQueries < 1) {
    throw new Error('--max-queries must be a positive number')
  }
  if (!['low', 'medium', 'high'].includes(args.minConfidence)) {
    throw new Error('--min-confidence must be low, medium, or high')
  }

  return args
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
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

function manufacturerSiteForBrand(brand) {
  const key = String(brand ?? '').trim().toLowerCase()
  const map = {
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
  return map[key] ?? null
}

function isManufacturerQuery(query) {
  return /\bsite:/i.test(String(query || ''))
    && MANUFACTURER_IMAGE_SOURCE_DOMAINS.some((domain) => String(query).toLowerCase().includes(domain))
}

function buildDealerSiteQueries(product) {
  const needle = [
    product?.model,
    product?.canonical_product_name,
    product?.product_family,
  ].map((value) => String(value ?? '').trim()).find(Boolean)
  if (!needle) return []

  const domains = [...new Set([
    ...SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS,
    ...CONDITIONAL_RETAILER_IMAGE_DOMAINS,
  ])]

  const queries = []
  for (const domain of domains.slice(0, 6)) {
    queries.push(`site:${domain} "${needle}"`)
  }
  return queries
}

function partitionSearchQueries(product, maxQueries) {
  const baseQueries = buildEquipmentProductImageSearchQueries(product)
  const manufacturerSite = manufacturerSiteForBrand(product?.brand)
  const manufacturerFirst = []
  const dealerSecond = []

  for (const query of baseQueries) {
    if (isManufacturerQuery(query) || (manufacturerSite && String(query).toLowerCase().includes(manufacturerSite))) {
      manufacturerFirst.push(query)
    } else {
      dealerSecond.push(query)
    }
  }

  // Prefer identity queries in manufacturer phase even without an explicit site: bias.
  if (!manufacturerFirst.length && baseQueries.length) {
    manufacturerFirst.push(baseQueries[0])
    dealerSecond.push(...baseQueries.slice(1))
  } else if (manufacturerSite && manufacturerFirst.length) {
    // Keep a plain identity query early for official pages that do not need site:.
    const identity = baseQueries[0]
    if (identity && !manufacturerFirst.includes(identity)) {
      manufacturerFirst.unshift(identity)
    }
  }

  for (const query of buildDealerSiteQueries(product)) {
    if (!dealerSecond.includes(query) && !manufacturerFirst.includes(query)) {
      dealerSecond.push(query)
    }
  }

  const manufacturerBudget = Math.max(1, Math.ceil(maxQueries / 2))
  return {
    manufacturerQueries: manufacturerFirst.slice(0, manufacturerBudget),
    dealerQueries: dealerSecond.slice(0, Math.max(1, maxQueries)),
    allQueries: [...new Set([...manufacturerFirst, ...dealerSecond])].slice(0, maxQueries + 4),
  }
}

function confidenceBucket(entry) {
  const band = String(entry?.confidenceBand ?? '').toLowerCase()
  const score = Number(entry?.score ?? 0)
  if (band === 'high_confidence' || score >= 85) return 'high'
  if (band === 'suggested' || score >= 55) return 'medium'
  return 'low'
}

function outcomeForConfidence(bucket) {
  if (bucket === 'high') return OUTCOME.FOUND_HIGH
  if (bucket === 'medium') return OUTCOME.FOUND_MEDIUM
  return OUTCOME.FOUND_LOW
}

function filterRankedByPhase(ranked, phase) {
  if (phase === 'manufacturer') {
    return ranked.filter((entry) => {
      const domain = entry.domain
        || normalizeImageSourceDomain(entry.candidate?.sourceUrl)
        || normalizeImageSourceDomain(entry.candidate?.imageUrl)
      return isManufacturerImageSourceDomain(domain)
    })
  }
  if (phase === 'dealer') {
    return ranked.filter((entry) => {
      const domain = entry.domain
        || normalizeImageSourceDomain(entry.candidate?.sourceUrl)
        || normalizeImageSourceDomain(entry.candidate?.imageUrl)
      return isConditionalRetailerImageDomain(domain)
        || !isManufacturerImageSourceDomain(domain)
    })
  }
  return ranked
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
    const error = new Error(message)
    error.quotaExhausted = /quota|credit|limit|exhausted|billing/i.test(String(message))
      || response.status === 429
      || response.status === 402
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

/**
 * Progressive search with manufacturer-first, dealer-second phases.
 * Duplicate candidates are keyed by image URL and never re-added.
 */
async function searchForProduct(product, serpApiKey, maxQueries) {
  const { manufacturerQueries, dealerQueries } = partitionSearchQueries(product, maxQueries)
  const byImageUrl = new Map()
  const usedQueries = []
  let serpApiCalls = 0
  let phaseUsed = null

  async function runQueries(queries, phase) {
    for (const query of queries) {
      usedQueries.push(query)
      serpApiCalls += 1
      const candidates = await searchImageCandidates(query, serpApiKey)
      for (const candidate of candidates) {
        const key = candidate.imageUrl || candidate.sourceUrl
        if (!key || byImageUrl.has(key)) continue
        byImageUrl.set(key, { ...candidate, searchQuery: query, searchPhase: phase })
      }

      const rankedAll = rankAutoSuggestImageCandidates([...byImageUrl.values()], product)
      const rankedPhase = filterRankedByPhase(rankedAll, phase)
      const ranked = rankedPhase.length ? rankedPhase : (phase === 'manufacturer' ? [] : rankedAll)
      if (ranked.length) {
        phaseUsed = phase
        return ranked
      }
    }
    return []
  }

  let ranked = await runQueries(manufacturerQueries, 'manufacturer')
  if (!ranked.length) {
    ranked = await runQueries(dealerQueries, 'dealer')
  }

  return {
    queries: usedQueries,
    serpApiCalls,
    phaseUsed,
    candidates: [...byImageUrl.values()],
    ranked,
  }
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

async function fetchProductsByIds(supabase, productIds) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  const rows = []
  const pageSize = 100

  for (let index = 0; index < uniqueIds.length; index += pageSize) {
    const batch = uniqueIds.slice(index, index + pageSize)
    const { data, error } = await supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .in('id', batch)
    if (error) throw error
    rows.push(...(data ?? []))
  }

  return new Map(rows.map((row) => [row.id, row]))
}

async function fetchFreshProductImageState(supabase, productId) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select('id, image_status, image_url, image_storage_path')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function savePendingImageMetadata(supabase, productId, metadata) {
  const pending = {
    ...metadata,
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    updated_at: new Date().toISOString(),
  }

  if (!imageMetadataPreservesPricingFields(pending)) {
    throw new Error('Refusing to write non-image fields')
  }

  const { error } = await supabase
    .from('equipment_products')
    .update(pending)
    .eq('id', productId)
    .neq('image_status', EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED)

  if (error) throw error
}

function extractCsvProductIds(csvPath) {
  const text = readFileSync(csvPath, 'utf8')
  const parsed = parseResearchCsv(text)
  if (parsed.error) throw parsed.error
  if (!parsed.headers.includes('product_id')) {
    throw new Error('CSV must include a product_id column')
  }

  const ids = []
  const seen = new Set()
  for (const row of parsed.rows) {
    const productId = String(row.product_id ?? '').trim()
    if (!productId || seen.has(productId)) continue
    seen.add(productId)
    ids.push({
      product_id: productId,
      csv_line: row.__line,
      brand: String(row.brand ?? '').trim() || null,
      canonical_product_key: String(row.canonical_product_key ?? '').trim() || null,
      has_approved_image_csv: String(row.has_approved_image ?? '').trim().toLowerCase(),
    })
  }
  return { rows: parsed.rows, entries: ids }
}

function emptySummary() {
  return {
    products_processed: 0,
    skipped_already_had_image: 0,
    searched: 0,
    images_found: 0,
    high_confidence: 0,
    medium_confidence: 0,
    low_confidence: 0,
    failed: 0,
    pending_candidates_saved: 0,
    serp_api_calls: 0,
    by_outcome: {},
  }
}

function recordOutcome(summary, outcome) {
  summary.by_outcome[outcome] = (summary.by_outcome[outcome] ?? 0) + 1
}

async function processProduct(product, {
  supabase,
  serpApiKey,
  dryRun,
  maxQueries,
  minConfidence = 'low',
  requireExact = false,
  manufacturerOnly = false,
  usedImageUrls = null,
}) {
  if (productHasDisplayableImage(product)) {
    return {
      outcome: OUTCOME.SKIPPED_APPROVED,
      searched: false,
      found: false,
      confidence: null,
      row: {
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        outcome: OUTCOME.SKIPPED_APPROVED,
      },
    }
  }

  let search
  try {
    search = await searchForProduct(product, serpApiKey, maxQueries)
  } catch (error) {
    if (error.quotaExhausted) throw error
    return {
      outcome: OUTCOME.FAILED_SEARCH,
      searched: true,
      found: false,
      confidence: null,
      serpApiCalls: 1,
      row: {
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        outcome: OUTCOME.FAILED_SEARCH,
        rejection_reason: error.message,
      },
    }
  }

  if (!search.ranked.length) {
    const planned = partitionSearchQueries(product, maxQueries)
    return {
      outcome: OUTCOME.FAILED_NO_CANDIDATE,
      searched: true,
      found: false,
      confidence: null,
      serpApiCalls: search.serpApiCalls,
      row: {
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        equipment_type: product.equipment_type ?? null,
        outcome: OUTCOME.FAILED_NO_CANDIDATE,
        search_phase: search.phaseUsed,
        search_queries: search.queries,
        planned_manufacturer_queries: planned.manufacturerQueries,
        planned_dealer_queries: planned.dealerQueries,
        serp_api_calls: search.serpApiCalls,
        rejection_reason: 'no_suitable_image_candidate',
      },
    }
  }

  // Prefer the first ranked candidate that clears batch quality gates.
  let best = null
  let gateReason = null
  for (const entry of search.ranked) {
    const bucket = confidenceBucket(entry)
    const domain = entry.domain
      || normalizeImageSourceDomain(entry.candidate?.sourceUrl)
      || normalizeImageSourceDomain(entry.candidate?.imageUrl)
    const imageKey = normalizeImageDedupeKey(entry.candidate?.imageUrl)

    if (!meetsMinConfidence(bucket, minConfidence)) {
      gateReason = `below_min_confidence:${bucket}`
      continue
    }
    if (requireExact && entry.identity?.evidenceLevel !== 'exact') {
      gateReason = `identity_not_exact:${entry.identity?.evidenceLevel || 'unknown'}`
      continue
    }
    if (manufacturerOnly && !isManufacturerImageSourceDomain(domain)) {
      gateReason = `non_manufacturer_domain:${domain || 'unknown'}`
      continue
    }
    if (hasConflictingFamilySignal(product, entry.candidate)) {
      gateReason = 'conflicting_family_or_generation_signal'
      continue
    }
    if (usedImageUrls && imageKey && usedImageUrls.has(imageKey)) {
      gateReason = `batch_duplicate_image:${usedImageUrls.get(imageKey)}`
      continue
    }

    best = entry
    break
  }

  if (!best) {
    const top = search.ranked[0]
    const bucket = confidenceBucket(top)
    return {
      outcome: gateReason?.startsWith('batch_duplicate_image')
        ? OUTCOME.SKIPPED_BATCH_DUPLICATE_IMAGE
        : OUTCOME.SKIPPED_QUALITY_GATE,
      searched: true,
      found: Boolean(top),
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      row: {
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        equipment_type: product.equipment_type ?? null,
        search_phase: search.phaseUsed,
        search_queries: search.queries,
        serp_api_calls: search.serpApiCalls,
        candidate_title: top?.candidate?.title ?? null,
        candidate_source_url: top?.candidate?.sourceUrl ?? null,
        candidate_image_url: top?.candidate?.imageUrl ?? null,
        candidate_domain: top?.domain
          || normalizeImageSourceDomain(top?.candidate?.sourceUrl)
          || normalizeImageSourceDomain(top?.candidate?.imageUrl),
        candidate_score: top?.score ?? null,
        confidence_band: top?.confidenceBand ?? null,
        confidence_bucket: bucket,
        identity_evidence: top?.identity?.evidenceLevel ?? null,
        outcome: gateReason?.startsWith('batch_duplicate_image')
          ? OUTCOME.SKIPPED_BATCH_DUPLICATE_IMAGE
          : OUTCOME.SKIPPED_QUALITY_GATE,
        rejection_reason: gateReason || 'failed_quality_gate',
      },
    }
  }

  const bucket = confidenceBucket(best)
  const foundOutcome = outcomeForConfidence(bucket)

  // Rank all candidates (including rejected) for dry-run quality review only.
  const scoredAll = (search.candidates || [])
    .map((candidate) => {
      const scored = scoreImageSearchCandidate(candidate, product)
      return { candidate, ...scored }
    })
    .sort((left, right) => (right.score || 0) - (left.score || 0))

  const alternateCandidates = scoredAll.slice(0, 8).map((entry, index) => ({
    rank: index + 1,
    title: entry.candidate?.title ?? null,
    source_url: entry.candidate?.sourceUrl ?? null,
    image_url: entry.candidate?.imageUrl ?? null,
    domain: entry.domain
      || normalizeImageSourceDomain(entry.candidate?.sourceUrl)
      || normalizeImageSourceDomain(entry.candidate?.imageUrl),
    score: entry.score ?? 0,
    confidence_band: entry.confidenceBand ?? null,
    identity_evidence: entry.identity?.evidenceLevel ?? null,
    rejected: Boolean(entry.rejection?.reject),
    rejection_reason: entry.rejection?.reason ?? null,
    selected: best.candidate?.imageUrl === entry.candidate?.imageUrl,
  }))

  const planned = partitionSearchQueries(product, maxQueries)

  const baseRow = {
    product_id: product.id,
    brand: product.brand,
    canonical_product_name: product.canonical_product_name,
    equipment_type: product.equipment_type ?? null,
    search_phase: search.phaseUsed,
    search_queries: search.queries,
    planned_manufacturer_queries: planned.manufacturerQueries,
    planned_dealer_queries: planned.dealerQueries,
    serp_api_calls: search.serpApiCalls,
    candidate_title: best.candidate?.title ?? null,
    candidate_source_url: best.candidate?.sourceUrl ?? null,
    candidate_image_url: best.candidate?.imageUrl ?? null,
    candidate_domain: best.domain
      || normalizeImageSourceDomain(best.candidate?.sourceUrl)
      || normalizeImageSourceDomain(best.candidate?.imageUrl),
    candidate_score: best.score ?? null,
    confidence_band: best.confidenceBand ?? null,
    confidence_bucket: bucket,
    identity_evidence: best.identity?.evidenceLevel ?? null,
    alternate_candidates: alternateCandidates,
  }

  if (dryRun) {
    return {
      outcome: foundOutcome,
      searched: true,
      found: true,
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      saved: false,
      imageKey: normalizeImageDedupeKey(best.candidate?.imageUrl),
      row: {
        ...baseRow,
        outcome: foundOutcome,
        dry_run: true,
        would_save_as: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
      },
    }
  }

  let downloadResult
  try {
    // Download starting from the gated best candidate within the ranked list.
    const rankedFromBest = [
      best,
      ...search.ranked.filter((entry) => entry !== best),
    ]
    downloadResult = await downloadFirstAvailableImageCandidate(rankedFromBest)
  } catch (error) {
    return {
      outcome: OUTCOME.FAILED_DOWNLOAD,
      searched: true,
      found: true,
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      row: {
        ...baseRow,
        outcome: OUTCOME.FAILED_DOWNLOAD,
        rejection_reason: error.message,
      },
    }
  }

  if (!downloadResult.downloaded || !downloadResult.entry) {
    return {
      outcome: OUTCOME.FAILED_DOWNLOAD,
      searched: true,
      found: true,
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      row: {
        ...baseRow,
        outcome: OUTCOME.FAILED_DOWNLOAD,
        rejection_reason: summarizeImageCandidateFailures(downloadResult.failures),
      },
    }
  }

  const { entry, downloaded } = downloadResult

  // Guard: never overwrite an approved image that appeared after we started.
  const fresh = await fetchFreshProductImageState(supabase, product.id)
  if (productHasDisplayableImage(fresh)) {
    return {
      outcome: OUTCOME.FAILED_APPROVED_GUARD,
      searched: true,
      found: true,
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      row: {
        ...baseRow,
        outcome: OUTCOME.FAILED_APPROVED_GUARD,
        rejection_reason: 'product_already_has_approved_image',
      },
    }
  }

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
      outcome: OUTCOME.FAILED_UPLOAD,
      searched: true,
      found: true,
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      row: {
        ...baseRow,
        outcome: OUTCOME.FAILED_UPLOAD,
        rejection_reason: error.message,
      },
    }
  }

  const metadata = buildSuggestedImageMetadata({
    imageUrl: uploaded.publicUrl,
    storagePath: uploaded.storagePath,
    sourceUrl: entry.candidate.sourceUrl ?? entry.candidate.imageUrl,
    confidence: entry.score,
    product,
    scoreResult: entry,
    failureReason: 'pending_manual_image_review',
  })

  // Force pending — never auto-approve from this script.
  metadata.image_status = EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
  if (!metadata.image_failure_reason) {
    metadata.image_failure_reason = 'pending_manual_image_review'
  }

  try {
    await savePendingImageMetadata(supabase, product.id, metadata)
  } catch (error) {
    return {
      outcome: OUTCOME.FAILED_MAPPING,
      searched: true,
      found: true,
      confidence: bucket,
      serpApiCalls: search.serpApiCalls,
      row: {
        ...baseRow,
        outcome: OUTCOME.FAILED_MAPPING,
        storage_path: uploaded.storagePath,
        rejection_reason: error.message,
      },
    }
  }

  return {
    outcome: foundOutcome,
    searched: true,
    found: true,
    confidence: bucket,
    serpApiCalls: search.serpApiCalls,
    saved: true,
    imageKey: normalizeImageDedupeKey(entry.candidate?.imageUrl || best.candidate?.imageUrl),
    row: {
      ...baseRow,
      outcome: foundOutcome,
      storage_path: uploaded.storagePath,
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
      saved_as_pending: true,
    },
  }
}

function buildMarkdownReport(report) {
  const s = report.summary
  const lines = [
    '# Missing product images from CSV',
    '',
    `- Generated: ${report.generated_at}`,
    `- Mode: ${report.mode}`,
    `- CSV: \`${report.csv}\``,
    report.brand_filter ? `- Brand filter: ${report.brand_filter}` : null,
    report.limit != null ? `- Limit: ${report.limit}` : null,
    report.resume ? '- Resume: yes' : null,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Products processed | ${s.products_processed} |`,
    `| Skipped (already had image) | ${s.skipped_already_had_image} |`,
    `| Searched | ${s.searched} |`,
    `| Images found | ${s.images_found} |`,
    `| High confidence | ${s.high_confidence} |`,
    `| Medium confidence | ${s.medium_confidence} |`,
    `| Low confidence | ${s.low_confidence} |`,
    `| Failed | ${s.failed} |`,
    `| Pending candidates saved | ${s.pending_candidates_saved} |`,
    `| SerpAPI calls | ${s.serp_api_calls} |`,
    '',
    '## Outcomes',
    '',
  ].filter((line) => line != null)

  for (const [outcome, count] of Object.entries(s.by_outcome).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${outcome}: ${count}`)
  }

  const foundRows = report.results.filter((row) => row.confidence_bucket)
  if (foundRows.length) {
    lines.push('', '## Sample found candidates', '')
    for (const row of foundRows.slice(0, 25)) {
      lines.push(
        `- **${row.canonical_product_name}** (${row.confidence_bucket})`
        + ` — score ${row.candidate_score ?? 'n/a'}`
        + ` — ${row.candidate_domain || 'unknown domain'}`
        + ` — phase ${row.search_phase || 'n/a'}`,
      )
    }
  }

  const failedRows = report.results.filter((row) => String(row.outcome || '').startsWith('failed'))
  if (failedRows.length) {
    lines.push('', '## Failures', '')
    for (const row of failedRows.slice(0, 40)) {
      lines.push(
        `- ${row.canonical_product_name || row.product_id}: ${row.outcome}`
        + (row.rejection_reason ? ` (${row.rejection_reason})` : ''),
      )
    }
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const serpApiKey = env.SERPAPI_API_KEY
  const csvPath = resolve(process.cwd(), args.csv)

  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
  if (!serpApiKey) {
    throw new Error('Missing SERPAPI_API_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  ensureReportsDir()

  const { entries } = extractCsvProductIds(csvPath)
  const productsById = await fetchProductsByIds(supabase, entries.map((entry) => entry.product_id))
  const progress = args.resume ? loadProgress() : { completedIds: {} }

  const summary = emptySummary()
  const results = []
  const searchQueue = []
  let quotaStopped = false

  for (const entry of entries) {
    if (args.resume && progress.completedIds?.[entry.product_id]) {
      summary.products_processed += 1
      recordOutcome(summary, OUTCOME.SKIPPED_RESUME)
      results.push({
        product_id: entry.product_id,
        outcome: OUTCOME.SKIPPED_RESUME,
        csv_line: entry.csv_line,
      })
      continue
    }

    if (args.brand) {
      const brandNeedle = args.brand.toLowerCase()
      const csvBrand = (entry.brand || '').toLowerCase()
      const product = productsById.get(entry.product_id)
      const dbBrand = String(product?.brand || '').toLowerCase()
      if (!csvBrand.includes(brandNeedle) && !dbBrand.includes(brandNeedle)) {
        summary.products_processed += 1
        recordOutcome(summary, OUTCOME.SKIPPED_BRAND)
        results.push({
          product_id: entry.product_id,
          outcome: OUTCOME.SKIPPED_BRAND,
          csv_line: entry.csv_line,
        })
        continue
      }
    }

    const product = productsById.get(entry.product_id)
    if (!product) {
      summary.products_processed += 1
      summary.failed += 1
      recordOutcome(summary, OUTCOME.SKIPPED_NOT_FOUND)
      results.push({
        product_id: entry.product_id,
        outcome: OUTCOME.SKIPPED_NOT_FOUND,
        csv_line: entry.csv_line,
        rejection_reason: 'product_id not found in equipment_products',
      })
      continue
    }

    if (productHasDisplayableImage(product)) {
      summary.products_processed += 1
      summary.skipped_already_had_image += 1
      recordOutcome(summary, OUTCOME.SKIPPED_APPROVED)
      results.push({
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        outcome: OUTCOME.SKIPPED_APPROVED,
      })
      continue
    }

    searchQueue.push({ entry, product })
  }

  const queue = args.limit != null ? searchQueue.slice(0, args.limit) : searchQueue
  const usedImageUrls = args.dedupeBatchImages ? new Map() : null

  console.log(`CSV products: ${entries.length}`)
  console.log(`Mode: ${args.apply ? 'apply (save pending candidates)' : 'dry-run (search + score only)'}`)
  console.log(`Search queue: ${queue.length}${args.limit != null ? ` (limit ${args.limit})` : ''}`)
  console.log(`Quality gates: minConfidence=${args.minConfidence} requireExact=${args.requireExact} manufacturerOnly=${args.manufacturerOnly} dedupeBatchImages=${args.dedupeBatchImages}`)

  for (const { entry, product } of queue) {
    summary.products_processed += 1

    let result
    try {
      result = await processProduct(product, {
        supabase,
        serpApiKey,
        dryRun: args.dryRun,
        maxQueries: args.maxQueries,
        minConfidence: args.minConfidence,
        requireExact: args.requireExact,
        manufacturerOnly: args.manufacturerOnly,
        usedImageUrls,
      })
    } catch (error) {
      if (error.quotaExhausted) {
        quotaStopped = true
        summary.failed += 1
        recordOutcome(summary, OUTCOME.QUOTA_STOPPED)
        results.push({
          product_id: product.id,
          brand: product.brand,
          canonical_product_name: product.canonical_product_name,
          outcome: OUTCOME.QUOTA_STOPPED,
          rejection_reason: error.message,
          csv_line: entry.csv_line,
        })
        console.error(`Quota exhausted at ${product.canonical_product_name}: ${error.message}`)
        break
      }
      throw error
    }

    if (result.imageKey && usedImageUrls && (result.saved || (args.dryRun && result.found && !String(result.outcome).startsWith('skipped_')))) {
      usedImageUrls.set(result.imageKey, product.canonical_product_name)
    }

    summary.serp_api_calls += Number(result.serpApiCalls || 0)
    if (result.searched) summary.searched += 1
    if (result.found && !String(result.outcome).startsWith('skipped_')) {
      summary.images_found += 1
      if (result.confidence === 'high') summary.high_confidence += 1
      else if (result.confidence === 'medium') summary.medium_confidence += 1
      else if (result.confidence === 'low') summary.low_confidence += 1
    }
    if (String(result.outcome).startsWith('failed')) summary.failed += 1
    if (result.saved) summary.pending_candidates_saved += 1
    recordOutcome(summary, result.outcome)
    results.push({ ...result.row, csv_line: entry.csv_line })

    progress.completedIds[product.id] = {
      outcome: result.outcome,
      confidence: result.confidence,
      at: new Date().toISOString(),
    }
    if (args.apply || args.resume) saveProgress(progress)

    console.log(
      `${result.outcome} | ${product.canonical_product_name}`
      + (result.confidence ? ` | ${result.confidence}` : ''),
    )

    if (args.delayMs > 0) await sleep(args.delayMs)
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    csv: csvPath,
    brand_filter: args.brand,
    limit: args.limit,
    resume: args.resume,
    min_confidence: args.minConfidence,
    require_exact: args.requireExact,
    manufacturer_only: args.manufacturerOnly,
    dedupe_batch_images: args.dedupeBatchImages,
    auto_approve: false,
    modifies_prices_years_content: false,
    quota_stopped: quotaStopped,
    summary,
    results,
  }

  writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(REPORT_MD_PATH, buildMarkdownReport(report))

  console.log('')
  console.log('Summary')
  console.log(`  products processed: ${summary.products_processed}`)
  console.log(`  skipped (already had image): ${summary.skipped_already_had_image}`)
  console.log(`  searched: ${summary.searched}`)
  console.log(`  images found: ${summary.images_found}`)
  console.log(`  high confidence: ${summary.high_confidence}`)
  console.log(`  medium confidence: ${summary.medium_confidence}`)
  console.log(`  low confidence: ${summary.low_confidence}`)
  console.log(`  failed: ${summary.failed}`)
  if (args.apply) {
    console.log(`  pending candidates saved: ${summary.pending_candidates_saved}`)
  }
  console.log(`Wrote ${REPORT_JSON_PATH}`)
  console.log(`Wrote ${REPORT_MD_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
