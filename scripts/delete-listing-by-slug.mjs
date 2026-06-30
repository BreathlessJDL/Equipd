#!/usr/bin/env node
/**
 * Delete a single listing by slug using the app delete flow (seller auth + listings.delete).
 * Audits associated rows first; reports leftovers after delete.
 *
 * Usage:
 *   node scripts/delete-listing-by-slug.mjs <slug> [--execute]
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.argv[2]
const execute = process.argv.includes('--execute')

if (!slug || slug.startsWith('--')) {
  console.error('Usage: node scripts/delete-listing-by-slug.mjs <slug> [--execute]')
  process.exit(1)
}

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

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function countByListing(table, listingId, extra = '') {
  const query = admin.from(table).select('id', { count: 'exact', head: true }).eq('listing_id', listingId)
  const { count, error } = await query
  if (error) return { table, error: error.message }
  return { table, count: count ?? 0, extra }
}

async function auditListing(listing) {
  const listingId = listing.id
  const checks = await Promise.all([
    countByListing('listing_images', listingId),
    countByListing('saved_listings', listingId),
    countByListing('offers', listingId),
    countByListing('conversations', listingId),
    countByListing('orders', listingId),
    countByListing('payments', listingId),
    countByListing('reviews', listingId),
    countByListing('transaction_support_requests', listingId),
    admin
      .from('listing_fulfilment_private')
      .select('listing_id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .then(({ count, error }) => ({ table: 'listing_fulfilment_private', count: count ?? 0, error: error?.message })),
    admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .or(`link_url.ilike.%${slug}%,body.ilike.%${listing.title}%`),
    admin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId),
  ])

  const { data: images } = await admin
    .from('listing_images')
    .select('id, storage_path')
    .eq('listing_id', listingId)

  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', listing.seller_id)
    .maybeSingle()

  let sellerEmail = null
  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(listing.seller_id)
  if (!authUserError && authUser?.user?.email) {
    sellerEmail = authUser.user.email
  }

  return { checks, images: images ?? [], seller: sellerProfile ? { ...sellerProfile, email: sellerEmail } : null }
}

const { data: listing, error: listingError } = await admin
  .from('listings')
  .select('id, slug, title, status, seller_id, created_at')
  .eq('slug', slug)
  .maybeSingle()

if (listingError) {
  console.error('Lookup failed:', listingError.message)
  process.exit(1)
}

if (!listing) {
  console.log(`No listing found with slug "${slug}".`)
  process.exit(0)
}

console.log('=== Listing ===')
console.log(listing)

const before = await auditListing(listing)
console.log('\n=== Seller ===')
console.log(before.seller)
console.log('\n=== Associated rows (before) ===')
for (const row of before.checks) {
  console.log(row)
}
console.log('\n=== Storage images ===')
console.log(before.images)

if (!execute) {
  console.log('\nDry run only. Re-run with --execute to delete via seller-authenticated app flow.')
  process.exit(0)
}

const sellerEmail = before.seller?.email
if (!sellerEmail) {
  console.error('Could not resolve seller email for sign-in.')
  process.exit(1)
}

const authed = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

const { data: authData, error: authError } = await authed.auth.signInWithPassword({
  email: sellerEmail,
  password: process.env.DEV_PASSWORD || 'EquipdDevSeed123!',
})

if (authError) {
  console.error(
    'Seller sign-in failed — cannot use app delete flow without seller credentials.',
    authError.message,
  )
  process.exit(1)
}

console.log(`\nSigned in as ${authData.user.email} (${authData.user.id})`)

const { error: fulfilmentDeleteError } = await authed
  .from('listing_fulfilment_private')
  .delete()
  .eq('listing_id', listing.id)

if (fulfilmentDeleteError) {
  console.error('Fulfilment private delete failed:', fulfilmentDeleteError.message)
  process.exit(1)
}

const fulfilmentCount = before.checks.find((row) => row.table === 'listing_fulfilment_private')?.count ?? 0
if (fulfilmentCount > 0) {
  console.log('Removed listing_fulfilment_private row (required before listing delete).')
}

for (const image of before.images) {
  const { error: storageError } = await authed.storage.from('listing-images').remove([image.storage_path])
  if (storageError) {
    console.warn(`Storage remove warning for ${image.storage_path}:`, storageError.message)
  }

  const { error: imageDeleteError } = await authed.from('listing_images').delete().eq('id', image.id)
  if (imageDeleteError) {
    console.error('Image row delete failed:', imageDeleteError.message)
    process.exit(1)
  }
}

if (before.images.length > 0) {
  console.log(`Removed ${before.images.length} listing image row(s) and storage object(s).`)
}

const { error: deleteError } = await authed.from('listings').delete().eq('id', listing.id)

if (deleteError) {
  console.error('App delete failed:', deleteError.message)
  process.exit(1)
}

console.log('Listing row deleted via seller-authenticated delete (same as deleteListing()).')

const { count: notifCount } = await admin
  .from('notifications')
  .delete({ count: 'exact' })
  .or(`link_url.ilike.%/listings/${slug}%,link_url.ilike.%listingId=${listing.id}%`)

if (notifCount) {
  console.log(`Removed ${notifCount} notification(s) referencing this listing.`)
}

const { data: stillThere } = await admin
  .from('listings')
  .select('id')
  .eq('slug', slug)
  .maybeSingle()

if (stillThere) {
  console.error('Listing still present after delete — aborting verification.')
  process.exit(1)
}

const after = await auditListing({ id: listing.id })
console.log('\n=== Associated rows (after, by listing_id) ===')
for (const row of after.checks) {
  console.log(row)
}

console.log('\nDone.')
