#!/usr/bin/env node
/**
 * Regenerate approved product content for a selected brand.
 *
 * Only regenerates rows that already have approved content.
 * Does not change images, pricing, or product identity fields.
 * After successful generation, re-publishes as approved so live pages stay current.
 *
 * Usage:
 *   node scripts/regenerate-approved-product-content-by-brand.mjs --brand "ProForm" --dry-run
 *   node scripts/regenerate-approved-product-content-by-brand.mjs --brand "Sole" --limit 20 --apply
 *   node scripts/regenerate-approved-product-content-by-brand.mjs --brand "Horizon Fitness" --apply
 *   node scripts/regenerate-approved-product-content-by-brand.mjs --brand "York Fitness" --apply --print-generated
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildProductContentSourceHash,
  buildProductContentSourcePayload,
  buildProductContentUpsertRow,
  DEFAULT_CONTENT_AI_MODEL,
  EQUIPMENT_PRODUCT_CONTENT_STATUS,
  generateProductContentWithOpenAI,
} from '../src/lib/equipmentProductContent.js'
import { resolveProductContentUsageSegment } from '../src/lib/equipmentProductContentUsage.js'

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

const CONSOLE_FIELDS = [
  'product_id',
  'console_name',
  'tier',
  'release_year',
  'retired_year',
  'modifier_percent',
  'is_active',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'category',
  'manufacture_year',
  'original_rrp',
  'currency',
].join(', ')

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: null,
    productIds: [],
    limit: null,
    delayMs: 250,
    dryRun: true,
    apply: false,
    printGenerated: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--product-id') {
      args.productIds.push(argv[index + 1])
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1])
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 250)
      index += 1
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--print-generated') {
      args.printGenerated = true
    }
  }

  if (!args.brand && !args.productIds.length) {
    throw new Error('Required: --brand "ProForm" and/or one or more --product-id UUID')
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchBrandProducts(supabase, brand, limit, productIds = []) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .eq('status', 'approved')
    .order('canonical_product_name')

  if (productIds.length) {
    query = query.in('id', productIds)
  } else if (brand) {
    query = query.ilike('brand', brand)
  }

  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit * 3)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function fetchApprovedContentByProductIds(supabase, productIds) {
  if (!productIds.length) return new Map()
  const rows = []
  for (let index = 0; index < productIds.length; index += 100) {
    const chunk = productIds.slice(index, index + 100)
    const { data, error } = await supabase
      .from('equipment_product_content')
      .select('equipment_product_id, overview_text, generation_status, version, approved_at, seo_title, seo_meta_description, faq_json, source_data_hash, ai_model, generated_at, error_message')
      .in('equipment_product_id', chunk)
      .eq('generation_status', EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED)
    if (error) throw error
    rows.push(...(data ?? []))
  }
  return new Map(rows.map((row) => [row.equipment_product_id, row]))
}

async function fetchConsoleOptions(supabase, productIds) {
  if (!productIds.length) return new Map()
  const rows = []
  for (let index = 0; index < productIds.length; index += 100) {
    const chunk = productIds.slice(index, index + 100)
    const { data, error } = await supabase
      .from('product_console_options')
      .select(CONSOLE_FIELDS)
      .in('product_id', chunk)
      .eq('is_active', true)
    if (error) throw error
    rows.push(...(data ?? []))
  }
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.product_id)) map.set(row.product_id, [])
    map.get(row.product_id).push(row)
  }
  return map
}

async function fetchIntelligenceRows(supabase, intelligenceIds) {
  if (!intelligenceIds.length) return new Map()
  const rows = []
  for (let index = 0; index < intelligenceIds.length; index += 100) {
    const chunk = intelligenceIds.slice(index, index + 100)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_FIELDS)
      .in('id', chunk)
    if (error) throw error
    rows.push(...(data ?? []))
  }
  return new Map(rows.map((row) => [row.id, row]))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = { ...process.env, ...loadEnv() }
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const apiKey = env.OPENAI_API_KEY
  const model = env.OPENAI_MODEL || DEFAULT_CONTENT_AI_MODEL

  if (!url || !key) throw new Error('Missing Supabase URL / service role key in .env.local')
  if (args.apply && !apiKey) throw new Error('OPENAI_API_KEY required for --apply')

  const supabase = createClient(url, key)
  const brandProducts = await fetchBrandProducts(
    supabase,
    args.brand,
    args.limit,
    args.productIds,
  )
  const contentById = await fetchApprovedContentByProductIds(
    supabase,
    brandProducts.map((product) => product.id),
  )

  let products = brandProducts.filter((product) => contentById.has(product.id))
  if (Number.isFinite(args.limit) && args.limit > 0) {
    products = products.slice(0, args.limit)
  }

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    brand: args.brand,
    product_ids: args.productIds.length ? args.productIds : undefined,
    approved_products_for_brand: brandProducts.length,
    approved_content_to_regenerate: products.length,
  }, null, 2))

  if (!products.length) {
    console.log('No approved content rows found for brand.')
    return
  }

  const productIds = products.map((product) => product.id)
  const consoleByProductId = await fetchConsoleOptions(supabase, productIds)
  const intelligenceIds = [...new Set(products.flatMap((product) => (
    product.source_intelligence_row_ids ?? []
  )))]
  const intelligenceById = await fetchIntelligenceRows(supabase, intelligenceIds)

  const summary = {
    brand: args.brand,
    considered: products.length,
    updated: 0,
    failed: 0,
    validation_failures: [],
    before_after: [],
  }

  for (const product of products) {
    const existing = contentById.get(product.id) ?? null
    const intelligenceRows = (product.source_intelligence_row_ids ?? [])
      .map((id) => intelligenceById.get(id))
      .filter(Boolean)
    const sourcePayload = buildProductContentSourcePayload(product, {
      consoleOptions: consoleByProductId.get(product.id) ?? [],
      intelligenceRows,
    })
    const sourceHash = buildProductContentSourceHash(sourcePayload)
    const usageSegment = resolveProductContentUsageSegment(product)

    console.log(`\n→ ${product.canonical_product_name} [${usageSegment}]`)

    if (args.dryRun) {
      if (summary.before_after.length < 8) {
        summary.before_after.push({
          id: product.id,
          name: product.canonical_product_name,
          usage_segment: usageSegment,
          before_excerpt: String(existing?.overview_text ?? '').slice(0, 160),
          action: 'would_regenerate',
        })
      }
      continue
    }

    try {
      const generated = await generateProductContentWithOpenAI({
        apiKey,
        model,
        sourcePayload,
      })

      const upsertRow = buildProductContentUpsertRow({
        productId: product.id,
        existingContent: existing,
        sourceHash,
        generated,
      })

      // Re-publish immediately so live pages keep approved content with corrected wording.
      upsertRow.generation_status = EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED
      upsertRow.approved_at = new Date().toISOString()
      upsertRow.error_message = null

      const { error } = await supabase
        .from('equipment_product_content')
        .upsert(upsertRow, { onConflict: 'equipment_product_id' })

      if (error) throw error

      summary.updated += 1
      if (summary.before_after.length < 8) {
        summary.before_after.push({
          id: product.id,
          name: product.canonical_product_name,
          usage_segment: usageSegment,
          before_excerpt: String(existing?.overview_text ?? '').slice(0, 180),
          after_excerpt: String(generated.overview_text ?? '').slice(0, 180),
        })
      }

      if (args.printGenerated) {
        console.log(generated.overview_text)
      } else {
        console.log('  updated + re-approved')
      }
    } catch (error) {
      summary.failed += 1
      summary.validation_failures.push({
        id: product.id,
        name: product.canonical_product_name,
        usage_segment: usageSegment,
        error: error?.message || String(error),
      })
      console.error(`  FAILED: ${error?.message || error}`)
    }

    if (args.delayMs > 0) await sleep(args.delayMs)
  }

  console.log('\n=== regeneration report ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
