#!/usr/bin/env node
/**
 * Generate missing product content drafts (idempotent).
 *
 * Dry-run (default):
 *   node scripts/generate-missing-product-content.mjs --brand "Peloton"
 *   node scripts/generate-missing-product-content.mjs --all
 *
 * Apply:
 *   node scripts/generate-missing-product-content.mjs --brand "Peloton" --apply
 *   node scripts/generate-missing-product-content.mjs --all --apply
 *
 * Options:
 *   --brand "Name"
 *   --status pending|needs_review|approved
 *   --limit N
 *   --product-id UUID
 *   --retry-failed   (alias: include failed content as missing)
 *   --concurrency N  (default 3; sequential OpenAI within worker pool)
 *   --dry-run | --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildProductContentSourceHash,
  buildProductContentSourcePayload,
  buildProductContentUpsertRow,
  DEFAULT_CONTENT_AI_MODEL,
  EQUIPMENT_PRODUCT_CONTENT_FIELDS,
  generateProductContentWithOpenAI,
} from '../src/lib/equipmentProductContent.js'
import {
  buildGenerateMissingPreview,
  chunkProductIds,
  emptyGenerateMissingProgress,
  applyGenerateMissingStepResult,
  evaluateMissingDraftGenerationEligibility,
  GENERATE_MISSING_DEFAULT_CONCURRENCY,
  GENERATE_MISSING_MAX_PER_STEP,
  summarizeGenerateMissingRun,
} from '../src/lib/equipmentProductContentGenerateMissing.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
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
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^["']|["']$/g, '')
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: null,
    status: null,
    productId: null,
    all: false,
    limit: null,
    dryRun: true,
    concurrency: GENERATE_MISSING_DEFAULT_CONCURRENCY,
    delayMs: 250,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--all') args.all = true
    else if (token === '--retry-failed') { /* failed already included via eligibility */ }
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--status') {
      args.status = argv[index + 1] ?? null
      index += 1
    } else if (token === '--product-id') {
      args.productId = argv[index + 1] ?? null
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1] ?? 0) || null
      index += 1
    } else if (token === '--concurrency') {
      args.concurrency = Math.max(1, Math.min(5, Number(argv[index + 1] ?? 3) || 3))
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 250)
      index += 1
    }
  }

  if (!args.all && !args.brand && !args.productId) {
    throw new Error('Provide --brand "Name", --product-id, or --all')
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchProducts(supabase, args) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('brand')
    .order('canonical_product_name')

  if (args.brand) query = query.ilike('brand', args.brand)
  if (args.productId) query = query.eq('id', args.productId)
  if (args.status) query = query.eq('status', args.status)
  else query = query.in('status', ['pending', 'needs_review', 'approved'])

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function fetchContentMap(supabase, productIds) {
  const map = {}
  const pageSize = 80
  for (let index = 0; index < productIds.length; index += pageSize) {
    const chunk = productIds.slice(index, index + pageSize)
    const { data, error } = await supabase
      .from('equipment_product_content')
      .select(EQUIPMENT_PRODUCT_CONTENT_FIELDS)
      .in('equipment_product_id', chunk)
    if (error) throw error
    for (const row of data ?? []) map[row.equipment_product_id] = row
  }
  return map
}

async function fetchConsoleMap(supabase, productIds) {
  const map = new Map()
  const pageSize = 80
  for (let index = 0; index < productIds.length; index += pageSize) {
    const chunk = productIds.slice(index, index + pageSize)
    const { data, error } = await supabase
      .from('product_console_options')
      .select('product_id,console_name,tier,release_year,retired_year,modifier_percent,is_active')
      .in('product_id', chunk)
      .eq('is_active', true)
    if (error) throw error
    for (const row of data ?? []) {
      if (!map.has(row.product_id)) map.set(row.product_id, [])
      map.get(row.product_id).push(row)
    }
  }
  return map
}

async function fetchIntelligenceMap(supabase, products) {
  const ids = [...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? []))]
  const map = new Map()
  const pageSize = 80
  for (let index = 0; index < ids.length; index += pageSize) {
    const chunk = ids.slice(index, index + pageSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select('id,brand,series,model,equipment_type,category,manufacture_year,original_rrp,currency')
      .in('id', chunk)
    if (error) throw error
    for (const row of data ?? []) map.set(row.id, row)
  }
  return map
}

