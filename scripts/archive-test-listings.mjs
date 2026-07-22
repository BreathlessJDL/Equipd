#!/usr/bin/env node
/**
 * Archive confirmed test listings (fixed id allowlist).
 * Archive only - no deletes, no image changes.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(relativePath) {
  if (!existsSync(relativePath)) return
  for (const line of readFileSync(relativePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Confirmed test listings only. Reviewed individually on 2026-07-21.
const CONFIRMED_TEST_LISTINGS = [
  // active
  'c954bdbe-79de-4c67-b07b-3ced634a431c', // Collection only test listing
  'd56b044c-e48e-4dcd-a32e-0905e6748b03', // Collection only test listing
  'cd6b9b21-55a0-448b-b6c2-2651a45b3690', // Collection only test listing
  '833fcfdc-5267-4127-a225-16e18aded2b3', // Test listing 1
  '4f98c8ce-9103-4133-bd9a-9bff7dfeca12', // Test listing 1
  'bcd72dd9-45c1-4257-95a8-ce9bfe1393f8', // Test listing 12
  'c59a0b37-ea70-43e5-bfda-11316e92bcdc', // Test listing 2
  // drafts
  'b1b2e322-0f74-4cad-8a34-03ec5e712448', // draft test
  '075bc2b4-7c72-4e96-8d71-c373a24b19f2', // QA fulfilment listing
  '7c7e9330-b632-4dbd-9bab-5548de8f508e', // QA fulfilment listing
]

async function main() {
  const { data: before, error: beforeError } = await client
    .from('listings')
    .select('id, title, status, seller_id, published_at, quantity_reserved')
    .in('id', CONFIRMED_TEST_LISTINGS)
  if (beforeError) throw new Error(beforeError.message)

  const archived = []
  const skipped = []

  for (const listing of before) {
    if (listing.status === 'archived') {
      skipped.push({ ...listing, reason: 'already archived' })
      continue
    }
    if (!['active', 'draft'].includes(listing.status)) {
      skipped.push({ ...listing, reason: `unexpected status ${listing.status}` })
      continue
    }
    if (listing.quantity_reserved > 0) {
      skipped.push({ ...listing, reason: 'reserved inventory present' })
      continue
    }

    const { data: updated, error: updateError } = await client
      .from('listings')
      .update({ status: 'archived' })
      .eq('id', listing.id)
      .eq('status', listing.status)
      .select('id, title, status')
      .single()
    if (updateError) {
      skipped.push({ ...listing, reason: `update failed: ${updateError.message}` })
      continue
    }
    archived.push({
      id: updated.id,
      title: updated.title,
      previous_status: listing.status,
      new_status: updated.status,
    })
  }

  const { count: remainingActive, error: countError } = await client
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  if (countError) throw new Error(countError.message)

  const report = {
    executed_at: new Date().toISOString(),
    archived_count: archived.length,
    archived,
    skipped,
    remaining_active_listings: remainingActive,
  }

  mkdirSync('reports/test-listing-cleanup', { recursive: true })
  writeFileSync(
    'reports/test-listing-cleanup/archive-result.json',
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
