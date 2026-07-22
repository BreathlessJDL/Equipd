#!/usr/bin/env node
/**
 * READ-ONLY production search for test/QA listings.
 *
 * Flags listings whose title or description matches obvious test terms
 * (word-boundary, case-insensitive) and reports seller + commerce context
 * so genuine customer listings (e.g. "ex-demo" equipment) can be excluded
 * before any archive action.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(relativePath) {
  if (!existsSync(relativePath)) return
  for (const line of readFileSync(relativePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
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

// Word-boundary regex so "test" does not match "greatest", etc.
const TERM_REGEX = /\b(test|testing|qa|dummy|sample|demo)\b/i

async function fetchAll(table, columns) {
  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function main() {
  const [listings, profiles, offers, payments, orders] = await Promise.all([
    fetchAll(
      'listings',
      'id, title, description, status, seller_id, source, published_at, created_at, quantity_total, quantity_available, quantity_reserved, quantity_sold',
    ),
    fetchAll('profiles', 'id, display_name, username, is_admin'),
    fetchAll('offers', 'id, listing_id, status'),
    fetchAll('payments', 'id, listing_id, status'),
    fetchAll('orders', 'id, listing_id, fulfilment_status'),
  ])

  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const countBy = (rows) => {
    const map = new Map()
    for (const row of rows) {
      map.set(row.listing_id, (map.get(row.listing_id) || 0) + 1)
    }
    return map
  }
  const offerCount = countBy(offers)
  const paymentCount = countBy(payments)
  const orderCount = countBy(orders)

  const candidates = []
  for (const listing of listings) {
    const titleMatch = TERM_REGEX.exec(listing.title || '')
    const descMatch = TERM_REGEX.exec(listing.description || '')
    if (!titleMatch && !descMatch) continue

    const seller = profileById.get(listing.seller_id)
    candidates.push({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      source: listing.source,
      seller_id: listing.seller_id,
      seller_display_name: seller?.display_name ?? null,
      seller_username: seller?.username ?? null,
      seller_is_admin: seller?.is_admin ?? null,
      published_at: listing.published_at,
      created_at: listing.created_at,
      matched_in_title: titleMatch ? titleMatch[0] : null,
      matched_in_description: descMatch ? descMatch[0] : null,
      description_snippet: descMatch
        ? (listing.description || '')
            .slice(
              Math.max(0, descMatch.index - 60),
              descMatch.index + 60,
            )
            .replace(/\s+/g, ' ')
        : null,
      quantity: {
        total: listing.quantity_total,
        available: listing.quantity_available,
        reserved: listing.quantity_reserved,
        sold: listing.quantity_sold,
      },
      offers: offerCount.get(listing.id) || 0,
      payments: paymentCount.get(listing.id) || 0,
      orders: orderCount.get(listing.id) || 0,
    })
  }

  const statusTotals = {}
  for (const listing of listings) {
    statusTotals[listing.status] = (statusTotals[listing.status] || 0) + 1
  }

  const report = {
    generated_at: new Date().toISOString(),
    read_only: true,
    total_listings: listings.length,
    status_totals: statusTotals,
    candidate_count: candidates.length,
    candidates: candidates.sort((a, b) =>
      (a.status || '').localeCompare(b.status || '') ||
      (a.title || '').localeCompare(b.title || ''),
    ),
  }

  mkdirSync('reports/test-listing-cleanup', { recursive: true })
  writeFileSync(
    'reports/test-listing-cleanup/candidates.json',
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
