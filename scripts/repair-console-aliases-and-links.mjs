#!/usr/bin/env node
/**
 * Classify unlinked consoles, plan Technogym alias decisions, and safely repair
 * console image metadata issues.
 *
 * Usage:
 *   node scripts/repair-console-aliases-and-links.mjs --dry-run
 *   node scripts/repair-console-aliases-and-links.mjs --apply
 *
 * Important finding (live DB + technogymConsoleCompat.js):
 *   TV, Digital TV, Visio and VisioWeb are four curated generations with
 *   overlapping product sets but different year windows. They are NOT merged.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPORTS_DIR = join(process.cwd(), 'reports')

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

function parseArgs(argv) {
  const args = { dryRun: true, apply: false }
  for (const token of argv.slice(2)) {
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    }
  }
  return args
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','))
  }
  writeFileSync(path, `${lines.join('\n')}\n`)
}

function resolveStaticConsolePath(imageUrl) {
  const text = String(imageUrl ?? '').trim()
  if (!text) return null
  let pathname = text
  try {
    if (/^https?:\/\//i.test(text)) pathname = new URL(text).pathname
  } catch {
    return null
  }
  const marker = '/equipment-console-images/'
  const idx = pathname.indexOf(marker)
  if (idx === -1 && !pathname.startsWith('equipment-console-images/')) return null
  const relative = idx === -1
    ? pathname.replace(/^\//, '')
    : pathname.slice(idx + 1)
  const decoded = decodeURIComponent(relative)
  return join(process.cwd(), 'public', decoded)
}

function staticFileExists(imageUrl) {
  const local = resolveStaticConsolePath(imageUrl)
  return Boolean(local && existsSync(local))
}

async function fetchAll(supabase, table, select) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }
  return rows
}

function classifyUnlinkedConsole(consoleRow, {
  productsByBrand,
  linkedConsoleIds,
}) {
  const brand = consoleRow.brand
  const key = String(consoleRow.console_key || '').toLowerCase()
  const products = productsByBrand.get(brand) || []

  const base = {
    console_id: consoleRow.id,
    brand,
    console_key: consoleRow.console_key,
    display_name: consoleRow.console_name,
    active_status: consoleRow.active,
    image_status: consoleRow.image_status,
    image_path: consoleRow.image_url || consoleRow.image_storage_path || null,
    static_file_exists: staticFileExists(consoleRow.image_url),
    start_year: consoleRow.start_year,
    end_year: consoleRow.end_year,
    notes: consoleRow.notes,
    currently_linked: linkedConsoleIds.has(consoleRow.id),
  }

  // Technogym superseded combined row
  if (/technogym/i.test(brand) && key === 'visio_visioweb') {
    return {
      ...base,
      classification: 'superseded_record',
      likely_compatible_product_families: ['Excite (historic entertainment)'],
      likely_years: '2003–2013',
      why_unlinked: 'Replaced by separate visio + visio_web master records during curated rebuild.',
      recommended_action: 'Keep inactive. Fix URL encoding if retained for history. Do not re-link.',
    }
  }

  // Matrix home consoles
  if (/matrix/i.test(brand) && ['xr', 'xer', 'xir', 'xur'].includes(key)) {
    const homeHint = products.filter((product) => /home|residential|xr|xer|xir|xur/i.test([
      product.canonical_product_name,
      product.product_family,
      product.model,
    ].join(' ')))
    return {
      ...base,
      classification: 'valid_future_catalogue',
      likely_compatible_product_families: ['Matrix Home / residential cardio'],
      likely_years: consoleRow.start_year
        ? `${consoleRow.start_year}${consoleRow.end_year ? `–${consoleRow.end_year}` : '+'}`
        : 'home era',
      why_unlinked: homeHint.length
        ? `Home console generation; ${homeHint.length} possible home-named products found but commercial digit/modular products must not receive these mappings.`
        : 'HOME-ONLY console generation (XR/XER/XIR/XUR). Intentionally not mapped to commercial digit or modular catalogue products.',
      recommended_action: 'Retain as valid master. Link only when Matrix Home products are onboarded. Do not merge with LED/Premium LED/Touch/Touch XL.',
    }
  }

  // Cybex later consoles
  if (/cybex/i.test(brand) && (key === '50l' || key === '70t')) {
    const rSeries = products.filter((product) => /\br[-\s]?series\b|\b50l\b|\b70t\b/i.test([
      product.canonical_product_name,
      product.model,
      product.product_family,
    ].join(' ')))
    return {
      ...base,
      classification: rSeries.length ? 'requires_research' : 'valid_future_catalogue',
      likely_compatible_product_families: ['Cybex R-Series cardio (when onboarded)', 'Not auto-mapped to 530/625/750/770/Sparc'],
      likely_years: key === '50l' ? 'later Cybex / R-Series' : 'later Cybex / R-Series premium',
      why_unlinked: rSeries.length
        ? `Possible related products exist (${rSeries.map((product) => product.canonical_product_name).join('; ')}), but Cybex research withholds mapping without frame evidence.`
        : 'R-Series frames are not present as approved canonical products. Master rows reserved for future onboarding.',
      recommended_action: rSeries.length
        ? 'Review Sparc/R-Series evidence before adding product_console_compat.'
        : 'Keep unlinked until R-Series products are onboarded; then map 50L base / 70T premium explicitly.',
    }
  }

  // Concept2 PM1
  if (/concept2/i.test(brand) && key === 'pm1') {
    const early = products.filter((product) => (
      /model\s*c\b/i.test(product.canonical_product_name)
      || (product.baseline_manufacture_year && product.baseline_manufacture_year <= 1995)
    ))
    return {
      ...base,
      classification: early.length ? 'valid_historic_no_current_products' : 'valid_historic_no_current_products',
      likely_compatible_product_families: ['Concept2 Model C / early rower era'],
      likely_years: 'pre-PM2 (~to mid-1990s)',
      why_unlinked: early.length
        ? `Eligible early product(s) exist (${early.map((product) => product.canonical_product_name).join('; ')}), but PM1 year windows were not attached in the Concept2 seed (PM2+ mapped instead).`
        : 'No clear PM1-era approved products beyond early Model C candidates.',
      recommended_action: early.length
        ? 'Propose optional/historic PM1 mapping on Model C for early manufacture years only; do not merge with PM2+.'
        : 'Retain historic master; link if earlier Concept2 SKUs are onboarded.',
      proposed_gap: early.map((product) => ({
        product_id: product.id,
        product_name: product.canonical_product_name,
        proposed_console_key: 'pm1',
        confidence: 'medium',
        notes: 'Historic PM1 may apply to early Model C years; confirm against Concept2 timeline before apply.',
      })),
    }
  }

  // Wattbike fit variants + PTS2
  if (/wattbike/i.test(brand) && (key === 'model_b_push_fit' || key === 'model_b_screw_fit')) {
    return {
      ...base,
      classification: 'valid_retrofit',
      likely_compatible_product_families: ['Wattbike Pro / Trainer'],
      likely_years: key.includes('screw') ? '2013–2014' : '2014+',
      why_unlinked: 'Intentional: public Pro/Trainer selector uses generic Model B Monitor only. Screw-fit/push-fit are connector identification variants, not separate public upgrade choices.',
      recommended_action: 'Retain separate technical master records. May share Model B image asset without merging identities. Do not auto-link as public factory options.',
    }
  }

  if (/wattbike/i.test(brand) && key === 'pts2') {
    const atomx = products.filter((product) => /atomx|air\s*pro|nucleus/i.test(product.canonical_product_name))
    return {
      ...base,
      classification: 'valid_future_catalogue',
      likely_compatible_product_families: ['Wattbike AtomX', 'Air Pro', 'possibly later Nucleus'],
      likely_years: '≈2025+',
      why_unlinked: atomx.length
        ? `Candidate products exist (${atomx.map((product) => product.canonical_product_name).join('; ')}), but PTS2 start is approximate (~2025) and must not overwrite PTS1 mappings without confirmation.`
        : 'PTS2 reserved for newer AtomX / Air Pro generations.',
      recommended_action: 'Keep unlinked until year evidence confirms which AtomX/Nucleus years receive PTS2 vs PTS.',
      proposed_gap: atomx.map((product) => ({
        product_id: product.id,
        product_name: product.canonical_product_name,
        proposed_console_key: 'pts2',
        confidence: 'low',
        notes: 'Do not auto-apply; confirm PTS2 introduction year against Wattbike support docs.',
      })),
    }
  }

  return {
    ...base,
    classification: 'requires_research',
    likely_compatible_product_families: [],
    likely_years: null,
    why_unlinked: 'No active product_console_compat rows; no brand-specific rule matched.',
    recommended_action: 'Manual research required.',
  }
}

function buildTechnogymAliasPlan(consoles, compatRows) {
  const byKey = Object.fromEntries(
    consoles.filter((row) => /technogym/i.test(row.brand)).map((row) => [row.console_key, row]),
  )
  const tv = byKey.tv
  const digitalTv = byKey.digital_tv
  const visio = byKey.visio
  const visioWeb = byKey.visio_web
  const combined = byKey.visio_visioweb

  const count = (consoleId) => compatRows.filter((row) => row.console_id === consoleId && row.is_active !== false).length

  return {
    decision: 'do_not_merge',
    summary: 'TV and Digital TV are NOT duplicates of Visio and VisioWeb. Keep four canonical entertainment generations plus LED/UNITY/Connect/LIVE.',
    evidence: [
      'src/lib/technogymConsoleCompat.js defines distinct console_key values with different year windows: tv 2002–2007, visio 2005–2007, digital_tv 2005–2013, visio_web 2007–2013.',
      'Live DB has active product_console_compat on all four: '
        + `tv=${count(tv?.id)}, visio=${count(visio?.id)}, digital_tv=${count(digitalTv?.id)}, visio_web=${count(visioWeb?.id)}.`,
      'Model-name parsers map VISIO WEB → visio_web, DIGITAL TV → digital_tv, VISIO → visio separately.',
      'Legacy combined key visio_visioweb is already inactive/superseded and has 0 compat rows.',
      'Merging would collapse distinct year windows (e.g. Digital TV from 2005 vs VisioWeb from 2007).',
    ],
    canonical_records: [
      { console_key: 'tv', console_name: 'TV', action: 'retain_canonical', image_needed: true },
      { console_key: 'digital_tv', console_name: 'Digital TV', action: 'retain_canonical', image_needed: true },
      { console_key: 'visio', console_name: 'Visio', action: 'retain_canonical', image_needed: !staticFileExists(visio?.image_url) },
      { console_key: 'visio_web', console_name: 'VisioWeb', action: 'retain_canonical', image_needed: !staticFileExists(visioWeb?.image_url) },
      {
        console_key: 'visio_visioweb',
        console_name: combined?.console_name,
        action: 'keep_inactive_superseded',
        image_needed: false,
      },
    ],
    compatibility_rows_to_move: [],
    duplicate_rows_that_would_result_if_merged: [
      'Almost all Excite products already carry both tv and visio (and digital_tv + visio_web) with different year windows; merging keys would create duplicate (product_id, console_id) collisions or silently drop year ranges.',
    ],
    image_metadata_to_transfer: [],
    records_to_deactivate: combined ? [{
      console_id: combined.id,
      console_key: 'visio_visioweb',
      already_inactive: combined.active === false,
      reason: 'Superseded combined label; keep inactive.',
    }] : [],
    aliases_retained: {
      visio: visio?.alternative_names || [],
      visio_web: visioWeb?.alternative_names || [],
      tv: tv?.alternative_names || [],
      digital_tv: digitalTv?.alternative_names || [],
      note: 'Do not add TV as an alias of Visio or Digital TV as an alias of VisioWeb without new OEM evidence.',
    },
    valuation_impact: 'No modifier remaps required; Technogym public options already use stable console_key values (tv, digital_tv, visio, visio_web).',
    product_pages_affected_by_no_merge: 'None — identities remain as currently seeded.',
    unresolved_records: [],
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  mkdirSync(REPORTS_DIR, { recursive: true })

  const consoles = await fetchAll(supabase, 'equipment_consoles', '*')
  const compat = await fetchAll(
    supabase,
    'product_console_compat',
    'id, product_id, console_id, available_from_year, available_to_year, compatibility_type, is_active, notes, source_url, confidence',
  )
  const products = await fetchAll(
    supabase,
    'equipment_products',
    'id, brand, canonical_product_name, canonical_product_key, model, product_family, status, baseline_manufacture_year, equipment_type',
  ).then((rows) => rows.filter((row) => row.status === 'approved'))

  const linkedConsoleIds = new Set(
    compat.filter((row) => row.is_active !== false).map((row) => row.console_id),
  )
  const productsByBrand = new Map()
  for (const product of products) {
    if (!productsByBrand.has(product.brand)) productsByBrand.set(product.brand, [])
    productsByBrand.get(product.brand).push(product)
  }

  const unlinked = consoles.filter((row) => !linkedConsoleIds.has(row.id))
  const classifications = unlinked.map((row) => classifyUnlinkedConsole(row, {
    productsByBrand,
    linkedConsoleIds,
  }))

  const aliasPlan = buildTechnogymAliasPlan(consoles, compat)

  const gaps = []
  for (const row of classifications) {
    for (const proposal of row.proposed_gap || []) {
      gaps.push({
        brand: row.brand,
        console_key: row.console_key,
        console_id: row.console_id,
        classification: row.classification,
        ...proposal,
        auto_apply: false,
      })
    }
  }

  // Matrix commercial digit products missing historic console keys is a separate gap class
  const matrixDigit = (productsByBrand.get('Matrix Fitness') || []).filter((product) => (
    /\b([AERTUCHS]\d{1,2}x(?:e|i)?)\b/i.test([
      product.model,
      product.product_family,
      product.canonical_product_name,
      product.canonical_product_key,
    ].join(' '))
  ))
  for (const product of matrixDigit) {
    const productCompat = compat.filter((row) => row.product_id === product.id && row.is_active !== false)
    if (!productCompat.length) {
      gaps.push({
        brand: 'Matrix Fitness',
        console_key: '(historic digit suite)',
        console_id: null,
        classification: 'requires_research',
        product_id: product.id,
        product_name: product.canonical_product_name,
        proposed_console_key: 'historic LED/XE/7XE/7XI per digit base',
        confidence: 'medium',
        notes: 'Digit-era product has no active console compat. XR/XER/XIR/XUR must NOT be used (home-only). Use historic commercial console matrix instead.',
        auto_apply: false,
      })
    }
  }

  writeFileSync(
    join(REPORTS_DIR, 'unlinked-console-classification.json'),
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      totals: {
        unlinked: classifications.length,
        by_classification: classifications.reduce((acc, row) => {
          acc[row.classification] = (acc[row.classification] || 0) + 1
          return acc
        }, {}),
      },
      records: classifications,
    }, null, 2)}\n`,
  )
  writeCsv(
    join(REPORTS_DIR, 'unlinked-console-classification.csv'),
    [
      'console_id', 'brand', 'console_key', 'display_name', 'active_status', 'image_status',
      'image_path', 'static_file_exists', 'classification', 'likely_compatible_product_families',
      'likely_years', 'why_unlinked', 'recommended_action',
    ],
    classifications.map((row) => ({
      ...row,
      likely_compatible_product_families: (row.likely_compatible_product_families || []).join('; '),
    })),
  )

  writeFileSync(
    join(REPORTS_DIR, 'console-alias-migration-plan.json'),
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      technogym_tv_digital_tv_visio: aliasPlan,
    }, null, 2)}\n`,
  )

  writeFileSync(
    join(REPORTS_DIR, 'console-compatibility-gaps.json'),
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      note: 'Proposals only. No automatic writes unless --apply and a repair action is explicitly implemented as high-confidence.',
      gaps,
    }, null, 2)}\n`,
  )

  // Safe apply actions: image metadata repairs only (no identity merges).
  const imageRepairs = []
  for (const consoleRow of consoles) {
    if (!/technogym/i.test(consoleRow.brand)) continue
    const url = String(consoleRow.image_url || '')
    if (!url) continue
    const decoded = url.includes('%') ? (() => {
      try { return decodeURIComponent(url) } catch { return null }
    })() : null
    const existsRaw = staticFileExists(url)
    const existsDecoded = decoded ? staticFileExists(decoded) : false

    // Normalize encoded paths when the decoded file exists on disk.
    if (decoded && decoded !== url && existsDecoded) {
      imageRepairs.push({
        console_id: consoleRow.id,
        console_key: consoleRow.console_key,
        action: 'fix_image_url_encoding',
        from: url,
        to: decoded,
      })
      continue
    }

    if (consoleRow.image_status === 'approved' && !existsRaw && !existsDecoded) {
      imageRepairs.push({
        console_id: consoleRow.id,
        console_key: consoleRow.console_key,
        action: 'demote_approved_missing_file',
        from_status: 'approved',
        to_status: 'none',
        image_url: url,
      })
    }
  }

  // Ensure Visio / VisioWeb remain approved when file exists
  for (const key of ['visio', 'visio_web']) {
    const row = consoles.find((entry) => /technogym/i.test(entry.brand) && entry.console_key === key)
    if (!row) continue
    if (staticFileExists(row.image_url) && row.image_status !== 'approved') {
      imageRepairs.push({
        console_id: row.id,
        console_key: row.console_key,
        action: 'confirm_approved_existing_file',
        image_url: row.image_url,
      })
    }
  }

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  console.log('Technogym alias decision:', aliasPlan.decision)
  console.log(aliasPlan.summary)
  console.log('Unlinked classifications:', classifications.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] || 0) + 1
    return acc
  }, {}))
  console.log('Compatibility gap proposals:', gaps.length)
  console.log('Image repairs proposed:', imageRepairs.length)
  for (const repair of imageRepairs) {
    console.log(repair.action, repair.console_key, repair.from || repair.image_url || '', '->', repair.to || repair.to_status || '')
  }

  if (!args.dryRun) {
    for (const repair of imageRepairs) {
      if (repair.action === 'fix_image_url_encoding') {
        const { error } = await supabase
          .from('equipment_consoles')
          .update({
            image_url: repair.to,
            image_status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', repair.console_id)
        if (error) throw error
      } else if (repair.action === 'demote_approved_missing_file') {
        const { error } = await supabase
          .from('equipment_consoles')
          .update({
            image_status: 'none',
            image_url: null,
            image_storage_path: null,
            updated_at: new Date().toISOString(),
            notes: [
              consoleRowNote(consoles, repair.console_id),
              'Image demoted: approved status had missing static file.',
            ].filter(Boolean).join(' '),
          })
          .eq('id', repair.console_id)
        if (error) throw error
      }
    }
    console.log(`Applied ${imageRepairs.length} image metadata repairs. No console identities were merged.`)
  } else {
    console.log('Dry-run only. Pass --apply to write image metadata repairs.')
  }

  console.log('Wrote reports/unlinked-console-classification.json')
  console.log('Wrote reports/unlinked-console-classification.csv')
  console.log('Wrote reports/console-alias-migration-plan.json')
  console.log('Wrote reports/console-compatibility-gaps.json')
}

function consoleRowNote(consoles, id) {
  return consoles.find((row) => row.id === id)?.notes || ''
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
