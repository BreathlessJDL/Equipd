#!/usr/bin/env node
/**
 * Verify admin_fetch_order_detail returns listing + payment for non-participant admins.
 * Usage: node scripts/test-admin-fetch-order-detail.mjs
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
    if (!process.env[key] || key === 'ADMIN_TEST_EMAIL' || key === 'ADMIN_TEST_PASSWORD') {
      process.env[key] = value
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  assert(supabaseUrl && anonKey && adminEmail && adminPassword, 'Missing env vars')

  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await signIn(authed, adminEmail, adminPassword)

  const { data: cases, error: listError } = await authed.rpc('admin_list_cases', {
    p_filter: 'active',
  })

  assert(!listError, `admin_list_cases failed: ${listError?.message}`)
  assert(cases?.length, 'Need at least one active case to test')

  const caseRow = cases[0]
  const orderId = caseRow.order_id

  const { data: order, error: orderError } = await authed.rpc('admin_fetch_order_detail', {
    p_order_id: orderId,
  })

  assert(!orderError, `admin_fetch_order_detail failed: ${orderError?.message}`)
  assert(order?.id === orderId, 'Order id mismatch')
  assert(order?.listing?.title, `Missing listing title (got ${order?.listing?.title})`)
  assert(order?.payment?.status, `Missing payment status (got ${order?.payment?.status})`)
  assert(order?.offer?.id, 'Missing offer id')

  const images = order?.listing?.listing_images ?? []
  console.log('PASS: admin_fetch_order_detail')
  console.log(`  order: ${order.id}`)
  console.log(`  listing: ${order.listing.title} (${order.listing.status})`)
  console.log(`  images: ${images.length}`)
  console.log(`  payment: ${order.payment.status}`)
  console.log(`  fulfilment: ${order.fulfilment_status}`)
}

main().catch((error) => {
  console.error('FAIL:', error.message)
  process.exit(1)
})
