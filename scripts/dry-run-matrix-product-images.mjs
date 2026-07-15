#!/usr/bin/env node
/**
 * Matrix Fitness image backfill dry-run with strict family matching.
 *
 * Usage:
 *   node scripts/dry-run-matrix-product-images.mjs
 *   node scripts/dry-run-matrix-product-images.mjs --limit 100
 *   node scripts/dry-run-matrix-product-images.mjs --line "Ultra Series" --limit 100
 *   node scripts/dry-run-matrix-product-images.mjs --line "7xi" --limit 100
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildEquipmentProductImageSearchQueries,
  isProductEligibleForImageBackfill,
  rankAutoSuggestImageCandidates,
} from '../src/lib/equipmentProductImages.js'
import { productMatchesMatrixLineFilter } from '../src/lib/matrixProductImageSearch.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'original_base_price',
  'status',
  'image_url',
  'image_storage_path',
  'image_status',
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
  const args = { limit: 100, line: null }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--limit') {
      args.limit = Number(argv[index + 1] ?? 100)
      index += 1
    } else if (token === '--line') {
      args.line = argv[index + 1] ?? null
      index += 1
    }
  }
  return args
}

function productIsMissingImage(product) {
  return !product?.image_url || !product?.image_storage_path
}

async function fetchMatrixProducts(supabase) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .or('brand.ilike.Matrix,brand.ilike.Matrix Fitness')
    .eq('status', 'approved')
    .order('canonical_product_name')

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
    source: result.source,
    width: result.original_width,
    height: result.original_height,
  }))
}

async function searchCandidatesForProduct(product, serpApiKey) {
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

  return { queries, candidates: [...byImageUrl.values()] }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const serpApiKey = env.SERPAPI_API_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials in .env.local')
  }
  if (!serpApiKey) {
    throw new Error('Missing SERPAPI_API_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchMatrixProducts(supabase)
  const lineFiltered = args.line
    ? products.filter((product) => productMatchesMatrixLineFilter(product, args.line))
    : products
  const missing = lineFiltered.filter(productIsMissingImage)
  const eligible = missing
    .filter((product) => isProductEligibleForImageBackfill(product, {
      completeOnly: false,
      approvedOnly: true,
      force: false,
    }))
    .slice(0, args.limit)

  const summary = {
    matrixProducts: products.length,
    lineFilteredProducts: lineFiltered.length,
    missingImages: missing.length,
    eligibleForBackfill: eligible.length,
    candidatesFound: 0,
    highConfidence: 0,
    suggested: 0,
    needsReview: 0,
    noCandidate: 0,
  }

  const samples = []

  console.log('Matrix Fitness image dry-run (no database writes)')
  console.log('')
  console.log(`Matrix approved products: ${summary.matrixProducts}`)
  if (args.line) console.log(`Line filter "${args.line}": ${summary.lineFilteredProducts} products`)
  console.log(`Missing images: ${summary.missingImages}`)
  console.log(`Eligible for backfill this run: ${summary.eligibleForBackfill}`)
  console.log('')

  for (const product of eligible) {
    const { queries, candidates } = await searchCandidatesForProduct(product, serpApiKey)
    const ranked = rankAutoSuggestImageCandidates(candidates, product)
    const best = ranked[0] ?? null

    if (!best) {
      summary.noCandidate += 1
      continue
    }

    summary.candidatesFound += 1
    const band = best.confidenceBand ?? 'needs_review'
    if (band === 'high_confidence') summary.highConfidence += 1
    else if (band === 'suggested') summary.suggested += 1
    else summary.needsReview += 1

    if (samples.length < 20) {
      samples.push({
        productName: product.canonical_product_name,
        searchQuery: best.candidate.searchQuery ?? queries[0],
        searchQueries: queries,
        sourceDomain: best.domain ?? '—',
        imageUrl: best.candidate.imageUrl ?? '—',
        confidence: best.score,
        reviewStatus: band,
        productFamily: best.productFamily ?? '—',
        reasons: (best.reasons ?? []).join('; ') || '—',
        warnings: (best.warnings ?? []).join('; ') || '—',
      })
    }
  }

  console.log('Summary')
  console.log(`Candidates found: ${summary.candidatesFound}`)
  console.log(`High confidence: ${summary.highConfidence}`)
  console.log(`Suggested: ${summary.suggested}`)
  console.log(`Needs review: ${summary.needsReview}`)
  console.log(`No candidate: ${summary.noCandidate}`)
  console.log('')
  console.log('Sample proposed matches (up to 20)')
  for (const sample of samples) {
    console.log('—')
    console.log(`Product: ${sample.productName}`)
    console.log(`Search query: ${sample.searchQuery}`)
    console.log(`All queries: ${sample.searchQueries.join(' | ')}`)
    console.log(`Source domain: ${sample.sourceDomain}`)
    console.log(`Image URL: ${sample.imageUrl}`)
    console.log(`Confidence: ${sample.confidence}`)
    console.log(`Review status: ${sample.reviewStatus}`)
    console.log(`Product family: ${sample.productFamily}`)
    console.log(`Reasons: ${sample.reasons}`)
    console.log(`Warnings: ${sample.warnings}`)
  }

  console.log('')
  console.log('Dry-run complete. No images were saved. Re-run backfill with --apply after review.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
