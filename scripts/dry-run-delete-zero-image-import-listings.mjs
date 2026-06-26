#!/usr/bin/env node
/**
 * Dry-run counts for zero-image import listing deletion.
 * Mirrors supabase/delete-zero-image-import-listings.sql criteria.
 *
 * Usage:
 *   node scripts/dry-run-delete-zero-image-import-listings.mjs
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

function formatError(error, context) {
  if (!error) return `${context}: unknown error`
  return `${context}: ${error.message || JSON.stringify(error)}`
}

async function fetchAllImportListings(admin) {
  const rows = []
  const pageSize = 500
  let from = 0

  while (true) {
    const { data, error } = await admin
      .from('listings')
      .select('id, slug, title, status, source')
      .eq('source', 'import')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(formatError(error, 'fetchAllImportListings'))
    }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function fetchListingIdsWithImages(admin, listingIds) {
  const withImages = new Set()
  const chunkSize = 200

  for (let i = 0; i < listingIds.length; i += chunkSize) {
    const chunk = listingIds.slice(i, i + chunkSize)
    const { data, error } = await admin
      .from('listing_images')
      .select('listing_id')
      .in('listing_id', chunk)

    if (error) throw new Error(formatError(error, 'fetchListingIdsWithImages'))
    for (const row of data ?? []) {
      withImages.add(row.listing_id)
    }
  }

  return withImages
}

async function countDependents(admin, table, listingIds) {
  if (!listingIds.length) return 0

  let total = 0
  const chunkSize = 100

  for (let i = 0; i < listingIds.length; i += chunkSize) {
    const chunk = listingIds.slice(i, i + chunkSize)
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('listing_id', chunk)

    if (error) throw new Error(formatError(error, `countDependents(${table})`))
    total += count ?? 0
  }

  return total
}

async function countMessagesForListings(admin, listingIds) {
  if (!listingIds.length) return 0

  let total = 0
  const chunkSize = 100

  for (let i = 0; i < listingIds.length; i += chunkSize) {
    const chunk = listingIds.slice(i, i + chunkSize)
    const { data: conversations, error: convError } = await admin
      .from('conversations')
      .select('id')
      .in('listing_id', chunk)

    if (convError) throw new Error(formatError(convError, 'countMessagesForListings/conversations'))
    const conversationIds = (conversations ?? []).map((row) => row.id)
    if (!conversationIds.length) continue

    const { count, error } = await admin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)

    if (error) throw new Error(formatError(error, 'countMessagesForListings/messages'))
    total += count ?? 0
  }

  return total
}

async function countNotificationsForSlugs(admin, slugs) {
  if (!slugs.length) return 0

  let total = 0
  for (const slug of slugs) {
    const { count, error } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('link_url', `/listings/${slug}`)

    if (error) throw new Error(formatError(error, 'countNotificationsForSlugs'))
    total += count ?? 0
  }

  return total
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const imports = await fetchAllImportListings(admin)
  const withImages = await fetchListingIdsWithImages(
    admin,
    imports.map((row) => row.id),
  )

  const targets = imports.filter((row) => !withImages.has(row.id))
  const remaining = imports.filter((row) => withImages.has(row.id))
  const targetIds = targets.map((row) => row.id)
  const targetSlugs = targets.map((row) => row.slug)

  const optionalDependents = ['reviews']
  const dependents = {
    saved_listings: await countDependents(admin, 'saved_listings', targetIds),
    listing_fulfilment_private: await countDependents(admin, 'listing_fulfilment_private', targetIds),
    listing_images: await countDependents(admin, 'listing_images', targetIds),
    offers: await countDependents(admin, 'offers', targetIds),
    payments: await countDependents(admin, 'payments', targetIds),
    orders: await countDependents(admin, 'orders', targetIds),
    conversations: await countDependents(admin, 'conversations', targetIds),
    messages: await countMessagesForListings(admin, targetIds),
    reports: await countDependents(admin, 'reports', targetIds),
    notifications: await countNotificationsForSlugs(admin, targetSlugs),
  }

  for (const table of optionalDependents) {
    try {
      dependents[table] = await countDependents(admin, table, targetIds)
    } catch {
      dependents[table] = null
    }
  }

  const blockers =
    dependents.offers +
    dependents.payments +
    dependents.orders +
    dependents.conversations +
    (dependents.reviews ?? 0)

  const result = {
    zeroImageImportCount: targets.length,
    expectedCount: 86,
    activeTargets: targets.filter((row) => row.status === 'active').length,
    remainingImportCount: remaining.length,
    remainingAllHaveImages: remaining.every((row) => withImages.has(row.id)),
    dependents,
    blockers,
    sampleSlugs: targets.slice(0, 10).map((row) => row.slug),
  }

  console.log(JSON.stringify(result, null, 2))

  const ok =
    targets.length === 86 &&
    remaining.length === 54 &&
    blockers === 0 &&
    dependents.listing_images === 0

  if (!ok) {
    console.log('DRY-RUN: review counts before executing SQL cleanup.')
    if (targets.length !== 86) process.exitCode = 1
  } else {
    console.log('DRY-RUN OK: safe to execute supabase/delete-zero-image-import-listings.sql')
  }
}

main().catch((error) => {
  console.error(error?.message || String(error) || 'Unknown error')
  if (error?.stack) console.error(error.stack)
  process.exit(1)
})
