#!/usr/bin/env node
/**
 * Regenerate approved content for Life Fitness HOME and Matrix HOME products only.
 *
 * Uses home-use usage_segment (via parseLifeFitnessHomeIdentity / parseMatrixHomeIdentity).
 * Does not touch commercial Integrity/Elevation/digit/modern products, images, or pricing.
 *
 * Usage:
 *   node scripts/regenerate-lf-matrix-home-product-content.mjs --dry-run
 *   node scripts/regenerate-lf-matrix-home-product-content.mjs --apply
 *   node scripts/regenerate-lf-matrix-home-product-content.mjs --apply --limit 5
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
import { parseLifeFitnessHomeIdentity } from '../src/lib/lifeFitnessConsoleCompat.js'
import { parseMatrixHomeIdentity } from '../src/lib/matrixConsoleCompat.js'

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
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i).trim()] = v
  }
  return env
}

function parseArgs(argv) {
  const args = { dryRun: true, apply: false, limit: null, delayMs: 200, printGenerated: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1])
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 200)
      index += 1
    } else if (token === '--print-generated') {
      args.printGenerated = true
    }
  }
  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isHomeCatalogueProduct(product) {
  return Boolean(parseLifeFitnessHomeIdentity(product) || parseMatrixHomeIdentity(product))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = { ...process.env, ...loadEnv() }
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const apiKey = env.OPENAI_API_KEY
  const model = env.OPENAI_MODEL || DEFAULT_CONTENT_AI_MODEL

  if (!url || !key) throw new Error('Missing Supabase URL / service role key')
  if (args.apply && !apiKey) throw new Error('OPENAI_API_KEY required for --apply')

  const supabase = createClient(url, key)

  const { data: products, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .or('brand.eq.Life Fitness,brand.eq.Matrix,brand.eq.Matrix Fitness')
    .eq('status', 'approved')
    .order('canonical_product_name')
  if (error) throw error

  let homeProducts = (products ?? []).filter(isHomeCatalogueProduct)
  if (Number.isFinite(args.limit) && args.limit > 0) {
    homeProducts = homeProducts.slice(0, args.limit)
  }

  const productIds = homeProducts.map((p) => p.id)
  const contentById = new Map()
  for (let i = 0; i < productIds.length; i += 100) {
    const chunk = productIds.slice(i, i + 100)
    const { data: contentRows, error: contentError } = await supabase
      .from('equipment_product_content')
      .select('equipment_product_id, overview_text, generation_status, version, approved_at, seo_title, seo_meta_description, faq_json, source_data_hash, ai_model')
      .in('equipment_product_id', chunk)
    if (contentError) throw contentError
    for (const row of contentRows ?? []) {
      contentById.set(row.equipment_product_id, row)
    }
  }

  // Home LF/Matrix rows were left as drafts with commercial wording — regenerate all existing content rows.
  const toRegen = homeProducts.filter((p) => contentById.has(p.id))

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    home_products_found: homeProducts.length,
    content_rows_to_regenerate: toRegen.length,
    by_status: toRegen.reduce((acc, product) => {
      const status = contentById.get(product.id)?.generation_status || 'missing'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {}),
  }, null, 2))

  const summary = {
    considered: toRegen.length,
    updated: 0,
    failed: 0,
    validation_failures: [],
    before_after: [],
    why_not_run_previously: [
      'Earlier home regen only covered ProForm/Sole/Horizon/York/Reebok/Schwinn/WaterRower/BH/Powertec/REP/Spirit.',
      'Life Fitness and Matrix were treated as commercial brands, so home catalogue rows kept commercial wording.',
      'LF/Matrix home content existed as drafts (not approved), so approved-only regen skipped them.',
      'usage_segment now resolves HOME via parseLifeFitnessHomeIdentity / parseMatrixHomeIdentity.',
    ],
  }

  for (const product of toRegen) {
    const existing = contentById.get(product.id)
    const identity = parseLifeFitnessHomeIdentity(product) || parseMatrixHomeIdentity(product)
    const sourcePayload = buildProductContentSourcePayload(product, {
      consoleOptions: [],
      intelligenceRows: [],
    })
    const usageSegment = resolveProductContentUsageSegment(product)
    const sourceHash = buildProductContentSourceHash(sourcePayload)

    console.log(`\n→ ${product.canonical_product_name} [${usageSegment}/${identity?.base || identity?.kind}]`)

    if (args.dryRun) {
      if (summary.before_after.length < 6) {
        summary.before_after.push({
          brand: product.brand,
          name: product.canonical_product_name,
          usage_segment: usageSegment,
          before_excerpt: String(existing?.overview_text ?? '').slice(0, 200),
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
      upsertRow.generation_status = EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED
      upsertRow.approved_at = new Date().toISOString()
      upsertRow.error_message = null

      const { error: upsertError } = await supabase
        .from('equipment_product_content')
        .upsert(upsertRow, { onConflict: 'equipment_product_id' })
      if (upsertError) throw upsertError

      summary.updated += 1
      if (summary.before_after.length < 6) {
        summary.before_after.push({
          brand: product.brand,
          name: product.canonical_product_name,
          usage_segment: usageSegment,
          before_excerpt: String(existing?.overview_text ?? '').slice(0, 220),
          after_excerpt: String(generated.overview_text ?? '').slice(0, 220),
        })
      }
      if (args.printGenerated) console.log(generated.overview_text)
      else console.log('  updated + re-approved')
    } catch (err) {
      summary.failed += 1
      summary.validation_failures.push({
        name: product.canonical_product_name,
        error: err?.message || String(err),
      })
      console.error(`  FAILED: ${err?.message || err}`)
    }

    if (args.delayMs > 0) await sleep(args.delayMs)
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    args.apply ? 'lf-matrix-home-content-regen-apply.json' : 'lf-matrix-home-content-regen-dry-run.json',
  )
  writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.log('\n=== regeneration report ===')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Wrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
