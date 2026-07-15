#!/usr/bin/env node
/**
 * Proposed Matrix base-model + year-based console matrix (review only).
 * No data changes.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MATRIX_CONSOLE_DEFS } from '../src/lib/matrixConsoleCompat.js'

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

const LETTER_META = {
  T: { label: 'Treadmill', equipment_type: 'Treadmill' },
  E: { label: 'Elliptical', equipment_type: 'Cross Trainer' },
  A: { label: 'Ascent', equipment_type: 'Ascent Trainer' },
  C: { label: 'ClimbMill', equipment_type: 'Stepper/Stair Climber' },
  S: { label: 'Stepper', equipment_type: 'Stepper/Stair Climber' },
  U: { label: 'Upright Bike', equipment_type: 'Exercise Bike' },
  R: { label: 'Recumbent Bike', equipment_type: 'Recumbent Bike' },
  H: { label: 'Hybrid Bike', equipment_type: 'Exercise Bike' },
}

const HISTORIC_CONSOLE_BY_SUFFIX = {
  '1x': { console_key: 'led_1x', console_name: '1x LED' },
  '3x': { console_key: 'led_3x', console_name: '3x LED' },
  '5x': { console_key: 'led_5x', console_name: '5x LED' },
  '7x': { console_key: 'led_7x', console_name: '7x LED' },
  '1xe': { console_key: 'xe', console_name: 'xe Console' },
  '3xe': { console_key: 'xe', console_name: 'xe Console' },
  '5xe': { console_key: '7xe', console_name: '7xe', held: true, note: 'Treat as 7xe-class touch pending OEM confirm; include as optional/factory with medium confidence if approved' },
  '7xe': { console_key: '7xe', console_name: '7xe' },
  '7xi': { console_key: '7xi', console_name: '7xi', note: 'No catalogue SKU today — include only if evidenced' },
}

function consoleYears(key) {
  const def = MATRIX_CONSOLE_DEFS.find((row) => row.console_key === key)
  if (!def) return { from: null, to: null, approximate: true }
  return {
    from: def.start_year ?? null,
    to: def.end_year ?? null,
    approximate: Boolean(def.start_year_approximate || def.end_year_approximate),
  }
}

function parseFamily(family) {
  const m = String(family ?? '').trim().match(/^([TEARCUHS])(\d)(xe|xi|x)$/i)
  if (!m) return null
  return {
    letter: m[1].toUpperCase(),
    digit: m[2],
    suffix: m[3].toLowerCase(),
    base: `${m[1].toUpperCase()}${m[2]}`,
    sku: `${m[1].toUpperCase()}${m[2]}${m[3].toLowerCase()}`,
  }
}

/**
 * Proposed year windows for a base model.
 * Historic: digit-matched LED + xe/7xe packages from folded SKUs.
 * Modern: proposed only from 2020 where user architecture wants continuity —
 * flagged as needs_evidence because OEM renamed to Lifestyle/Endurance/Performance.
 */
