#!/usr/bin/env node
/**
 * Repair stale/missing equipment_consoles.image_url values where the approved
 * static asset already exists under public/equipment-console-images/.
 *
 * Does not change console compatibility or modifiers.
 *
 * Usage:
 *   node scripts/repair-public-console-image-paths.mjs --dry-run
 *   node scripts/repair-public-console-image-paths.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPAIRS = [
  {
    brand: 'Matrix Fitness',
    console_key: 'onyx_22',
    image_url: '/equipment-console-images/matrix-fitness/normalized/onyx-22.png',
    image_storage_path: 'equipment-console-images/matrix-fitness/normalized/onyx-22.png',
  },
  {
    brand: 'Matrix Fitness',
    console_key: 'onyx_32',
    image_url: '/equipment-console-images/matrix-fitness/normalized/onyx-32.png',
    image_storage_path: 'equipment-console-images/matrix-fitness/normalized/onyx-32.png',
  },
]

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

function localPathFromImageUrl(imageUrl) {
  const text = String(imageUrl ?? '').trim()
  if (!text.startsWith('/equipment-console-images/')) {
    throw new Error(`Expected static console path, got ${imageUrl}`)
  }
  return join(process.cwd(), 'public', text.slice(1))
}

async function main() {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const plan = []
  for (const repair of REPAIRS) {
    const localPath = localPathFromImageUrl(repair.image_url)
    if (!existsSync(localPath)) {
      plan.push({ ...repair, error: 'local_file_missing', localPath })
      continue
    }

    const { data, error } = await supabase
      .from('equipment_consoles')
      .select('id, brand, console_key, console_name, image_url, image_storage_path, image_status')
      .ilike('brand', repair.brand)
      .eq('console_key', repair.console_key)
      .limit(1)
    if (error) throw error

    const row = data?.[0]
    if (!row) {
      plan.push({ ...repair, error: 'console_not_found' })
      continue
    }

    const alreadyOk = row.image_url === repair.image_url
      && row.image_storage_path === repair.image_storage_path
      && row.image_status === 'approved'

    plan.push({
      ...repair,
      console_id: row.id,
      console_name: row.console_name,
      previous_image_url: row.image_url,
      previous_image_storage_path: row.image_storage_path,
      previous_image_status: row.image_status,
      already_ok: alreadyOk,
      localPath,
    })
  }

  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  for (const row of plan) {
    if (row.error) {
      console.log(`FAIL ${row.brand}/${row.console_key}: ${row.error}`)
      continue
    }
    if (row.already_ok) {
      console.log(`OK   ${row.brand}/${row.console_name}: already correct`)
      continue
    }
    console.log(`FIX  ${row.brand}/${row.console_name} (${row.console_key})`)
    console.log(`  ${row.previous_image_url || '(none)'} => ${row.image_url}`)
  }

  if (!apply) {
    console.log('Dry-run only. Pass --apply to write.')
    return
  }

  let updated = 0
  for (const row of plan) {
    if (row.error || row.already_ok) continue
    const { error } = await supabase
      .from('equipment_consoles')
      .update({
        image_url: row.image_url,
        image_storage_path: row.image_storage_path,
        image_status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.console_id)
    if (error) throw error
    updated += 1
  }

  console.log(`Updated ${updated} console image path(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
