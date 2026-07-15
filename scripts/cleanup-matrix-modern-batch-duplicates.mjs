#!/usr/bin/env node
/**
 * Clean duplicate Matrix modern products created when core_model/key changed.
 * Keeps the stronger full-model key rows; excludes weak equipment-type-only keys.
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

async function main() {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: batch } = await sb
    .from('equipment_intelligence')
    .select('id')
    .ilike('brand', 'Matrix Fitness')
    .gte('created_at', '2026-07-10T16:42:00Z')
    .lte('created_at', '2026-07-10T16:43:00Z')
  const batchIds = new Set((batch ?? []).map((row) => row.id))

  const { data: products } = await sb
    .from('equipment_products')
    .select('id, canonical_product_name, canonical_product_key, status, model, source_intelligence_row_ids, review_notes')
    .ilike('brand', 'Matrix Fitness')

  const linked = (products ?? []).filter((product) =>
    (product.source_intelligence_row_ids ?? []).some((id) => batchIds.has(id)),
  )

  const bySource = new Map()
  for (const product of linked) {
    for (const id of product.source_intelligence_row_ids ?? []) {
      if (!batchIds.has(id)) continue
      const list = bySource.get(id) ?? []
      list.push(product)
      bySource.set(id, list)
    }
  }

  const toExclude = []
  const keepers = []
  for (const [sourceId, group] of bySource) {
    if (group.length < 2) {
      keepers.push(group[0])
      continue
    }
    const ranked = [...group].sort((a, b) => {
      const aApproved = a.status === 'approved' ? 1 : 0
      const bApproved = b.status === 'approved' ? 1 : 0
      if (aApproved !== bApproved) return bApproved - aApproved
      // Prefer longer model / key (full "Endurance ClimbMill" over "ClimbMill")
      return String(b.model ?? '').length - String(a.model ?? '').length
        || String(b.canonical_product_key).length - String(a.canonical_product_key).length
    })
    keepers.push(ranked[0])
    for (const duplicate of ranked.slice(1)) {
      toExclude.push({
        id: duplicate.id,
        key: duplicate.canonical_product_key,
        name: duplicate.canonical_product_name,
        status: duplicate.status,
        keeper_id: ranked[0].id,
        keeper_key: ranked[0].canonical_product_key,
        source_id: sourceId,
      })
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    linked_products: linked.length,
    source_rows_with_duplicates: [...bySource.values()].filter((g) => g.length > 1).length,
    keepers: keepers.length,
    to_exclude: toExclude.length,
    exclusions: toExclude,
  }, null, 2))

  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to exclude duplicates.')
    return
  }

  for (const row of toExclude) {
    const { error } = await sb
      .from('equipment_products')
      .update({
        status: 'excluded',
        review_notes: [
          row.status === 'approved' ? null : null,
          `Superseded by ${row.keeper_id} (${row.keeper_key}) — Matrix modern batch key normalization.`,
        ].filter(Boolean).join('\n') || `Superseded by ${row.keeper_id} (${row.keeper_key}) — Matrix modern batch key normalization.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) throw error
  }

  console.log(`Excluded ${toExclude.length} duplicate product(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
