#!/usr/bin/env node
/**
 * Read-only audit: console/platform terms in equipment_intelligence.
 *
 * Usage:
 *   node scripts/audit-console-platform-terms.mjs
 *   node scripts/audit-console-platform-terms.mjs --json
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONSOLE_VARIANT_PHRASES,
  deriveCoreProductFields,
  SERIES_FAMILY_CONSOLE_PATTERNS,
} from '../src/lib/intelligenceCoreProductGrouping.js'

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

const AUDIT_TERMS = [
  { brand: 'Life Fitness', term: 'Achieve' },
  { brand: 'Life Fitness', term: 'Engage' },
  { brand: 'Life Fitness', term: 'Inspire' },
  { brand: 'Life Fitness', term: 'Discover SI', patterns: [/\bdiscover\s+si\b/i, /\bsi\b/i] },
  { brand: 'Life Fitness', term: 'Discover SE', patterns: [/\bdiscover\s+se\b/i] },
  { brand: 'Life Fitness', term: 'Discover ST', patterns: [/\bdiscover\s+st\b/i] },
  { brand: 'Life Fitness', term: 'Discover SE3', patterns: [/\bdiscover\s+se3\b/i, /\bse3\b/i] },
  { brand: 'Life Fitness', term: 'Discover SE4', patterns: [/\bse4\b/i, /\bdiscover\s+se4\b/i] },
  { brand: 'Life Fitness', term: 'SL', patterns: [/\bsl\b/i] },
  { brand: 'Life Fitness', term: 'Elevation', patterns: [/\belevation\b/i] },
  { brand: 'Technogym', term: 'Unity', patterns: [/\bunity\b/i] },
  { brand: 'Technogym', term: 'Live', patterns: [/\blive\b/i] },
  { brand: 'Technogym', term: 'Connect', patterns: [/\bconnect\b/i] },
  { brand: 'Matrix', term: 'XR', patterns: [/\bxr\b/i] },
  { brand: 'Matrix', term: 'XER', patterns: [/\bxer\b/i] },
  { brand: 'Matrix', term: 'XIR', patterns: [/\bxir\b/i] },
]

const SELECT_FIELDS = 'id, brand, series, model, equipment_type, product_family, variant_name, variant_type, slug'

function fieldContainsTerm(fieldValue, term, patterns) {
  if (!fieldValue) return false
  const text = String(fieldValue)
  if (patterns?.length) {
    return patterns.some((pattern) => pattern.test(text))
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

function classifyTerm({ brand, term }, stats, derivedSamples) {
  const termLower = term.toLowerCase()
  const inConsolePhrases = CONSOLE_VARIANT_PHRASES.some((phrase) => (
    phrase === termLower || termLower.includes(phrase) || phrase.includes(termLower)
  ))
  const inSeriesPatterns = SERIES_FAMILY_CONSOLE_PATTERNS.some((entry) => (
    entry.variant?.toLowerCase() === termLower
    || entry.family?.toLowerCase() === termLower
    || termLower.includes(String(entry.variant ?? '').toLowerCase())
  ))

  const variantDetectedCount = derivedSamples.filter((sample) => (
    sample.variant_name && sample.variant_name.toLowerCase().includes(termLower.split(' ').pop())
  )).length

  const strippedAsConsoleCount = derivedSamples.filter((sample) => (
    sample.variant_name
    && sample.raw_model
    && sample.core_model
    && sample.raw_model.toLowerCase() !== sample.core_model.toLowerCase()
    && sample.variant_name.toLowerCase().includes(termLower.split(' ').pop())
  )).length

  const onlyInProductFamily = stats.in_product_family > 0
    && stats.in_model === 0
    && stats.in_series === 0

  const onlyInSeries = stats.in_series > 0
    && stats.in_model === 0
    && stats.in_product_family === 0

  const inModelAsSuffix = derivedSamples.some((sample) => (
    sample.raw_model
    && sample.core_model
    && sample.raw_model.toLowerCase().includes(termLower)
    && !sample.variant_name
    && sample.raw_model.toLowerCase() !== sample.core_model.toLowerCase()
  ))

  const appearsAsStandaloneModel = derivedSamples.some((sample) => (
    normalizeKey(sample.raw_model) === normalizeKey(term)
    || normalizeKey(sample.core_model) === normalizeKey(term)
  ))

  let classification = 'unknown'
  let rationale = []

  if (term === 'Elevation' || onlyInProductFamily) {
    classification = 'product family'
    rationale.push('appears primarily as product_family / platform line, not a console suffix')
  } else if (inConsolePhrases || inSeriesPatterns || strippedAsConsoleCount > 0 || variantDetectedCount > 0) {
    classification = 'console'
    rationale.push('codebase already classifies/strips this as a console variant')
  } else if (['Achieve', 'Engage', 'Inspire'].includes(term)) {
    classification = 'console'
    rationale.push('Elevation console generation name embedded in model/series; not a distinct machine model')
  } else if (['XR', 'XER', 'XIR'].includes(term)) {
    classification = 'console'
    rationale.push('Matrix console tier suffix on shared base machines')
  } else if (term === 'Live' && brand === 'Technogym') {
    classification = 'console'
    rationale.push('Technogym console generation label (Unity / Live / etc.)')
  } else if (appearsAsStandaloneModel) {
    classification = 'genuine model'
    rationale.push('appears as standalone model identity on some rows')
  } else if (inModelAsSuffix) {
    classification = 'console'
    rationale.push('appears as model suffix without being stripped — likely console misfiled in model')
  } else if (onlyInSeries) {
    classification = 'unknown'
    rationale.push('only present in series field — needs manual review')
  } else if (stats.matching_rows === 0) {
    classification = 'unknown'
    rationale.push('no matching rows in equipment_intelligence')
  } else {
    classification = 'unknown'
    rationale.push('mixed usage — review sample rows')
  }

  return { classification, rationale }
}

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function pickExamples(rows, limit = 5) {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    series: row.series,
    model: row.model,
    product_family: row.product_family,
    equipment_type: row.equipment_type,
    slug: row.slug,
  }))
}

async function fetchBrandRows(supabase, brand) {
  const pageSize = 1000
  let from = 0
  const rows = []

  while (true) {
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(SELECT_FIELDS)
      .ilike('brand', brand)
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

function auditTerm(entry, allRows) {
  const brandRows = allRows.filter((row) => (
    String(row.brand).toLowerCase() === entry.brand.toLowerCase()
  ))

  const matching = brandRows.filter((row) => (
    fieldContainsTerm(row.model, entry.term, entry.patterns)
    || fieldContainsTerm(row.series, entry.term, entry.patterns)
    || fieldContainsTerm(row.product_family, entry.term, entry.patterns)
  ))

  const inModel = matching.filter((row) => fieldContainsTerm(row.model, entry.term, entry.patterns)).length
  const inSeries = matching.filter((row) => fieldContainsTerm(row.series, entry.term, entry.patterns)).length
  const inProductFamily = matching.filter((row) => (
    fieldContainsTerm(row.product_family, entry.term, entry.patterns)
  )).length

  const derivedSamples = matching.slice(0, 50).map((row) => {
    const derived = deriveCoreProductFields(row)
    return {
      id: row.id,
      raw_model: row.model,
      core_model: derived.core_model,
      product_family: derived.product_family,
      variant_name: derived.variant_name,
      variant_type: derived.variant_type,
      variant_source: derived.variant_source,
      core_product_name: derived.core_product_name,
    }
  })

  const stats = {
    matching_rows: matching.length,
    in_model: inModel,
    in_series: inSeries,
    in_product_family: inProductFamily,
  }

  const { classification, rationale } = classifyTerm(entry, stats, derivedSamples)

  const uniqueCoreNames = [...new Set(derivedSamples.map((sample) => sample.core_product_name).filter(Boolean))].slice(0, 8)
  const uniqueVariants = [...new Set(derivedSamples.map((sample) => sample.variant_name).filter(Boolean))]

  return {
    brand: entry.brand,
    term: entry.term,
    appears_in: {
      model: inModel,
      series: inSeries,
      product_family: inProductFamily,
    },
    matching_rows: stats.matching_rows,
    suggested_classification: classification,
    rationale,
    grouping_behavior: {
      detected_as_variant_name: uniqueVariants,
      sample_core_product_names: uniqueCoreNames,
      codebase_strips_as_console: CONSOLE_VARIANT_PHRASES.some((phrase) => (
        entry.term.toLowerCase().includes(phrase) || phrase.includes(entry.term.toLowerCase())
      )),
    },
    examples: pickExamples(matching),
    derived_examples: derivedSamples.slice(0, 5),
  }
}

async function main() {
  const jsonOutput = process.argv.includes('--json')
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials in .env.local')

  const supabase = createClient(url, key)
  const brands = [...new Set(AUDIT_TERMS.map((entry) => entry.brand))]
  const rowsByBrand = {}

  for (const brand of brands) {
    rowsByBrand[brand] = await fetchBrandRows(supabase, brand)
  }

  const allRows = Object.values(rowsByBrand).flat()
  const results = AUDIT_TERMS.map((entry) => auditTerm(entry, allRows))

  const report = {
    generated_at: new Date().toISOString(),
    scope: 'equipment_intelligence read-only audit',
    total_rows_scanned: allRows.length,
    rows_by_brand: Object.fromEntries(
      Object.entries(rowsByBrand).map(([brand, rows]) => [brand, rows.length]),
    ),
    terms: results,
    implications: {
      life_fitness_elevation_console_generations: 'Achieve / Engage / Inspire are in SERIES_FAMILY_CONSOLE_PATTERNS and CONSOLE_VARIANT_PHRASES — Elevation family stays in canonical identity; console is variant_name.',
      discover_consoles: 'Discover SI/SE/ST/SE3 are in SERIES_FAMILY_CONSOLE_PATTERNS and CONSOLE_VARIANT_PHRASES.',
      technogym_consoles: 'Unity and Connect are in CONSOLE_VARIANT_PHRASES; Live is not.',
      matrix_consoles: 'XR/XER/XIR are not in CONSOLE_VARIANT_PHRASES.',
    },
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log('Console / platform term audit (read-only)')
  console.log('========================================')
  console.log(`Rows scanned: ${report.total_rows_scanned}`)
  for (const [brand, count] of Object.entries(report.rows_by_brand)) {
    console.log(`  ${brand}: ${count}`)
  }
  console.log('')

  for (const item of results) {
    console.log(`${item.brand} — ${item.term}`)
    console.log(`  Matching rows: ${item.matching_rows}`)
    console.log(`  Appears in: model=${item.appears_in.model}, series=${item.appears_in.series}, product_family=${item.appears_in.product_family}`)
    console.log(`  Suggested classification: ${item.suggested_classification}`)
    console.log(`  Rationale: ${item.rationale.join('; ')}`)
    if (item.grouping_behavior.detected_as_variant_name.length) {
      console.log(`  Code detects variant: ${item.grouping_behavior.detected_as_variant_name.join(', ')}`)
    } else {
      console.log('  Code detects variant: (none)')
    }
    if (item.grouping_behavior.sample_core_product_names.length) {
      console.log(`  Sample core names: ${item.grouping_behavior.sample_core_product_names.join(' | ')}`)
    }
    if (item.examples.length) {
      console.log('  Examples:')
      for (const example of item.examples) {
        console.log(`    - model="${example.model ?? '—'}" series="${example.series ?? '—'}" family="${example.product_family ?? '—'}"`)
      }
    }
    console.log('')
  }

  console.log('Implications')
  console.log('------------')
  for (const [key, value] of Object.entries(report.implications)) {
    console.log(`- ${key}: ${value}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
