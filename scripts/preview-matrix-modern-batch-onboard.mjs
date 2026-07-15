#!/usr/bin/env node
/**
 * Preview canonical derivation for Matrix 2026-07-10 import batch only.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCanonicalProductAuditReport,
  PRODUCT_STATUS,
} from '../src/lib/intelligenceCanonicalProducts.js'
import { deriveCoreProductFields } from '../src/lib/intelligenceCoreProductGrouping.js'

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    let value = trimmed.slice(idx + 1)
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

function normalizeRowForCanonical(row) {
  // CSV import stores year in manufacture_year; canonical builder prefers baseline_manufacture_year.
  const baseline = row.baseline_manufacture_year ?? row.manufacture_year ?? null
  return {
    ...row,
    baseline_manufacture_year: baseline,
    manufacture_start_year: row.manufacture_start_year ?? baseline,
  }
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .select('*')
    .ilike('brand', 'Matrix Fitness')
    .gte('created_at', '2026-07-10T16:42:00Z')
    .lte('created_at', '2026-07-10T16:43:00Z')
    .order('series')
    .order('model')
  if (error) throw error

  const rows = (data ?? []).map(normalizeRowForCanonical)
  const { data: existingProducts } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, status')
    .ilike('brand', 'Matrix Fitness')

  const existingByKey = new Map((existingProducts ?? []).map((row) => [row.canonical_product_key, row]))
  const audit = buildCanonicalProductAuditReport(rows, { brandFilter: 'Matrix Fitness' })

  const proposals = audit.products.map((product) => {
    const existing = existingByKey.get(product.canonical_product_key)
    const source = product.source_rows?.[0]
    const derived = deriveCoreProductFields(rows.find((row) => row.id === product.source_intelligence_row_ids[0]) ?? {})
    return {
      source_row: {
        id: source?.intelligence_row_id,
        series: source?.series,
        model: source?.model,
        slug: source?.slug,
        confidence: rows.find((row) => row.id === source?.intelligence_row_id)?.confidence ?? null,
      },
      proposed_canonical_product_name: product.canonical_product_name,
      brand: product.brand,
      family: product.product_family,
      model: product.model,
      equipment_type: product.equipment_type,
      proposed_canonical_product_key: product.canonical_product_key,
      duplicate_merge_candidate: existing
        ? { id: existing.id, name: existing.canonical_product_name, status: existing.status }
        : null,
      grouping_confidence: product.grouping_confidence ?? derived.core_product_group_confidence,
      status: product.status,
      safe_approval: product.status === PRODUCT_STATUS.PENDING || product.status === PRODUCT_STATUS.APPROVED,
      needs_review_reason: product.review_reasons ?? [],
      action: existing ? 'update' : 'create',
      original_base_price: product.original_base_price,
      baseline_manufacture_year: product.baseline_manufacture_year,
      production_start_year: product.production_start_year,
      source_intelligence_row_ids: product.source_intelligence_row_ids,
    }
  })

  const report = {
    generated_at: new Date().toISOString(),
    source_rows: rows.length,
    proposed_products: proposals.length,
    create: proposals.filter((row) => row.action === 'create').length,
    update: proposals.filter((row) => row.action === 'update').length,
    needs_review: proposals.filter((row) => row.status === PRODUCT_STATUS.NEEDS_REVIEW).length,
    safe: proposals.filter((row) => row.safe_approval).length,
    proposals,
  }

  mkdirSync('reports', { recursive: true })
  const out = join('reports', 'matrix-modern-batch-onboard-dry-run.json')
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    source_rows: report.source_rows,
    proposed_products: report.proposed_products,
    create: report.create,
    update: report.update,
    needs_review: report.needs_review,
    safe: report.safe,
    out,
  }, null, 2))
  for (const row of proposals) {
    console.log(
      `${row.action.toUpperCase()} | ${row.proposed_canonical_product_name} | `
      + `family=${row.family} | type=${row.equipment_type} | `
      + `rrp=${row.original_base_price} | year=${row.baseline_manufacture_year} | `
      + `status=${row.status} | reasons=${(row.needs_review_reason || []).join(',') || '—'}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
