#!/usr/bin/env node
/**
 * Reject two known cross-family pending image mismatches from the first CSV pass.
 * Does not alter any other pending suggestions.
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

const TARGETS = [
  {
    id: '49959fe5-979c-4be3-948c-06650f40937a',
    expectedName: 'Technogym Selection Pro Pulldown',
    reason: 'rejected_cross_family_mismatch:selection_pro_to_pure_strength_pulldown',
  },
  {
    id: '9459408d-a6da-42f9-8849-dcd7ef19d88b',
    expectedName: 'Technogym Strength Panca Regolabile',
    reason: 'rejected_cross_family_mismatch:strength_to_pure_strength_adjustable_bench',
  },
]

const env = loadEnv()
const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const results = []
for (const target of TARGETS) {
  const { data: before, error: fetchError } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_name, image_status, image_source_url, image_url, image_storage_path, image_confidence')
    .eq('id', target.id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!before) throw new Error(`Product not found: ${target.id}`)
  if (before.canonical_product_name !== target.expectedName) {
    throw new Error(`Name mismatch for ${target.id}: ${before.canonical_product_name}`)
  }
  if (before.image_status !== 'suggested') {
    results.push({
      ...target,
      skipped: true,
      reason: `current_status_${before.image_status}`,
    })
    continue
  }

  const { error } = await supabase
    .from('equipment_products')
    .update({
      image_status: 'rejected',
      image_failure_reason: target.reason,
      image_confidence: 0,
      image_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Keep assets for audit; demote from pending review queue.
    })
    .eq('id', target.id)
    .eq('image_status', 'suggested')
  if (error) throw error

  results.push({
    product_id: target.id,
    canonical_product_name: target.expectedName,
    previous_status: before.image_status,
    previous_source: before.image_source_url,
    new_status: 'rejected',
    reason: target.reason,
  })
  console.log(`rejected | ${target.expectedName}`)
}

console.log(JSON.stringify({ rejected: results.length, results }, null, 2))
