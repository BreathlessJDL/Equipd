#!/usr/bin/env node
/**
 * Reject and clear equipment product images flagged as blocked risk.
 *
 * Usage:
 *   node scripts/cleanup-blocked-equipment-product-images.mjs
 *   node scripts/cleanup-blocked-equipment-product-images.mjs --brand "Life Fitness"
 *   node scripts/cleanup-blocked-equipment-product-images.mjs --risk blocked --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  IMAGE_AUDIT_RISK,
  listProductsForImageCleanup,
} from '../src/lib/equipmentProductImageAudit.js'
import {
  BLOCKED_DEALER_IMAGE_REJECTION_REASON,
} from '../src/lib/equipmentProductImages.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_status',
  'image_failure_reason',
  'original_base_price',
  'baseline_manufacture_year',
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
    risk: IMAGE_AUDIT_RISK.BLOCKED,
    dryRun: true,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--risk') {
      args.risk = argv[index + 1] ?? IMAGE_AUDIT_RISK.BLOCKED
      index += 1
    }
  }

  return args
}

async function fetchProducts(supabase, brandFilter) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('brand')
    .order('canonical_product_name')

  if (brandFilter) {
    query = query.ilike('brand', brandFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function rejectProductImage(supabase, product, reason) {
  const { error } = await supabase
    .from('equipment_products')
    .update({
      image_status: 'rejected',
      image_url: null,
      image_storage_path: null,
      image_failure_reason: reason,
      image_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id)

  if (error) throw error

  return {
    originalBasePrice: product.original_base_price,
    baselineManufactureYear: product.baseline_manufacture_year,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchProducts(supabase, args.brand)
  const targets = listProductsForImageCleanup(products, { risk: args.risk })

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  if (args.brand) console.log(`Brand filter: ${args.brand}`)
  console.log(`Risk filter: ${args.risk}`)
  console.log(`Cleanup targets: ${targets.length}`)

  const summary = {
    processed: 0,
    rejected: 0,
    failed: 0,
  }

  for (const product of targets) {
    summary.processed += 1
    console.log([
      product.canonical_product_name,
      product.image_status,
      product.image_source_domain ?? '—',
      args.dryRun ? 'DRY-RUN' : 'REJECT',
    ].join(' | '))

    if (args.dryRun) {
      summary.rejected += 1
      continue
    }

    try {
      const preserved = await rejectProductImage(
        supabase,
        product,
        BLOCKED_DEALER_IMAGE_REJECTION_REASON,
      )
      if (
        preserved.originalBasePrice !== product.original_base_price
        || preserved.baselineManufactureYear !== product.baseline_manufacture_year
      ) {
        throw new Error('pricing fields changed unexpectedly')
      }
      summary.rejected += 1
    } catch (error) {
      summary.failed += 1
      console.error(`FAILED ${product.canonical_product_name}: ${error.message}`)
    }
  }

  console.log('Summary:', summary)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
