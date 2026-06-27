#!/usr/bin/env node
/**
 * Full Buyer Protection protected transaction regression test.
 *
 * Usage:
 *   node scripts/test-buyer-protection-regression.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { calculateBuyerProtectionFee } from '../src/lib/buyerProtection.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const COLLECTION_BUYER = {
  email: 'dev-buyer-chris@equipd.dev',
  id: '11111111-1111-4111-8111-111111111105',
}
const COLLECTION_SELLER = {
  email: 'dev-seller-leeds@equipd.dev',
  id: '11111111-1111-4111-8111-111111111101',
}
const WRONG_BUYER = {
  email: 'dev-buyer-emma@equipd.dev',
  id: '11111111-1111-4111-8111-111111111104',
}
const COURIER_BUYER = {
  email: 'dev-buyer-emma@equipd.dev',
  id: '11111111-1111-4111-8111-111111111104',
}
const COURIER_SELLER = {
  email: 'dev-seller-manchester@equipd.dev',
  id: '11111111-1111-4111-8111-111111111102',
}
const DEV_ADMIN = {
  email: 'dev-seller-london@equipd.dev',
  id: '11111111-1111-4111-8111-111111111103',
}

const COLLECTION_LISTING_ID = '22222222-2222-4222-8222-222222222229'
const COURIER_LISTING_ID = '22222222-2222-4222-8222-222222222230'

const COLLECTION_CHECKS = {
  item_collected: true,
  item_inspected: true,
  item_matches_listing: true,
}

const DELIVERY_CHECKS = {
  item_received: true,
  handover_evidence_reviewed: true,
  protection_window_acknowledged: true,
}

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
  'base64',
)

const sessionCache = new Map()

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

function logSection(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`)
}

function logStep(title) {
  console.log(`\n--- ${title} ---`)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signIn(client, email) {
  if (sessionCache.has(email)) {
    const { error } = await client.auth.setSession(sessionCache.get(email))
    if (!error) {
      return sessionCache.get(email)
    }
    sessionCache.delete(email)
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) {
    throw new Error(`Sign in failed for ${email}: ${error.message}`)
  }

  sessionCache.set(email, data.session)
  return data.session
}

async function ensureAdminUser(admin) {
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()

  if (adminProfile?.id) {
    return DEV_ADMIN
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', DEV_ADMIN.id)

  if (error) {
    throw new Error(`Admin bootstrap failed: ${error.message}`)
  }

  return DEV_ADMIN
}

async function prepareListing(admin, listingId, { collectionAvailable, courierAvailable }) {
  await admin
    .from('listings')
    .update({
      status: 'active',
      collection_available: collectionAvailable,
      courier_available: courierAvailable,
    })
    .eq('id', listingId)
}

async function createAcceptedOffer(authed, {
  listingId,
  buyer,
  seller,
  amountPence,
  message,
}) {
  await signIn(authed, buyer.email)

  const { data: offer, error: offerError } = await authed
    .from('offers')
    .insert({
      listing_id: listingId,
      buyer_id: buyer.id,
      seller_id: seller.id,
      amount_pence: amountPence,
      status: 'pending',
      direction: 'buyer_to_seller',
      message,
    })
    .select('id')
    .single()

  if (offerError) {
    throw new Error(`Create offer failed: ${offerError.message}`)
  }

  await signIn(authed, seller.email)

  const { error: acceptError } = await authed.rpc('accept_offer', {
    p_offer_id: offer.id,
  })

  if (acceptError) {
    throw new Error(`accept_offer failed: ${acceptError.message}`)
  }

  return offer.id
}

async function loadPaymentAndOrder(admin, offerId) {
  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('*')
    .eq('offer_id', offerId)
    .single()

  if (paymentError || !payment) {
    throw new Error(`Payment lookup failed: ${paymentError?.message ?? 'missing'}`)
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('*')
    .eq('offer_id', offerId)
    .single()

  if (orderError || !order) {
    throw new Error(`Order lookup failed: ${orderError?.message ?? 'missing'}`)
  }

  return { payment, order }
}

function verifyCheckoutTotals(payment, order, offerAmountPence) {
  const expectedFee = calculateBuyerProtectionFee(offerAmountPence)
  const expectedTotal = offerAmountPence + expectedFee

  assert(payment.amount_pence === offerAmountPence, 'payment.amount_pence mismatch')
  assert(
    payment.buyer_protection_fee_pence === expectedFee,
    'payment.buyer_protection_fee_pence mismatch',
  )
  assert(payment.buyer_total_pence === expectedTotal, 'payment.buyer_total_pence mismatch')
  assert(payment.seller_net_pence === offerAmountPence, 'payment.seller_net_pence mismatch')
  assert(order.item_price_pence === offerAmountPence, 'order.item_price_pence mismatch')
  assert(order.buyer_protection_fee_pence === expectedFee, 'order.buyer_protection_fee_pence mismatch')
  assert(order.buyer_total_pence === expectedTotal, 'order.buyer_total_pence mismatch')
  assert(order.seller_net_pence === offerAmountPence, 'order.seller_net_pence mismatch')
}

function verifyNoImmediatePayout(order) {
  assert(order.payout_status === 'not_due', `Expected not_due after payment, got ${order.payout_status}`)
  assert(!order.payout_release_at, 'payout_release_at should be null after payment')
  assert(!order.payout_released_at, 'payout_released_at should be null after payment')
  assert(!order.stripe_transfer_id, 'No Stripe transfer after payment')
  assert(!['ready', 'processing', 'paid'].includes(order.payout_status), 'Payout must not be released yet')
}

async function capturePayment(admin, paymentId, suffix) {
  const { error } = await admin.rpc('mark_payment_captured', {
    p_payment_id: paymentId,
    p_stripe_checkout_session_id: `cs_regression_${suffix}`,
    p_stripe_payment_intent_id: `pi_regression_${suffix}`,
    p_stripe_charge_id: `ch_regression_${suffix}`,
  })

  if (error) {
    throw new Error(`mark_payment_captured failed: ${error.message}`)
  }
}

async function fetchOrder(admin, orderId) {
  const { data, error } = await admin.from('orders').select('*').eq('id', orderId).single()

  if (error || !data) {
    throw new Error(`Order fetch failed: ${error?.message ?? orderId}`)
  }

  return data
}

async function confirmCollectionWithAuthChecks(authed, orderId) {
  await signIn(authed, COLLECTION_SELLER.email)

  const { data: tokenData, error: tokenError } = await authed.rpc('generate_collection_qr_token', {
    p_order_id: orderId,
  })

  if (tokenError) {
    throw new Error(`generate_collection_qr_token failed: ${tokenError.message}`)
  }

  await signIn(authed, WRONG_BUYER.email)

  const { error: wrongBuyerError } = await authed.rpc('confirm_collection_by_qr', {
    p_token: tokenData.token,
    p_checks: COLLECTION_CHECKS,
    p_user_agent: 'regression-test',
  })

  assert(wrongBuyerError, 'Wrong buyer should not confirm collection QR')
  logPass(`Wrong buyer rejected: ${wrongBuyerError.message}`)

  await signIn(authed, COLLECTION_SELLER.email)

  const { error: sellerError } = await authed.rpc('confirm_collection_by_qr', {
    p_token: tokenData.token,
    p_checks: COLLECTION_CHECKS,
    p_user_agent: 'regression-test',
  })

  assert(sellerError, 'Seller should not confirm collection QR')
  logPass(`Seller rejected: ${sellerError.message}`)

  await signIn(authed, COLLECTION_BUYER.email)

  const beforeConfirm = Date.now()

  const { data: confirmedOrder, error: confirmError } = await authed.rpc('confirm_collection_by_qr', {
    p_token: tokenData.token,
    p_checks: COLLECTION_CHECKS,
    p_user_agent: 'regression-test',
  })

  if (confirmError) {
    throw new Error(`confirm_collection_by_qr failed: ${confirmError.message}`)
  }

  assert(confirmedOrder.fulfilment_status === 'collected', 'Expected collected')
  assert(confirmedOrder.payout_status === 'not_due', 'Expected not_due after collection')
  assert(confirmedOrder.payout_release_at, 'Expected payout_release_at after collection')
  assert(!confirmedOrder.stripe_transfer_id, 'No Stripe transfer after collection')

  const hoursUntilRelease =
    (new Date(confirmedOrder.payout_release_at).getTime() - beforeConfirm) / (1000 * 60 * 60)
  assert(hoursUntilRelease > 23 && hoursUntilRelease < 25, `Expected ~24h window, got ${hoursUntilRelease.toFixed(2)}h`)

  logPass('Buyer confirmed collection; 24h protection window started')
  return confirmedOrder
}

async function confirmCollectionQuick(authed, orderId) {
  await signIn(authed, COLLECTION_SELLER.email)

  const { data: tokenData, error: tokenError } = await authed.rpc('generate_collection_qr_token', {
    p_order_id: orderId,
  })

  if (tokenError) {
    throw new Error(`generate_collection_qr_token failed: ${tokenError.message}`)
  }

  await signIn(authed, COLLECTION_BUYER.email)

  const { data: confirmedOrder, error: confirmError } = await authed.rpc('confirm_collection_by_qr', {
    p_token: tokenData.token,
    p_checks: COLLECTION_CHECKS,
    p_user_agent: 'regression-test',
  })

  if (confirmError) {
    throw new Error(`confirm_collection_by_qr failed: ${confirmError.message}`)
  }

  return confirmedOrder
}

function buildEvidencePayload(orderId) {
  return {
    courier_evidence_video_url: `${orderId}/video/regression.mp4`,
    courier_pre_collection_photo_url: `${orderId}/photos/pre-collection/regression.jpg`,
    courier_handover_photo_url: `${orderId}/photos/handover/regression.jpg`,
    courier_name: 'Regression Courier',
    courier_company: 'Equipd Test Freight',
    courier_signature_name: 'Regression Courier',
    courier_signature_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  }
}

async function submitCourierEvidence(authed, orderId) {
  await signIn(authed, COURIER_SELLER.email)

  const { data, error } = await authed.rpc('submit_courier_handover_evidence', {
    p_order_id: orderId,
    p_payload: buildEvidencePayload(orderId),
  })

  if (error) {
    throw new Error(`submit_courier_handover_evidence failed: ${error.message}`)
  }

  assert(data.fulfilment_status === 'in_transit', 'Expected in_transit after evidence')
  assert(data.payout_status === 'not_due', 'Expected not_due after evidence')
  assert(!data.payout_release_at, 'payout_release_at should be null before delivery confirm')
  logPass('Seller submitted courier evidence; order in transit')
  return data
}

async function confirmCourierDelivery(authed, orderId) {
  await signIn(authed, COURIER_BUYER.email)

  const beforeConfirm = Date.now()

  const { data, error } = await authed.rpc('confirm_courier_delivery', {
    p_order_id: orderId,
    p_checks: DELIVERY_CHECKS,
    p_user_agent: 'regression-test',
    p_buyer_tracking_reference: `REG-BUYER-${orderId.slice(0, 8)}`,
  })

  if (error) {
    throw new Error(`confirm_courier_delivery failed: ${error.message}`)
  }

  assert(data.fulfilment_status === 'delivered', 'Expected delivered')
  assert(data.payout_status === 'not_due', 'Expected not_due after delivery')
  assert(data.payout_release_at, 'Expected payout_release_at after delivery')
  assert(!data.stripe_transfer_id, 'No Stripe transfer after delivery')

  const hoursUntilRelease =
    (new Date(data.payout_release_at).getTime() - beforeConfirm) / (1000 * 60 * 60)
  assert(hoursUntilRelease > 23 && hoursUntilRelease < 25, `Expected ~24h window, got ${hoursUntilRelease.toFixed(2)}h`)

  logPass('Buyer confirmed delivery; 24h protection window started')
  return data
}

async function callReleaseDuePayouts(admin) {
  const { data, error } = await admin.rpc('release_due_order_payouts')

  if (error) {
    throw new Error(`release_due_order_payouts failed: ${error.message}`)
  }

  return Array.isArray(data) ? data : (data ?? [])
}

async function setProtectionWindowElapsed(admin, orderId) {
  const { error } = await admin
    .from('orders')
    .update({ payout_release_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
    .eq('id', orderId)

  if (error) {
    throw new Error(`Failed to backdate payout_release_at: ${error.message}`)
  }
}

function assertPayoutEligible(order, label) {
  assert(
    order.fulfilment_status === 'buyer_confirmed' ||
      order.fulfilment_status === 'collected' ||
      order.fulfilment_status === 'delivered',
    `${label}: unexpected fulfilment_status ${order.fulfilment_status}`,
  )
  assert(
    ['ready', 'awaiting_seller_setup'].includes(order.payout_status),
    `${label}: expected payout eligible (ready/awaiting_seller_setup), got ${order.payout_status}`,
  )
  assert(order.payout_status !== 'on_hold', `${label}: payout should not be on hold`)
  assert(!order.stripe_transfer_id, `${label}: no Stripe transfer in regression`)
}

function assertPayoutFrozen(order, label) {
  assert(order.fulfilment_status === 'disputed', `${label}: expected disputed fulfilment`)
  assert(order.payout_status === 'on_hold', `${label}: expected on_hold payout`)
  assert(!order.stripe_transfer_id, `${label}: no Stripe transfer when frozen`)
}

async function openDispute(authed, orderId, reason = 'significant_undisclosed_fault') {
  const disputeId = crypto.randomUUID()
  const path = `${orderId}/disputes/${disputeId}/regression.jpg`

  const { error: uploadError } = await authed.storage.from('order-evidence').upload(path, JPEG, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Dispute evidence upload failed: ${uploadError.message}`)
  }

  const { data, error } = await authed.rpc('open_order_dispute', {
    p_order_id: orderId,
    p_reason: reason,
    p_description: 'Regression test dispute.',
    p_evidence_paths: [path],
    p_dispute_id: disputeId,
  })

  if (error) {
    throw new Error(`open_order_dispute failed: ${error.message}`)
  }

  return data
}

async function openCourierDispute(authed, orderId) {
  return openDispute(authed, orderId, 'significant_seller_misrepresentation')
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

  const adminUser = await ensureAdminUser(admin)

  logSection('CHECKOUT & PAYMENT TOTALS (collection)')

  await prepareListing(admin, COLLECTION_LISTING_ID, {
    collectionAvailable: true,
    courierAvailable: false,
  })

  const collectionAmount = 28000 + Math.floor(Math.random() * 1000)

  logStep('Offer accepted and payment rows created')
  const collectionOfferId = await createAcceptedOffer(authed, {
    listingId: COLLECTION_LISTING_ID,
    buyer: COLLECTION_BUYER,
    seller: COLLECTION_SELLER,
    amountPence: collectionAmount,
    message: 'Regression collection offer',
  })

  let { payment, order } = await loadPaymentAndOrder(admin, collectionOfferId)
  verifyCheckoutTotals(payment, order, collectionAmount)
  verifyNoImmediatePayout(order)
  logPass(
    `Buyer pays item + protection; seller net = item price (£${(collectionAmount / 100).toFixed(0)} + fee)`,
  )

  logStep('Simulate payment capture')
  await capturePayment(admin, payment.id, collectionOfferId.slice(0, 8))
  order = await fetchOrder(admin, order.id)
  assert(order.fulfilment_status === 'awaiting_collection', 'Expected awaiting_collection after pay')
  verifyNoImmediatePayout(order)
  logPass('No immediate payout after checkout/payment capture')

  logSection('PATH 1 — COLLECTION ORDER (no dispute → payout eligible)')

  await confirmCollectionWithAuthChecks(authed, order.id)

  logStep('Future protection window → payout not yet eligible')
  const beforeWindowResults = await callReleaseDuePayouts(admin)
  assert(
    !beforeWindowResults.some((entry) => entry.order_id === order.id),
    'Order with active window should not be promoted yet',
  )
  logPass('Payout not eligible while 24h window is active')

  logStep('Protection window elapsed → payout becomes eligible')
  await setProtectionWindowElapsed(admin, order.id)
  const collectionPromoteResults = await callReleaseDuePayouts(admin)
  assert(
    collectionPromoteResults.some((entry) => entry.order_id === order.id),
    'Expected collection order in release_due_order_payouts results',
  )

  const collectionEligible = await fetchOrder(admin, order.id)
  assert(collectionEligible.fulfilment_status === 'buyer_confirmed', 'Expected buyer_confirmed after window')
  assertPayoutEligible(collectionEligible, 'Collection no-dispute')
  logPass(`Collection payout eligible: payout_status=${collectionEligible.payout_status}`)

  logSection('PATH 1b — COLLECTION ORDER (dispute → payout frozen → admin resolve seller)')

  await prepareListing(admin, COLLECTION_LISTING_ID, {
    collectionAvailable: true,
    courierAvailable: false,
  })

  const collectionDisputeAmount = collectionAmount + 500
  const collectionDisputeOfferId = await createAcceptedOffer(authed, {
    listingId: COLLECTION_LISTING_ID,
    buyer: COLLECTION_BUYER,
    seller: COLLECTION_SELLER,
    amountPence: collectionDisputeAmount,
    message: 'Regression collection dispute offer',
  })

  let collectionDisputePayment = (await loadPaymentAndOrder(admin, collectionDisputeOfferId)).payment
  await capturePayment(admin, collectionDisputePayment.id, collectionDisputeOfferId.slice(0, 8))
  const collectionDisputeOrder = await fetchOrder(
    admin,
    (await loadPaymentAndOrder(admin, collectionDisputeOfferId)).order.id,
  )

  await confirmCollectionQuick(authed, collectionDisputeOrder.id)

  logStep('Buyer opens dispute → payout frozen')
  await signIn(authed, COLLECTION_BUYER.email)
  const collectionDispute = await openDispute(authed, collectionDisputeOrder.id)
  let frozenCollectionOrder = await fetchOrder(admin, collectionDisputeOrder.id)
  assertPayoutFrozen(frozenCollectionOrder, 'Collection dispute')

  logStep('Normal users cannot resolve disputes')
  const { error: buyerResolveError } = await authed.rpc('admin_resolve_dispute_for_seller', {
    p_dispute_id: collectionDispute.id,
    p_admin_note: 'Should fail',
  })
  assert(buyerResolveError, 'Buyer must not resolve disputes')
  logPass(`Buyer rejected: ${buyerResolveError.message}`)

  await signIn(authed, COLLECTION_SELLER.email)
  const { error: sellerResolveError } = await authed.rpc('admin_resolve_dispute_for_buyer', {
    p_dispute_id: collectionDispute.id,
    p_admin_note: 'Should fail',
  })
  assert(sellerResolveError, 'Seller must not resolve disputes')
  logPass(`Seller rejected: ${sellerResolveError.message}`)

  logStep('Disputed order skipped by release_due_order_payouts')
  await setProtectionWindowElapsed(admin, collectionDisputeOrder.id)
  const disputedReleaseResults = await callReleaseDuePayouts(admin)
  assert(
    !disputedReleaseResults.some((entry) => entry.order_id === collectionDisputeOrder.id),
    'Disputed order must not be promoted',
  )
  frozenCollectionOrder = await fetchOrder(admin, collectionDisputeOrder.id)
  assertPayoutFrozen(frozenCollectionOrder, 'Collection dispute after release_due skip')
  logPass('Dispute keeps payout frozen')

  logStep('Admin resolves for seller → payout eligible again')
  await signIn(authed, adminUser.email)
  const { error: adminSellerResolveError } = await authed.rpc('admin_resolve_dispute_for_seller', {
    p_dispute_id: collectionDispute.id,
    p_admin_note: 'Regression seller resolution',
  })

  if (adminSellerResolveError) {
    throw new Error(`admin_resolve_dispute_for_seller failed: ${adminSellerResolveError.message}`)
  }

  const collectionResolvedSeller = await fetchOrder(admin, collectionDisputeOrder.id)
  assertPayoutEligible(collectionResolvedSeller, 'Collection admin seller resolve')
  logPass(`Admin seller resolution restored payout eligibility (${collectionResolvedSeller.payout_status})`)

  logSection('PATH 2 — BUYER COURIER ORDER (no dispute → payout eligible)')

  await prepareListing(admin, COURIER_LISTING_ID, {
    collectionAvailable: false,
    courierAvailable: true,
  })

  const courierAmount = 150000 + Math.floor(Math.random() * 1000)
  const courierOfferId = await createAcceptedOffer(authed, {
    listingId: COURIER_LISTING_ID,
    buyer: COURIER_BUYER,
    seller: COURIER_SELLER,
    amountPence: courierAmount,
    message: 'Regression courier offer',
  })

  const courierPayment = (await loadPaymentAndOrder(admin, courierOfferId)).payment
  await capturePayment(admin, courierPayment.id, courierOfferId.slice(0, 8))
  let courierOrder = await fetchOrder(admin, (await loadPaymentAndOrder(admin, courierOfferId)).order.id)

  assert(courierOrder.order_type === 'buyer_courier', 'Expected buyer_courier order')
  assert(courierOrder.fulfilment_status === 'awaiting_courier_collection', 'Expected awaiting courier collection')
  verifyNoImmediatePayout(courierOrder)
  logPass('Courier order paid; payout held')

  await submitCourierEvidence(authed, courierOrder.id)
  await confirmCourierDelivery(authed, courierOrder.id)

  logStep('Future window → not eligible yet')
  const courierBeforeWindow = await callReleaseDuePayouts(admin)
  assert(
    !courierBeforeWindow.some((entry) => entry.order_id === courierOrder.id),
    'Courier order with active window should not promote yet',
  )
  logPass('Courier payout not eligible during active window')

  logStep('Window elapsed → payout eligible')
  await setProtectionWindowElapsed(admin, courierOrder.id)
  const courierPromoteResults = await callReleaseDuePayouts(admin)
  assert(
    courierPromoteResults.some((entry) => entry.order_id === courierOrder.id),
    'Expected courier order promoted',
  )

  courierOrder = await fetchOrder(admin, courierOrder.id)
  assert(courierOrder.fulfilment_status === 'buyer_confirmed', 'Expected buyer_confirmed')
  assertPayoutEligible(courierOrder, 'Courier no-dispute')
  logPass(`Courier payout eligible: payout_status=${courierOrder.payout_status}`)

  logSection('PATH 2b — BUYER COURIER ORDER (dispute → frozen → admin resolve buyer)')

  await prepareListing(admin, COURIER_LISTING_ID, {
    collectionAvailable: false,
    courierAvailable: true,
  })

  const courierDisputeAmount = courierAmount + 500
  const courierDisputeOfferId = await createAcceptedOffer(authed, {
    listingId: COURIER_LISTING_ID,
    buyer: COURIER_BUYER,
    seller: COURIER_SELLER,
    amountPence: courierDisputeAmount,
    message: 'Regression courier dispute offer',
  })

  const courierDisputePayment = (await loadPaymentAndOrder(admin, courierDisputeOfferId)).payment
  await capturePayment(admin, courierDisputePayment.id, courierDisputeOfferId.slice(0, 8))
  const courierDisputeOrder = await fetchOrder(
    admin,
    (await loadPaymentAndOrder(admin, courierDisputeOfferId)).order.id,
  )

  await submitCourierEvidence(authed, courierDisputeOrder.id)
  await confirmCourierDelivery(authed, courierDisputeOrder.id)

  await signIn(authed, COURIER_BUYER.email)
  const courierDispute = await openCourierDispute(authed, courierDisputeOrder.id)
  let frozenCourierOrder = await fetchOrder(admin, courierDisputeOrder.id)
  assertPayoutFrozen(frozenCourierOrder, 'Courier dispute')
  logPass('Courier dispute froze payout')

  logStep('Admin resolves for buyer → payout stays held')
  await signIn(authed, adminUser.email)

  const { error: adminBuyerResolveError } = await authed.rpc('admin_resolve_dispute_for_buyer', {
    p_dispute_id: courierDispute.id,
    p_admin_note: 'Regression buyer resolution — manual refund',
  })

  if (adminBuyerResolveError) {
    throw new Error(`admin_resolve_dispute_for_buyer failed: ${adminBuyerResolveError.message}`)
  }

  frozenCourierOrder = await fetchOrder(admin, courierDisputeOrder.id)
  assert(frozenCourierOrder.fulfilment_status === 'disputed', 'Order remains disputed')
  assert(frozenCourierOrder.payout_status === 'on_hold', 'Payout stays on hold after buyer resolution')
  assert(!frozenCourierOrder.stripe_transfer_id, 'No Stripe transfer on buyer resolution')
  logPass('Admin buyer resolution keeps payout on hold (no automated refund/payout)')

  logStep('Admin mark under review on a fresh dispute')
  await prepareListing(admin, COLLECTION_LISTING_ID, {
    collectionAvailable: true,
    courierAvailable: false,
  })
  const reviewOfferId = await createAcceptedOffer(authed, {
    listingId: COLLECTION_LISTING_ID,
    buyer: COLLECTION_BUYER,
    seller: COLLECTION_SELLER,
    amountPence: collectionAmount + 1500,
    message: 'Regression under review offer',
  })
  const reviewPayment = (await loadPaymentAndOrder(admin, reviewOfferId)).payment
  await capturePayment(admin, reviewPayment.id, reviewOfferId.slice(0, 8))
  const reviewOrder = await fetchOrder(admin, (await loadPaymentAndOrder(admin, reviewOfferId)).order.id)
  await confirmCollectionQuick(authed, reviewOrder.id)
  await signIn(authed, COLLECTION_BUYER.email)
  const reviewDispute = await openDispute(authed, reviewOrder.id)

  await signIn(authed, adminUser.email)
  const { data: underReview, error: reviewError } = await authed.rpc(
    'admin_mark_dispute_under_review',
    {
      p_dispute_id: reviewDispute.id,
      p_admin_note: 'Regression under review',
    },
  )

  if (reviewError) {
    throw new Error(`admin_mark_dispute_under_review failed: ${reviewError.message}`)
  }

  assert(underReview.status === 'under_review', 'Expected under_review')
  const reviewOrderAfter = await fetchOrder(admin, reviewOrder.id)
  assert(reviewOrderAfter.payout_status === 'on_hold', 'Payout remains on hold while under review')
  logPass('Admin marked dispute under review; payout still on hold')

  logSection('REGRESSION COMPLETE')
  console.log('\nAll protected transaction regression checks passed.')
  console.log(`Collection eligible order: ${order.id}`)
  console.log(`Collection dispute order: ${collectionDisputeOrder.id}`)
  console.log(`Courier eligible order: ${courierOrder.id}`)
  console.log(`Courier buyer-resolution order: ${courierDisputeOrder.id}`)
}

main().catch((error) => {
  console.error('\nREGRESSION FAILED:', error.message)
  process.exit(1)
})
