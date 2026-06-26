#!/usr/bin/env node
/**
 * End-to-end verification for Buyer Protection Phase 4B (Due payout release).
 *
 * Usage:
 *   node scripts/test-buyer-protection-phase4b-payout-release.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Run buyer-protection-phase4b-payout-release.sql on Supabase first.
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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logStep(title) {
  console.log(`\n=== ${title} ===`)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function callReleaseDuePayouts(admin) {
  const { data, error } = await admin.rpc('release_due_order_payouts')

  if (error) {
    throw new Error(`release_due_order_payouts failed: ${error.message}`)
  }

  return Array.isArray(data) ? data : (data ?? [])
}

async function findEligibleCollectedOrder(admin) {
  const { data: candidates } = await admin
    .from('orders')
    .select('id, seller_id, payment_id, fulfilment_status, payout_status, payout_release_at')
    .in('fulfilment_status', ['collected', 'delivered'])
    .eq('payout_status', 'not_due')
    .is('payout_released_at', null)
    .is('stripe_transfer_id', null)
    .neq('fulfilment_status', 'disputed')
    .order('created_at', { ascending: false })
    .limit(20)

  for (const candidate of candidates ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status !== 'paid') continue

    const { data: disputes } = await admin
      .from('order_disputes')
      .select('id')
      .eq('order_id', candidate.id)
      .in('status', ['open', 'under_review'])

    if ((disputes ?? []).length === 0) {
      return candidate
    }
  }

  throw new Error(
    'No eligible collected/delivered order found. Run phase 2 or 3B tests to create one.',
  )
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const testOrder = await findEligibleCollectedOrder(admin)
  logPass(`Using order ${testOrder.id}`)

  const originalReleaseAt = testOrder.payout_release_at
  const futureReleaseAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const pastReleaseAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  logStep('Future payout_release_at → not released')
  await admin
    .from('orders')
    .update({
      fulfilment_status: testOrder.fulfilment_status,
      payout_status: 'not_due',
      payout_release_at: futureReleaseAt,
    })
    .eq('id', testOrder.id)

  const futureResults = await callReleaseDuePayouts(admin)
  const futurePromotion = futureResults.find((entry) => entry.order_id === testOrder.id)
  assert(!futurePromotion, 'Order with future payout_release_at should not be promoted')
  logPass('Future protection window skipped')

  logStep('Past payout_release_at with no dispute → promoted')
  await admin
    .from('orders')
    .update({
      fulfilment_status: testOrder.fulfilment_status,
      payout_status: 'not_due',
      payout_release_at: pastReleaseAt,
    })
    .eq('id', testOrder.id)

  const promoteResults = await callReleaseDuePayouts(admin)
  const promotion = promoteResults.find((entry) => entry.order_id === testOrder.id)
  assert(promotion, 'Expected order to be promoted after protection window')
  assert(
    ['promoted_ready', 'promoted_awaiting_seller_setup'].includes(promotion.result),
    `Unexpected promotion result: ${promotion.result}`,
  )

  const { data: promotedOrder } = await admin
    .from('orders')
    .select('fulfilment_status, payout_status, payout_release_at, buyer_confirmed_at, protection_status')
    .eq('id', testOrder.id)
    .single()

  assert(promotedOrder.fulfilment_status === 'completed', 'Expected completed')
  assert(promotedOrder.payout_release_at, 'Expected payout_release_at preserved as protection end time')
  assert(
    promotedOrder.protection_status === 'released',
    `Expected protection_status=released, got ${promotedOrder.protection_status}`,
  )
  assert(
    ['ready', 'awaiting_seller_setup'].includes(promotedOrder.payout_status),
    `Expected ready or awaiting_seller_setup, got ${promotedOrder.payout_status}`,
  )
  assert(promotedOrder.buyer_confirmed_at, 'Expected buyer_confirmed_at set')
  logPass(`Promoted with payout_status=${promotedOrder.payout_status}`)

  logStep('Idempotent re-run → skipped')
  const rerunResults = await callReleaseDuePayouts(admin)
  const rerunPromotion = rerunResults.find((entry) => entry.order_id === testOrder.id)
  assert(!rerunPromotion, 'Promoted order should not be promoted again')
  logPass('Second run skipped already-promoted order')

  logStep('Disputed order → skipped')
  const { data: disputedOrder } = await admin
    .from('orders')
    .select('id')
    .eq('fulfilment_status', 'disputed')
    .limit(1)
    .maybeSingle()

  if (disputedOrder?.id) {
    await admin
      .from('orders')
      .update({
        payout_release_at: pastReleaseAt,
        payout_status: 'on_hold',
      })
      .eq('id', disputedOrder.id)

    const disputedResults = await callReleaseDuePayouts(admin)
    const disputedPromotion = disputedResults.find((entry) => entry.order_id === disputedOrder.id)
    assert(!disputedPromotion, 'Disputed order should not be promoted')
    logPass(`Disputed order ${disputedOrder.id} skipped`)
  } else {
    logPass('No disputed order in database — skipped disputed check')
  }

  logStep('Already paid order → skipped')
  const { data: paidOrder } = await admin
    .from('orders')
    .select('id')
    .eq('payout_status', 'paid')
    .limit(1)
    .maybeSingle()

  if (paidOrder?.id) {
    const paidResults = await callReleaseDuePayouts(admin)
    const paidPromotion = paidResults.find((entry) => entry.order_id === paidOrder.id)
    assert(!paidPromotion, 'Paid order should not be promoted')
    logPass(`Paid order ${paidOrder.id} skipped`)
  } else {
    logPass('No paid order in database — skipped paid check')
  }

  logStep('Missing Connect account → awaiting_seller_setup')
  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('stripe_onboarding_complete, stripe_account_id')
    .eq('id', testOrder.seller_id)
    .single()

  const { data: secondOrder } = await admin
    .from('orders')
    .select('id, fulfilment_status, seller_id')
    .in('fulfilment_status', ['collected', 'delivered'])
    .eq('payout_status', 'not_due')
    .neq('id', testOrder.id)
    .limit(1)
    .maybeSingle()

  if (secondOrder?.id) {
    await admin
      .from('profiles')
      .update({ stripe_onboarding_complete: false, stripe_account_id: null })
      .eq('id', secondOrder.seller_id)

    await admin
      .from('orders')
      .update({
        fulfilment_status: secondOrder.fulfilment_status,
        payout_status: 'not_due',
        payout_release_at: pastReleaseAt,
      })
      .eq('id', secondOrder.id)

    const connectResults = await callReleaseDuePayouts(admin)
    const connectPromotion = connectResults.find((entry) => entry.order_id === secondOrder.id)
    assert(connectPromotion?.result === 'promoted_awaiting_seller_setup', 'Expected awaiting setup')
    assert(connectPromotion.seller_connect_ready === false, 'Expected seller_connect_ready=false')

    const { data: awaitingOrder } = await admin
      .from('orders')
      .select('payout_status')
      .eq('id', secondOrder.id)
      .single()

    assert(
      awaitingOrder.payout_status === 'awaiting_seller_setup',
      'Expected awaiting_seller_setup payout status',
    )
    logPass('Missing Connect promoted to awaiting_seller_setup')

    if (sellerProfile) {
      await admin
        .from('profiles')
        .update({
          stripe_onboarding_complete: sellerProfile.stripe_onboarding_complete,
          stripe_account_id: sellerProfile.stripe_account_id,
        })
        .eq('id', testOrder.seller_id)
    }
  } else if (promotion.result === 'promoted_awaiting_seller_setup') {
    logPass('Primary test order promoted to awaiting_seller_setup (seller Connect missing)')
  } else {
    logPass('Seller Connect ready on primary order; no second order for missing-Connect test')
  }

  console.log('\nAll Buyer Protection Phase 4B payout release checks passed.')
  console.log(`Primary order: ${testOrder.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
