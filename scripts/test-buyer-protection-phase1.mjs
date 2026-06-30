#!/usr/bin/env node
/**
 * End-to-end verification for Buyer Protection Phase 1.
 *
 * Usage:
 *   node scripts/test-buyer-protection-phase1.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Optional STRIPE_SECRET_KEY to verify Checkout line items via Stripe API.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { calculateBuyerProtectionFee } from '../src/lib/buyerProtection.js'

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

async function fetchStripeCheckoutSession(sessionId, secretKey) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Stripe session fetch failed: ${response.status} ${body}`)
  }

  return response.json()
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authed = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const offerAmountPence = 32000
  const expectedFee = calculateBuyerProtectionFee(offerAmountPence)
  const expectedTotal = offerAmountPence + expectedFee

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
    .eq('status', 'pending')

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
      message: 'Phase 1 buyer protection E2E test offer',
    })
    .select('id')
    .single()

  if (offerError) {
    throw new Error(`Create offer failed: ${offerError.message}`)
  }

  logPass(`Offer ${offerRow.id} created for £${(offerAmountPence / 100).toFixed(2)}`)

  logStep('Seller accepts offer')
  await signIn(authed, SELLER.email)

  const { data: acceptedOffer, error: acceptError } = await authed.rpc('accept_offer', {
    p_offer_id: offerRow.id,
  })

  if (acceptError) {
    throw new Error(`accept_offer failed: ${acceptError.message}`)
  }

  logPass(`Offer accepted (${acceptedOffer?.status ?? 'accepted'})`)

  logStep('Verify payment + order rows')
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

  assert(payment.amount_pence === offerAmountPence, `payment.amount_pence expected ${offerAmountPence}, got ${payment.amount_pence}`)
  assert(
    payment.buyer_protection_fee_pence === expectedFee,
    `payment.buyer_protection_fee_pence expected ${expectedFee}, got ${payment.buyer_protection_fee_pence}`,
  )
  assert(
    payment.buyer_total_pence === expectedTotal,
    `payment.buyer_total_pence expected ${expectedTotal}, got ${payment.buyer_total_pence}`,
  )
  assert(
    payment.seller_net_pence === offerAmountPence,
    `payment.seller_net_pence expected ${offerAmountPence}, got ${payment.seller_net_pence}`,
  )

  assert(order.item_price_pence === offerAmountPence, `order.item_price_pence mismatch`)
  assert(order.buyer_protection_fee_pence === expectedFee, `order.buyer_protection_fee_pence mismatch`)
  assert(order.buyer_total_pence === expectedTotal, `order.buyer_total_pence mismatch`)
  assert(order.seller_net_pence === offerAmountPence, `order.seller_net_pence mismatch`)
  assert(order.fulfilment_status === 'awaiting_payment', `order.fulfilment_status expected awaiting_payment, got ${order.fulfilment_status}`)
  assert(order.payout_status === 'not_due', `order.payout_status expected not_due, got ${order.payout_status}`)
  assert(order.payout_release_at === null, `order.payout_release_at should be null before payment`)

  logPass(
    `Payment/order amounts: item £${(offerAmountPence / 100).toFixed(2)}, protection £${(expectedFee / 100).toFixed(2)}, total £${(expectedTotal / 100).toFixed(2)}, seller net £${(offerAmountPence / 100).toFixed(2)}`,
  )

  logStep('Buyer creates Stripe Checkout session')
  await signIn(authed, BUYER.email)
  const buyerSession = (await authed.auth.getSession()).data.session

  const checkoutResponse = await fetch(`${supabaseUrl}/functions/v1/stripe-create-checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${buyerSession.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payment_id: payment.id }),
  })

  const checkoutBody = await checkoutResponse.json()

  if (!checkoutResponse.ok) {
    throw new Error(`stripe-create-checkout failed: ${checkoutResponse.status} ${JSON.stringify(checkoutBody)}`)
  }

  assert(typeof checkoutBody.url === 'string' && checkoutBody.url.length > 0, 'Checkout URL missing')
  logPass('Checkout session URL returned')

  const { data: paymentAfterCheckout, error: paymentAfterCheckoutError } = await admin
    .from('payments')
    .select('stripe_checkout_session_id')
    .eq('id', payment.id)
    .single()

  if (paymentAfterCheckoutError) {
    throw new Error(`Payment session lookup failed: ${paymentAfterCheckoutError.message}`)
  }

  assert(
    paymentAfterCheckout.stripe_checkout_session_id,
    'stripe_checkout_session_id not attached to payment',
  )

  if (stripeSecretKey) {
    logStep('Verify Stripe Checkout line items')
    const stripeSession = await fetchStripeCheckoutSession(
      paymentAfterCheckout.stripe_checkout_session_id,
      stripeSecretKey,
    )

    const lineItems = stripeSession.line_items?.data ?? []
    assert(lineItems.length === 2, `Expected 2 line items, got ${lineItems.length}`)

    const itemLine = lineItems.find((line) => line.description?.includes('Accepted offer') || line.price?.product)
    const protectionLine = lineItems.find((line) => line.description === 'Equipd Buyer Protection for this purchase' || line.amount_total === expectedFee)

    const amounts = lineItems.map((line) => line.amount_total).sort((a, b) => a - b)
    assert(amounts[0] === expectedFee, `Protection line amount expected ${expectedFee}, got ${amounts[0]}`)
    assert(amounts[1] === offerAmountPence, `Item line amount expected ${offerAmountPence}, got ${amounts[1]}`)
    assert(stripeSession.amount_total === expectedTotal, `Stripe total expected ${expectedTotal}, got ${stripeSession.amount_total}`)

    logPass(`Stripe charges £${(stripeSession.amount_total / 100).toFixed(2)} (item + Buyer Protection)`)
    void itemLine
    void protectionLine
  } else {
    console.log('SKIP: STRIPE_SECRET_KEY not set locally — checkout URL created; line items not verified via Stripe API')
  }

  logStep('Simulate payment capture (webhook path)')
  const { error: captureError } = await admin.rpc('mark_payment_captured', {
    p_payment_id: payment.id,
    p_stripe_checkout_session_id: paymentAfterCheckout.stripe_checkout_session_id,
    p_stripe_payment_intent_id: 'pi_phase1_test',
    p_stripe_charge_id: 'ch_phase1_test',
  })

  if (captureError) {
    throw new Error(`mark_payment_captured failed: ${captureError.message}`)
  }

  const { data: orderAfterCapture, error: orderAfterCaptureError } = await admin
    .from('orders')
    .select('fulfilment_status, payout_status, payout_release_at, payout_released_at, seller_net_pence')
    .eq('id', order.id)
    .single()

  if (orderAfterCaptureError) {
    throw new Error(`Order after capture lookup failed: ${orderAfterCaptureError.message}`)
  }

  const expectedFulfilment =
    listing.courier_available && !listing.collection_available
      ? 'awaiting_courier_collection'
      : 'awaiting_collection'

  assert(
    orderAfterCapture.fulfilment_status === expectedFulfilment,
    `After capture fulfilment_status expected ${expectedFulfilment}, got ${orderAfterCapture.fulfilment_status}`,
  )
  assert(orderAfterCapture.payout_status === 'not_due', `After capture payout_status expected not_due, got ${orderAfterCapture.payout_status}`)
  assert(orderAfterCapture.payout_release_at === null, 'After capture payout_release_at should remain null')
  assert(orderAfterCapture.payout_released_at === null, 'After capture payout_released_at should remain null')
  assert(
    orderAfterCapture.seller_net_pence === offerAmountPence - Math.round(offerAmountPence * 0.02),
    'Seller net should reflect 2% Seller Service Fee after capture',
  )

  logPass(`Order moved to ${orderAfterCapture.fulfilment_status}; payout held (not_due, no release timestamp)`)

  logStep('Confirm no payout release attempted')
  const { data: payoutReadyOrders, error: payoutQueryError } = await admin
    .from('orders')
    .select('id, payout_status, payout_released_at, stripe_transfer_id')
    .eq('id', order.id)
    .single()

  if (payoutQueryError) {
    throw new Error(`Payout status query failed: ${payoutQueryError.message}`)
  }

  assert(!['ready', 'processing', 'paid'].includes(payoutReadyOrders.payout_status), 'Payout should not be ready/processing/paid immediately')
  assert(!payoutReadyOrders.stripe_transfer_id, 'No Stripe transfer should exist yet')

  logPass('No immediate payout release')

  console.log('\nAll Buyer Protection Phase 1 checks passed.')
  console.log(`Test offer: ${offerRow.id}`)
  console.log(`Test payment: ${payment.id}`)
  console.log(`Test order: ${order.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
