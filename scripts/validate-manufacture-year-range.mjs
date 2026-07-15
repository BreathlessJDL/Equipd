#!/usr/bin/env node
/**
 * Validate manufacture-year ranges vs console compatibility.
 *
 * For each approved product with console mappings:
 * - build selectable years via getValidManufactureYearRange
 * - resolve consoles for every selectable year
 * - report empty-console years (expected-to-have-console products)
 * - report products using inferred (console) max years
 *
 * Usage:
 *   node scripts/validate-manufacture-year-range.mjs
 *   node scripts/validate-manufacture-year-range.mjs --brand "Matrix Fitness"
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getCompatibleConsoleOptions,
  normalizeConsoleCompatOption,
} from '../src/lib/consoleCompatibility.js'
import { supportsProductConsoleOptions } from '../src/lib/equipmentCardio.js'
import {
  buildManufactureYearDropdownOptions,
  getValidManufactureYearRange,
} from '../src/lib/equipmentValuation.js'

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

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)
  const currentYear = new Date().getFullYear()

  let productsQuery = supabase
    .from('equipment_products')
    .select('id, brand, canonical_product_key, canonical_product_name, equipment_type, model, product_family, status, baseline_manufacture_year, production_start_year, production_end_year')
    .eq('status', 'approved')
  if (args.brand) productsQuery = productsQuery.eq('brand', args.brand)

  const { data: products, error: productsError } = await productsQuery
  if (productsError) throw productsError

  const productIds = (products ?? []).map((row) => row.id)
  let compatRows = []
  const chunkSize = 200
  for (let index = 0; index < productIds.length; index += chunkSize) {
    const chunk = productIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('product_console_compat')
      .select('*, equipment_consoles(console_key, console_name)')
      .in('product_id', chunk)
      .eq('is_active', true)
    if (error) throw error
    compatRows = compatRows.concat(data ?? [])
  }

  const byProduct = new Map()
  for (const row of compatRows) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, [])
    byProduct.get(row.product_id).push(normalizeConsoleCompatOption({
      ...row,
      console_key: row.equipment_consoles?.console_key,
      console_name: row.equipment_consoles?.console_name,
    }))
  }

  const report = {
    brand: args.brand ?? 'all',
    generated_at: new Date().toISOString(),
    current_year: currentYear,
    summary: {
      products: products?.length ?? 0,
      with_console_mappings: 0,
      inferred_max_year: 0,
      empty_console_years: 0,
      years_past_production_end: 0,
    },
    inferred_max_year_products: [],
    empty_console_year_findings: [],
    matrix_digit_samples: [],
  }

  for (const product of products ?? []) {
    const options = byProduct.get(product.id) ?? []
    const expectsConsole = supportsProductConsoleOptions(product) && options.length > 0
    if (options.length) report.summary.with_console_mappings += 1

    const range = getValidManufactureYearRange(product, options, { currentYear })
    const yearOptions = buildManufactureYearDropdownOptions({
      baseline_manufacture_year: product.baseline_manufacture_year,
      production_start_year: product.production_start_year,
      production_end_year: product.production_end_year,
      console_compatibility: options,
      current_year: currentYear,
    })
    const years = yearOptions.map((row) => Number(row.value))

    if (range.maxYearSource === 'console_compat') {
      report.summary.inferred_max_year += 1
      report.inferred_max_year_products.push({
        product: product.canonical_product_name,
        key: product.canonical_product_key,
        minYear: range.minYear,
        maxYear: range.maxYear,
        maxYearSource: range.maxYearSource,
      })
    }

    const productionEnd = product.production_end_year == null || product.production_end_year === ''
      ? null
      : Number(product.production_end_year)
    if (Number.isFinite(productionEnd)) {
      const past = years.filter((year) => year > productionEnd)
      if (past.length) {
        report.summary.years_past_production_end += past.length
      }
    }

    if (expectsConsole) {
      for (const year of years) {
        const resolved = getCompatibleConsoleOptions({
          productId: product.id,
          manufactureYear: year,
          options,
          audience: 'public',
        })
        if (!resolved.options.length) {
          report.summary.empty_console_years += 1
          report.empty_console_year_findings.push({
            product: product.canonical_product_name,
            key: product.canonical_product_key,
            year,
            range: [range.minYear, range.maxYear],
            maxYearSource: range.maxYearSource,
          })
        }
      }
    }

    if (/^Matrix [TEARCUHS]\d /.test(product.canonical_product_name || '')) {
      report.matrix_digit_samples.push({
        product: product.canonical_product_name,
        key: product.canonical_product_key,
        baseline: product.baseline_manufacture_year,
        production_end: product.production_end_year,
        minYear: range.minYear,
        maxYear: range.maxYear,
        maxYearSource: range.maxYearSource,
        selectable_years: years,
        includes_2022: years.includes(2022),
      })
    }
  }

  mkdirSync('reports', { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    `manufacture-year-range-validation${args.brand ? `-${args.brand.toLowerCase().replace(/\s+/g, '-')}` : ''}.json`,
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`Wrote ${outPath}`)

  if (report.matrix_digit_samples.length) {
    console.log('\nMatrix digit samples:')
    for (const row of report.matrix_digit_samples.slice(0, 12)) {
      console.log(
        `- ${row.product}: ${row.minYear}–${row.maxYear} (${row.maxYearSource}) `
        + `2022=${row.includes_2022 ? 'YES' : 'no'}`,
      )
    }
  }

  if (report.empty_console_year_findings.length) {
    console.log(`\nEmpty-console years (first 20 of ${report.empty_console_year_findings.length}):`)
    for (const row of report.empty_console_year_findings.slice(0, 20)) {
      console.log(`- ${row.product} @ ${row.year}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
