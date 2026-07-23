#!/usr/bin/env node
/**
 * Sync home-use console valuation modifiers only.
 * Updates equipment_console_modifiers + product_console_compat.modifier_percent
 * for Life Fitness GO/TRACK* and Matrix XR/XER/XIR.
 *
 * Does not change compatibility mappings, timelines, products, or images.
 *
 * Usage:
 *   node scripts/sync-home-console-modifiers.mjs
 *   node scripts/sync-home-console-modifiers.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LIFE_FITNESS_BRAND,
  LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY,
} from '../src/lib/lifeFitnessConsoleCompat.js'
import {
  MATRIX_BRAND,
  MATRIX_CONSOLE_MODIFIER_BY_KEY,
} from '../src/lib/matrixConsoleCompat.js'

const HOME_UPDATES = [
  {
    brand: LIFE_FITNESS_BRAND,
    console_key: 'go',
    console_name: 'GO',
    old_modifier_percent: 0,
    ...LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.go,
  },
  {
    brand: LIFE_FITNESS_BRAND,
    console_key: 'track',
    console_name: 'TRACK',
    old_modifier_percent: 8,
    ...LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.track,
  },
  {
    brand: LIFE_FITNESS_BRAND,
    console_key: 'track_connect',
    console_name: 'TRACK CONNECT',
    old_modifier_percent: 15,
    ...LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.track_connect,
  },
  {
    brand: LIFE_FITNESS_BRAND,
    console_key: 'track_connect_2',
    console_name: 'TRACK CONNECT 2.0',
    old_modifier_percent: 22,
    ...LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.track_connect_2,
  },
  {
    brand: MATRIX_BRAND,
    console_key: 'xr',
    console_name: 'XR',
    old_modifier_percent: 0,
    ...MATRIX_CONSOLE_MODIFIER_BY_KEY.xr,
  },
  {
    brand: MATRIX_BRAND,
    console_key: 'xer',
    console_name: 'XER',
    old_modifier_percent: 15,
    ...MATRIX_CONSOLE_MODIFIER_BY_KEY.xer,
  },
  {
    brand: MATRIX_BRAND,
    console_key: 'xir',
    console_name: 'XIR',
    old_modifier_percent: 25,
    ...MATRIX_CONSOLE_MODIFIER_BY_KEY.xir,
  },
]

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i).trim()] = v
  }
  return env
}

async function upsertModifier(supabase, entry, apply) {
  const brands = entry.brand === MATRIX_BRAND
    ? [MATRIX_BRAND, 'Matrix']
    : [entry.brand]

  const results = []
  for (const brand of brands) {
    const row = {
      brand,
      console_key: entry.console_key,
      console_name: entry.console_name,
      console_tier: entry.tier,
      modifier_type: 'percentage',
      modifier_value: Number(entry.modifier_percent),
      confidence: 95,
      source: 'home_console_modifier_tune_2026_07',
      notes: `Home console modifier sync for ${entry.console_key}`,
    }

    const { data: existing, error: findError } = await supabase
      .from('equipment_console_modifiers')
      .select('id, modifier_value')
      .eq('brand', brand)
      .eq('console_key', entry.console_key)
      .maybeSingle()
    if (findError) throw findError

    if (!apply) {
      results.push({
        brand,
        console_key: entry.console_key,
        action: existing ? 'would_update' : 'would_insert',
        previous: existing?.modifier_value ?? null,
        next: row.modifier_value,
      })
      continue
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('equipment_console_modifiers')
        .update({
          console_name: row.console_name,
          console_tier: row.console_tier,
          modifier_value: row.modifier_value,
          confidence: row.confidence,
          source: row.source,
          notes: row.notes,
        })
        .eq('id', existing.id)
      if (error) throw error
      results.push({
        brand,
        console_key: entry.console_key,
        action: 'updated',
        previous: existing.modifier_value,
        next: row.modifier_value,
      })
    } else {
      const { error } = await supabase.from('equipment_console_modifiers').insert(row)
      if (error) throw error
      results.push({
        brand,
        console_key: entry.console_key,
        action: 'inserted',
        previous: null,
        next: row.modifier_value,
      })
    }
  }
  return results
}

async function syncCompatModifiers(supabase, entry, apply) {
  const brands = entry.brand === MATRIX_BRAND
    ? [MATRIX_BRAND, 'Matrix']
    : [entry.brand]

  const { data: consoles, error: consoleError } = await supabase
    .from('equipment_consoles')
    .select('id, brand, console_key')
    .in('brand', brands)
    .eq('console_key', entry.console_key)
  if (consoleError) throw consoleError

  const consoleIds = (consoles ?? []).map((row) => row.id)
  if (!consoleIds.length) {
    return { console_key: entry.console_key, compat_rows_touched: 0 }
  }

  const { data: compatRows, error: compatError } = await supabase
    .from('product_console_compat')
    .select('id, modifier_percent, console_id')
    .in('console_id', consoleIds)
  if (compatError) throw compatError

  const next = Number(entry.modifier_percent)
  const toUpdate = (compatRows ?? []).filter(
    (row) => Number(row.modifier_percent) !== next,
  )

  if (apply && toUpdate.length) {
    for (const row of toUpdate) {
      const { error } = await supabase
        .from('product_console_compat')
        .update({ modifier_percent: next })
        .eq('id', row.id)
      if (error) throw error
    }
  }

  return {
    console_key: entry.console_key,
    compat_rows_found: (compatRows ?? []).length,
    compat_rows_touched: toUpdate.length,
    sample_previous: toUpdate[0]?.modifier_percent ?? (compatRows?.[0]?.modifier_percent ?? null),
    next,
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  )

  console.log(`Home console modifier sync (${apply ? 'APPLY' : 'dry-run'})`)

  const report = {
    generated_at: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    updates: [],
    commercial_unchanged_sample: {
      life_fitness_discover_se4: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_se4.modifier_percent,
      life_fitness_integrity_x: LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.integrity_x.modifier_percent,
      matrix_touch_xl: MATRIX_CONSOLE_MODIFIER_BY_KEY.touch_xl.modifier_percent,
      matrix_7xi: MATRIX_CONSOLE_MODIFIER_BY_KEY['7xi'].modifier_percent,
    },
  }

  for (const entry of HOME_UPDATES) {
    const modifierResults = await upsertModifier(supabase, entry, apply)
    const compatResult = await syncCompatModifiers(supabase, entry, apply)
    const item = {
      brand: entry.brand,
      console_key: entry.console_key,
      console_name: entry.console_name,
      old_modifier_percent: entry.old_modifier_percent,
      new_modifier_percent: entry.modifier_percent,
      tier: entry.tier,
      modifier_table: modifierResults,
      compat: compatResult,
    }
    report.updates.push(item)
    console.log(
      `${entry.brand} ${entry.console_name}: ${entry.old_modifier_percent}% → ${entry.modifier_percent}% `
      + `(compat rows ${compatResult.compat_rows_touched}/${compatResult.compat_rows_found ?? 0})`,
    )
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    apply ? 'home-console-modifiers-apply.json' : 'home-console-modifiers-dry-run.json',
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
