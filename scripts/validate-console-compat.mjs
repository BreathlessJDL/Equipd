#!/usr/bin/env node
/**
 * Validate console compatibility mappings.
 *
 * Usage:
 *   node scripts/validate-console-compat.mjs
 *   node scripts/validate-console-compat.mjs --brand Concept2
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCardioEquipmentProduct, isStrengthEquipmentProduct } from '../src/lib/equipmentCardio.js'
import {
  findOverlappingCompatMappings,
  getCompatibleConsoleOptions,
  normalizeConsoleCompatOption,
} from '../src/lib/consoleCompatibility.js'
import { CONCEPT2_UNRESOLVED_PRODUCTS } from '../src/lib/concept2ConsoleCompat.js'

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
  const args = { brand: null }
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--brand') args.brand = argv[index + 1]
  }
  return args
}

function mapJoinRow(row) {
  return normalizeConsoleCompatOption({
    ...row,
    console_key: row.equipment_consoles?.console_key,
    console_name: row.equipment_consoles?.console_name,
    image_url: row.equipment_consoles?.image_url,
    brand: row.equipment_consoles?.brand,
  })
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)

  let productsQuery = supabase
    .from('equipment_products')
    .select('id, brand, canonical_product_key, canonical_product_name, equipment_type, model, product_family, status, baseline_manufacture_year, production_start_year, production_end_year')
    .eq('status', 'approved')
  if (args.brand) productsQuery = productsQuery.eq('brand', args.brand)

  const { data: products, error: productsError } = await productsQuery
  if (productsError) throw productsError

  const productIds = (products ?? []).map((row) => row.id)
  let compatRows = []
  if (productIds.length) {
    const { data, error } = await supabase
      .from('product_console_compat')
      .select('*, equipment_consoles(*)')
      .in('product_id', productIds)
      .eq('is_active', true)
    if (error) throw error
    compatRows = data ?? []
  }

  const byProduct = new Map()
  for (const row of compatRows) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, [])
    byProduct.get(row.product_id).push(mapJoinRow(row))
  }

  const report = {
    brand: args.brand ?? 'all',
    generated_at: new Date().toISOString(),
    products: [],
    summary: {
      approved: products.length,
      cardio: 0,
      strength_with_consoles: 0,
      missing_mappings: 0,
      overlaps: 0,
      low_confidence: 0,
      cybex_public_safe: true,
    },
    unresolved_concept2: CONCEPT2_UNRESOLVED_PRODUCTS,
  }

  for (const product of products ?? []) {
    const options = byProduct.get(product.id) ?? []
    const isCardio = isCardioEquipmentProduct(product)
    const isStrength = isStrengthEquipmentProduct(product)
    if (isCardio) report.summary.cardio += 1

    if (isStrength && options.length) {
      report.summary.strength_with_consoles += 1
    }

    const overlaps = findOverlappingCompatMappings(options)
    if (overlaps.length) report.summary.overlaps += 1
    if (options.some((row) => row.confidence === 'low')) report.summary.low_confidence += 1
    if (isCardio && !options.length) report.summary.missing_mappings += 1

    const sampleYear = Number(product.baseline_manufacture_year
      ?? product.production_start_year
      ?? new Date().getFullYear())
    const publicOptions = getCompatibleConsoleOptions({
      productId: product.id,
      manufactureYear: sampleYear,
      options,
      audience: 'public',
    })

    // Cybex safety: no brand fallback means empty public options until mapped
    if (product.brand === 'Cybex' && publicOptions.options.length > 0 && !options.length) {
      report.summary.cybex_public_safe = false
    }

    report.products.push({
      brand: product.brand,
      product: product.canonical_product_name,
      key: product.canonical_product_key,
      is_cardio: isCardio,
      production_range: [
        product.production_start_year ?? product.baseline_manufacture_year,
        product.production_end_year,
      ],
      assigned_consoles: options.map((row) => ({
        name: row.console_name,
        type: row.compatibility_type,
        from: row.available_from_year,
        to: row.available_to_year,
        confidence: row.confidence,
        approximate: row.from_year_approximate || row.to_year_approximate,
        default: row.is_default,
      })),
      public_sample_year: sampleYear,
      public_options: publicOptions.options.map((row) => row.label),
      default_console: publicOptions.defaultConsoleName || null,
      fixed_only: Boolean(publicOptions.fixedOnly),
      show_selector: publicOptions.showSelector,
      overlaps: overlaps.length,
      missing_mapping: isCardio && !options.length,
    })
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    `console-compat-validation${args.brand ? `-${args.brand.toLowerCase().replace(/\s+/g, '-')}` : ''}.json`,
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`Wrote ${outPath}`)

  const brandSamples = report.products.filter((row) => (
    !args.brand || row.brand === args.brand
  ))
  if (brandSamples.length) {
    console.log(`\n${args.brand || 'All'} public samples:`)
    for (const row of brandSamples) {
      const publicLabel = row.fixed_only
        ? `${row.default_console} (fixed)`
        : (row.public_options.join(', ') || '(none)')
      console.log(
        `- ${row.product} @ ${row.public_sample_year}: `
        + `${publicLabel} `
        + `[selector=${row.show_selector ? 'yes' : 'no'}] `
        + `mappings=${row.assigned_consoles.length}`,
      )
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
