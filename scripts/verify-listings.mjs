#!/usr/bin/env node
/**
 * Verify listing counts in Supabase vs homepage/browse queries.
 * Uses anon key (same as the app) and optionally service role for full counts.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RECENT_LISTINGS_LIMIT = 8
const DEV_SEED_PREFIX = 'dev-seed-'

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

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const anon = createClient(url, anonKey)
const admin = serviceKey
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

async function count(client, label, builder) {
  const { count, error } = await builder(client)
  if (error) {
    console.log(`${label}: ERROR — ${error.message}`)
    return null
  }
  console.log(`${label}: ${count ?? 0}`)
  return count
}

async function fetchHomepageQuery(client) {
  const { data, error } = await client
    .from('listings')
    .select(CARD_FIELDS, { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(RECENT_LISTINGS_LIMIT)

  return { data, error, count: data?.length ?? 0 }
}

const CARD_FIELDS =
  'id, slug, title, brand, model, price_pence, condition, location, status, seller_id, rating, collection_available, courier_available, created_at, updated_at, listing_images(id, storage_path, sort_order)'

console.log('=== Equipd listing verification ===\n')
console.log(`Supabase URL: ${url}`)
console.log(`Service role available: ${Boolean(admin)}`)
console.log(`SEED_DEV_ALLOW: ${process.env.SEED_DEV_ALLOW ?? '(not set)'}\n`)

if (admin) {
  await count(admin, 'Total listings (all statuses, admin)', (c) =>
    c.from('listings').select('*', { count: 'exact', head: true }),
  )
  await count(admin, 'Dev-seed listings (admin)', (c) =>
    c.from('listings').select('*', { count: 'exact', head: true }).like('slug', `${DEV_SEED_PREFIX}%`),
  )

  const { data: byStatus } = await admin.from('listings').select('status')
  if (byStatus) {
    const tally = byStatus.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, {})
    console.log('Listings by status (admin):', tally)
  }
} else {
  console.log('No SUPABASE_SERVICE_ROLE_KEY — skipping full table counts.\n')
}

await count(anon, 'Active listings visible to anon (app query base)', (c) =>
  c.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
)

const { data: homepageRows, error: homepageError } = await fetchHomepageQuery(anon)
if (homepageError) {
  console.log(`Homepage fetchActiveListings equivalent: ERROR — ${homepageError.message}`)
} else {
  console.log(`Homepage Recently Added rows returned: ${homepageRows.length} (limit ${RECENT_LISTINGS_LIMIT})`)
  if (homepageRows.length) {
    console.log('  Slugs:', homepageRows.map((r) => r.slug).join(', '))
  }
}

const { count: browseCount, error: browseError } = await anon
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'active')

if (browseError) {
  console.log(`Browse page base count: ERROR — ${browseError.message}`)
} else {
  console.log(`Browse page visible (status=active, no filters): ${browseCount}`)
}

console.log('\n=== Homepage query logic ===')
console.log('Recently Added: fetchActiveListings({ limit: 8 })')
console.log('  → status = "active"')
console.log('  → order by created_at DESC')
console.log('  → limit 8')
console.log('Browse section on homepage: fetchActiveListings(queryOptions) with filters')
console.log('  → same base: status = "active" + optional search/category/condition/rating/price/brand/sort')

console.log('\n=== Exclusion flags ===')
console.log('No moderation, visibility, published, or deleted columns on listings.')
console.log('RLS hides non-active listings from anon except own drafts (authenticated).')
console.log('Seeded sold listing (dev-seed-york-plates-manchester) excluded by status=sold.')
