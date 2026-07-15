#!/usr/bin/env node
/**
 * Audit equipment product images for dealer/marketplace/watermark risk.
 *
 * Usage:
 *   node scripts/audit-equipment-product-images.mjs
 *   node scripts/audit-equipment-product-images.mjs --brand "Technogym"
 *   node scripts/audit-equipment-product-images.mjs --risk blocked --out blocked-images.csv
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  buildEquipmentProductImageAuditReport,
  defaultEquipmentProductImageAuditPaths,
  IMAGE_AUDIT_RISK,
  serializeEquipmentProductImageAuditCsv,
} from '../src/lib/equipmentProductImageAudit.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'image_url',
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
    imageStatus: null,
    risk: null,
    out: null,
    jsonOut: null,
    csvOut: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--status') {
      args.imageStatus = argv[index + 1] ?? null
      index += 1
    } else if (token === '--risk') {
      args.risk = argv[index + 1] ?? null
      index += 1
    } else if (token === '--out') {
      args.out = argv[index + 1] ?? null
      index += 1
    } else if (token === '--json-out') {
      args.jsonOut = argv[index + 1] ?? null
      index += 1
    } else if (token === '--csv-out') {
      args.csvOut = argv[index + 1] ?? null
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

function resolveOutputPaths(args) {
  const defaults = defaultEquipmentProductImageAuditPaths()
  if (args.out) {
    const custom = resolve(args.out)
    if (custom.endsWith('.json')) {
      return { csv: custom.replace(/\.json$/i, '.csv'), json: custom }
    }
    return { csv: custom, json: custom.replace(/\.csv$/i, '.json') }
  }
  return {
    csv: resolve(args.csvOut ?? defaults.csv),
    json: resolve(args.jsonOut ?? defaults.json),
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
  const report = buildEquipmentProductImageAuditReport(products, {
    brand: args.brand,
    imageStatus: args.imageStatus,
    risk: args.risk,
  })
  const outputPaths = resolveOutputPaths(args)

  console.log('Equipment product image audit')
  if (args.brand) console.log(`Brand filter: ${args.brand}`)
  if (args.imageStatus) console.log(`Image status filter: ${args.imageStatus}`)
  if (args.risk) console.log(`Risk filter: ${args.risk}`)
  console.log('Summary:', report.summary)
  console.log('')

  console.log('Risk totals by source domain:')
  for (const row of report.byDomain) {
    console.log([
      row.domain,
      `classification=${row.classification}`,
      `safe=${row.safe}`,
      `review=${row.review}`,
      `blocked=${row.blocked}`,
      `total=${row.total}`,
    ].join(' | '))
  }
  console.log('')

  console.log(`Audit rows (${report.rows.length}):`)
  for (const row of report.rows.slice(0, 40)) {
    console.log([
      row.brand,
      row.canonicalProductName,
      row.imageStatus,
      row.imageSourceDomain || '—',
      row.riskLevel,
      row.reason,
    ].join(' | '))
  }
  if (report.rows.length > 40) {
    console.log(`... ${report.rows.length - 40} more rows written to export files`)
  }

  writeFileSync(outputPaths.csv, serializeEquipmentProductImageAuditCsv(report.rows), 'utf8')
  writeFileSync(outputPaths.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log('')
  console.log(`Wrote ${outputPaths.csv}`)
  console.log(`Wrote ${outputPaths.json}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
