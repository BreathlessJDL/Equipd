#!/usr/bin/env node
/**
 * Audit active listings missing usable coordinates (excluded from 40-mile hubs).
 *
 *   node scripts/audit-listing-coordinates.mjs
 *
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from .env.local when present.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  LOCATION_HUB_RADIUS_MILES,
  LOCATION_PAGES,
  LOCATION_SLUGS,
  getLocationHubSearch,
} from '../src/lib/locations.js'
import { haversineDistanceMiles } from '../src/lib/listingDistance.js'

function loadEnvLocal() {
  const path = '.env.local'
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const fileEnv = loadEnvLocal()
const url = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase URL/anon key (.env.local or env).')
  process.exit(1)
}

const supabase = createClient(url, key)

const pageSize = 1000
let from = 0
const rows = []

while (true) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, status, location, city, latitude, longitude')
    .eq('status', 'active')
    .range(from, from + pageSize - 1)

  if (error) {
    console.error(error)
    process.exit(1)
  }

  rows.push(...(data ?? []))
  if (!data || data.length < pageSize) break
  from += pageSize
}

const missingCoords = rows.filter(
  (row) =>
    row.latitude == null ||
    row.longitude == null ||
    !Number.isFinite(Number(row.latitude)) ||
    !Number.isFinite(Number(row.longitude)),
)

const hubCounts = {}
for (const slug of LOCATION_SLUGS) {
  const hub = getLocationHubSearch(LOCATION_PAGES[slug])
  let count = 0
  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) continue
    const miles = haversineDistanceMiles(
      hub.latitude,
      hub.longitude,
      Number(row.latitude),
      Number(row.longitude),
    )
    if (miles != null && miles <= LOCATION_HUB_RADIUS_MILES) count += 1
  }
  hubCounts[slug] = count
}

const summary = {
  activeListings: rows.length,
  missingCoordinates: missingCoords.length,
  missingCoordinatesPct:
    rows.length === 0 ? 0 : Number(((missingCoords.length / rows.length) * 100).toFixed(1)),
  note: 'Listings without lat/lng are excluded from 40-mile location hubs (haversine RPC). They remain eligible for non-radius browse.',
  radiusMiles: LOCATION_HUB_RADIUS_MILES,
  hubEligibleCounts: hubCounts,
  sampleMissing: missingCoords.slice(0, 8).map((row) => ({
    id: row.id,
    location: row.location,
    city: row.city,
  })),
}

console.log(JSON.stringify(summary, null, 2))
