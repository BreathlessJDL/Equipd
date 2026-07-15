#!/usr/bin/env node
/**
 * Publish exactly eight reviewed Technogym Excite Step content drafts.
 * Does not regenerate. Uses the same status transition as admin publish.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  publishEquipmentProductContentDrafts,
} from '../src/lib/equipmentProductContentAdmin.js'
import { buildEquipmentProductPagePath } from '../src/lib/equipmentPageSeo.js'

const PRODUCT_IDS = [
  '3679b635-1599-45ce-856c-138e9d62a8ec', // 700 Digital
  '5f165454-efc2-4925-a3d4-58f90b4302d4', // 500i
  '5611dfc7-aa70-45c0-b7e8-724beafe4b34', // 1000
  '3812ffa1-d42c-40ac-a854-529bc06bf331', // 700i
  '7e9704d7-88ed-4581-b6d1-d913e2d05ff4', // 500
  'f64fcb0d-0127-42d1-8c3f-1a61883f861f', // 700 step-excite-700
  '0fcc0b0e-c61e-4047-8db1-8859e15b5754', // 700 excite-700
  '6518412b-4ffe-47db-b581-b70f242acc3f', // 700 excite-step-700
]

const EXPECTED_KEYS = new Set([
  'technogym-excite-step-step-excite-700-digital',
  'technogym-excite-step-500i',
  'technogym-excite-2016-step-excite-1000',
  'technogym-excite-step-700i',
  'technogym-excite-step-step-excite-500',
  'technogym-excite-step-step-excite-700',
  'technogym-excite-step-excite-700',
  'technogym-excite-step-700',
])

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

const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error: productsError } = await sb
  .from('equipment_products')
  .select('id,status,canonical_product_name,canonical_product_key,original_base_price,baseline_manufacture_year,equipment_type')
  .in('id', PRODUCT_IDS)

if (productsError) throw productsError

const { data: contentRows, error: contentError } = await sb
  .from('equipment_product_content')
  .select('id,equipment_product_id,generation_status,overview_text,version,approved_at')
  .in('equipment_product_id', PRODUCT_IDS)

if (contentError) throw contentError

const productById = Object.fromEntries((products || []).map((row) => [row.id, row]))
const contentByProductId = Object.fromEntries((contentRows || []).map((row) => [row.equipment_product_id, row]))

const preflight = PRODUCT_IDS.map((productId) => {
  const product = productById[productId]
  const content = contentByProductId[productId]
  return {
    product_id: productId,
    name: product?.canonical_product_name || null,
    key: product?.canonical_product_key || null,
    product_status: product?.status || null,
    content_id: content?.id || null,
    content_status: content?.generation_status || 'missing',
    version: content?.version ?? null,
    eligible: Boolean(
      content?.id
      && content.generation_status === 'draft'
      && EXPECTED_KEYS.has(product?.canonical_product_key),
    ),
    skip_reason: !content
      ? 'missing_content_row'
      : content.generation_status !== 'draft'
        ? `not_draft:${content.generation_status}`
        : !EXPECTED_KEYS.has(product?.canonical_product_key)
          ? 'unexpected_key'
          : null,
  }
})

const toPublish = preflight.filter((row) => row.eligible)
const skipped = preflight.filter((row) => !row.eligible)

console.log(JSON.stringify({ phase: 'preflight', toPublish: toPublish.length, skipped }, null, 2))

if (toPublish.length !== 8) {
  console.error(`Expected 8 publishable drafts, found ${toPublish.length}. Aborting.`)
  process.exit(1)
}

const result = await publishEquipmentProductContentDrafts(
  toPublish.map((row) => row.content_id),
  { supabaseClient: sb },
)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

const { data: afterRows, error: afterError } = await sb
  .from('equipment_product_content')
  .select('id,equipment_product_id,generation_status,overview_text,version,approved_at,updated_at')
  .in('equipment_product_id', PRODUCT_IDS)

if (afterError) throw afterError

const afterByProduct = Object.fromEntries((afterRows || []).map((row) => [row.equipment_product_id, row]))

const report = PRODUCT_IDS.map((productId) => {
  const product = productById[productId]
  const after = afterByProduct[productId]
  const overview = after?.overview_text || ''
  const path = buildEquipmentProductPagePath(product.canonical_product_key)
  return {
    product_id: productId,
    name: product.canonical_product_name,
    key: product.canonical_product_key,
    product_status: product.status,
    content_status: after?.generation_status || null,
    version: after?.version ?? null,
    public_path: path,
    public_url: `https://www.equipd.co.uk${path}`,
    describes_cardio_stepper: /cardio\s+stepper|stepper/i.test(overview) && /cardio/i.test(overview),
    has_banned_strength: /selectori[sz]ed|weight\s+stack|pin[-\s]?loaded|plate[-\s]?loaded|strength\s+station|lower[\s-]body\s+strength|cable\s+machine/i.test(overview),
    rrp_unchanged: product.original_base_price,
    year_unchanged: product.baseline_manufacture_year,
    equipment_type: product.equipment_type,
  }
})

console.log(JSON.stringify({
  phase: 'published',
  published_count: result.publishedCount,
  published_content_ids: result.publishedIds,
  skipped_preflight: skipped,
  rows: report,
}, null, 2))
