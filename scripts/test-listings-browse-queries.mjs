#!/usr/bin/env node
/**
 * Verify browse listing queries against Supabase (legacy + structured location).
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const LEGACY_FIELDS =
  'id, slug, title, brand, model, price_pence, condition, location, latitude, longitude, status, seller_id, rating, collection_available, courier_available, created_at, updated_at'

async function main() {
  const structuredProbe = await supabase.from('listings').select('location_name').limit(0)
  const structuredAvailable = !structuredProbe.error
  console.log(`Structured listing location columns available: ${structuredAvailable}`)

  const basic = await supabase
    .from('listings')
    .select(`${LEGACY_FIELDS}, category:categories(id, name, slug)`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5)

  if (basic.error) throw new Error(`basic browse failed: ${basic.error.message}`)

  const search = await supabase
    .from('listings')
    .select('id, title')
    .eq('status', 'active')
    .or('title.ilike.%bike%,brand.ilike.%bike%,model.ilike.%bike%,description.ilike.%bike%')
    .limit(5)

  if (search.error) throw new Error(`keyword search failed: ${search.error.message}`)

  const rpc = await supabase.rpc('search_listings_with_distance', {
    p_buyer_lat: 53.8008,
    p_buyer_lng: -1.5491,
    p_radius_miles: 50,
    p_sort: 'nearest',
    p_limit: 5,
  })

  if (rpc.error && rpc.error.code !== 'PGRST202') {
    throw new Error(`distance RPC failed unexpectedly: ${rpc.error.message}`)
  }

  console.log('PASS: legacy browse queries work without Phase 5A columns')
  console.log(`  basic rows: ${basic.data?.length ?? 0}`)
  console.log(`  search rows: ${search.data?.length ?? 0}`)
  console.log(`  distance RPC deployed: ${rpc.error ? 'no (client fallback expected)' : 'yes'}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
