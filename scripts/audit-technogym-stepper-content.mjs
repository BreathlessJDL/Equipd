#!/usr/bin/env node
/**
 * Audit Technogym Step / Stepper products for strength-contaminated content.
 * Dry-run only — prints side-by-side candidates; does not regenerate or publish.
 *
 *   node scripts/audit-technogym-stepper-content.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  findCategoryIncompatibleTerms,
  resolveContentEquipmentIdentityFamily,
  resolveProductContentCategory,
} from '../src/lib/equipmentProductContent.js'

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

const STRENGTH_TERMS = /selectori[sz]ed|plate[-\s]?loaded|pin[-\s]?loaded|weight\s+stack|strength\s+station|leg[- ]strength|cable\s+resistance/i

const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error } = await sb
  .from('equipment_products')
  .select('id,brand,product_family,model,equipment_type,canonical_product_name,canonical_product_key,status')
  .ilike('brand', 'Technogym')
  .or('equipment_type.ilike.%step%,model.ilike.%step%,canonical_product_name.ilike.%step%,product_family.ilike.%step%')

if (error) throw error

const stepperish = (products || []).filter((product) => {
  const hay = [
    product.equipment_type,
    product.model,
    product.canonical_product_name,
    product.product_family,
  ].join(' ')
  return /\bstep(?:per|s)?\b|\bstair\s*climber\b|\bexcite\s+step\b/i.test(hay)
    && !/chest\s+press|leg\s+press|selectorised/i.test(product.equipment_type || '')
})

const ids = stepperish.map((p) => p.id)
const { data: contentRows } = ids.length
  ? await sb
    .from('equipment_product_content')
    .select('equipment_product_id,generation_status,overview_text,seo_title,seo_meta_description,faq_json')
    .in('equipment_product_id', ids)
  : { data: [] }

const contentById = Object.fromEntries(
  (contentRows || []).map((row) => [row.equipment_product_id, row]),
)

const report = {
  product_count: stepperish.length,
  products: stepperish.map((product) => {
    const content = contentById[product.id] || null
    const family = resolveContentEquipmentIdentityFamily(product)
    const category = resolveProductContentCategory(product)
    const overview = content?.overview_text || ''
    const seoBlob = [content?.seo_title, content?.seo_meta_description, overview].join('\n')
    const incompat = content
      ? findCategoryIncompatibleTerms(overview, product)
      : []
    const strengthHit = STRENGTH_TERMS.test(seoBlob)
    return {
      id: product.id,
      name: product.canonical_product_name,
      key: product.canonical_product_key,
      type: product.equipment_type,
      status: product.status,
      identity_family: family,
      content_category: category,
      content_status: content?.generation_status || 'missing',
      strength_contaminated: strengthHit || incompat.length > 0,
      incompatible_terms: incompat.map((term) => term.label || term),
      overview_excerpt: overview ? overview.slice(0, 280) : null,
      recommended_action: (strengthHit || incompat.length > 0)
        ? 'regenerate_draft_only_keep_identity'
        : 'leave_unchanged',
    }
  }),
}

report.needs_correction = report.products.filter((row) => row.strength_contaminated)
console.log(JSON.stringify(report, null, 2))