function buildProposedConsoles(base, sourceSkus) {
  const { letter, digit } = (() => {
    const m = base.match(/^([TEARCUHS])(\d)$/)
    return { letter: m[1], digit: m[2] }
  })()

  const rows = []
  const suffixesPresent = new Set(sourceSkus.map((s) => s.suffix))

  // Digit-matched LED (*x)
  const ledSuffix = `${digit}x`
  if (suffixesPresent.has('x') || true) {
    const led = HISTORIC_CONSOLE_BY_SUFFIX[ledSuffix]
    if (led) {
      const years = consoleYears(led.console_key)
      rows.push({
        console_key: led.console_key,
        console_name: led.console_name,
        compatibility_type: 'factory',
        available_from_year: years.from,
        available_to_year: years.to ?? 2019,
        confidence: 'high',
        evidence: 'Historic named *x SKU / console master years',
        status: 'proposed',
      })
    }
  }

  // xe packages
  if (digit === '1' || digit === '3') {
    if (suffixesPresent.has('xe') || true) {
      const years = consoleYears('xe')
      rows.push({
        console_key: 'xe',
        console_name: 'xe Console',
        compatibility_type: 'factory',
        available_from_year: years.from,
        available_to_year: years.to ?? 2016,
        confidence: 'high',
        evidence: 'Historic *1xe/*3xe; shared T-1XE/3XE console part on treadmills',
        status: 'proposed',
      })
    }
  }

  if (digit === '5') {
    rows.push({
      console_key: '7xe',
      console_name: '7xe',
      compatibility_type: 'factory',
      available_from_year: consoleYears('7xe').from,
      available_to_year: consoleYears('7xe').to ?? 2019,
      confidence: 'medium',
      evidence: 'From *5xe catalogue rows — held previously; include only if approved as 7xe-class',
      status: 'needs_approval',
      from_skus: ['*5xe'],
    })
  }

  if (digit === '7') {
    const years7xe = consoleYears('7xe')
    rows.push({
      console_key: '7xe',
      console_name: '7xe',
      compatibility_type: 'factory',
      available_from_year: years7xe.from,
      available_to_year: years7xe.to ?? 2019,
      confidence: 'high',
      evidence: 'Historic *7xe SKUs',
      status: 'proposed',
    })
    rows.push({
      console_key: '7xi',
      console_name: '7xi',
      compatibility_type: 'factory',
      available_from_year: consoleYears('7xi').from,
      available_to_year: consoleYears('7xi').to ?? 2019,
      confidence: 'medium',
      evidence: 'OEM T7xi docs exist; no approved catalogue *7xi SKU — include when evidenced',
      status: 'optional_if_evidenced',
    })
  }

  // Modern modular — architecture intent for full production history on one page.
  // Official 2020+ naming is Lifestyle/Endurance/Performance, not T5/E3/etc.
  const touchXlAllowed = letter === 'T' || letter === 'C'
  const modernFrom = 2020
  const modern = [
    { console_key: 'led', console_name: 'LED' },
    { console_key: 'premium_led', console_name: 'Premium LED' },
    { console_key: 'touch', console_name: 'Touch' },
  ]
  if (touchXlAllowed) {
    modern.push({ console_key: 'touch_xl', console_name: 'Touch XL' })
  }

  for (const entry of modern) {
    rows.push({
      console_key: entry.console_key,
      console_name: entry.console_name,
      compatibility_type: 'factory',
      available_from_year: modernFrom,
      available_to_year: null,
      confidence: 'low',
      evidence:
        'User architecture: single product page spans full history. '
        + 'Official modern Matrix uses Lifestyle/Endurance/Performance series names, not digit platforms. '
        + 'Attach only if approved as continuity mapping (digit → modern series class).',
      status: 'needs_evidence_approval',
      notes: touchXlAllowed || entry.console_key !== 'touch_xl'
        ? null
        : 'Touch XL not proposed for this modality (brochure: treadmills & ClimbMills only)',
    })
  }

  return rows
}