async function recheckAndGenerate(supabase, {
  product,
  openAiKey,
  openAiModel,
  consoleByProductId,
  intelligenceById,
}) {
  const { data: freshProduct, error: productError } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .eq('id', product.id)
    .maybeSingle()
  if (productError) throw productError
  if (!freshProduct) {
    return { status: 'failed', product_id: product.id, name: product.canonical_product_name, reason: 'product_missing' }
  }

  const { data: freshContent, error: contentError } = await supabase
    .from('equipment_product_content')
    .select(EQUIPMENT_PRODUCT_CONTENT_FIELDS)
    .eq('equipment_product_id', product.id)
    .maybeSingle()
  if (contentError) throw contentError

  const decision = evaluateMissingDraftGenerationEligibility(freshProduct, freshContent)
  if (!decision.eligible) {
    return {
      status: 'skipped',
      product_id: product.id,
      name: freshProduct.canonical_product_name,
      reason: decision.reason,
      product_status: freshProduct.status,
    }
  }

  const intelligenceRows = (freshProduct.source_intelligence_row_ids ?? [])
    .map((id) => intelligenceById.get(id))
    .filter(Boolean)
  const sourcePayload = buildProductContentSourcePayload(freshProduct, {
    consoleOptions: consoleByProductId.get(freshProduct.id) ?? [],
    intelligenceRows,
  })
  const sourceHash = buildProductContentSourceHash(sourcePayload)

  try {
    const generated = await generateProductContentWithOpenAI({
      sourcePayload,
      apiKey: openAiKey,
      model: openAiModel,
    })
    const upsertRow = buildProductContentUpsertRow({
      productId: freshProduct.id,
      generated,
      sourceHash,
      existingContent: freshContent,
    })
    const { error: upsertError } = await supabase
      .from('equipment_product_content')
      .upsert(upsertRow, { onConflict: 'equipment_product_id' })
    if (upsertError) throw upsertError

    return {
      status: 'created',
      product_id: product.id,
      name: freshProduct.canonical_product_name,
      reason: decision.reason,
      product_status: freshProduct.status,
    }
  } catch (error) {
    const failRow = buildProductContentUpsertRow({
      productId: freshProduct.id,
      generated: null,
      sourceHash,
      existingContent: freshContent,
      errorMessage: error?.message || String(error),
    })
    await supabase
      .from('equipment_product_content')
      .upsert(failRow, { onConflict: 'equipment_product_id' })
    return {
      status: 'failed',
      product_id: product.id,
      name: freshProduct.canonical_product_name,
      reason: error?.message || String(error),
      product_status: freshProduct.status,
    }
  }
}

async function mapPool(items, concurrency, mapper) {
  const results = []
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await mapper(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchProducts(supabase, args)
  const contentByProductId = await fetchContentMap(supabase, products.map((p) => p.id))
  let preview = buildGenerateMissingPreview({ products, contentByProductId })

  if (args.limit != null && args.limit > 0) {
    preview = {
      ...preview,
      eligible_product_ids: preview.eligible_product_ids.slice(0, args.limit),
      eligible: Math.min(preview.eligible, args.limit),
      estimated_batches: Math.ceil(Math.min(preview.eligible, args.limit) / GENERATE_MISSING_MAX_PER_STEP),
    }
  }

  console.log(JSON.stringify({
    mode: args.dryRun ? 'dry-run' : 'apply',
    brand: args.brand,
    status: args.status,
    preview: {
      considered: preview.considered,
      eligible: preview.eligible,
      skipped_draft: preview.skipped_draft,
      skipped_approved: preview.skipped_approved,
      invalid: preview.invalid,
      brands_affected: preview.brands_affected,
      eligible_by_brand: preview.eligible_by_brand,
      estimated_batches: preview.estimated_batches,
      samples: preview.samples,
    },
  }, null, 2))

  if (args.dryRun) {
    console.log('\nDry-run only. Pass --apply to generate drafts.')
    return
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required in .env.local when using --apply')
  }

  const eligibleIds = new Set(preview.eligible_product_ids)
  const eligibleProducts = products.filter((product) => eligibleIds.has(product.id))
  const consoleByProductId = await fetchConsoleMap(supabase, eligibleProducts.map((p) => p.id))
  const intelligenceById = await fetchIntelligenceMap(supabase, eligibleProducts)

  let progress = emptyGenerateMissingProgress(eligibleProducts.length)
  const chunks = chunkProductIds(
    eligibleProducts.map((product) => product.id),
    GENERATE_MISSING_MAX_PER_STEP,
  )

  for (const chunk of chunks) {
    const chunkProducts = eligibleProducts.filter((product) => chunk.includes(product.id))
    const results = await mapPool(chunkProducts, args.concurrency, async (product) => {
      const result = await recheckAndGenerate(supabase, {
        product,
        openAiKey: env.OPENAI_API_KEY,
        openAiModel: env.OPENAI_MODEL || DEFAULT_CONTENT_AI_MODEL,
        consoleByProductId,
        intelligenceById,
      })
      await sleep(args.delayMs)
      return result
    })

    const step = {
      created: results.filter((row) => row.status === 'created').length,
      skipped: results.filter((row) => row.status === 'skipped').length,
      failed: results.filter((row) => row.status === 'failed').length,
      failures: results
        .filter((row) => row.status === 'failed')
        .map((row) => ({
          product_id: row.product_id,
          name: row.name,
          reason: row.reason,
        })),
    }
    progress = applyGenerateMissingStepResult(progress, step)
    console.log(
      `Progress: created=${progress.created} skipped=${progress.skipped} failed=${progress.failed} completed=${progress.completed}/${progress.total}`,
    )
  }

  console.log(JSON.stringify({
    summary: summarizeGenerateMissingRun({ preview, progress }),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
