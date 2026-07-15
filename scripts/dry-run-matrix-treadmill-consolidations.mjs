#!/usr/bin/env node
/**
 * Phase A dry-run: Matrix treadmill platform consolidations (T1, T3, T5/T7).
 * Makes NO data changes.
 *
 * Usage:
 *   node scripts/dry-run-matrix-treadmill-consolidations.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PRODUCT_SELECT = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_source',
  'original_price_confidence',
  'original_price_source_url',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
  'review_notes',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
].join(', ')

const GROUPS = [
  {
    id: 't1',
    label: 'T1 treadmill platform',
    oemFrame: 'T-1X-04-F',
    proposedName: 'Matrix T1 Treadmill',
    proposedKey: 'matrix-fitness-treadmill-t1-treadmill',
    proposedFamily: 'T1',
    phase: 'B',
    families: ['T1x', 'T1xe'],
    expectedConsoles: [
      { key: 'led_1x', name: '1x LED', fromSku: 'T1x' },
      { key: 'xe', name: 'xe Console', fromSku: 'T1xe' },
    ],
  },
  {
    id: 't3',
    label: 'T3 treadmill platform',
    oemFrame: 'T-3X-04-F',
    proposedName: 'Matrix T3 Treadmill',
    proposedKey: 'matrix-fitness-treadmill-t3-treadmill',
    proposedFamily: 'T3',
    phase: 'B',
    families: ['T3x', 'T3xe'],
    expectedConsoles: [
      { key: 'led_3x', name: '3x LED', fromSku: 'T3x' },
      { key: 'xe', name: 'xe Console', fromSku: 'T3xe' },
    ],
  },
  {
    id: 't5t7',
    label: 'T5/T7 treadmill platform',
    oemFrame: 'T-5x/7x-F',
    proposedName: 'Matrix T5/T7 Treadmill',
    proposedKey: 'matrix-fitness-treadmill-t5-t7-treadmill',
    proposedFamily: 'T5/T7',
    phase: 'C',
    families: ['T5x', 'T7x', 'T7xe'],
    // T5xe explicitly excluded from this merge
    expectedConsoles: [
      { key: 'led_5x', name: '5x LED', fromSku: 'T5x' },
      { key: 'led_7x', name: '7x LED', fromSku: 'T7x' },
      { key: '7xe', name: '7xe', fromSku: 'T7xe' },
    ],
    notes: [
      'T5xe is held and must NOT be included.',
      '7xi only if a catalogue SKU or supported source exists later (none today).',
      'Phase C — merge only after neutral name + RRP treatment approved.',
    ],
  },
]

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
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

function money(value, currency = 'GBP') {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return { amount: n, currency: currency || 'GBP', formatted: `${currency || 'GBP'} ${n.toLocaleString('en-GB')}` }
}

function publicUrl(key) {
  return `/equipment/${encodeURIComponent(key)}`
}

function sourceCount(product) {
  return (product.source_intelligence_row_ids ?? []).length
}

function hasApprovedImage(product) {
  return String(product.image_status ?? '').toLowerCase() === 'approved'
    || Boolean(product.image_url || product.image_storage_path)
}

function pickRepresentative(products) {
  // Prefer: most sources, then approved image, then lowest RRP (base machine), then earliest baseline, then key sort
  const ranked = [...products].sort((a, b) => {
    const sourceDiff = sourceCount(b) - sourceCount(a)
    if (sourceDiff !== 0) return sourceDiff

    const imgDiff = Number(hasApprovedImage(b)) - Number(hasApprovedImage(a))
    if (imgDiff !== 0) return imgDiff

    const priceA = Number(a.original_base_price)
    const priceB = Number(b.original_base_price)
    const aHas = Number.isFinite(priceA) && priceA > 0
    const bHas = Number.isFinite(priceB) && priceB > 0
    if (aHas && bHas && priceA !== priceB) return priceA - priceB
    if (aHas !== bHas) return aHas ? -1 : 1

    const baseA = Number(a.baseline_manufacture_year)
    const baseB = Number(b.baseline_manufacture_year)
    if (Number.isFinite(baseA) && Number.isFinite(baseB) && baseA !== baseB) return baseA - baseB

    return String(a.canonical_product_key).localeCompare(String(b.canonical_product_key))
  })
  return ranked[0]
}

function analyzeRrp(products) {
  const priced = products
    .map((p) => ({
      family: p.product_family,
      key: p.canonical_product_key,
      price: Number(p.original_base_price),
      currency: p.original_base_price_currency,
      confidence: p.original_price_confidence,
      source: p.original_price_source,
      sourceUrl: p.original_price_source_url,
    }))
    .filter((row) => Number.isFinite(row.price) && row.price > 0)

  if (priced.length === 0) {
    return {
      status: 'missing',
      includesConsolePremium: 'unknown',
      recommendation: 'No RRP on any member — flag for manual RRP research.',
      prices: [],
      spread: null,
    }
  }

  const amounts = priced.map((row) => row.price)
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const spread = max - min
  const relative = min > 0 ? spread / min : null

  // Heuristic: material spread between LED and touch SKUs suggests console-inclusive pricing
  const byFamily = Object.fromEntries(priced.map((row) => [row.family, row]))
  let includesConsolePremium = 'unknown'
  let recommendation = 'Preserve representative existing base RRP; do not average.'

  if (priced.length >= 2 && relative != null && relative >= 0.08) {
    includesConsolePremium = 'likely'
    recommendation = 'Prices diverge by ≥8% across console SKUs — treat as console-inclusive or mixed. Preserve representative RRP; flag platform for manual base-machine RRP review; keep console differences as modifiers.'
  } else if (priced.length >= 2 && spread === 0) {
    includesConsolePremium = 'unlikely_same_value'
    recommendation = 'Identical RRP across console SKUs — likely shared base (or shared placeholder). Preserve representative RRP.'
  } else if (priced.length >= 2 && relative != null && relative < 0.08) {
    includesConsolePremium = 'unclear_small_spread'
    recommendation = 'Small price spread — cannot separate console premium confidently. Preserve representative RRP; flag for manual review.'
  } else if (priced.length === 1) {
    includesConsolePremium = 'single_price_only'
    recommendation = 'Only one SKU has RRP. Preserve that value on representative; flag siblings for price research.'
  }

  return {
    status: 'present',
    includesConsolePremium,
    recommendation,
    prices: priced,
    byFamily,
    min,
    max,
    spread,
    relativeSpread: relative,
  }
}

function summarizeIntelligence(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    brand: row.brand,
    series: row.series,
    model: row.model,
    product_family: row.product_family,
    variant_name: row.variant_name,
    core_product_key: row.core_product_key,
    is_base_product: row.is_base_product,
    original_rrp: row.original_rrp ?? row.best_original_price,
    currency: row.currency,
    baseline_manufacture_year: row.baseline_manufacture_year,
    manufacture_start_year: row.manufacture_start_year,
    manufacture_end_year: row.manufacture_end_year,
  }))
}

function buildGroupReport(group, products, compatByProductId, contentByProductId, intelligenceById) {
  const members = group.families.map((family) => {
    const product = products.find((row) => String(row.product_family).toLowerCase() === family.toLowerCase())
      || products.find((row) => String(row.canonical_product_key).includes(family.toLowerCase()))
    return { family, product: product ?? null }
  })

  const found = members.map((m) => m.product).filter(Boolean)
  const missing = members.filter((m) => !m.product).map((m) => m.family)
  const representative = found.length ? pickRepresentative(found) : null
  const rrp = analyzeRrp(found)

  const memberDetails = members.map(({ family, product }) => {
    if (!product) {
      return {
        family,
        found: false,
        reason: 'No approved catalogue product for this family',
      }
    }
    const compat = compatByProductId.get(product.id) ?? []
    const content = contentByProductId.get(product.id) ?? null
    const intelligence = (product.source_intelligence_row_ids ?? [])
      .map((id) => intelligenceById.get(id))
      .filter(Boolean)

    return {
      family,
      found: true,
      id: product.id,
      canonical_product_key: product.canonical_product_key,
      canonical_product_name: product.canonical_product_name,
      status: product.status,
      model: product.model,
      equipment_type: product.equipment_type,
      source_row_count: sourceCount(product),
      source_intelligence_row_ids: product.source_intelligence_row_ids ?? [],
      production_start_year: product.production_start_year,
      production_end_year: product.production_end_year,
      baseline_manufacture_year: product.baseline_manufacture_year,
      rrp: money(product.original_base_price, product.original_base_price_currency),
      original_price_confidence: product.original_price_confidence,
      original_price_source: product.original_price_source,
      original_price_source_url: product.original_price_source_url,
      image: {
        status: product.image_status,
        url: product.image_url,
        storage_path: product.image_storage_path,
        source_url: product.image_source_url,
        confidence: product.image_confidence,
      },
      public_url: publicUrl(product.canonical_product_key),
      console_mappings: compat.map((row) => ({
        console_key: row.console_key,
        console_name: row.console_name,
        compatibility_type: row.compatibility_type,
        available_from_year: row.available_from_year,
        available_to_year: row.available_to_year,
        modifier_percent: row.modifier_percent,
        tier: row.tier,
        confidence: row.confidence,
        is_active: row.is_active,
        source_url: row.source_url,
      })),
      content: content
        ? {
          id: content.id,
          status: content.status,
          has_overview: Boolean(content.overview_text),
          has_seo: Boolean(content.seo_title || content.meta_description),
          faq_count: Array.isArray(content.faqs) ? content.faqs.length : 0,
        }
        : null,
      intelligence_rows: summarizeIntelligence(intelligence),
      is_proposed_representative: representative?.id === product.id,
    }
  })

  const allSourceIds = [...new Set(found.flatMap((p) => p.source_intelligence_row_ids ?? []))]
  const proposedConsoles = group.expectedConsoles.map((expected) => {
    const fromMember = memberDetails.find((m) => m.family === expected.fromSku && m.found)
    const mapping = fromMember?.console_mappings?.find((row) => row.console_key === expected.key)
      || fromMember?.console_mappings?.[0]
      || null
    return {
      ...expected,
      current_mapping: mapping,
      year_window: mapping
        ? {
          from: mapping.available_from_year,
          to: mapping.available_to_year,
        }
        : null,
    }
  })

  const mechanicalCheck = {
    oem_frame: group.oemFrame,
    catalogue_families: found.map((p) => p.product_family),
    equipment_types: [...new Set(found.map((p) => p.equipment_type))],
    models: [...new Set(found.map((p) => p.model))],
    same_equipment_type: found.every((p) => p.equipment_type === found[0]?.equipment_type),
    baseline_years: found.map((p) => ({
      family: p.product_family,
      baseline: p.baseline_manufacture_year,
      start: p.production_start_year,
      end: p.production_end_year,
    })),
    intelligence_core_keys: [...new Set(
      allSourceIds
        .map((id) => intelligenceById.get(id)?.core_product_key)
        .filter(Boolean),
    )],
    intelligence_models: [...new Set(
      allSourceIds
        .map((id) => intelligenceById.get(id)?.model)
        .filter(Boolean),
    )],
  }

  let mergeReady = missing.length === 0 && found.length >= 2
  let mergeBlockers = []
  if (missing.length) {
    mergeReady = false
    mergeBlockers.push(`Missing catalogue products: ${missing.join(', ')}`)
  }
  if (group.id === 't5t7') {
    // Extra caution: confirm not mixing T5xe; confirm mechanical sameness signals
    const t5xePresent = products.some((p) => String(p.product_family).toLowerCase() === 't5xe')
    if (t5xePresent) {
      mergeBlockers.push('T5xe exists in catalogue and must remain excluded from this merge (held).')
    }
    if (!mechanicalCheck.same_equipment_type) {
      mergeReady = false
      mergeBlockers.push('Members do not share the same equipment_type.')
    }
    // Different baselines alone are OK (console SKU intro years) but flag large gaps
    const baselines = mechanicalCheck.baseline_years
      .map((row) => Number(row.baseline))
      .filter((n) => Number.isFinite(n))
    if (baselines.length >= 2) {
      const gap = Math.max(...baselines) - Math.min(...baselines)
      if (gap > 3) {
        mergeBlockers.push(`Baseline years span ${gap} years across members — review whether generations differ before merge.`)
      }
    }
  }

  return {
    id: group.id,
    label: group.label,
    phase: group.phase,
    oem_frame: group.oemFrame,
    proposed: {
      representative_product_id: representative?.id ?? null,
      representative_current_key: representative?.canonical_product_key ?? null,
      representative_current_name: representative?.canonical_product_name ?? null,
      final_product_name: group.proposedName,
      final_product_key: group.proposedKey,
      final_product_family: group.proposedFamily,
      aliases_to_preserve: found.map((p) => p.canonical_product_name),
      variant_keys_to_exclude: found
        .filter((p) => p.id !== representative?.id)
        .map((p) => p.canonical_product_key),
      aggregated_source_intelligence_row_ids: allSourceIds,
      aggregated_source_count: allSourceIds.length,
      console_options_after_merge: proposedConsoles,
      rrp_treatment: {
        preserve_representative_rrp: representative
          ? money(representative.original_base_price, representative.original_base_price_currency)
          : null,
        analysis: rrp,
      },
      image_from_representative: representative
        ? {
          status: representative.image_status,
          url: representative.image_url,
          storage_path: representative.image_storage_path,
        }
        : null,
      content_from_representative: representative
        ? contentByProductId.get(representative.id) ?? null
        : null,
      public_url_after: publicUrl(group.proposedKey),
      old_urls: found.map((p) => ({
        from: publicUrl(p.canonical_product_key),
        note: 'No redirect table today — Phase B/C must add resolution or soft-redirect behaviour for excluded keys.',
      })),
    },
    members: memberDetails,
    missing_families: missing,
    mechanical_check: mechanicalCheck,
    merge_ready_for_review: mergeReady,
    merge_blockers: mergeBlockers,
    notes: group.notes ?? [],
  }
}

async function main() {
  const env = loadEnv()
  const sb = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const families = GROUPS.flatMap((g) => g.families)
  const { data: products, error } = await sb
    .from('equipment_products')
    .select(PRODUCT_SELECT)
    .ilike('brand', '%matrix%')
    .in('product_family', [...families, 'T5xe'])
    .order('canonical_product_key')

  if (error) throw error

  const targetProducts = (products ?? []).filter((p) => families.includes(p.product_family))
  const productIds = targetProducts.map((p) => p.id)

  const { data: compatRows, error: compatError } = await sb
    .from('product_console_compat')
    .select(`
      id,
      product_id,
      console_id,
      available_from_year,
      available_to_year,
      compatibility_type,
      modifier_percent,
      tier,
      confidence,
      is_active,
      source_url,
      notes,
      equipment_consoles (
        console_key,
        console_name
      )
    `)
    .in('product_id', productIds)

  if (compatError) throw compatError

  const compatByProductId = new Map()
  for (const row of compatRows ?? []) {
    const list = compatByProductId.get(row.product_id) ?? []
    list.push({
      ...row,
      console_key: row.equipment_consoles?.console_key ?? null,
      console_name: row.equipment_consoles?.console_name ?? null,
    })
    compatByProductId.set(row.product_id, list)
  }

  const { data: contentRows, error: contentError } = await sb
    .from('equipment_product_content')
    .select('id, equipment_product_id, generation_status, overview_text, seo_title, seo_meta_description, faq_json')
    .in('equipment_product_id', productIds)

  if (contentError) {
    console.warn('content fetch warning:', contentError.message)
  }

  const contentByProductId = new Map()
  for (const row of contentRows ?? []) {
    contentByProductId.set(row.equipment_product_id, {
      id: row.id,
      status: row.generation_status,
      overview_text: row.overview_text,
      seo_title: row.seo_title,
      meta_description: row.seo_meta_description,
      faqs: row.faq_json,
    })
  }

  const allSourceIds = [...new Set(targetProducts.flatMap((p) => p.source_intelligence_row_ids ?? []))]
  const intelligenceById = new Map()
  if (allSourceIds.length) {
    const { data: intelRows, error: intelError } = await sb
      .from('equipment_intelligence')
      .select('id, brand, series, model, product_family, variant_name, core_product_key, is_base_product, original_rrp, best_original_price, currency, baseline_manufacture_year, manufacture_start_year, manufacture_end_year')
      .in('id', allSourceIds)
    if (intelError) throw intelError
    for (const row of intelRows ?? []) intelligenceById.set(row.id, row)
  }

  const groupReports = GROUPS.map((group) => buildGroupReport(
    group,
    products ?? [],
    compatByProductId,
    contentByProductId,
    intelligenceById,
  ))

  const held = {
    t5xe: (products ?? [])
      .filter((p) => String(p.product_family).toLowerCase() === 't5xe')
      .map((p) => ({
        id: p.id,
        key: p.canonical_product_key,
        name: p.canonical_product_name,
        status: p.status,
        rrp: money(p.original_base_price, p.original_base_price_currency),
        note: 'Held — not part of T5/T7 consolidation',
      })),
    other_modalities: 'E/A/C/S/U/R/H series, S-Drive, Krankcycle — not in this dry-run',
    modern_consoles: 'LED / Premium LED / Touch / Touch XL remain master-only; not attached to historic T1/T3/T5/T7',
  }

  const report = {
    generated_at: new Date().toISOString(),
    phase: 'A',
    status: 'dry-run-only',
    no_data_changes: true,
    scope: {
      approved_for_eventual_merge: ['T1x+T1xe', 'T3x+T3xe'],
      pending_name_rrp_approval: ['T5x+T7x+T7xe'],
      held: held,
    },
    url_resolution_note:
      'equipment_products has no redirect/alias columns today. Soft-merge sets non-representatives to status=excluded; old canonical_product_key URLs currently 404 unless Phase B/C adds redirect resolution.',
    groups: groupReports,
  }

  mkdirSync('reports', { recursive: true })
  const jsonPath = join('reports', 'matrix-treadmill-consolidation-dry-run.json')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const md = renderMarkdown(report)
  const mdPath = join('reports', 'matrix-treadmill-consolidation-dry-run.md')
  writeFileSync(mdPath, md)

  console.log(md)
  console.log(`\nWrote ${jsonPath}`)
  console.log(`Wrote ${mdPath}`)
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Matrix treadmill consolidation — Phase A dry-run')
  lines.push('')
  lines.push(`**Generated:** ${report.generated_at}`)
  lines.push('**Status:** Dry-run only — no data changes applied.')
  lines.push('')
  lines.push('## Scope')
  lines.push('')
  lines.push('- Phase B (after approval): T1x+T1xe, T3x+T3xe')
  lines.push('- Phase C (after name + RRP approval): T5x+T7x+T7xe only')
  lines.push('- Held: all `*5xe`, E/A/C/S/U/R/H, S-Drive, Krankcycle')
  lines.push('- Modern LED / Premium LED / Touch / Touch XL: master-only')
  lines.push('')
  lines.push(`> ${report.url_resolution_note}`)
  lines.push('')

  if (report.scope.held.t5xe?.length) {
    lines.push('### Held T5xe (excluded from T5/T7 merge)')
    lines.push('')
    for (const row of report.scope.held.t5xe) {
      lines.push(`- \`${row.key}\` (${row.name}) — ${row.rrp?.formatted ?? 'no RRP'}`)
    }
    lines.push('')
  }

  for (const group of report.groups) {
    lines.push(`## ${group.label} (Phase ${group.phase})`)
    lines.push('')
    lines.push(`- OEM frame: \`${group.oem_frame}\``)
    lines.push(`- Merge ready for review: **${group.merge_ready_for_review ? 'yes' : 'no'}**`)
    if (group.merge_blockers.length) {
      lines.push('- Blockers / flags:')
      for (const b of group.merge_blockers) lines.push(`  - ${b}`)
    }
    for (const note of group.notes) lines.push(`- Note: ${note}`)
    lines.push('')
    lines.push('### Proposed representative')
    lines.push('')
    lines.push(`| Field | Value |`)
    lines.push(`| --- | --- |`)
    lines.push(`| Current representative ID | \`${group.proposed.representative_product_id}\` |`)
    lines.push(`| Current key / name | \`${group.proposed.representative_current_key}\` / ${group.proposed.representative_current_name} |`)
    lines.push(`| Proposed final name | **${group.proposed.final_product_name}** |`)
    lines.push(`| Proposed final key | \`${group.proposed.final_product_key}\` |`)
    lines.push(`| Proposed family | \`${group.proposed.final_product_family}\` |`)
    lines.push(`| Aggregated source rows | ${group.proposed.aggregated_source_count} |`)
    lines.push(`| Preserve RRP | ${group.proposed.rrp_treatment.preserve_representative_rrp?.formatted ?? '—'} |`)
    lines.push(`| RRP console-premium signal | ${group.proposed.rrp_treatment.analysis.includesConsolePremium} |`)
    lines.push(`| RRP recommendation | ${group.proposed.rrp_treatment.analysis.recommendation} |`)
    lines.push(`| Public URL after | \`${group.proposed.public_url_after}\` |`)
    lines.push('')
    lines.push('### Members')
    lines.push('')
    lines.push('| Family | ID | Name | Key | Sources | Baseline | Prod years | RRP | Image | Public URL | Consoles |')
    lines.push('| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |')
    for (const m of group.members) {
      if (!m.found) {
        lines.push(`| ${m.family} | — | MISSING | — | — | — | — | — | — | — | — |`)
        continue
      }
      const years = `${m.production_start_year ?? '—'}–${m.production_end_year ?? '—'}`
      const consoles = (m.console_mappings ?? [])
        .map((c) => `${c.console_name} (${c.compatibility_type}, ${c.available_from_year ?? '?'}–${c.available_to_year ?? '?'})`)
        .join('; ') || '—'
      const rep = m.is_proposed_representative ? ' **(rep)**' : ''
      lines.push(
        `| ${m.family}${rep} | \`${m.id}\` | ${m.canonical_product_name} | \`${m.canonical_product_key}\` | ${m.source_row_count} | ${m.baseline_manufacture_year ?? '—'} | ${years} | ${m.rrp?.formatted ?? '—'} | ${m.image?.status ?? '—'} | \`${m.public_url}\` | ${consoles} |`,
      )
    }
    lines.push('')
    lines.push('### Proposed console options on representative')
    lines.push('')
    lines.push('| Console | From SKU | Current mapping years | Current type | Post-merge type (proposed) |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const c of group.proposed.console_options_after_merge) {
      const years = c.year_window
        ? `${c.year_window.from ?? '?'}–${c.year_window.to ?? '?'}`
        : 'missing mapping'
      lines.push(`| ${c.name} (\`${c.key}\`) | ${c.fromSku} | ${years} | ${c.current_mapping?.compatibility_type ?? '—'} | factory (selectable; year-filtered) |`)
    }
    lines.push('')
    lines.push('> Post-merge: current per-SKU `fixed` rows should become year-filtered `factory` options on the representative. Do not attach modern LED/Touch/Touch XL.')
    lines.push('')
    lines.push('### Mechanical / intelligence check')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(group.mechanical_check, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('### Aliases to preserve')
    lines.push('')
    for (const alias of group.proposed.aliases_to_preserve) lines.push(`- ${alias}`)
    lines.push('')
    lines.push('### Keys to exclude after merge')
    lines.push('')
    for (const key of group.proposed.variant_keys_to_exclude) lines.push(`- \`${key}\``)
    lines.push('')
  }

  lines.push('## Next steps')
  lines.push('')
  lines.push('1. Review this dry-run.')
  lines.push('2. Approve Phase B (T1 + T3) separately from Phase C (T5/T7 name + RRP).')
  lines.push('3. Do not apply until explicit approval.')
  lines.push('')
  return lines.join('\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