async function main() {
  const env = loadEnv()
  const sb = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const { data, error } = await sb
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, product_family, equipment_type, baseline_manufacture_year, original_base_price, original_base_price_currency, status')
    .ilike('brand', '%matrix%')
    .eq('status', 'approved')
    .order('product_family')

  if (error) throw error

  const byBase = {}
  const excluded = []

  for (const product of data ?? []) {
    const parsed = parseFamily(product.product_family)
    if (!parsed) {
      const hay = `${product.product_family} ${product.canonical_product_name}`.toLowerCase()
      if (/s-?drive|krank|cxc|cxm|cxp/.test(hay)) {
        excluded.push({
          key: product.canonical_product_key,
          name: product.canonical_product_name,
          reason: 'Specialty / indoor bike — remain unmapped; not a digit base model',
        })
      }
      continue
    }

    byBase[parsed.base] = byBase[parsed.base] || {
      base: parsed.base,
      letter: parsed.letter,
      digit: parsed.digit,
      meta: LETTER_META[parsed.letter],
      source_skus: [],
    }

    byBase[parsed.base].source_skus.push({
      id: product.id,
      family: product.product_family,
      suffix: parsed.suffix,
      sku: parsed.sku,
      key: product.canonical_product_key,
      name: product.canonical_product_name,
      type: product.equipment_type,
      baseline: product.baseline_manufacture_year,
      rrp: product.original_base_price,
      currency: product.original_base_price_currency,
    })
  }

  const bases = Object.values(byBase)
    .sort((a, b) => a.base.localeCompare(b.base))
    .map((group) => {
      const proposedName = `Matrix ${group.base} ${group.meta.label}`
      const proposedKey = `matrix-fitness-${String(group.meta.equipment_type).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${group.base.toLowerCase()}`
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      // Prefer cleaner keys matching existing style where possible
      const keyByLetter = {
        T: `matrix-fitness-treadmill-${group.base.toLowerCase()}-treadmill`,
        E: `matrix-fitness-cross-trainer-${group.base.toLowerCase()}-elliptical`,
        A: `matrix-fitness-${group.base.toLowerCase()}-ascent`,
        C: `matrix-fitness-stepper-stair-climber-${group.base.toLowerCase()}-climbmill`,
        S: `matrix-fitness-stepper-stair-climber-${group.base.toLowerCase()}-stepper`,
        U: `matrix-fitness-exercise-bike-${group.base.toLowerCase()}-upright-bike`,
        R: `matrix-fitness-exercise-bike-${group.base.toLowerCase()}-recumbent-bike`,
        H: `matrix-fitness-exercise-bike-${group.base.toLowerCase()}-hybrid-bike`,
      }

      return {
        base_model: group.base,
        proposed_canonical_name: proposedName,
        proposed_canonical_key: keyByLetter[group.letter] || proposedKey,
        proposed_product_family: group.base,
        equipment_type: group.meta.equipment_type,
        source_skus: group.source_skus.sort((a, b) => a.sku.localeCompare(b.sku)),
        source_sku_count: group.source_skus.length,
        proposed_consoles: buildProposedConsoles(group.base, group.source_skus),
        example_year_slices: buildYearSlices(group.base, buildProposedConsoles(group.base, group.source_skus)),
        open_questions: buildOpenQuestions(group),
      }
    })

  const report = {
    generated_at: new Date().toISOString(),
    status: 'proposal-only',
    no_data_changes: true,
    architecture: {
      rule: 'One canonical product per Matrix base digit platform (T1, T3, T5, T7, E3, …).',
      year_drives_consoles: true,
      suffix_becomes: ['console compatibility row', 'search alias (later)', 'source intelligence'],
      do_not_split_generations: true,
      modern_consoles_policy:
        'Propose modern LED/Premium LED/Touch/(Touch XL) from 2020 on digit platforms only if continuity is approved. Official OEM naming is Lifestyle/Endurance/Performance.',
      excluded_from_base_models: excluded,
    },
    console_master_years: MATRIX_CONSOLE_DEFS.map((d) => ({
      key: d.console_key,
      name: d.console_name,
      from: d.start_year,
      to: d.end_year,
      family: d.family,
    })),
    base_models: bases,
    summary: {
      base_model_count: bases.length,
      source_sku_total: bases.reduce((n, b) => n + b.source_sku_count, 0),
      high_confidence_historic_ready: bases.filter((b) => ['1', '3'].includes(b.base_model.slice(1)) || b.base_model.endsWith('7') || b.base_model.endsWith('5')).length,
    },
  }

  mkdirSync('reports', { recursive: true })
  const jsonPath = join('reports', 'matrix-base-model-console-matrix-proposal.json')
  const mdPath = join('reports', 'matrix-base-model-console-matrix-proposal.md')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(mdPath, renderMarkdown(report))
  console.log(renderMarkdown(report))
  console.log(`\nWrote ${jsonPath}`)
  console.log(`Wrote ${mdPath}`)
}

function buildYearSlices(base, consoles) {
  const samples = [2010, 2014, 2018, 2022]
  return samples.map((year) => ({
    year,
    visible: consoles
      .filter((c) => c.status !== 'optional_if_evidenced' || year >= (c.available_from_year ?? 0))
      .filter((c) => {
        const from = c.available_from_year ?? 0
        const to = c.available_to_year
        if (year < from) return false
        if (to != null && year > to) return false
        // For needs_evidence modern rows, still show in slice as proposed
        return true
      })
      .filter((c) => {
        // Hide needs_approval 5xe→7xe from slices unless year in window — still list
        return true
      })
      .map((c) => ({
        console_name: c.console_name,
        confidence: c.confidence,
        status: c.status,
      })),
  }))
}

