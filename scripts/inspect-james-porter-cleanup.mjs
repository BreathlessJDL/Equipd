#!/usr/bin/env node
/**
 * Inspect James Porter / leftover fulfilment test listings before cleanup.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PROTECTED_EMAILS = new Set([
  'jlinnell95@gmail.com',
  'jordanlinnell1995@hotmail.co.uk',
])

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

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const { data: authUsers, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (authError) throw authError

const jamesAuth = authUsers.users.find((u) =>
  u.email === 'dev-seller-leeds@equipd.dev'
  || u.user_metadata?.display_name === 'James Porter'
  || u.user_metadata?.full_name === 'James Porter',
)

console.log('James Porter auth user:', jamesAuth
  ? { id: jamesAuth.id, email: jamesAuth.email, created_at: jamesAuth.created_at }
  : null)

const sellerId = jamesAuth?.id ?? '11111111-1111-4111-8111-111111111101'

const { data: profile } = await admin
  .from('profiles')
  .select('id, display_name, username, email, is_admin, created_at')
  .eq('id', sellerId)
  .maybeSingle()

console.log('Profile:', profile)

const { data: listings } = await admin
  .from('listings')
  .select('id, title, slug, status, created_at, seller_id')
  .eq('seller_id', sellerId)
  .order('created_at', { ascending: false })

console.log('\nAll James Porter listings:', listings?.length ?? 0)
for (const listing of listings ?? []) {
  console.log(' -', listing.id, listing.status, listing.title, listing.slug)
}

const targetTitles = [
  'Collection + courier test listing',
  'Collection only test listing',
  'Collection only invalid selection test',
]

const { data: targetListings } = await admin
  .from('listings')
  .select('id, title, slug, status, seller_id, created_at')
  .or(targetTitles.map((t) => `title.eq.${t}`).join(','))

console.log('\nFulfilment test listings by title:', targetListings)

const { data: fulfilmentSlugListings } = await admin
  .from('listings')
  .select('id, title, slug, status, seller_id')
  .like('slug', 'fulfilment-test-%')

console.log('\nFulfilment-test slug listings:', fulfilmentSlugListings)

const { data: browseMatch } = await admin
  .from('listings')
  .select('id, title, slug, status')
  .eq('status', 'active')
  .ilike('title', '%Collection + courier test%')

console.log('\nActive browse matches for title:', browseMatch)

for (const listing of targetListings ?? []) {
  const listingId = listing.id
  const { data: images } = await admin.from('listing_images').select('id, storage_path').eq('listing_id', listingId)
  const { data: offers } = await admin.from('offers').select('id, status').eq('listing_id', listingId)
  const { data: orders } = await admin.from('orders').select('id, fulfilment_status').eq('listing_id', listingId)
  const { data: convos } = await admin.from('conversations').select('id').eq('listing_id', listingId)
  const { data: saved } = await admin.from('saved_listings').select('id').eq('listing_id', listingId)
  const { data: privateF } = await admin.from('listing_fulfilment_private').select('listing_id').eq('listing_id', listingId)

  console.log(`\nRelated records for ${listing.title} (${listingId}):`)
  console.log({ images: images?.length ?? 0, offers: offers?.length ?? 0, orders: orders?.length ?? 0, convos: convos?.length ?? 0, saved: saved?.length ?? 0, privateF: privateF?.length ?? 0 })
}
