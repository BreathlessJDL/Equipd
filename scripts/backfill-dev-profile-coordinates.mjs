#!/usr/bin/env node
/**
 * Backfill dev-seed profile coordinates for seller-delivery radius testing.
 *
 * Usage:
 *   SEED_DEV_ALLOW=true node scripts/backfill-dev-profile-coordinates.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DEV_PROFILE_COORDINATES } from './seed-dev-data.mjs'
import { assertSeedWriteAllowed } from './lib/supabaseProjectSafety.mjs'

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

async function main() {
  loadEnvFile('.env.local')
  const target = assertSeedWriteAllowed()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const supabase = createClient(target.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const [profileId, coords] of Object.entries(DEV_PROFILE_COORDINATES)) {
    const { error } = await supabase
      .from('profiles')
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .eq('id', profileId)

    if (error) {
      throw new Error(`Failed to update profile ${profileId}: ${error.message}`)
    }

    console.log(`Updated profile ${profileId} → ${coords.latitude}, ${coords.longitude}`)
  }

  console.log('Dev profile coordinates backfill complete.')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
