#!/usr/bin/env node
/**
 * Order completion notifications (buyer review reminder + seller payout complete).
 *
 * Usage:
 *   node scripts/test-order-completion-notifications.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Run supabase/order-completion-notifications.sql on Supabase first.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const BUYER_REVIEW_TYPE = 'buyer_review_reminder'
const SELLER_PAYOUT_TYPE = 'seller_payout_complete'

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

function orderLink(orderId) {
  return `/orders/${orderId}`
}

async function countOrderNotifications(admin, { userId, type, orderId }) {
  const { data, error } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('link_url', orderLink(orderId))

  if (error) {
    throw new Error(`countOrderNotifications failed: ${error.message}`)
  }

  return data?.length ?? 0
}

async function findEligibleProtectionOrder(admin) {
  const { data: candidates } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payment_id, fulfilment_status, payout_status, payout_release_at, protection_status')
    .in('fulfilment_status', ['collected', 'delivered'])
    .eq('payout_status', 'not_due')
    .is('payout_released_at', null)
    .is('stripe_transfer_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  for (const candidate of candidates ?? []) {
    if (!candidate.payment_id) continue

    const { data: payment } = await admin
      .from('payments')
      .select('status, stripe_charge_id')
      .eq('id', candidate.payment_id)
      .maybeSingle()

    if (payment?.status !== 'paid' || !payment?.stripe_charge_id) continue

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
    'No eligible collected/delivered order found. Run buyer-protection phase 2/3 tests first.',
  )
}

async function promoteOrderAfterProtection(admin, orderId) {
  const { error } = await admin.rpc('promote_order_after_buyer_protection_window', {
    p_order_id: orderId,
  })

  if (error) {
    throw new Error(`promote_order_after_buyer_protection_window failed: ${error.message}`)
  }
}

async function ensureRpcExists(admin, functionName) {
  const { error } = await admin.rpc(functionName, { p_order_id: '00000000-0000-0000-0000-000000000000' })

  if (error?.message?.includes('Could not find the function')) {
    throw new Error(
      `Missing ${functionName}. Run supabase/order-completion-notifications.sql on Supabase first.`,
    )
  }
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

  await ensureRpcExists(admin, 'send_buyer_review_reminder_if_eligible')

  const testOrder = await findEligibleProtectionOrder(admin)
  logPass(`Using order ${testOrder.id}`)

  const pastReleaseAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  logStep('Buyer does not get review reminder before completion')
  await admin
    .from('orders')
    .update({
      fulfilment_status: testOrder.fulfilment_status,
      payout_status: 'not_due',
      payout_release_at: pastReleaseAt,
      protection_status: 'active',
    })
    .eq('id', testOrder.id)

  const beforeCount = await countOrderNotifications(admin, {
    userId: testOrder.buyer_id,
    type: BUYER_REVIEW_TYPE,
    orderId: testOrder.id,
  })

  const { data: beforeOrder } = await admin
    .from('orders')
    .select('fulfilment_status, protection_status')
    .eq('id', testOrder.id)
    .single()

  assert(
    beforeOrder.fulfilment_status !== 'completed',
    'Test order should not be completed before promotion',
  )
  assert(beforeCount === 0, 'Buyer should not have review reminder before completion')
  logPass('No buyer review reminder while order is in progress')

  logStep('Buyer gets review reminder after completion')
  await promoteOrderAfterProtection(admin, testOrder.id)

  const { data: completedOrder } = await admin
    .from('orders')
    .select('fulfilment_status, protection_status, payout_status')
    .eq('id', testOrder.id)
    .single()

  assert(completedOrder.fulfilment_status === 'completed', 'Expected completed fulfilment_status')
  assert(
    completedOrder.protection_status === 'released',
    `Expected protection_status=released, got ${completedOrder.protection_status}`,
  )

  const afterCompleteCount = await countOrderNotifications(admin, {
    userId: testOrder.buyer_id,
    type: BUYER_REVIEW_TYPE,
    orderId: testOrder.id,
  })

  assert(afterCompleteCount === 1, `Expected 1 buyer review reminder, got ${afterCompleteCount}`)

  const { data: buyerNotification } = await admin
    .from('notifications')
    .select('title, body, link_url')
    .eq('user_id', testOrder.buyer_id)
    .eq('type', BUYER_REVIEW_TYPE)
    .eq('link_url', orderLink(testOrder.id))
    .single()

  assert(
    /leave a review/i.test(buyerNotification.body),
    'Buyer notification body should mention leaving a review',
  )
  assert(buyerNotification.link_url === orderLink(testOrder.id), 'Buyer notification should link to order')
  logPass('Buyer review reminder created after completion')

  logStep('Repeated buyer reminder helper → no duplicate')
  const { data: buyerReminderAgain, error: buyerReminderError } = await admin.rpc(
    'send_buyer_review_reminder_if_eligible',
    { p_order_id: testOrder.id },
  )

  if (buyerReminderError) {
    throw new Error(`send_buyer_review_reminder_if_eligible failed: ${buyerReminderError.message}`)
  }

  assert(buyerReminderAgain === false, 'Second buyer reminder call should be skipped')

  const duplicateBuyerCount = await countOrderNotifications(admin, {
    userId: testOrder.buyer_id,
    type: BUYER_REVIEW_TYPE,
    orderId: testOrder.id,
  })

  assert(duplicateBuyerCount === 1, `Expected still 1 buyer reminder, got ${duplicateBuyerCount}`)
  logPass('Buyer review reminder is idempotent')

  logStep('Buyer with existing review → no reminder')
  await admin
    .from('notifications')
    .delete()
    .eq('user_id', testOrder.buyer_id)
    .eq('type', BUYER_REVIEW_TYPE)
    .eq('link_url', orderLink(testOrder.id))

  const { error: reviewInsertError } = await admin.from('reviews').insert({
    order_id: testOrder.id,
    reviewer_user_id: testOrder.buyer_id,
    reviewed_user_id: testOrder.seller_id,
    rating: 5,
    review_text: 'Test review for notification skip',
  })

  if (reviewInsertError && !/duplicate|already reviewed|unique/i.test(reviewInsertError.message)) {
    throw new Error(`Review insert failed: ${reviewInsertError.message}`)
  }

  const { data: skippedForReview, error: skippedForReviewError } = await admin.rpc(
    'send_buyer_review_reminder_if_eligible',
    { p_order_id: testOrder.id },
  )

  if (skippedForReviewError) {
    throw new Error(`send_buyer_review_reminder_if_eligible failed: ${skippedForReviewError.message}`)
  }

  assert(skippedForReview === false, 'Reminder should be skipped when buyer already reviewed')

  const reviewSkipCount = await countOrderNotifications(admin, {
    userId: testOrder.buyer_id,
    type: BUYER_REVIEW_TYPE,
    orderId: testOrder.id,
  })

  assert(reviewSkipCount === 0, 'No buyer reminder when review already exists')
  logPass('Buyer review reminder skipped when review already left')

  logStep('Seller gets payout complete notification after payout paid')

  if (!['ready', 'awaiting_seller_setup'].includes(completedOrder.payout_status)) {
    throw new Error(`Unexpected payout_status after promotion: ${completedOrder.payout_status}`)
  }

  if (completedOrder.payout_status === 'awaiting_seller_setup') {
    const { data: sellerProfile } = await admin
      .from('profiles')
      .select('stripe_onboarding_complete, stripe_account_id')
      .eq('id', testOrder.seller_id)
      .single()

    if (!sellerProfile?.stripe_account_id || !sellerProfile?.stripe_onboarding_complete) {
      console.log(
        'SKIP: Seller payout paid test — seller Connect not ready (awaiting_seller_setup).',
      )
      console.log('\nBuyer-side order completion notification checks passed.')
      console.log(`Order: ${testOrder.id}`)
      return
    }

    await admin
      .from('orders')
      .update({ payout_status: 'ready' })
      .eq('id', testOrder.id)
  }

  const beforeSellerCount = await countOrderNotifications(admin, {
    userId: testOrder.seller_id,
    type: SELLER_PAYOUT_TYPE,
    orderId: testOrder.id,
  })

  assert(beforeSellerCount === 0, 'Seller should not have payout notification before payout paid')

  const { error: processingError } = await admin.rpc('mark_order_payout_processing', {
    p_order_id: testOrder.id,
  })

  if (processingError) {
    throw new Error(`mark_order_payout_processing failed: ${processingError.message}`)
  }

  const fakeTransferId = `tr_test_${Date.now()}`

  const { error: releasedError } = await admin.rpc('mark_order_payout_released', {
    p_order_id: testOrder.id,
    p_stripe_transfer_id: fakeTransferId,
  })

  if (releasedError) {
    throw new Error(`mark_order_payout_released failed: ${releasedError.message}`)
  }

  const afterSellerCount = await countOrderNotifications(admin, {
    userId: testOrder.seller_id,
    type: SELLER_PAYOUT_TYPE,
    orderId: testOrder.id,
  })

  assert(afterSellerCount === 1, `Expected 1 seller payout notification, got ${afterSellerCount}`)

  const { data: sellerNotification } = await admin
    .from('notifications')
    .select('title, body, link_url')
    .eq('user_id', testOrder.seller_id)
    .eq('type', SELLER_PAYOUT_TYPE)
    .eq('link_url', orderLink(testOrder.id))
    .single()

  assert(
    /payout has been released/i.test(sellerNotification.body),
    'Seller notification body should mention payout release',
  )
  logPass('Seller payout complete notification created')

  logStep('Repeated payout release + helper → no duplicate seller notification')
  const { error: releasedAgainError } = await admin.rpc('mark_order_payout_released', {
    p_order_id: testOrder.id,
    p_stripe_transfer_id: fakeTransferId,
  })

  if (releasedAgainError) {
    throw new Error(`mark_order_payout_released re-run failed: ${releasedAgainError.message}`)
  }

  const { data: sellerReminderAgain, error: sellerReminderError } = await admin.rpc(
    'send_seller_payout_complete_notification_if_eligible',
    { p_order_id: testOrder.id },
  )

  if (sellerReminderError) {
    throw new Error(
      `send_seller_payout_complete_notification_if_eligible failed: ${sellerReminderError.message}`,
    )
  }

  assert(sellerReminderAgain === false, 'Second seller notification call should be skipped')

  const duplicateSellerCount = await countOrderNotifications(admin, {
    userId: testOrder.seller_id,
    type: SELLER_PAYOUT_TYPE,
    orderId: testOrder.id,
  })

  assert(duplicateSellerCount === 1, `Expected still 1 seller notification, got ${duplicateSellerCount}`)
  logPass('Seller payout notification is idempotent')

  console.log('\nAll order completion notification checks passed.')
  console.log(`Order: ${testOrder.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
