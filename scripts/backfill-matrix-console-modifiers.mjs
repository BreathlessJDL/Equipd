#!/usr/bin/env node
/**
 * Backfill Matrix console modifiers with stable console_key values,
 * normalize brand to "Matrix Fitness", and sync product_console_compat.modifier_percent.
 *
 * Usage:
 *   node scripts/backfill-matrix-console-modifiers.mjs
 *   node scripts/backfill-matrix-console-modifiers.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATRIX_BRAND,
  MATRIX_CONSOLE_DEFS,
  MATRIX_CONSOLE_MODIFIER_BY_KEY,
} from '../src/lib/matrixConsoleCompat.js'

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
  return { apply: argv.includes('--apply') }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const modifierRows = MATRIX_CONSOLE_DEFS.map((def) => {
    const mod = MATRIX_CONSOLE_MODIFIER_BY_KEY[def.console_key] ?? {
      modifier_percent: 0,
      tier: 'base',
    }
    return {
      brand: MATRIX_BRAND,
      console_key: def.console_key,
      console_name: def.console_name,
      console_tier: mod.tier,
      modifier_type: 'percentage',
      modifier_value: Number(mod.modifier_percent ?? 0),
      confidence: 90,
      source: 'matrix_console_key_backfill',
      notes: `Stable key ${def.console_key}; public label ${def.console_name}.`,
    }
  })

  console.log(`${args.apply ? 'APPLY' : 'DRY-RUN'}: ${modifierRows.length} Matrix Fitness modifier rows`)

  if (args.apply) {
    // Remove legacy brand="Matrix" rows that collide by display name.
    const { error: deleteLegacyError } = await supabase
      .from('equipment_console_modifiers')
      .delete()
      .eq('brand', 'Matrix')
    if (deleteLegacyError) throw deleteLegacyError

    for (const row of modifierRows) {
      const { data: existing } = await supabase
        .from('equipment_console_modifiers')
        .select('id')
        .eq('brand', MATRIX_BRAND)
        .eq('console_key', row.console_key)
        .maybeSingle()

      if (existing?.id) {
        const { error } = await supabase
          .from('equipment_console_modifiers')
          .update(row)
          .eq('id', existing.id)
        if (error) throw error
      } else {
        // Also try match by console_name for rows without key yet.
        const { data: byName } = await supabase
          .from('equipment_console_modifiers')
          .select('id')
          .eq('brand', MATRIX_BRAND)
          .ilike('console_name', row.console_name)
          .is('console_key', null)
          .maybeSingle()

        if (byName?.id) {
          const { error } = await supabase
            .from('equipment_console_modifiers')
            .update(row)
            .eq('id', byName.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('equipment_console_modifiers').insert(row)
          if (error) throw error
        }
      }
    }
  }

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('id, console_key')
    .eq('brand', MATRIX_BRAND)
  if (consolesError) throw consolesError

  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))
  const compatUpdates = []

  for (const [consoleKey, mod] of Object.entries(MATRIX_CONSOLE_MODIFIER_BY_KEY)) {
    const consoleId = consoleIdByKey.get(consoleKey)
    if (!consoleId) continue
    compatUpdates.push({
      console_id: consoleId,
      console_key: consoleKey,
      modifier_percent: Number(mod.modifier_percent ?? 0),
      tier: mod.tier,
    })
  }

  if (args.apply) {
    for (const update of compatUpdates) {
      const { error } = await supabase
        .from('product_console_compat')
        .update({
          modifier_percent: update.modifier_percent,
          tier: update.tier,
        })
        .eq('console_id', update.console_id)
      if (error) throw error
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    modifier_rows: modifierRows,
    compat_updates: compatUpdates,
  }
  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    args.apply ? 'matrix-console-modifiers-backfill-apply.json' : 'matrix-console-modifiers-backfill-dry-run.json',
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(args.apply ? 'Apply complete.' : 'Dry-run complete. Re-run with --apply to write.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
