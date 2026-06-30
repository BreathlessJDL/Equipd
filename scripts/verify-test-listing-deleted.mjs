#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
function loadEnvFile(relativePath) {
  const envPath = path.join(ROOT, relativePath)
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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

const slug = 'test-listing-title-c8e92a10'
const listingId = 'cce2b633-6203-4204-b9d3-b2ca681f4f09'
const storagePath =
  '11111111-1111-4111-8111-111111111101/cce2b633-6203-4204-b9d3-b2ca681f4f09/3bcec4bc-5af8-4601-8462-1c99141291ab.png'

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const checks = []

const { count: listingCount } = await admin
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .eq('slug', slug)
checks.push(['listings row', listingCount === 0])

const { count: browseCount } = await admin
  .from('listings_public_browse')
  .select('*', { count: 'exact', head: true })
  .eq('slug', slug)
checks.push(['listings_public_browse row', browseCount === 0])

const { count: savedCount } = await admin
  .from('saved_listings')
  .select('*', { count: 'exact', head: true })
  .eq('listing_id', listingId)
checks.push(['saved_listings row', savedCount === 0])

const { count: notifCount } = await admin
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .or(`link_url.ilike.%${slug}%,link_url.ilike.%${listingId}%`)
checks.push(['notifications referencing listing', notifCount === 0])

const { data: storageList } = await admin.storage.from('listing-images').list(
  '11111111-1111-4111-8111-111111111101/cce2b633-6203-4204-b9d3-b2ca681f4f09',
)
checks.push(['storage folder empty/missing', !storageList?.length])

const { count: otherListings } = await admin
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .eq('seller_id', '11111111-1111-4111-8111-111111111101')
checks.push(['seller still has other listings', (otherListings ?? 0) > 0])

for (const [label, ok] of checks) {
  console.log(ok ? 'OK' : 'FAIL', '-', label)
}
