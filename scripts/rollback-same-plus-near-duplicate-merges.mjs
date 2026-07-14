#!/usr/bin/env node
/**
 * Roll back unsafe same_plus_near_duplicate merges from audit-plus-canonical-duplicates.
 * Keeps ifi_twin exclusions in place.
 *
 *   node scripts/rollback-same-plus-near-duplicate-merges.mjs --dry-run
 *   node scripts/rollback-same-plus-near-duplicate-merges.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^["']|["']$/g, '')
  }
  return env
}

const apply = process.argv.includes('--apply')
const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await sb
  .from('equipment_products')
  .select('id,status,canonical_product_name,canonical_product_key,review_notes')
  .eq('status', 'excluded')
  .ilike('brand', 'Technogym')
  .ilike('review_notes', '%class=same_plus_near_duplicate%')

if (error) throw error

const rows = data || []
console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  rollback_count: rows.length,
  products: rows.map((row) => ({
    id: row.id,
    name: row.canonical_product_name,
    key: row.canonical_product_key,
    review_notes: row.review_notes,
  })),
}, null, 2))

if (!apply) {
  console.error('\nDry-run only. Pass --apply to restore these rows to approved.')
  process.exit(0)
}

for (const row of rows) {
  const cleanedNotes = String(row.review_notes || '')
    .replace(/\[duplicate_merge[^\]]*\][^.]*\.\s*/g, '')
    .replace(/legacy_key=[^\s]+\s*/g, '')
    .replace(/class=same_plus_near_duplicate\s*/g, '')
    .trim() || null

  const { error: updateError } = await sb
    .from('equipment_products')
    .update({
      status: 'approved',
      review_notes: cleanedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (updateError) throw updateError
}

console.error(JSON.stringify({ restored: rows.length }, null, 2))
