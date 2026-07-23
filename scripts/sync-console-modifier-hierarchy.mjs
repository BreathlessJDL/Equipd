#!/usr/bin/env node
/**
 * Sync equipment_console_modifiers to researched brand console hierarchies.
 *
 * Life Fitness Discover order (least → most valuable):
 *   SI (10%) → SE (15%) → ST (18%) → SE3 (22%) → SE3HD (26%) → SE4 (30%)
 *
 * Usage:
 *   node scripts/sync-console-modifier-hierarchy.mjs --dry-run
 *   node scripts/sync-console-modifier-hierarchy.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY } from '../src/lib/lifeFitnessConsoleCompat.js'
import { MATRIX_CONSOLE_MODIFIER_BY_KEY } from '../src/lib/matrixConsoleCompat.js'

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

const LF_NAMES = {
  led: 'LED',
  achieve: 'Achieve',
  inspire: 'Inspire',
  engage: 'Engage',
  discover_si: 'Discover SI',
  discover_se: 'Discover SE',
  st: 'Discover ST',
  discover_se3: 'Discover SE3',
  discover_se3hd: 'Discover SE3HD',
  discover_se4: 'Discover SE4',
  integrity_c: 'Integrity C',
  integrity_sl: 'Integrity SL',
  integrity_x: 'Integrity X',
}

/** Short aliases — unique console_key per brand (DB unique on brand+console_key). */
const LF_ALIASES = [
  { console_key: 'si', console_name: 'SI', modifier_percent: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_si.modifier_percent, tier: 'mid' },
  { console_key: 'se', console_name: 'SE', modifier_percent: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_se.modifier_percent, tier: 'mid' },
  { console_key: 'se3', console_name: 'SE3', modifier_percent: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_se3.modifier_percent, tier: 'mid' },
  { console_key: 'se3hd', console_name: 'SE3HD', modifier_percent: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_se3hd.modifier_percent, tier: 'premium' },
  { console_key: 'se4', console_name: 'SE4', modifier_percent: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_se4.modifier_percent, tier: 'premium' },
  { console_key: 'sl', console_name: 'SL', modifier_percent: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.integrity_sl.modifier_percent, tier: 'base' },
]

const MATRIX_NAMES = {
  led: 'LED',
  premium_led: 'Premium LED',
  touch: 'Touch',
  touch_xl: 'Touch XL',
  onyx_22: 'Onyx 22',
  onyx_32: 'Onyx 32',
  xr: 'XR',
  xer: 'XER',
  xir: 'XIR',
  xur: 'XUR',
  xe: 'XE',
  '7xe': '7XE',
  '7xi': '7XI',
  led_1x: 'LED 1x',
  led_3x: 'LED 3x',
  led_5x: 'LED 5x',
  led_7x: 'LED 7x',
}

