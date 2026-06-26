#!/usr/bin/env node
/**
 * End-to-end verification for Buyer Protection Phase 3B (Courier delivery confirmation).
 *
 * Usage:
 *   node scripts/test-buyer-protection-phase3b-courier-delivery.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const BUYER = { email: 'dev-buyer-emma@equipd.dev', id: '11111111-1111-4111-8111-111111111104' }
const SELLER = { email: 'dev-seller-manchester@equipd.dev', id: '11111111-1111-4111-8111-111111111102' }
const WRONG_BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }

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

function logStep(title) {
  console.log(`\n=== ${title} ===`)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) {
    throw new Error(`Sign in failed for ${email}: ${error.message}`)
  }

  return data.session
}

function buildDeliveryChecks() {
  return {
    item_received: true,
    handover_evidence_reviewed: true,
    protection_window_acknowledged: true,
  }
}

async function findOrCreateInTransitOrder(admin) {
  const { data: existing } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payment_id, fulfilment_status, order_type')
    .eq('fulfilment_status', 'in_transit')
    .eq('order_type', 'buyer_courier')
    .order('created_at', { ascending: false })
    .limit(5)

  for (const candidate of existing ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status === 'paid') {
      return candidate
    }
  }

  throw new Error(
    'No paid in_transit buyer_courier order found. Run scripts/test-buyer-protection-phase3a-courier-evidence.mjs first.',
  )
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const order = await findOrCreateInTransitOrder(admin)
  logPass(`Using order ${order.id}`)

  logStep('Seller cannot confirm courier delivery')
  await signIn(authed, SELLER.email)

  const { error: sellerError } = await authed.rpc('confirm_courier_delivery', {
    p_order_id: order.id,
    p_checks: buildDeliveryChecks(),
    p_user_agent: 'phase3b-test-script',
  })

  assert(sellerError, 'Seller confirmation should fail')
  logPass(`Seller rejected: ${sellerError.message}`)

  logStep('Wrong buyer cannot confirm courier delivery')
  await signIn(authed, WRONG_BUYER.email)

  const { error: wrongBuyerError } = await authed.rpc('confirm_courier_delivery', {
    p_order_id: order.id,
    p_checks: buildDeliveryChecks(),
    p_user_agent: 'phase3b-test-script',
  })

  assert(wrongBuyerError, 'Wrong buyer confirmation should fail')
  logPass(`Wrong buyer rejected: ${wrongBuyerError.message}`)

  logStep('Buyer confirms courier delivery')
  await signIn(authed, BUYER.email)

  const beforeConfirm = Date.now()

  const { data: updatedOrder, error: confirmError } = await authed.rpc('confirm_courier_delivery', {
    p_order_id: order.id,
    p_checks: buildDeliveryChecks(),
    p_user_agent: 'phase3b-test-script',
  })

  if (confirmError) {
    throw new Error(`confirm_courier_delivery failed: ${confirmError.message}`)
  }

  assert(updatedOrder.fulfilment_status === 'delivered', 'Expected delivered status')
  assert(updatedOrder.delivered_at, 'Expected delivered_at')
  assert(updatedOrder.courier_delivered_at, 'Expected courier_delivered_at')
  assert(updatedOrder.courier_delivery_confirmed_by === BUYER.id, 'Expected buyer as confirmer')
  assert(updatedOrder.payout_status === 'not_due', 'Payout should remain not_due')
  assert(updatedOrder.payout_release_at, 'Expected payout_release_at')
  assert(!updatedOrder.stripe_transfer_id, 'No Stripe transfer should exist')

  const releaseAtMs = new Date(updatedOrder.payout_release_at).getTime()
  const hoursUntilRelease = (releaseAtMs - beforeConfirm) / (1000 * 60 * 60)
  assert(hoursUntilRelease > 23 && hoursUntilRelease < 25, `Expected ~24h hold, got ${hoursUntilRelease.toFixed(2)}h`)

  logPass('Delivery confirmed with 24-hour payout hold')

  logStep('Verify notifications')
  const { data: notifications } = await admin
    .from('notifications')
    .select('user_id, type, title')
    .eq('type', 'courier_delivery_confirmed')
    .in('user_id', [BUYER.id, SELLER.id])
    .order('created_at', { ascending: false })
    .limit(4)

  assert((notifications ?? []).length >= 2, 'Expected buyer and seller notifications')
  logPass('Delivery notifications created')

  console.log('\nAll Buyer Protection Phase 3B courier delivery checks passed.')
  console.log(`Order: ${order.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
