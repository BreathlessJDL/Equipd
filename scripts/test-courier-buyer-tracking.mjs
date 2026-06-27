#!/usr/bin/env node
/**
 * Verify courier buyer tracking migration and optional tracking flow.
 *
 * Requires:
 *   - supabase/buyer-protection-courier-buyer-tracking.sql applied
 *   - .env.local with Supabase keys
 *
 * Usage:
 *   node scripts/test-courier-buyer-tracking.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

function getCourierDeliveryTimelineTrackingDetail(order) {
  const buyerTracking = order?.courier_buyer_tracking_reference?.trim()
  if (buyerTracking) return `Tracking number: ${buyerTracking}`

  if (order?.courier_delivered_at || order?.delivered_at) {
    return 'No tracking number provided'
  }

  return null
}

const BUYER = { email: 'dev-buyer-emma@equipd.dev' }
const SELLER = { email: 'dev-seller-manchester@equipd.dev' }

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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signIn(client, email) {
  const { error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

function buildEvidencePayload(orderId) {
  return {
    courier_evidence_video_url: `${orderId}/video/buyer-tracking-test.mp4`,
    courier_pre_collection_photo_url: `${orderId}/photos/pre-collection/test.jpg`,
    courier_handover_photo_url: `${orderId}/photos/handover/test.jpg`,
    courier_name: 'Tracking Test Courier',
    courier_company: 'Equipd Test Freight',
    courier_signature_name: 'Tracking Test Courier',
    courier_signature_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  }
}

function buildChecks() {
  return {
    item_received: true,
    handover_evidence_reviewed: true,
    protection_window_acknowledged: true,
  }
}

async function assertMigrationApplied(admin) {
  const { error } = await admin
    .from('orders')
    .select('courier_buyer_tracking_reference, courier_evidence_notes')
    .limit(1)

  if (error?.message?.includes('courier_buyer_tracking_reference')) {
    throw new Error(
      'Migration not applied. Run supabase/buyer-protection-courier-buyer-tracking.sql in the SQL editor first.',
    )
  }

  if (error) throw error
  logPass('Migration columns present')
}

async function findAwaitingCourierOrder(admin) {
  const { data, error } = await admin
    .from('orders')
    .select('id, payment_id, fulfilment_status, order_type')
    .eq('fulfilment_status', 'awaiting_courier_collection')
    .eq('order_type', 'buyer_courier')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error

  for (const candidate of data ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status === 'paid') return candidate
  }

  return null
}

async function main() {
  loadEnvFile('.env.local')

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await assertMigrationApplied(admin)

  const order = await findAwaitingCourierOrder(admin)
  assert(order, 'No paid awaiting_courier_collection buyer_courier order found for testing')

  logPass(`Using order ${order.id}`)

  await signIn(authed, SELLER.email)
  const { data: inTransitOrder, error: evidenceError } = await authed.rpc(
    'submit_courier_handover_evidence',
    {
      p_order_id: order.id,
      p_payload: buildEvidencePayload(order.id),
    },
  )

  if (evidenceError) {
    throw new Error(`submit_courier_handover_evidence failed: ${evidenceError.message}`)
  }

  assert(inTransitOrder.fulfilment_status === 'in_transit', 'Expected in_transit')
  assert(!inTransitOrder.courier_tracking_reference, 'Seller tracking should remain unset')
  logPass('Seller evidence submitted without tracking')

  await signIn(authed, BUYER.email)

  const { data: withoutTracking, error: noTrackError } = await authed.rpc('confirm_courier_delivery', {
    p_order_id: order.id,
    p_checks: buildChecks(),
    p_user_agent: 'courier-buyer-tracking-test',
    p_buyer_tracking_reference: '',
  })

  if (noTrackError) {
    throw new Error(`confirm without tracking failed: ${noTrackError.message}`)
  }

  assert(withoutTracking.fulfilment_status === 'delivered', 'Expected delivered')
  assert(!withoutTracking.courier_buyer_tracking_reference, 'Buyer tracking should be null when omitted')
  assert(
    getCourierDeliveryTimelineTrackingDetail(withoutTracking) === 'No tracking number provided',
    'Timeline helper should show neutral no-tracking message',
  )
  logPass('Buyer confirmed delivery without tracking')

  const order2 = await findAwaitingCourierOrder(admin)
  assert(order2, 'Need a second courier order to test with tracking')

  await signIn(authed, SELLER.email)
  await authed.rpc('submit_courier_handover_evidence', {
    p_order_id: order2.id,
    p_payload: buildEvidencePayload(order2.id),
  })

  await signIn(authed, BUYER.email)
  const { data: withTracking, error: trackError } = await authed.rpc('confirm_courier_delivery', {
    p_order_id: order2.id,
    p_checks: buildChecks(),
    p_user_agent: 'courier-buyer-tracking-test',
    p_buyer_tracking_reference: 'BUYER-TRACK-12345',
  })

  if (trackError) {
    throw new Error(`confirm with tracking failed: ${trackError.message}`)
  }

  assert(
    withTracking.courier_buyer_tracking_reference === 'BUYER-TRACK-12345',
    'Buyer tracking should be saved',
  )
  assert(
    getCourierDeliveryTimelineTrackingDetail(withTracking) === 'Tracking number: BUYER-TRACK-12345',
    'Timeline should show buyer tracking',
  )
  logPass('Buyer confirmed delivery with optional tracking')

  console.log('\nAll courier buyer tracking checks passed.')
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
