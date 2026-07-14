#!/usr/bin/env node
/**
 * Fix Technogym Excite Step equipment_type + list contaminated content IDs.
 *   node scripts/repair-technogym-stepper-types.mjs --dry-run
 *   node scripts/repair-technogym-stepper-types.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findCategoryIncompatibleTerms } from '../src/lib/equipmentProductContent.js'
import { isStepperCardioProductIdentity } from '../src/lib/equipmentCardio.js'

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

const { data: products, error } = await sb
  .from('equipment_products')
  .select('id,brand,product_family,model,equipment_type,canonical_product_name,canonical_product_key,status')
  .ilike('brand', 'Technogym')
  .neq('status', 'excluded')

if (error) throw error

const steppers = (products || []).filter((product) => isStepperCardioProductIdentity(product))
const typeFixes = steppers.filter((product) => !product.equipment_type)

const ids = steppers.map((p) => p.id)
const { data: contentRows } = ids.length
  ? await sb.from('equipment_product_content')
    .select('equipment_product_id,generation_status,overview_text,seo_title,seo_meta_description')
    .in('equipment_product_id', ids)
  : { data: [] }

const contentById = Object.fromEntries((contentRows || []).map((row) => [row.equipment_product_id, row]))

const contaminated = steppers.map((product) => {
  const content = contentById[product.id]
  if (!content?.overview_text) return null
  const terms = findCategoryIncompatibleTerms(content.overview_text, {
    ...product,
    equipment_type: product.equipment_type || 'Stepper',
  })
  const strengthHit = /selectori[sz]ed|weight\s+stack|plate[-\s]?loaded|pin[-\s]?loaded|strength\s+station/i
    .test([content.overview_text, content.seo_title, content.seo_meta_description].join('\n'))
  if (!terms.length && !strengthHit) return null
  return {
    id: product.id,
    name: product.canonical_product_name,
    key: product.canonical_product_key,
    content_status: content.generation_status,
    old_overview: content.overview_text,
    terms: terms.map((t) => t.label || t),
  }
}).filter(Boolean)

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  stepper_count: steppers.length,
  type_fix_count: typeFixes.length,
  contaminated_content_count: contaminated.length,
  type_fixes: typeFixes.map((p) => ({
    id: p.id,
    name: p.canonical_product_name,
    from: p.equipment_type,
    to: 'Stepper',
  })),
  contaminated,
}, null, 2))

if (!apply) {
  console.error('\nDry-run only. Pass --apply to set equipment_type=Stepper on blank/non-stepper cardio step products.')
  process.exit(0)
}

for (const product of typeFixes) {
  const { error: updateError } = await sb
    .from('equipment_products')
    .update({
      equipment_type: 'Stepper',
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id)
  if (updateError) throw updateError
}

console.error(JSON.stringify({ type_fixed: typeFixes.length, regenerate_ids: contaminated.map((row) => row.id) }, null, 2))