function buildDesiredRows() {
  const rows = []

  for (const [console_key, meta] of Object.entries(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY)) {
    rows.push({
      brand: 'Life Fitness',
      console_key,
      console_name: LF_NAMES[console_key] || console_key,
      console_tier: meta.tier,
      modifier_type: 'percentage',
      modifier_value: meta.modifier_percent,
      confidence: 95,
      source: 'hierarchy_research_2026_07',
      notes: 'Synced from LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY',
    })
  }
  for (const alias of LF_ALIASES) {
    rows.push({
      brand: 'Life Fitness',
      console_key: alias.console_key,
      console_name: alias.console_name,
      console_tier: alias.tier,
      modifier_type: 'percentage',
      modifier_value: alias.modifier_percent,
      confidence: 95,
      source: 'hierarchy_research_2026_07',
      notes: `Alias of ${alias.console_key}`,
    })
  }

  rows.push(
    { brand: 'Technogym', console_key: 'led', console_name: 'LED', console_tier: 'base', modifier_type: 'percentage', modifier_value: 0, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Excite base LED' },
    { brand: 'Technogym', console_key: 'visio', console_name: 'Visio', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 8, confidence: 90, source: 'hierarchy_research_2026_07', notes: 'Pre-VisioWeb' },
    { brand: 'Technogym', console_key: 'visio_web', console_name: 'VisioWeb', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 10, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'VisioWeb 2007+' },
    { brand: 'Technogym', console_key: 'connect', console_name: 'Connect', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 12, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Connect below Unity' },
    { brand: 'Technogym', console_key: 'unity', console_name: 'Unity', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 15, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'UNITY 2013+' },
    { brand: 'Technogym', console_key: 'unity_3_0', console_name: 'UNITY 3.0', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 20, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Artis UNITY 3.0' },
    { brand: 'Technogym', console_key: 'live', console_name: 'LIVE', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 24, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'LIVE 2020+' },
    { brand: 'Technogym', console_key: 'live_10', console_name: 'Live 10', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 26, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'LIVE 10"' },
    { brand: 'Technogym', console_key: 'live_16', console_name: 'Live 16', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 26, confidence: 90, source: 'hierarchy_research_2026_07', notes: 'LIVE 16" alias band' },
    { brand: 'Technogym', console_key: 'live_19', console_name: 'Live 19', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 28, confidence: 90, source: 'hierarchy_research_2026_07', notes: 'Larger LIVE entertainment' },
  )

  for (const [console_key, meta] of Object.entries(MATRIX_CONSOLE_MODIFIER_BY_KEY)) {
    if (!MATRIX_NAMES[console_key]) continue
    rows.push({
      brand: 'Matrix Fitness',
      console_key,
      console_name: MATRIX_NAMES[console_key],
      console_tier: meta.tier,
      modifier_type: 'percentage',
      modifier_value: meta.modifier_percent,
      confidence: 95,
      source: 'hierarchy_research_2026_07',
      notes: 'Synced from MATRIX_CONSOLE_MODIFIER_BY_KEY',
    })
  }
  // Also seed Matrix brand alias used by older rows
  rows.push(
    { brand: 'Matrix', console_key: 'led', console_name: 'LED', console_tier: 'base', modifier_type: 'percentage', modifier_value: 0, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias' },
    { brand: 'Matrix', console_key: 'premium_led', console_name: 'Premium LED', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 8, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias' },
    { brand: 'Matrix', console_key: 'touch', console_name: 'Touch', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 15, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias' },
    { brand: 'Matrix', console_key: 'touch_xl', console_name: 'Touch XL', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 25, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias' },
    { brand: 'Matrix', console_key: 'xr', console_name: 'XR', console_tier: 'base', modifier_type: 'percentage', modifier_value: 0, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias' },
    { brand: 'Matrix', console_key: 'xer', console_name: 'XER', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 8, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias — home XER' },
    { brand: 'Matrix', console_key: 'xir', console_name: 'XIR', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 15, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias — home XIR' },
    { brand: 'Matrix', console_key: 'xur', console_name: 'XUR', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 25, confidence: 95, source: 'hierarchy_research_2026_07', notes: 'Matrix brand alias' },
  )

  rows.push(
    { brand: 'Precor', console_key: 'p31', console_name: 'P31 LED', console_tier: 'base', modifier_type: 'percentage', modifier_value: 0, confidence: 90, source: 'hierarchy_research_2026_07', notes: 'P30/P31 LED base' },
    { brand: 'Precor', console_key: 'p62', console_name: 'P62', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 15, confidence: 90, source: 'hierarchy_research_2026_07', notes: '~10" touch' },
    { brand: 'Precor', console_key: 'p82', console_name: 'P82', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 25, confidence: 90, source: 'hierarchy_research_2026_07', notes: '~15" touch' },
    { brand: 'Cybex', console_key: 'led', console_name: 'LED', console_tier: 'base', modifier_type: 'percentage', modifier_value: 0, confidence: 90, source: 'hierarchy_research_2026_07', notes: 'Base LED' },
    { brand: 'Cybex', console_key: '50l', console_name: '50L', console_tier: 'base', modifier_type: 'percentage', modifier_value: 0, confidence: 90, source: 'hierarchy_research_2026_07', notes: '50L LED' },
    { brand: 'Cybex', console_key: 'e3_view', console_name: 'E3 View', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 12, confidence: 90, source: 'hierarchy_research_2026_07', notes: 'E3 View' },
    { brand: 'Cybex', console_key: 'cybex_go', console_name: 'Cybex GO', console_tier: 'mid', modifier_type: 'percentage', modifier_value: 15, confidence: 85, source: 'hierarchy_research_2026_07', notes: 'Cybex GO' },
    { brand: 'Cybex', console_key: '70t', console_name: '70T', console_tier: 'premium', modifier_type: 'percentage', modifier_value: 25, confidence: 90, source: 'hierarchy_research_2026_07', notes: '70T touchscreen' },
  )

  return rows
}

async function main() {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const desired = buildDesiredRows()
  console.log(`Desired modifier rows: ${desired.length}`)
  console.log('Life Fitness hierarchy preview:')
  for (const row of desired.filter((entry) => entry.brand === 'Life Fitness' && !['SI', 'SE', 'ST', 'SE3', 'SE3HD', 'SE3 HD', 'SE4', 'SL'].includes(entry.console_name))) {
    console.log(`  ${row.console_name.padEnd(16)} ${row.modifier_value}% (${row.console_tier})`)
  }

  if (!apply) {
    console.log('Dry-run only. Pass --apply to upsert.')
    return
  }

  const { data: existing, error: existingError } = await supabase
    .from('equipment_console_modifiers')
    .select('id, brand, console_key, console_name, modifier_value')
  if (existingError) throw existingError

  let updated = 0
  let inserted = 0

  for (const row of desired) {
    const match = (existing ?? []).find((entry) => (
      entry.brand === row.brand
      && entry.console_key
      && entry.console_key === row.console_key
    )) || (existing ?? []).find((entry) => (
      entry.brand === row.brand
      && entry.console_name === row.console_name
    ))

    if (match) {
      const { error } = await supabase
        .from('equipment_console_modifiers')
        .update({
          console_key: row.console_key,
          console_name: row.console_name,
          console_tier: row.console_tier,
          modifier_type: row.modifier_type,
          modifier_value: row.modifier_value,
          confidence: row.confidence,
          source: row.source,
          notes: row.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id)
      if (error) throw error
      updated += 1
    } else {
      const { error } = await supabase
        .from('equipment_console_modifiers')
        .insert(row)
      if (error) throw error
      inserted += 1
    }
  }

  console.log(`Updated ${updated}, inserted ${inserted}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
