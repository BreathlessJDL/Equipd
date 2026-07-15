#!/usr/bin/env node
/**
 * Remove Technogym TV and Digital TV console masters completely.
 * Deletes product_console_compat rows first (FK restrict), then consoles,
 * then any matching equipment_console_modifiers.
 *
 * Usage:
 *   node scripts/remove-technogym-tv-consoles.mjs --dry-run
 *   node scripts/remove-technogym-tv-consoles.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const KEYS = ['tv', 'digital_tv']
const BRAND = 'Technogym'

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

const apply = process.argv.includes('--apply')
const env = loadEnv()
const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const { data: consoles, error } = await supabase
  .from('equipment_consoles')
  .select('id, brand, console_key, console_name, image_status, active')
  .ilike('brand', BRAND)
  .in('console_key', KEYS)
if (error) throw error

const ids = (consoles ?? []).map((row) => row.id)
let compatCount = 0
let modifierCount = 0

if (ids.length) {
  const { count, error: cErr } = await supabase
    .from('product_console_compat')
    .select('id', { count: 'exact', head: true })
    .in('console_id', ids)
  if (cErr) throw cErr
  compatCount = count ?? 0
}

const { data: modifiers, error: mErr } = await supabase
  .from('equipment_console_modifiers')
  .select('id, brand, console_key, console_name')
  .ilike('brand', BRAND)
  .or('console_key.in.(tv,digital_tv),console_name.in.(TV,Digital TV,"Digital Television")')
if (mErr) throw mErr
modifierCount = (modifiers ?? []).length

const plan = {
  mode: apply ? 'apply' : 'dry-run',
  consoles,
  compat_rows_to_delete: compatCount,
  modifiers_to_delete: modifiers ?? [],
}
mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
writeFileSync(
  join(process.cwd(), 'reports', 'remove-technogym-tv-consoles.json'),
  `${JSON.stringify(plan, null, 2)}\n`,
)
console.log(JSON.stringify(plan, null, 2))

if (!apply) {
  console.log('Dry-run only. Pass --apply to delete.')
  process.exit(0)
}

if (ids.length) {
  const { error: delCompat } = await supabase
    .from('product_console_compat')
    .delete()
    .in('console_id', ids)
  if (delCompat) throw delCompat

  const { error: delConsoles } = await supabase
    .from('equipment_consoles')
    .delete()
    .in('id', ids)
  if (delConsoles) throw delConsoles
}

if ((modifiers ?? []).length) {
  const { error: delMods } = await supabase
    .from('equipment_console_modifiers')
    .delete()
    .in('id', (modifiers ?? []).map((row) => row.id))
  if (delMods) throw delMods
}

const { data: remaining } = await supabase
  .from('equipment_consoles')
  .select('id, console_key')
  .ilike('brand', BRAND)
  .in('console_key', KEYS)

console.log(`Deleted ${ids.length} consoles, ${compatCount} compat rows, ${modifierCount} modifiers.`)
console.log('Remaining TV/Digital TV consoles:', remaining ?? [])
