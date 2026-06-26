#!/usr/bin/env node
/**
 * Regression test: paid orders visible in Hub filters and listings hidden from browse.
 *
 * Usage:
 *   node scripts/test-paid-order-hub-visibility.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { isPaymentComplete } from '../src/lib/payments.js'

const HUB_PAID_ACTIVE_FULFILMENT_STATUSES = new Set([
  'paid',
  'awaiting_collection',
  'awaiting_courier_collection',
  'collected',
  'in_transit',
  'delivered',
  'in_progress',
  'awaiting_payout',
  'buyer_confirmed',
  'disputed',
])

function isPaidHubOrder(order, payment) {
  return Boolean(order && isPaymentComplete(payment) && HUB_PAID_ACTIVE_FULFILMENT_STATUSES.has(order.fulfilment_status))
}

function isBuyerHubPurchase(order, payment) {
  return isPaidHubOrder(order, payment)
}

function isSellerHubSaleInProgress(order, payment) {
  return isPaidHubOrder(order, payment) && order.fulfilment_status !== 'completed'
}

function isOrderAwaitingFulfilment(order, payment) {
  if (!isPaidHubOrder(order, payment)) return false

  return (
    order.fulfilment_status === 'awaiting_collection' ||
    order.fulfilment_status === 'awaiting_courier_collection' ||
    order.fulfilment_status === 'paid' ||
    order.fulfilment_status === 'in_progress'
  )
}

function canBuyerConfirmOrder(order, payment) {
  if (order?.order_type === 'collection' && order?.fulfilment_status === 'awaiting_collection') {
    return false
  }

  if (
    order?.order_type === 'buyer_courier' &&
    order?.fulfilment_status === 'awaiting_courier_collection'
  ) {
    return false
  }

  if (order?.order_type === 'buyer_courier') {
    return false
  }

  return payment?.status === 'paid' && HUB_PAID_ACTIVE_FULFILMENT_STATUSES.has(order?.fulfilment_status)
}

function isHubManageableListing(listing) {
  return ['draft', 'active', 'archived'].includes(listing?.status)
}

function isHubInProgressSaleListing(listing) {
  return listing?.status === 'reserved' || listing?.status === 'in_progress'
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }
const SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }
const LISTING_ID = '22222222-2222-4222-8222-222222222229'

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
  if (!condition) {
    throw new Error(message)
  }
}

function logStep(title) {
  console.log(`\n=== ${title} ===`)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signIn(supabase, email) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) {
    throw new Error(`Sign in failed for ${email}: ${error.message}`)
  }

  return data.session
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authed = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const offerAmountPence = 33000

  logStep('Prepare listing')
  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select('id, title, status, seller_id, collection_available, courier_available')
    .eq('id', LISTING_ID)
    .single()

  if (listingError || !listing) {
    throw new Error(`Listing lookup failed: ${listingError?.message ?? 'not found'}`)
  }

  if (listing.status !== 'active') {
    await admin.from('listings').update({ status: 'active' }).eq('id', LISTING_ID)
    logPass(`Reset listing ${LISTING_ID} to active`)
  }

  await admin
    .from('offers')
    .update({ status: 'rejected' })
    .eq('listing_id', LISTING_ID)
    .in('status', ['pending', 'accepted'])

  logStep('Buyer submits offer')
  await signIn(authed, BUYER.email)

  const { data: offerRow, error: offerError } = await authed
    .from('offers')
    .insert({
      listing_id: LISTING_ID,
      buyer_id: BUYER.id,
      seller_id: SELLER.id,
      amount_pence: offerAmountPence,
      status: 'pending',
      direction: 'buyer_to_seller',
      message: 'Paid order Hub visibility regression test',
    })
    .select('id')
    .single()

  if (offerError) {
    throw new Error(`Create offer failed: ${offerError.message}`)
  }

  logPass(`Offer ${offerRow.id} created`)

  logStep('Seller accepts offer')
  await signIn(authed, SELLER.email)

  const { error: acceptError } = await authed.rpc('accept_offer', {
    p_offer_id: offerRow.id,
  })

  if (acceptError) {
    throw new Error(`accept_offer failed: ${acceptError.message}`)
  }

  logPass('Offer accepted')

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('*')
    .eq('offer_id', offerRow.id)
    .single()

  if (paymentError || !payment) {
    throw new Error(`Payment lookup failed: ${paymentError?.message ?? 'not found'}`)
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('*')
    .eq('offer_id', offerRow.id)
    .single()

  if (orderError || !order) {
    throw new Error(`Order lookup failed: ${orderError?.message ?? 'not found'}`)
  }

  assert(order.fulfilment_status === 'awaiting_payment', 'Order should start awaiting_payment')
  logPass('Order row exists before payment')

  logStep('Simulate payment capture')
  const { error: captureError } = await admin.rpc('mark_payment_captured', {
    p_payment_id: payment.id,
    p_stripe_checkout_session_id: payment.stripe_checkout_session_id ?? 'cs_hub_visibility_test',
    p_stripe_payment_intent_id: 'pi_hub_visibility_test',
    p_stripe_charge_id: 'ch_hub_visibility_test',
  })

  if (captureError) {
    throw new Error(`mark_payment_captured failed: ${captureError.message}`)
  }

  const { data: paymentAfter, error: paymentAfterError } = await admin
    .from('payments')
    .select('*')
    .eq('id', payment.id)
    .single()

  if (paymentAfterError || !paymentAfter) {
    throw new Error(`Payment after capture lookup failed: ${paymentAfterError?.message ?? 'not found'}`)
  }

  const { data: orderAfter, error: orderAfterError } = await admin
    .from('orders')
    .select('*')
    .eq('id', order.id)
    .single()

  if (orderAfterError || !orderAfter) {
    throw new Error(`Order after capture lookup failed: ${orderAfterError?.message ?? 'not found'}`)
  }

  const { data: listingAfter, error: listingAfterError } = await admin
    .from('listings')
    .select('id, status, seller_id')
    .eq('id', LISTING_ID)
    .single()

  if (listingAfterError || !listingAfter) {
    throw new Error(`Listing after capture lookup failed: ${listingAfterError?.message ?? 'not found'}`)
  }

  const expectedFulfilment =
    listing.courier_available && !listing.collection_available
      ? 'awaiting_courier_collection'
      : 'awaiting_collection'

  assert(isPaymentComplete(paymentAfter), 'Payment should be paid after capture')
  assert(orderAfter.fulfilment_status === expectedFulfilment, `Expected ${expectedFulfilment}, got ${orderAfter.fulfilment_status}`)
  assert(orderAfter.payout_status === 'not_due', 'Payout should remain not_due')
  assert(orderAfter.payout_release_at === null, 'payout_release_at should remain null')
  assert(listingAfter.status === 'in_progress', `Listing should be in_progress, got ${listingAfter.status}`)

  logPass('Payment captured; order awaiting fulfilment; listing in_progress; payout held')

  logStep('Verify Hub visibility helpers')
  assert(isBuyerHubPurchase(orderAfter, paymentAfter), 'Buyer Hub should include paid order')
  assert(isSellerHubSaleInProgress(orderAfter, paymentAfter), 'Seller Hub should include paid sale')
  assert(isPaidHubOrder(orderAfter, paymentAfter), 'Paid Hub order helper should match')
  assert(isOrderAwaitingFulfilment(orderAfter, paymentAfter), 'Order should be awaiting fulfilment')
  assert(!canBuyerConfirmOrder(orderAfter, paymentAfter), 'Collection/courier orders should not use legacy confirm')
  assert(!isHubManageableListing(listingAfter), 'Paid in_progress listing should not appear in My listings grid')
  assert(isHubInProgressSaleListing(listingAfter), 'Paid in_progress listing should be treated as in-progress sale')

  logPass('Hub filter helpers include paid order and exclude listing from manageable listings')

  logStep('Verify browse and seller listing visibility')
  const { count: activeBrowseCount, error: browseError } = await admin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('id', LISTING_ID)
    .eq('status', 'active')

  if (browseError) {
    throw new Error(`Browse query failed: ${browseError.message}`)
  }

  assert(activeBrowseCount === 0, 'Paid listing should not appear in active browse')

  const { data: sellerManageableListings, error: sellerListingsError } = await admin
    .from('listings')
    .select('id, status')
    .eq('seller_id', SELLER.id)
    .in('status', ['draft', 'active', 'archived'])

  if (sellerListingsError) {
    throw new Error(`Seller listings query failed: ${sellerListingsError.message}`)
  }

  assert(
    !(sellerManageableListings ?? []).some((row) => row.id === LISTING_ID),
    'Paid listing should not appear in seller manageable listings filter',
  )

  logPass('Listing removed from active browse and seller manageable listings')

  console.log('\nAll paid order Hub visibility checks passed.')
  console.log(`Test offer: ${offerRow.id}`)
  console.log(`Test payment: ${payment.id}`)
  console.log(`Test order: ${order.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
