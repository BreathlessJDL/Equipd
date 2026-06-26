#!/usr/bin/env node
/**
 * Backfill latitude/longitude on dev seed listings (and other listings with known UK city text).
 *
 * Radius search requires listing coordinates. Dev seed data only had text locations until Phase 5A.
 *
 * Usage:
 *   SEED_DEV_ALLOW=true node scripts/backfill-dev-listing-coordinates.mjs
 *
 * Safe to re-run — only updates rows missing coordinates.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DEV_LOCATION_COORDINATES } from './seed-dev-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assertDevSafe() {
  if (process.env.SEED_DEV_ALLOW !== 'true') {
    throw new Error('Set SEED_DEV_ALLOW=true before running this backfill script.')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  assertDevSafe()

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, slug, location, latitude, longitude, location_name, city, county')
    .is('latitude', null)

  if (error) throw error

  let updated = 0
  let skipped = 0

  for (const listing of listings ?? []) {
    if (listing.latitude != null && listing.longitude != null) {
      skipped += 1
      continue
    }

    const coords = DEV_LOCATION_COORDINATES[listing.location?.trim()]
    if (!coords) {
      console.log(`  Skip ${listing.slug}: no coordinate map for "${listing.location}"`)
      skipped += 1
      continue
    }

    const patch = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      location_name: coords.location_name,
      city: coords.city,
      county: coords.county,
    }

    const { error: updateError } = await supabase.from('listings').update(patch).eq('id', listing.id)

    if (updateError) {
      if (/column .* does not exist/i.test(updateError.message)) {
        const { error: legacyError } = await supabase
          .from('listings')
          .update({
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
          .eq('id', listing.id)

        if (legacyError) throw legacyError
      } else {
        throw updateError
      }
    }

    updated += 1
    console.log(`  Updated ${listing.slug} → ${coords.city} (${coords.latitude}, ${coords.longitude})`)
  }

  console.log(`\nBackfill complete. Updated ${updated}, skipped ${skipped}.`)
  console.log(
    'Note: listings created before Phase 5A without coordinates are excluded from radius search until edited with Google Places.',
  )
}

main().catch((error) => {
  console.error('\nBackfill failed:', error.message)
  process.exit(1)
})
