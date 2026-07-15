#!/usr/bin/env node
/**
 * Audit Technogym model suffixes to distinguish hardware tiers from console/package variants.
 * Analysis only — does not modify equipment_intelligence or equipment_products.
 *
 * Usage:
 *   node scripts/audit-technogym-model-variants.mjs
 *   node scripts/audit-technogym-model-variants.mjs --json technogym-model-variant-audit.json --md technogym-model-variant-report.md
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildTechnogymModelVariantAudit,
  renderTechnogymModelVariantReport,
} from '../src/lib/technogymModelVariantAudit.js'

const DEFAULT_JSON = 'technogym-model-variant-audit.json'
const DEFAULT_MD = 'technogym-model-variant-report.md'

const SELECT_FIELDS = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'slug',
  'product_family',
  'variant_name',
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
    json: DEFAULT_JSON,
    md: DEFAULT_MD,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--json') {
      args.json = argv[index + 1] ?? DEFAULT_JSON
      index += 1
    } else if (token === '--md') {
      args.md = argv[index + 1] ?? DEFAULT_MD
      index += 1
    }
  }

  return args
}

async function fetchTechnogymRows(supabase) {
  const pageSize = 1000
  let from = 0
  const rows = []

  while (true) {
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(SELECT_FIELDS)
      .ilike('brand', 'Technogym')
      .order('model')
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

function printConsoleSummary(audit) {
  console.log('Technogym model variant audit (analysis only)')
  console.log('============================================')
  console.log(`Rows analysed:              ${audit.summary.total_rows}`)
  console.log(`Series + machine groups:    ${audit.summary.total_groups}`)
  console.log(`Distinct suffixes:          ${audit.summary.distinct_suffixes}`)
  console.log(`Likely console/package:     ${audit.summary.likely_console_package}`)
  console.log(`Likely hardware revision:   ${audit.summary.likely_hardware_revision}`)
  console.log(`Likely physical model:      ${audit.summary.likely_physical_model}`)
  console.log(`Unknown:                    ${audit.summary.unknown}`)
  console.log(`Pairing patterns:           ${audit.summary.pairing_patterns}`)
  console.log('')

  const topGroups = audit.groups.slice(0, 8)
  for (const group of topGroups) {
    console.log(`${group.seriesFamily}`)
    console.log(`${group.machineType}`)
    console.log('')
    console.log('Suffixes:')
    for (const suffix of group.suffixes.slice(0, 10)) {
      console.log(`  ${suffix.suffix} — ${suffix.stats.occurrences} rows — ${suffix.classification} (${suffix.confidence})`)
    }
    console.log(`Rows: ${group.rowCount}`)
    console.log('')
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const rows = await fetchTechnogymRows(supabase)
  const audit = buildTechnogymModelVariantAudit(rows)

  writeFileSync(args.json, `${JSON.stringify(audit, null, 2)}\n`)
  writeFileSync(args.md, renderTechnogymModelVariantReport(audit))

  printConsoleSummary(audit)

  console.log(`Wrote ${args.json}`)
  console.log(`Wrote ${args.md}`)
  console.log('')
  console.log('No database changes were made.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
