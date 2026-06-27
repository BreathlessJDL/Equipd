#!/usr/bin/env node
/**
 * Remove leftover fulfilment-method-selection test listings from production.
 * Keeps dev-seller-leeds@equipd.dev (James Porter) — active QA account.
 *
 * Usage: node scripts/cleanup-fulfilment-test-listings.mjs [--apply]
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const APPLY = process.argv.includes('--apply')

const PROTECTED_EMAILS = new Set([
  'jlinnell95@gmail.com',
  'jordanlinnell1995@hotmail.co.uk',
  'dev-seller-leeds@equipd.dev',
  'dev-seller-manchester@equipd.dev',
  'dev-seller-london@equipd.dev',
  'dev-buyer-emma@equipd.dev',
  'dev-buyer-chris@equipd.dev',
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

async function count(table, column, value) {
  const { count: rowCount, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, value)
  if (error) return null
  return rowCount ?? 0
}

async function collectListingSnapshot(listingId) {
  return {
    listing_images: await count('listing_images', 'listing_id', listingId),
    offers: await count('offers', 'listing_id', listingId),
    payments: await count('payments', 'listing_id', listingId),
    orders: await count('orders', 'listing_id', listingId),
    conversations: await count('conversations', 'listing_id', listingId),
    saved_listings: await count('saved_listings', 'listing_id', listingId),
    listing_fulfilment_private: await count('listing_fulfilment_private', 'listing_id', listingId),
  }
}

async function browseHasListing(listingId) {
  const { data, error } = await admin
    .from('listings_public_browse')
    .select('id')
    .eq('id', listingId)
    .maybeSingle()

  if (error && error.code !== '42P01') throw error
  if (error?.code === '42P01') {
    const { data: fallback } = await admin
      .from('listings')
      .select('id')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle()
    return Boolean(fallback)
  }
  return Boolean(data)
}

async function searchBrowseForTitle(titleFragment) {
  const { data, error } = await admin
    .from('listings_public_browse')
    .select('id, title, slug, status')
    .ilike('title', `%${titleFragment}%`)

  if (error && error.code === '42P01') {
    const { data: fallback, error: fallbackError } = await admin
      .from('listings')
      .select('id, title, slug, status')
      .eq('status', 'active')
      .ilike('title', `%${titleFragment}%`)
    if (fallbackError) throw fallbackError
    return fallback ?? []
  }
  if (error) throw error
  return data ?? []
}

const { data: targets, error: targetError } = await admin
  .from('listings')
  .select('id, title, slug, status, seller_id')
  .like('slug', 'fulfilment-test-%')

if (targetError) throw targetError

if (!targets?.length) {
  console.log('No fulfilment-test-* listings found. Nothing to do.')
  process.exit(0)
}

const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
const sellerIds = [...new Set(targets.map((row) => row.seller_id))]
for (const sellerId of sellerIds) {
  const authUser = authUsers?.users?.find((user) => user.id === sellerId)
  const email = authUser?.email ?? '(unknown)'
  if (PROTECTED_EMAILS.has(email) && email !== 'dev-seller-leeds@equipd.dev') {
    console.log(`Protected seller ${email} — skipping their listings`)
  }
}

console.log(`Found ${targets.length} leftover fulfilment-test listing(s):`)
const removed = []

for (const listing of targets) {
  const authUser = authUsers?.users?.find((user) => user.id === listing.seller_id)
  const sellerEmail = authUser?.email ?? listing.seller_id

  const before = await collectListingSnapshot(listing.id)
  const inBrowse = await browseHasListing(listing.id)

  console.log('\n---')
  console.log({
    listing_id: listing.id,
    title: listing.title,
    slug: listing.slug,
    status: listing.status,
    seller_email: sellerEmail,
    in_browse: inBrowse,
    related_before: before,
  })

  if (!APPLY) continue

  const { error: deleteError } = await admin.from('listings').delete().eq('id', listing.id)
  if (deleteError) {
    console.error('DELETE FAILED:', deleteError.message)
    process.exit(1)
  }

  const afterListing = await count('listings', 'id', listing.id)
  const after = await collectListingSnapshot(listing.id)

  removed.push({
    listing_id: listing.id,
    title: listing.title,
    seller_email: sellerEmail,
    related_before: before,
    related_after: after,
    listing_row_remaining: afterListing,
  })
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to delete.')
  process.exit(0)
}

console.log('\n=== Post-cleanup verification ===')

for (const row of removed) {
  assertOrExit(row.listing_row_remaining === 0, `Listing row still exists: ${row.listing_id}`)
  for (const [table, remaining] of Object.entries(row.related_after)) {
    if (remaining == null) continue
    assertOrExit(remaining === 0, `Orphan in ${table} for ${row.listing_id}: ${remaining}`)
  }
}

const browseMatches = await searchBrowseForTitle('Collection + courier test')
assertOrExit(browseMatches.length === 0, `Browse still shows: ${JSON.stringify(browseMatches)}`)

const fulfilmentTestBrowse = await admin
  .from('listings')
  .select('id, title, slug')
  .like('slug', 'fulfilment-test-%')

console.log('Remaining fulfilment-test slugs:', fulfilmentTestBrowse.data?.length ?? 0)
assertOrExit((fulfilmentTestBrowse.data?.length ?? 0) === 0, 'fulfilment-test slugs remain')

console.log('\nCleanup complete.')
console.log(JSON.stringify({ removed, browse_clean: true }, null, 2))

function assertOrExit(condition, message) {
  if (!condition) {
    console.error('VERIFICATION FAILED:', message)
    process.exit(1)
  }
}
