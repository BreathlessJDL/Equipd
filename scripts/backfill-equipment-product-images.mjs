#!/usr/bin/env node
/**
 * Backfill hero images for approved equipment_products.
 *
 * Usage:
 *   node scripts/backfill-equipment-product-images.mjs --brand "Technogym" --complete-only --limit 20 --dry-run
 *   node scripts/backfill-equipment-product-images.mjs --brand "Technogym" --complete-only --limit 20 --apply
 *   node scripts/backfill-equipment-product-images.mjs --brand "Life Fitness" --missing-only --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildEquipmentProductImageSearchQueries,
  buildEquipmentProductImageStoragePath,
  buildEquipmentProductImageImportMetadata,
  buildSuggestedImageMetadata,
  downloadFirstAvailableImageCandidate,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  isProductEligibleForImageBackfill,
  rankAutoSuggestImageCandidates,
  rankImageSearchCandidates,
  summarizeImageCandidateFailures,
} from '../src/lib/equipmentProductImages.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'model',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'original_base_price',
  'original_base_price_currency',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
].join(', ')

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: null,
    completeOnly: false,
    approvedOnly: true,
    limit: 50,
    dryRun: true,
    force: false,
    missingOnly: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--complete-only') args.completeOnly = true
    else if (token === '--approved-only') args.approvedOnly = true
    else if (token === '--force') args.force = true
    else if (token === '--missing-only') args.missingOnly = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1] ?? 50)
      index += 1
    }
  }

  return args
}

function productIsMissingImage(product) {
  return !product?.image_url || !product?.image_storage_path
}

async function fetchProducts(supabase, brandFilter) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('canonical_product_name')

  if (brandFilter) {
    query = query.ilike('brand', brandFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function searchImageCandidates(query, serpApiKey) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_images')
  url.searchParams.set('q', query)
  url.searchParams.set('ijn', '0')
  url.searchParams.set('api_key', serpApiKey)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`SerpAPI image search failed (${response.status})`)
  }

  const payload = await response.json()
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

async function uploadImage(supabase, product, buffer, contentType, extension) {
  const storagePath = buildEquipmentProductImageStoragePath(product, extension)
  const { error } = await supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
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

function logCandidateFailure(productName, failure) {
  console.warn([
    `  candidate failed | ${productName}`,
    failure.imageUrl ?? 'unknown',
    failure.reason,
  ].join(' | '))
}

async function searchImageCandidatesForProduct(product, serpApiKey) {
  const queries = buildEquipmentProductImageSearchQueries(product)
  const byImageUrl = new Map()

  for (const query of queries) {
    const candidates = await searchImageCandidates(query, serpApiKey)
    for (const candidate of candidates) {
      const key = candidate.imageUrl || candidate.sourceUrl
      if (!key || byImageUrl.has(key)) continue
      byImageUrl.set(key, { ...candidate, searchQuery: query })
    }
  }

  return [...byImageUrl.values()]
}

async function processProduct(product, { supabase, serpApiKey, dryRun }) {
  const queries = buildEquipmentProductImageSearchQueries(product)
  const candidates = await searchImageCandidatesForProduct(product, serpApiKey)
  const ranked = rankAutoSuggestImageCandidates(candidates, product)

  if (!ranked.length) {
    const metadata = buildSuggestedImageMetadata({
      imageUrl: null,
      storagePath: null,
      sourceUrl: null,
      confidence: 0,
      failureReason: 'no_allowlisted_image_candidate',
      product,
    })
    if (!dryRun) {
      await saveImageMetadata(supabase, product.id, metadata)
    }
    return { product, status: 'failed', reason: metadata.image_failure_reason, failures: [] }
  }

  if (dryRun) {
    const best = ranked[0]
    return {
      product,
      status: 'dry-run',
      reason: null,
      queries,
      candidate: {
        score: best.score,
        sourceUrl: best.candidate.sourceUrl,
        imageUrl: best.candidate.imageUrl,
        domain: best.domain,
        searchQuery: best.candidate.searchQuery ?? queries[0],
        candidateCount: ranked.length,
        confidenceBand: best.confidenceBand ?? null,
        warnings: best.warnings ?? [],
        reasons: best.reasons ?? [],
        productLine: best.productLine ?? null,
      },
      failures: [],
    }
  }

  const downloadResult = await downloadFirstAvailableImageCandidate(ranked, {
    onCandidateFailure: (failure) => logCandidateFailure(product.canonical_product_name, failure),
  })

  if (!downloadResult.downloaded || !downloadResult.entry) {
    const failureReason = summarizeImageCandidateFailures(downloadResult.failures)
    const metadata = buildSuggestedImageMetadata({
      imageUrl: null,
      storagePath: null,
      sourceUrl: null,
      confidence: 0,
      failureReason,
    })
    await saveImageMetadata(supabase, product.id, metadata)
    return {
      product,
      status: 'failed',
      reason: failureReason,
      failures: downloadResult.failures,
    }
  }

  const { entry, downloaded } = downloadResult
  const uploaded = await uploadImage(
    supabase,
    product,
    downloaded.buffer,
    downloaded.contentType,
    downloaded.extension,
  )

  const metadata = buildEquipmentProductImageImportMetadata({
    imageUrl: uploaded.publicUrl,
    storagePath: uploaded.storagePath,
    sourceUrl: entry.candidate.sourceUrl ?? entry.candidate.imageUrl,
    confidence: entry.score,
    product,
    scoreResult: entry,
  })

  await saveImageMetadata(supabase, product.id, metadata)

  return {
    product,
    status: metadata.image_status,
    reason: null,
    failures: downloadResult.failures,
    candidate: {
      score: entry.score,
      sourceUrl: metadata.image_source_url,
      imageUrl: metadata.image_url,
      domain: metadata.image_source_domain,
      downloadAttempt: downloaded.attempt,
      skippedCandidates: downloadResult.failures.length,
    },
  }
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
  if (!serpApiKey) {
    throw new Error('Missing SERPAPI_API_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchProducts(supabase, args.brand)
  const missingOnlySkipped = args.missingOnly
    ? products.filter((product) => !productIsMissingImage(product))
    : []
  const missingOnlyCandidates = args.missingOnly
    ? products.filter((product) => productIsMissingImage(product))
    : products
  const eligible = missingOnlyCandidates
    .filter((product) => isProductEligibleForImageBackfill(product, {
      completeOnly: args.completeOnly,
      approvedOnly: args.approvedOnly,
      force: args.force,
    }))
    .slice(0, args.limit)

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  if (args.missingOnly) console.log('Filter: missing-only (image_url or image_storage_path is null)')
  console.log(`Loaded ${products.length} products, ${eligible.length} eligible (limit ${args.limit})`)
  if (args.missingOnly) {
    console.log(`Skipped ${missingOnlySkipped.length} products that already have image_url and image_storage_path`)
  }

  const summary = {
    processed: 0,
    suggested: 0,
    approved: 0,
    failed: 0,
    dryRun: 0,
    productsChecked: products.length,
    alreadyHadImage: missingOnlySkipped.length,
    imagesFound: 0,
    imagesMissing: 0,
    failedDownloads: 0,
  }

  for (const product of eligible) {
    summary.processed += 1
    try {
      const result = await processProduct(product, {
        supabase,
        serpApiKey,
        dryRun: args.dryRun,
      })

      if (result.status === 'suggested') summary.suggested += 1
      if (result.status === 'approved') summary.approved += 1
      if (result.status === 'failed' || result.status === 'rejected') summary.failed += 1
      if (result.status === 'dry-run') summary.dryRun += 1

      if (result.status === 'suggested' || result.status === 'approved' || result.status === 'dry-run') {
        summary.imagesFound += 1
      } else if (result.reason === 'no_allowlisted_image_candidate') {
        summary.imagesMissing += 1
      } else if (result.failures?.length || (result.reason && result.reason !== 'no_allowlisted_image_candidate')) {
        summary.failedDownloads += 1
      } else {
        summary.imagesMissing += 1
      }

      console.log([
        product.canonical_product_name,
        result.status,
        result.candidate?.domain ?? '—',
        result.candidate?.score ?? '—',
        result.candidate?.skippedCandidates != null ? `skipped=${result.candidate.skippedCandidates}` : '',
        result.reason ?? '',
      ].filter(Boolean).join(' | '))
    } catch (error) {
      summary.failed += 1
      summary.failedDownloads += 1
      const metadata = buildSuggestedImageMetadata({
        imageUrl: null,
        storagePath: null,
        sourceUrl: null,
        confidence: 0,
        failureReason: error.message,
      })
      if (!args.dryRun) {
        await saveImageMetadata(supabase, product.id, metadata)
      }
      console.error(`FAILED ${product.canonical_product_name}: ${error.message}`)
    }
  }

  if (args.missingOnly) {
    console.log('Summary:')
    console.log(`Products checked: ${summary.productsChecked}`)
    console.log(`Already had image: ${summary.alreadyHadImage}`)
    console.log(`Images found: ${summary.imagesFound}`)
    console.log(`Images missing: ${summary.imagesMissing}`)
    console.log(`Failed downloads: ${summary.failedDownloads}`)
  } else {
    console.log('Summary:', summary)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
