#!/usr/bin/env node
/**
 * End-to-end verification for Buyer Protection Phase 3A (Courier evidence).
 *
 * Usage:
 *   node scripts/test-buyer-protection-phase3a-courier-evidence.mjs
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
const WRONG_SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }
const LISTING_ID = '22222222-2222-4222-8222-222222222230'

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

function buildEvidencePayload(orderId) {
  return {
    courier_evidence_video_url: `${orderId}/video/test.mp4`,
    courier_pre_collection_photo_url: `${orderId}/photos/pre-collection/test.jpg`,
    courier_handover_photo_url: `${orderId}/photos/handover/test.jpg`,
    courier_name: 'Alex Courier',
    courier_company: 'FastFreight Ltd',
    courier_tracking_reference: 'FF-PHASE3A-TEST',
    courier_signature_name: 'Alex Courier',
    courier_signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  }
}

async function findOrCreateCourierOrder(admin, authed) {
  const { data: existing } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payment_id, fulfilment_status, order_type')
    .eq('fulfilment_status', 'awaiting_courier_collection')
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

  logStep('Create paid buyer_courier order for testing')

  await admin
    .from('listings')
    .update({ status: 'active', collection_available: false, courier_available: true })
    .eq('id', LISTING_ID)

  await signIn(authed, BUYER.email)

  const offerAmountPence = 140000

  const { data: offerRow, error: offerError } = await authed
    .from('offers')
    .insert({
      listing_id: LISTING_ID,
      buyer_id: BUYER.id,
      seller_id: SELLER.id,
      amount_pence: offerAmountPence,
      status: 'pending',
      direction: 'buyer_to_seller',
      message: 'Phase 3A courier evidence test offer',
    })
    .select('id')
    .single()

  if (offerError) {
    throw new Error(`Create offer failed: ${offerError.message}`)
  }

  await signIn(authed, SELLER.email)

  const { error: acceptError } = await authed.rpc('accept_offer', {
    p_offer_id: offerRow.id,
  })

  if (acceptError) {
    throw new Error(`accept_offer failed: ${acceptError.message}`)
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('id')
    .eq('offer_id', offerRow.id)
    .single()

  if (paymentError || !payment) {
    throw new Error(`Payment lookup failed: ${paymentError?.message ?? 'missing'}`)
  }

  const { error: captureError } = await admin.rpc('mark_payment_captured', {
    p_payment_id: payment.id,
    p_stripe_checkout_session_id: 'cs_phase3a_test',
    p_stripe_payment_intent_id: 'pi_phase3a_test',
    p_stripe_charge_id: 'ch_phase3a_test',
  })

  if (captureError) {
    throw new Error(`mark_payment_captured failed: ${captureError.message}`)
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payment_id, fulfilment_status, order_type')
    .eq('offer_id', offerRow.id)
    .single()

  if (orderError || !order) {
    throw new Error(`Order lookup failed: ${orderError?.message ?? 'missing'}`)
  }

  assert(order.order_type === 'buyer_courier', `Expected buyer_courier, got ${order.order_type}`)
  assert(
    order.fulfilment_status === 'awaiting_courier_collection',
    `Expected awaiting_courier_collection, got ${order.fulfilment_status}`,
  )

  logPass(`Created courier order ${order.id}`)
  return order
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

  const order = await findOrCreateCourierOrder(admin, authed)
  logPass(`Using order ${order.id}`)

  logStep('Wrong seller cannot submit evidence')
  await signIn(authed, WRONG_SELLER.email)

  const { error: wrongSellerError } = await authed.rpc('submit_courier_handover_evidence', {
    p_order_id: order.id,
    p_payload: buildEvidencePayload(order.id),
  })

  assert(wrongSellerError, 'Wrong seller submission should fail')
  logPass(`Wrong seller rejected: ${wrongSellerError.message}`)

  logStep('Buyer cannot submit evidence')
  await signIn(authed, BUYER.email)

  const { error: buyerError } = await authed.rpc('submit_courier_handover_evidence', {
    p_order_id: order.id,
    p_payload: buildEvidencePayload(order.id),
  })

  assert(buyerError, 'Buyer submission should fail')
  logPass(`Buyer rejected: ${buyerError.message}`)

  logStep('Seller submits courier handover evidence')
  await signIn(authed, SELLER.email)

  const { data: updatedOrder, error: submitError } = await authed.rpc(
    'submit_courier_handover_evidence',
    {
      p_order_id: order.id,
      p_payload: buildEvidencePayload(order.id),
    },
  )

  if (submitError) {
    throw new Error(`submit_courier_handover_evidence failed: ${submitError.message}`)
  }

  assert(updatedOrder.fulfilment_status === 'in_transit', 'Expected in_transit')
  assert(updatedOrder.courier_collected_at, 'Expected courier_collected_at')
  assert(updatedOrder.courier_evidence_submitted_at, 'Expected courier_evidence_submitted_at')
  assert(updatedOrder.courier_evidence_submitted_by === SELLER.id, 'Expected seller as submitter')
  assert(updatedOrder.courier_tracking_reference === 'FF-PHASE3A-TEST', 'Tracking should be saved')
  assert(updatedOrder.payout_status === 'not_due', 'Payout should remain not_due')
  assert(updatedOrder.payout_release_at === null, 'payout_release_at should remain null')
  assert(!updatedOrder.stripe_transfer_id, 'No Stripe transfer should exist')

  logPass('Evidence saved and order moved to in_transit with payout still held')

  logStep('Verify notifications')
  const { data: notifications } = await admin
    .from('notifications')
    .select('user_id, type, title')
    .in('type', ['courier_collection_confirmed', 'courier_evidence_submitted'])
    .in('user_id', [BUYER.id, SELLER.id])
    .order('created_at', { ascending: false })
    .limit(4)

  assert((notifications ?? []).length >= 2, 'Expected buyer and seller notifications')
  logPass('Courier notifications created')

  console.log('\nAll Buyer Protection Phase 3A courier evidence checks passed.')
  console.log(`Order: ${order.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