function buildOpenQuestions(group) {
  const q = []
  if (group.digit === '5') {
    q.push('Include *5xe → 7xe (or distinct 5xe console) on this base model?')
  }
  if (group.digit === '7') {
    q.push('Include 7xi without a catalogue *7xi SKU?')
  }
  q.push('Attach modern modular consoles (2020+) to this digit platform, or wait for Lifestyle/Endurance/Performance products?')
  if (group.letter === 'T' && (group.digit === '5' || group.digit === '7')) {
    q.push('OEM frame T-5x/7x-F is shared across T5x/T7x/T7xe — confirm keeping Matrix T5 and Matrix T7 as separate public products (recommended by catalogue digit architecture).')
  }
  return q
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Matrix base-model + year-based console matrix — proposal')
  lines.push('')
  lines.push(`**Generated:** ${report.generated_at}`)
  lines.push('**Status:** Proposal only — no catalogue or mapping changes applied.')
  lines.push('')
  lines.push('## Architecture')
  lines.push('')
  lines.push(`- ${report.architecture.rule}`)
  lines.push('- Manufacture year filters console options on one product page.')
  lines.push('- Console suffixes become compatibility rows (+ later search aliases / source intelligence), not separate public products.')
  lines.push('- Do not split historic vs modern generations into separate public pages at this stage.')
  lines.push(`- Modern consoles: ${report.architecture.modern_consoles_policy}`)
  lines.push('')
  lines.push('## Excluded (not base digit models)')
  lines.push('')
  for (const row of report.architecture.excluded_from_base_models) {
    lines.push(`- \`${row.key}\` — ${row.reason}`)
  }
  if (!report.architecture.excluded_from_base_models.length) {
    lines.push('- (none matched in this pass beyond non-digit products)')
  }
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Proposed base models: **${report.summary.base_model_count}**`)
  lines.push(`- Source suffix SKUs to fold: **${report.summary.source_sku_total}**`)
  lines.push('')

  // Compact overview table
  lines.push('## Base models overview')
  lines.push('')
  lines.push('| Base | Proposed name | Source SKUs | Historic consoles (proposed) | Modern 2020+ |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const b of report.base_models) {
    const historic = b.proposed_consoles
      .filter((c) => !['led', 'premium_led', 'touch', 'touch_xl'].includes(c.console_key))
      .map((c) => `${c.console_name} (${c.available_from_year}–${c.available_to_year ?? '…'}; ${c.confidence})`)
      .join('; ')
    const modern = b.proposed_consoles
      .filter((c) => ['led', 'premium_led', 'touch', 'touch_xl'].includes(c.console_key))
      .map((c) => c.console_name)
      .join(', ')
    const skus = b.source_skus.map((s) => s.sku).join(', ')
    lines.push(`| ${b.base_model} | ${b.proposed_canonical_name} | ${skus} | ${historic || '—'} | ${modern || '—'} (needs evidence) |`)
  }
  lines.push('')

  // Detailed examples for treadmills first
  const focus = report.base_models.filter((b) => b.base_model.startsWith('T') || ['E3', 'E5', 'A5', 'U3'].includes(b.base_model))
  lines.push('## Detailed examples (review focus)')
  lines.push('')
  for (const b of focus) {
    lines.push(`### ${b.proposed_canonical_name}`)
    lines.push('')
    lines.push(`- Proposed key: \`${b.proposed_canonical_key}\``)
    lines.push(`- Fold SKUs: ${b.source_skus.map((s) => `\`${s.sku}\` (${s.key})`).join(', ')}`)
    lines.push('')
    lines.push('| Console | Type | Years | Confidence | Status | Evidence |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const c of b.proposed_consoles) {
      lines.push(`| ${c.console_name} (\`${c.console_key}\`) | ${c.compatibility_type} | ${c.available_from_year}–${c.available_to_year ?? 'present'} | ${c.confidence} | ${c.status} | ${c.evidence} |`)
    }
    lines.push('')
    lines.push('Year slices (what the dropdown/read-only UI would show):')
    lines.push('')
    for (const slice of b.example_year_slices) {
      const names = slice.visible.map((v) => `${v.console_name} [${v.status}/${v.confidence}]`).join(', ') || '(none)'
      lines.push(`- **${slice.year}:** ${names}`)
    }
    lines.push('')
    if (b.open_questions.length) {
      lines.push('Open questions:')
      for (const q of b.open_questions) lines.push(`- ${q}`)
      lines.push('')
    }
  }

  lines.push('## Decision requests before any apply')
  lines.push('')
  lines.push('1. Confirm base-model list (T1/T3/T5/T7 and E/A/C/S/U/R/H equivalents) — keep T5 and T7 separate despite shared OEM frame `T-5x/7x-F`.')
  lines.push('2. Approve including `*5xe` as 7xe-class on digit-5 bases (medium confidence) or keep held.')
  lines.push('3. Approve whether **modern modular consoles attach to digit platforms from 2020**, or remain deferred until Lifestyle/Endurance/Performance products exist.')
  lines.push('4. Approve 7xi inclusion without catalogue SKU.')
  lines.push('5. After matrix approval only: implement consolidations + year-filtered factory mappings + public year→console UX.')
  lines.push('')
  lines.push('No redirects/alias architecture in the first implementation pass beyond what consolidation already requires for search terms / source IDs.')
  lines.push('')
  return lines.join('\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
