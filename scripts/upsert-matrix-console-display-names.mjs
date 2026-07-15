#!/usr/bin/env node
/**
 * Upsert Matrix console display names only (keys/compat unchanged).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MATRIX_BRAND, MATRIX_CONSOLE_DEFS } from '../src/lib/matrixConsoleCompat.js'

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

async function main() {
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const rows = MATRIX_CONSOLE_DEFS.map((def) => ({
    brand: MATRIX_BRAND,
    console_key: def.console_key,
    console_name: def.console_name,
    alternative_names: def.alternative_names ?? [],
    start_year: def.start_year ?? null,
    end_year: def.end_year ?? null,
    start_year_approximate: Boolean(def.start_year_approximate),
    end_year_approximate: Boolean(def.end_year_approximate),
    is_current: Boolean(def.is_current),
    display_order: def.display_order ?? 0,
    active: true,
    image_url: def.image_url ?? null,
    image_status: def.image_url ? 'approved' : 'none',
    source_url: def.source_url ?? null,
    notes: def.notes ?? null,
    confidence: def.confidence ?? 'medium',
  }))

  const { error } = await supabase
    .from('equipment_consoles')
    .upsert(rows, { onConflict: 'brand,console_key' })
  if (error) throw error

  const { data, error: readError } = await supabase
    .from('equipment_consoles')
    .select('console_key, console_name')
    .eq('brand', MATRIX_BRAND)
    .in('console_key', [
      'led_1x', 'led_3x', 'led_5x', 'led_7x', 'xe', '7xe', '7xi',
      'led', 'premium_led', 'touch', 'touch_xl',
    ])
    .order('display_order')
  if (readError) throw readError

  console.log('Matrix console display names upserted:')
  for (const row of data ?? []) {
    console.log(`  ${row.console_key} → ${row.console_name}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
