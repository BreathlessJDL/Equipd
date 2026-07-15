#!/usr/bin/env node
/**
 * Reject suggested Life Fitness Pro product images for manual re-sourcing.
 *
 * Usage:
 *   node scripts/reset-life-fitness-pro-images.mjs --dry-run
 *   node scripts/reset-life-fitness-pro-images.mjs --apply
 *   node scripts/reset-life-fitness-pro-images.mjs --name-contains "Pro 1" --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

const BRAND = 'Life Fitness'
const DEFAULT_NAME_CONTAINS = 'Pro'
const REJECTION_REASON = 'Rejected: Life Fitness Pro image requires manual review / possible wrong product match'

const PRODUCT_FIELDS = [
  'id',
  'brand',
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
    nameContains: DEFAULT_NAME_CONTAINS,
    dryRun: true,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--name-contains') {
      args.nameContains = argv[index + 1] ?? DEFAULT_NAME_CONTAINS
      index += 1
    }
  }

  return args
}

async function fetchTargets(supabase, nameContains) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .ilike('brand', BRAND)
    .ilike('canonical_product_name', `%${nameContains}%`)
    .eq('image_status', EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED)
    .order('canonical_product_name')

  if (error) throw error
  return data ?? []
}

function buildResetMetadata() {
  return {
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
    image_url: null,
    image_storage_path: null,
    image_failure_reason: REJECTION_REASON,
    image_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function resetProductImage(supabase, product) {
  const pricingSnapshot = {
    original_base_price: product.original_base_price,
    baseline_manufacture_year: product.baseline_manufacture_year,
    canonical_product_name: product.canonical_product_name,
    status: product.status,
  }

  const { error } = await supabase
    .from('equipment_products')
    .update(buildResetMetadata())
    .eq('id', product.id)

  if (error) throw error

  const { data, error: verifyError } = await supabase
    .from('equipment_products')
    .select('original_base_price,baseline_manufacture_year,canonical_product_name,status,image_source_url,image_source_domain')
    .eq('id', product.id)
    .single()

  if (verifyError) throw verifyError

  if (
    data.original_base_price !== pricingSnapshot.original_base_price
    || data.baseline_manufacture_year !== pricingSnapshot.baseline_manufacture_year
    || data.canonical_product_name !== pricingSnapshot.canonical_product_name
    || data.status !== pricingSnapshot.status
  ) {
    throw new Error('non-image product fields changed unexpectedly')
  }

  if (data.image_source_url !== product.image_source_url || data.image_source_domain !== product.image_source_domain) {
    throw new Error('image source audit fields changed unexpectedly')
  }

  return data
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

  const targets = await fetchTargets(supabase, args.nameContains)

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  console.log(`Brand: ${BRAND}`)
  console.log(`Name contains: ${args.nameContains}`)
  console.log(`Image status: ${EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED}`)
  console.log(`Reset targets: ${targets.length}`)
  console.log('')
  console.log(['Product', 'image_source_domain', 'image_source_url', 'Action'].join(' | '))

  const summary = {
    productsChecked: targets.length,
    reset: 0,
    failed: 0,
  }

  for (const product of targets) {
    console.log([
      product.canonical_product_name,
      product.image_source_domain ?? '—',
      product.image_source_url ?? '—',
      args.dryRun ? 'DRY-RUN' : 'RESET',
    ].join(' | '))

    if (args.dryRun) {
      summary.reset += 1
      continue
    }

    try {
      await resetProductImage(supabase, product)
      summary.reset += 1
    } catch (error) {
      summary.failed += 1
      console.error(`FAILED ${product.canonical_product_name}: ${error.message}`)
    }
  }

  console.log('')
  console.log('Summary:')
  console.log(`Products checked: ${summary.productsChecked}`)
  console.log(`Reset: ${summary.reset}`)
  console.log(`Failed: ${summary.failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
