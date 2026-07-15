#!/usr/bin/env node
/**
 * Audit equipment_products.equipment_type against canonical keyword rules.
 *
 * Usage:
 *   node scripts/audit-equipment-types.mjs
 *   node scripts/audit-equipment-types.mjs --brand "Life Fitness"
 *   node scripts/audit-equipment-types.mjs --csv-out equipment-type-audit.csv
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  auditEquipmentProductTypes,
  serializeEquipmentTypeAuditCsv,
} from '../src/lib/equipmentTypeAudit.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'product_family',
  'model',
  'equipment_type',
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
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: null,
    csvOut: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--csv-out') {
      args.csvOut = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function fetchProducts(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const products = []

  while (true) {
    let query = supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .order('brand')
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)

    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }

    const { data, error } = await query
    if (error) throw error
    const batch = data ?? []
    products.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return products
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
  const report = auditEquipmentProductTypes(products)

  console.log('Equipment type audit (differences only)')
  if (args.brand) console.log(`Brand filter: ${args.brand}`)
  console.log(`Products checked: ${report.summary.productsChecked}`)
  console.log(`Type differences: ${report.summary.differences}`)
  console.log(`No keyword rule match: ${report.summary.noRuleMatch}`)
  console.log('')
  console.log([
    'canonical_product_name',
    'product_family',
    'model',
    'current type',
    'suggested type',
    'confidence',
  ].join(' | '))

  for (const row of report.differences) {
    console.log([
      row.product.canonical_product_name,
      row.product.product_family ?? '—',
      row.product.model ?? '—',
      row.currentType ?? '—',
      row.suggestedType ?? '—',
      row.confidence ?? '—',
    ].join(' | '))
  }

  if (args.csvOut) {
    const csvPath = resolve(args.csvOut)
    writeFileSync(csvPath, serializeEquipmentTypeAuditCsv(report.differences), 'utf8')
    console.log('')
    console.log(`Wrote ${report.differences.length} rows to ${csvPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
