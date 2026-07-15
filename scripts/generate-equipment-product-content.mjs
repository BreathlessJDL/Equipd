#!/usr/bin/env node
/**
 * Batch-generate AI overview and SEO content for canonical equipment products.
 *
 * Usage:
 *   node scripts/generate-equipment-product-content.mjs --limit 50 --missing-only --dry-run
 *   node scripts/generate-equipment-product-content.mjs --limit 1000 --missing-only --apply
 *   node scripts/generate-equipment-product-content.mjs --brand "Life Fitness" --limit 100 --apply
 *   node scripts/generate-equipment-product-content.mjs --product-id PRODUCT_ID --apply
 *   node scripts/generate-equipment-product-content.mjs --product-name "Cybex 530t Treadmill" --regenerate --apply
 *   node scripts/generate-equipment-product-content.mjs --changed-only --apply
 *   node scripts/generate-equipment-product-content.mjs --regenerate --limit 20 --apply
 *   node scripts/generate-equipment-product-content.mjs --approved-only --missing-only --apply
 *
 * Status selection:
 *   (default) pending + needs_review + approved
 *   --approved-only  approved products only
 *   --all-statuses   no status filter (includes excluded)
 *
 * Requires OPENAI_API_KEY in .env.local (or OPENAI_MODEL optional).
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
  shouldGenerateProductContent,
  summarizeProductContentPlan,
} from '../src/lib/equipmentProductContent.js'

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
    productId: null,
    productName: null,
    limit: 50,
    dryRun: true,
    missingOnly: false,
    changedOnly: false,
    regenerate: false,
    // Default: pending + needs_review + approved (content prep before/after approval).
    // Use --approved-only to restrict; --all-statuses includes excluded too.
    approvedOnly: false,
    allStatuses: false,
    delayMs: 250,
    printGenerated: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--missing-only') args.missingOnly = true
    else if (token === '--changed-only') args.changedOnly = true
    else if (token === '--regenerate') args.regenerate = true
    else if (token === '--approved-only') args.approvedOnly = true
    else if (token === '--all-statuses') args.allStatuses = true
    else if (token === '--print-generated') args.printGenerated = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--product-id') {
      args.productId = argv[index + 1] ?? null
      index += 1
    } else if (token === '--product-name') {
      args.productName = argv[index + 1] ?? null
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1] ?? 50)
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 250)
      index += 1
    }
  }

  if (args.missingOnly && args.changedOnly) {
    throw new Error('Use either --missing-only or --changed-only, not both')
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchProducts(supabase, { brand, productId, productName, approvedOnly, allStatuses }) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('brand')
    .order('canonical_product_name')

  if (brand) query = query.ilike('brand', brand)
  if (productId) query = query.eq('id', productId)
  if (productName) query = query.ilike('canonical_product_name', productName)
  if (approvedOnly) {
    query = query.eq('status', 'approved')
  } else if (!allStatuses) {
    query = query.in('status', ['pending', 'needs_review', 'approved'])
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function fetchExistingContent(supabase, productIds) {
  if (!productIds.length) return []

  const rows = []
  const chunkSize = 100
  for (let index = 0; index < productIds.length; index += chunkSize) {
    const chunk = productIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_product_content')
      .select(EQUIPMENT_PRODUCT_CONTENT_FIELDS)
      .in('equipment_product_id', chunk)

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error(
          'equipment_product_content table not found. Apply migration 20260708200000_equipment_product_content.sql first.',
        )
      }
      throw error
    }
    rows.push(...(data ?? []))
  }

  return rows
}

async function fetchConsoleOptions(supabase, productIds) {
  if (!productIds.length) return []

  const rows = []
  const chunkSize = 100
  for (let index = 0; index < productIds.length; index += chunkSize) {
    const chunk = productIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('product_console_options')
      .select(CONSOLE_FIELDS)
      .in('product_id', chunk)
      .eq('is_active', true)

    if (error) throw error
    rows.push(...(data ?? []))
  }

  return rows
}

async function fetchIntelligenceRows(supabase, intelligenceIds) {
  if (!intelligenceIds.length) return []

  const rows = []
  const chunkSize = 100
  for (let index = 0; index < intelligenceIds.length; index += chunkSize) {
    const chunk = intelligenceIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_FIELDS)
      .in('id', chunk)

    if (error) throw error
    rows.push(...(data ?? []))
  }

  return rows
}

function groupByProductId(rows, productIdField = 'product_id') {
  const map = new Map()
  for (const row of rows) {
    const key = row[productIdField]
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

function buildGenerationPlan(products, {
  contentByProductId,
  consoleByProductId,
  intelligenceById,
  missingOnly,
  changedOnly,
  regenerate,
}) {
  const plan = []

  for (const product of products) {
    const existingContent = contentByProductId.get(product.id) ?? null
    const intelligenceRows = (product.source_intelligence_row_ids ?? [])
      .map((id) => intelligenceById.get(id))
      .filter(Boolean)
    const sourcePayload = buildProductContentSourcePayload(product, {
      consoleOptions: consoleByProductId.get(product.id) ?? [],
      intelligenceRows,
    })
    const sourceHash = buildProductContentSourceHash(sourcePayload)
    const decision = shouldGenerateProductContent({
      existingContent,
      sourceHash,
      missingOnly,
      changedOnly,
      regenerate,
    })

    if (!decision.include) continue

    plan.push({
      product,
      existingContent,
      sourcePayload,
      sourceHash,
      reason: decision.reason,
    })
  }

  return plan
}

async function upsertContentRow(supabase, row) {
  const { data, error } = await supabase
    .from('equipment_product_content')
    .upsert(row, { onConflict: 'equipment_product_id' })
    .select('id, equipment_product_id, generation_status, version')
    .single()

  if (error) throw error
  return data
}

function printDryRunPreview(entry) {
  console.log(`  - ${entry.product.canonical_product_name}`)
  console.log(`    reason: ${entry.reason}`)
  console.log(`    status: ${entry.existingContent?.generation_status ?? 'none'}`)
  console.log(`    hash: ${entry.sourceHash.slice(0, 12)}…`)
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const openAiKey = env.OPENAI_API_KEY
  const openAiModel = env.OPENAI_MODEL ?? DEFAULT_CONTENT_AI_MODEL

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
  }
  if (!args.dryRun && !openAiKey) {
    throw new Error('OPENAI_API_KEY is required in .env.local when using --apply')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchProducts(supabase, {
    brand: args.brand,
    productId: args.productId,
    productName: args.productName,
    approvedOnly: args.approvedOnly,
    allStatuses: args.allStatuses,
  })

  if (!products.length) {
    console.log('No matching equipment products found.')
    return
  }

  const productIds = products.map((product) => product.id)
  const intelligenceIds = [...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? []))]

  const [existingContentRows, consoleRows, intelligenceRows] = await Promise.all([
    fetchExistingContent(supabase, productIds),
    fetchConsoleOptions(supabase, productIds),
    fetchIntelligenceRows(supabase, intelligenceIds),
  ])

  const contentByProductId = new Map(
    existingContentRows.map((row) => [row.equipment_product_id, row]),
  )
  const consoleByProductId = groupByProductId(consoleRows)
  const intelligenceById = new Map(intelligenceRows.map((row) => [row.id, row]))

  const plan = buildGenerationPlan(products, {
    contentByProductId,
    consoleByProductId,
    intelligenceById,
    missingOnly: args.missingOnly,
    changedOnly: args.changedOnly,
    regenerate: args.regenerate,
  }).slice(0, Math.max(1, args.limit))

  const summary = summarizeProductContentPlan(plan)

  console.log(args.dryRun ? 'DRY RUN — no writes' : 'APPLY — generating and writing content')
  console.log(`Products matched: ${products.length}`)
  console.log(`Queued for generation: ${plan.length}`)
  console.log(`Reasons: ${JSON.stringify(summary.byReason)}`)
  console.log(`Model: ${openAiModel}`)

  if (!plan.length) {
    console.log('Nothing to generate.')
    return
  }

  if (args.printGenerated) {
    if (!openAiKey) {
      throw new Error('OPENAI_API_KEY is required in .env.local for --print-generated')
    }

    console.log('\nGenerated previews (not saved):\n')

    for (const [index, entry] of plan.entries()) {
      const generated = await generateProductContentWithOpenAI({
        apiKey: openAiKey,
        model: openAiModel,
        sourcePayload: entry.sourcePayload,
      })

      console.log('─'.repeat(72))
      console.log(entry.product.canonical_product_name)
      console.log(`category: ${entry.sourcePayload.equipment_category}`)
      console.log(`reason: ${entry.reason}`)
      console.log('─'.repeat(72))
      console.log(generated.overview_text)
      console.log('')

      if (index < plan.length - 1 && args.delayMs > 0) {
        await sleep(args.delayMs)
      }
    }

    return
  }

  if (args.dryRun) {
    console.log('\nPreview:')
    for (const entry of plan) {
      printDryRunPreview(entry)
    }
    return
  }

  let succeeded = 0
  let failed = 0

  for (const [index, entry] of plan.entries()) {
    const label = entry.product.canonical_product_name
    process.stdout.write(`[${index + 1}/${plan.length}] ${label}… `)

    try {
      const generated = await generateProductContentWithOpenAI({
        apiKey: openAiKey,
        model: openAiModel,
        sourcePayload: entry.sourcePayload,
      })

      const row = buildProductContentUpsertRow({
        productId: entry.product.id,
        generated,
        sourceHash: entry.sourceHash,
        existingContent: entry.existingContent,
      })

      await upsertContentRow(supabase, row)
      succeeded += 1
      console.log('draft saved')
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.log(`failed (${message})`)

      const failedRow = buildProductContentUpsertRow({
        productId: entry.product.id,
        existingContent: entry.existingContent,
        sourceHash: entry.sourceHash,
        errorMessage: message,
      })

      try {
        await upsertContentRow(supabase, failedRow)
      } catch (writeError) {
        console.error(`  Could not persist failure row: ${writeError.message}`)
      }
    }

    if (index < plan.length - 1 && args.delayMs > 0) {
      await sleep(args.delayMs)
    }
  }

  console.log(`\nDone. Succeeded: ${succeeded}, failed: ${failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
