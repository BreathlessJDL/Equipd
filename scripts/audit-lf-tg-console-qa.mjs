#!/usr/bin/env node
/**
 * Read-only QA audit of Life Fitness + Technogym console compatibility.
 * Does not modify mappings.
 *
 * Usage: node scripts/audit-lf-tg-console-qa.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isCardioEquipmentProduct,
  isSpinBikeIndoorCycleProduct,
  isStrengthEquipmentProduct,
  supportsProductConsoleOptions,
} from '../src/lib/equipmentCardio.js'
import {
  buildConsoleOptionsForProduct,
  classifyCommercialCardioConsoleGroup,
} from '../src/lib/commercialCardioConsoleCompat.js'
import {
  findOverlappingCompatMappings,
  getCompatibleConsoleOptions,
  normalizeConsoleCompatOption,
} from '../src/lib/consoleCompatibility.js'

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

function asOptionList(value) {
  if (Array.isArray(value)) return value
  if (value?.options && Array.isArray(value.options)) return value.options
  if (value?.rows && Array.isArray(value.rows)) return value.rows
  return []
}

const PACKAGE_CONSOLE_NAMES = /^(p|sp|ifi|ce|package)$/i

async function fetchAllInChunks(supabase, table, select, ids, idField = 'product_id') {
  const rows = []
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200)
    const { data, error } = await supabase.from(table).select(select).in(idField, chunk)
    if (error) throw error
    rows.push(...(data ?? []))
  }
  return rows
}

async function auditBrand(supabase, brand) {
  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select('id, brand, canonical_product_key, canonical_product_name, equipment_type, model, product_family, status, baseline_manufacture_year, production_start_year, production_end_year')
    .eq('brand', brand)
    .eq('status', 'approved')
  if (productsError) throw productsError

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('*')
    .eq('brand', brand)
    .order('display_order')
  if (consolesError) throw consolesError

  const productIds = (products ?? []).map((row) => row.id)
  const compat = productIds.length
    ? await fetchAllInChunks(supabase, 'product_console_compat', '*, equipment_consoles(*)', productIds)
    : []
  const options = productIds.length
    ? await fetchAllInChunks(supabase, 'product_console_options', '*', productIds)
    : []

  const { data: modifiers, error: modifiersError } = await supabase
    .from('equipment_console_modifiers')
    .select('*')
    .eq('brand', brand)
  if (modifiersError) throw modifiersError

  const { data: availability, error: availabilityError } = await supabase
    .from('equipment_console_availability')
    .select('*')
    .eq('brand', brand)
  if (availabilityError) throw availabilityError

  const cardio = (products ?? []).filter((product) => isCardioEquipmentProduct(product))
  const strength = (products ?? []).filter((product) => isStrengthEquipmentProduct(product))

  const byProductCompat = new Map()
  for (const row of compat) {
    if (!byProductCompat.has(row.product_id)) byProductCompat.set(row.product_id, [])
    byProductCompat.get(row.product_id).push(row)
  }
  const byProductOptions = new Map()
  for (const row of options) {
    if (!byProductOptions.has(row.product_id)) byProductOptions.set(row.product_id, [])
    byProductOptions.get(row.product_id).push(row)
  }

  const usedConsoleIds = new Set(compat.map((row) => row.console_id))
  const orphanConsoles = (consoles ?? []).filter((row) => row.active && !usedConsoleIds.has(row.id))

  const productReports = []
  const issues = {
    missing_mapping: [],
    strength_with_consoles: [],
    multiple_defaults: [],
    overlaps: [],
    no_source: [],
    all_factory_only: [],
    template_mismatch: [],
    package_as_console: [],
    spin_with_consoles: [],
    missing_default: [],
    invalid_compat_type: [],
    duplicate_mappings: [],
    legacy_options_differ: [],
    group_null_with_consoles: [],
    residential_with_consoles: [],
  }

  const groupCounts = {}

  for (const product of products ?? []) {
    const rows = byProductCompat.get(product.id) || []
    const legacy = byProductOptions.get(product.id) || []
    const isCardio = isCardioEquipmentProduct(product)
    const isStrength = isStrengthEquipmentProduct(product)
    const isSpin = isSpinBikeIndoorCycleProduct(product)

    if (isStrength && rows.length) {
      issues.strength_with_consoles.push(product.canonical_product_key)
    }
    if (!isCardio) continue

    const group = classifyCommercialCardioConsoleGroup(product)
    groupCounts[group ?? 'null'] = (groupCounts[group ?? 'null'] || 0) + 1

    const templateOpts = asOptionList(buildConsoleOptionsForProduct(product))
    const normalized = rows.map((row) => normalizeConsoleCompatOption({
      ...row,
      console_key: row.equipment_consoles?.console_key,
      console_name: row.equipment_consoles?.console_name,
      image_url: row.equipment_consoles?.image_url,
      brand: row.equipment_consoles?.brand,
    }))

    const overlaps = findOverlappingCompatMappings(normalized)
    if (overlaps.length) {
      issues.overlaps.push({ key: product.canonical_product_key, overlaps })
    }

    const seen = new Set()
    for (const row of rows) {
      const key = [row.console_id, row.compatibility_type, row.available_from_year].join('|')
      if (seen.has(key)) issues.duplicate_mappings.push(product.canonical_product_key)
      seen.add(key)
    }

    const defaults = rows.filter((row) => row.is_default && row.is_active)
    if (rows.length && defaults.length === 0) {
      issues.missing_default.push(product.canonical_product_key)
    }
    if (defaults.length > 1) {
      issues.multiple_defaults.push({ key: product.canonical_product_key, count: defaults.length })
    }

    for (const row of rows) {
      if (!['factory', 'optional', 'retrofit', 'fixed'].includes(row.compatibility_type)) {
        issues.invalid_compat_type.push({
          key: product.canonical_product_key,
          type: row.compatibility_type,
        })
      }
      if (!row.source_url && !row.equipment_consoles?.source_url) {
        issues.no_source.push({
          key: product.canonical_product_key,
          console: row.equipment_consoles?.console_key,
        })
      }
    }

    const types = new Set(rows.map((row) => row.compatibility_type))
    if (rows.length > 1 && [...types].every((type) => type === 'factory')) {
      issues.all_factory_only.push(product.canonical_product_key)
    }

    if (!rows.length && supportsProductConsoleOptions(product) && templateOpts.length) {
      issues.missing_mapping.push({
        key: product.canonical_product_key,
        group,
        name: product.canonical_product_name,
      })
    }
    if (isSpin && rows.length) {
      issues.spin_with_consoles.push(product.canonical_product_key)
    }
    if (!group && rows.length) {
      issues.group_null_with_consoles.push(product.canonical_product_key)
    }

    const dbKeys = new Set(normalized.map((row) => row.console_key).filter(Boolean))
    const tplKeys = new Set(templateOpts.map((row) => row.console_key).filter(Boolean))
    const onlyDb = [...dbKeys].filter((key) => !tplKeys.has(key))
    const onlyTpl = [...tplKeys].filter((key) => !dbKeys.has(key))
    if ((onlyDb.length || onlyTpl.length) && (dbKeys.size || tplKeys.size)) {
      issues.template_mismatch.push({
        key: product.canonical_product_key,
        group,
        onlyDb,
        onlyTpl,
        dbKeys: [...dbKeys],
        tplKeys: [...tplKeys],
      })
    }

    for (const row of normalized) {
      if (PACKAGE_CONSOLE_NAMES.test(row.console_name || '') || PACKAGE_CONSOLE_NAMES.test(row.console_key || '')) {
        issues.package_as_console.push({
          key: product.canonical_product_key,
          console: row.console_name,
        })
      }
    }

    const sampleYears = []
    const base = Number(product.baseline_manufacture_year || product.production_start_year || 2015)
    const years = [base - 2, base, base + 2, 2010, 2015, 2018, 2020, 2022, 2024]
      .filter((year, index, list) => Number.isFinite(year) && list.indexOf(year) === index)
      .sort((left, right) => left - right)

    for (const year of years) {
      const result = getCompatibleConsoleOptions({
        manufactureYear: year,
        options: normalized,
        audience: 'public',
      })
      sampleYears.push({
        year,
        labels: result.options.map((option) => option.label),
        default: result.defaultConsoleName,
        showSelector: result.showSelector,
        fixedOnly: result.fixedOnly,
        missing: result.missingMapping,
      })
    }

    if (legacy.length && rows.length) {
      const legNames = new Set(
        legacy.filter((row) => row.is_active).map((row) => String(row.console_name).toLowerCase()),
      )
      const compNames = new Set(normalized.map((row) => String(row.console_name).toLowerCase()))
      const legOnly = [...legNames].filter((name) => !compNames.has(name))
      const compOnly = [...compNames].filter((name) => !legNames.has(name))
      if (legOnly.length || compOnly.length) {
        issues.legacy_options_differ.push({
          key: product.canonical_product_key,
          legOnly,
          compOnly,
        })
      }
    }

    productReports.push({
      key: product.canonical_product_key,
      name: product.canonical_product_name,
      family: product.product_family,
      model: product.model,
      type: product.equipment_type,
      group,
      spin: isSpin,
      supports: supportsProductConsoleOptions(product),
      baseline_year: product.baseline_manufacture_year,
      production_start_year: product.production_start_year,
      production_end_year: product.production_end_year,
      compat_count: rows.length,
      legacy_count: legacy.length,
      consoles: normalized.map((row) => ({
        key: row.console_key,
        name: row.console_name,
        type: row.compatibility_type,
        from: row.available_from_year,
        to: row.available_to_year,
        default: row.is_default,
        order: row.display_order,
        confidence: row.confidence,
        source: row.source_url || null,
        modifier: row.modifier_percent,
      })),
      samples: sampleYears,
    })
  }

  return {
    totals: {
      approved: (products ?? []).length,
      cardio: cardio.length,
      strength: strength.length,
      cardio_with_compat: cardio.filter((product) => (byProductCompat.get(product.id) || []).length > 0).length,
      cardio_without_compat: cardio.filter((product) => (byProductCompat.get(product.id) || []).length === 0).length,
      consoles_master: (consoles ?? []).length,
      orphan_active_consoles: orphanConsoles.map((row) => row.console_key),
      modifiers: (modifiers ?? []).length,
      availability_rows: (availability ?? []).length,
      legacy_option_rows: options.length,
      compat_rows: compat.length,
      group_counts: groupCounts,
    },
    consoles: (consoles ?? []).map((row) => ({
      key: row.console_key,
      name: row.console_name,
      start: row.start_year,
      end: row.end_year,
      current: row.is_current,
      confidence: row.confidence,
      source_url: row.source_url,
      notes: row.notes,
      active: row.active,
      used: usedConsoleIds.has(row.id),
      image: Boolean(row.image_url),
      display_order: row.display_order,
    })),
    modifiers: (modifiers ?? []).map((row) => ({
      name: row.console_name,
      tier: row.console_tier,
      value: row.modifier_value,
      confidence: row.confidence,
      source: row.source,
    })),
    availability: (availability ?? []).map((row) => ({
      name: row.console_name,
      release: row.release_year,
      retired: row.retired_year,
      series: row.compatible_series,
      types: row.compatible_equipment_types,
      notes: row.notes,
    })),
    issue_counts: Object.fromEntries(
      Object.entries(issues).map(([key, value]) => [key, Array.isArray(value) ? value.length : value]),
    ),
    issues,
    products: productReports,
  }
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const brands = ['Life Fitness', 'Technogym']
  const out = {
    generated_at: new Date().toISOString(),
    brands: {},
  }

  for (const brand of brands) {
    out.brands[brand] = await auditBrand(supabase, brand)
    const brandData = out.brands[brand]
    console.log(`\n=== ${brand} ===`)
    console.log(JSON.stringify(brandData.totals, null, 2))
    console.log('issue_counts', JSON.stringify(brandData.issue_counts, null, 2))
    console.log(
      'consoles',
      brandData.consoles
        .map((row) => `${row.key} used=${row.used} src=${Boolean(row.source_url)}`)
        .join(' | '),
    )
    console.log('orphan', brandData.totals.orphan_active_consoles)
    console.log('missing sample', brandData.issues.missing_mapping.slice(0, 12))
    console.log('template_mismatch', brandData.issues.template_mismatch.length)
    console.log('all_factory_only', brandData.issues.all_factory_only.length)
    console.log(
      'no_source unique consoles',
      [...new Set(brandData.issues.no_source.map((row) => row.console))],
    )
  }

  mkdirSync('reports', { recursive: true })
  const outPath = join(process.cwd(), 'reports', 'lf-tg-console-qa-raw.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(`\nWrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
