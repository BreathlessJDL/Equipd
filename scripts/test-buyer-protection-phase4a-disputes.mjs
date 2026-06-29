#!/usr/bin/env node
/**
 * End-to-end verification for Buyer Protection Phase 4A (Buyer disputes).
 *
 * Usage:
 *   node scripts/test-buyer-protection-phase4a-disputes.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Run buyer-protection-phase4a-disputes.sql on Supabase first.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }
const SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }
const WRONG_BUYER = { email: 'dev-buyer-emma@equipd.dev', id: '11111111-1111-4111-8111-111111111104' }

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

function minimalJpegBuffer() {
  const base64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=='
  return Buffer.from(base64, 'base64')
}

async function findEligibleCollectedOrder(admin, buyerId) {
  const { data: candidates } = await admin
    .from('orders')
    .select(
      'id, buyer_id, seller_id, payment_id, fulfilment_status, order_type, payout_release_at, payout_released_at, payout_status, stripe_transfer_id',
    )
    .eq('buyer_id', buyerId)
    .eq('fulfilment_status', 'collected')
    .eq('order_type', 'collection')
    .gt('payout_release_at', new Date().toISOString())
    .is('payout_released_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  for (const candidate of candidates ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status !== 'paid') continue

    const { data: disputes } = await admin
      .from('order_disputes')
      .select('id, status')
      .eq('order_id', candidate.id)
      .in('status', ['open', 'under_review'])

    if ((disputes ?? []).length === 0) {
      return candidate
    }
  }

  throw new Error(
    'No eligible collected order found. Run scripts/test-buyer-protection-phase2-collection-qr.mjs first.',
  )
}

async function uploadDisputeEvidence(client, orderId, disputeId) {
  const path = `${orderId}/disputes/${disputeId}/test-evidence.jpg`
  const file = minimalJpegBuffer()

  const { error } = await client.storage.from('order-evidence').upload(path, file, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (error) {
    throw new Error(`Evidence upload failed: ${error.message}`)
  }

  return path
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

  const order = await findEligibleCollectedOrder(admin, BUYER.id)
  logPass(`Using order ${order.id}`)

  logStep('Wrong buyer cannot open dispute')
  await signIn(authed, WRONG_BUYER.email)

  const { error: wrongBuyerError } = await authed.rpc('open_order_dispute', {
    p_order_id: order.id,
    p_reason: 'significant_undisclosed_fault',
    p_description: 'Should fail — wrong buyer.',
    p_evidence_paths: [`${order.id}/disputes/00000000-0000-4000-8000-000000000001/fake.jpg`],
    p_dispute_id: '00000000-0000-4000-8000-000000000001',
  })

  assert(wrongBuyerError, 'Wrong buyer dispute should fail')
  logPass(`Wrong buyer rejected: ${wrongBuyerError.message}`)

  logStep('Buyer with invalid reason rejected')
  await signIn(authed, BUYER.email)

  const invalidDisputeId = crypto.randomUUID()
  const invalidPath = await uploadDisputeEvidence(authed, order.id, invalidDisputeId)

  const { error: invalidReasonError } = await authed.rpc('open_order_dispute', {
    p_order_id: order.id,
    p_reason: 'item_not_received',
    p_description: 'Should fail — invalid reason for collection order.',
    p_evidence_paths: [invalidPath],
    p_dispute_id: invalidDisputeId,
  })

  assert(invalidReasonError, 'Invalid reason should fail')
  logPass(`Invalid reason rejected: ${invalidReasonError.message}`)

  logStep('Buyer with no evidence rejected')
  const { error: noEvidenceError } = await authed.rpc('open_order_dispute', {
    p_order_id: order.id,
    p_reason: 'significant_undisclosed_fault',
    p_description: 'Should fail — no evidence.',
    p_evidence_paths: [],
    p_dispute_id: crypto.randomUUID(),
  })

  assert(noEvidenceError, 'Missing evidence should fail')
  logPass(`No evidence rejected: ${noEvidenceError.message}`)

  logStep('Buyer opens valid dispute')
  const disputeId = crypto.randomUUID()
  const evidencePath = await uploadDisputeEvidence(authed, order.id, disputeId)

  const { data: dispute, error: openError } = await authed.rpc('open_order_dispute', {
    p_order_id: order.id,
    p_reason: 'significant_undisclosed_fault',
    p_description: 'Phase 4A test dispute — significant undisclosed fault reported by buyer.',
    p_evidence_paths: [evidencePath],
    p_dispute_id: disputeId,
  })

  if (openError) {
    throw new Error(`open_order_dispute failed: ${openError.message}`)
  }

  assert(dispute?.id === disputeId, 'Expected dispute row returned')
  assert(dispute.status === 'open', 'Expected open dispute status')
  logPass('Valid dispute opened')

  logStep('Verify order frozen')
  const { data: updatedOrder, error: orderError } = await admin
    .from('orders')
    .select(
      'fulfilment_status, protection_status, payout_status, payout_release_at, payout_released_at, stripe_transfer_id',
    )
    .eq('id', order.id)
    .single()

  if (orderError) {
    throw new Error(`Order fetch failed: ${orderError.message}`)
  }

  assert(updatedOrder.fulfilment_status === 'disputed', 'Expected fulfilment_status = disputed')
  assert(updatedOrder.protection_status === 'disputed', 'Expected protection_status = disputed')
  assert(updatedOrder.payout_status === 'on_hold', 'Expected payout_status = on_hold')
  assert(updatedOrder.payout_release_at === null, 'Expected payout_release_at = null')
  assert(!updatedOrder.payout_released_at, 'Expected payout_released_at = null')
  assert(!updatedOrder.stripe_transfer_id, 'No Stripe transfer should exist')
  logPass('Order payout frozen')

  logStep('Verify dispute row')
  const { data: disputeRow, error: disputeError } = await admin
    .from('order_disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (disputeError) {
    throw new Error(`Dispute fetch failed: ${disputeError.message}`)
  }

  assert(disputeRow.order_id === order.id, 'Expected dispute linked to order')
  assert(disputeRow.reason === 'significant_undisclosed_fault', 'Expected dispute reason')
  assert(disputeRow.evidence_paths?.length >= 1, 'Expected evidence paths')
  logPass('Dispute row verified')

  logStep('Verify notifications')
  const { data: notifications } = await admin
    .from('notifications')
    .select('user_id, type, title')
    .eq('type', 'order_dispute_opened')
    .in('user_id', [BUYER.id, SELLER.id])
    .order('created_at', { ascending: false })
    .limit(4)

  assert((notifications ?? []).length >= 2, 'Expected buyer and seller notifications')
  logPass('Dispute notifications created')

  console.log('\nAll Buyer Protection Phase 4A dispute checks passed.')
  console.log(`Order: ${order.id}`)
  console.log(`Dispute: ${disputeId}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
