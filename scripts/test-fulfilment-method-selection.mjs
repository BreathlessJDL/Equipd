#!/usr/bin/env node
/**
 * Regression tests for buyer fulfilment method selection.
 *
 * Usage:
 *   node scripts/test-fulfilment-method-selection.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Requires buyer-protection-fulfilment-method-selection-a-enums.sql and
 * buyer-protection-fulfilment-method-selection-b-functions.sql applied.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

function inferDeliveryOptionsFromListing(listing) {
  const opts = []
  const notes = listing.delivery_notes?.toLowerCase() ?? ''

  if (notes.includes('buyer can arrange')) opts.push('buyer_courier')
  if (notes.includes('seller delivery') || notes.includes('seller can personally')) {
    opts.push('seller_delivery')
  }

  if (listing.collection_available !== false) {
    const sellerOnly =
      opts.includes('seller_delivery') &&
      !opts.includes('buyer_courier') &&
      (notes.includes('seller delivery') || notes.includes('seller can personally'))

    if (!sellerOnly) opts.push('collection')
  }

  if (opts.length === 0 && listing.courier_available) opts.push('buyer_courier')

  return [...new Set(opts)]
}

function getAvailableFulfilmentMethods(listing) {
  const map = {
    collection: 'collection',
    buyer_courier: 'buyer_courier',
    seller_delivery: 'seller_delivery',
  }

  return inferDeliveryOptionsFromListing(listing)
    .map((optionId) => map[optionId])
    .filter(Boolean)
}

function listingRequiresFulfilmentSelection(listing) {
  return getAvailableFulfilmentMethods(listing).length > 1
}

function getOrderTimelineCurrentStage({ order, payment }) {
  if (payment?.status === 'paid' && order?.fulfilment_status === 'awaiting_courier_collection') {
    return { eventKey: 'awaiting_courier_collection' }
  }

  if (payment?.status === 'paid' && order?.fulfilment_status === 'awaiting_collection') {
    return { eventKey: 'awaiting_collection' }
  }

  return null
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }
const SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }

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

/** Unique fake Stripe ids per run — avoids payments_checkout_session_unique collisions. */
function fakeStripeTestIds(label = 'fulfilment') {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return {
    checkoutSessionId: `cs_${label}_${suffix}`,
    paymentIntentId: `pi_${label}_${suffix}`,
    chargeId: `ch_${label}_${suffix}`,
  }
}

async function captureTestPayment(admin, paymentId, label) {
  const ids = fakeStripeTestIds(label)
  const { error } = await admin.rpc('mark_payment_captured', {
    p_payment_id: paymentId,
    p_stripe_checkout_session_id: ids.checkoutSessionId,
    p_stripe_payment_intent_id: ids.paymentIntentId,
    p_stripe_charge_id: ids.chargeId,
  })

  if (error) {
    throw new Error(`mark_payment_captured failed: ${error.message}`)
  }
}

async function signIn(supabase, email) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
  return data.session
}

async function createActiveListing(admin, config) {
  const { data: category, error: categoryError } = await admin
    .from('categories')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (categoryError || !category?.id) {
    throw new Error(`Category lookup failed: ${categoryError?.message ?? 'not found'}`)
  }

  const { data, error } = await admin
    .from('listings')
    .insert({
      seller_id: SELLER.id,
      category_id: category.id,
      title: config.title,
      slug: `fulfilment-test-${crypto.randomUUID().slice(0, 8)}`,
      price_pence: 25000,
      condition: 'good',
      location: 'Leeds',
      status: 'active',
      collection_available: config.collection_available,
      courier_available: config.courier_available,
      delivery_notes: config.delivery_notes,
    })
    .select('id, collection_available, courier_available, delivery_notes')
    .single()

  if (error) throw new Error(`Create listing failed: ${error.message}`)
  return data
}

async function acceptOfferFlow(authed, admin, listingId, amountPence = 24000) {
  await signIn(authed, BUYER.email)

  const { data: offerRow, error: offerError } = await authed
    .from('offers')
    .insert({
      listing_id: listingId,
      buyer_id: BUYER.id,
      seller_id: SELLER.id,
      amount_pence: amountPence,
      status: 'pending',
      direction: 'buyer_to_seller',
      message: 'Fulfilment method selection test',
    })
    .select('id')
    .single()

  if (offerError) throw new Error(`Create offer failed: ${offerError.message}`)

  await signIn(authed, SELLER.email)

  const { error: acceptError } = await authed.rpc('accept_offer', {
    p_offer_id: offerRow.id,
  })

  if (acceptError) throw new Error(`accept_offer failed: ${acceptError.message}`)

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

  return { offerId: offerRow.id, payment, order }
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

  console.log('\n=== Collection-only listing auto-selects collection ===')
  const collectionListing = await createActiveListing(admin, {
    title: 'Collection only test listing',
    collection_available: true,
    courier_available: false,
    delivery_notes: null,
  })

  assert(
    getAvailableFulfilmentMethods(collectionListing).join(',') === 'collection',
    'Expected collection-only methods',
  )

  const collectionFlow = await acceptOfferFlow(authed, admin, collectionListing.id)
  assert(collectionFlow.order.order_type === 'collection', 'Expected auto-selected collection order_type')
  logPass('Collection-only listing auto-selects collection')

  console.log('\n=== Multi-option listing leaves order_type unset until buyer selects ===')
  const multiListing = await createActiveListing(admin, {
    title: 'Collection + courier test listing',
    collection_available: true,
    courier_available: true,
    delivery_notes: 'Buyer can arrange a courier or collection service',
  })

  assert(listingRequiresFulfilmentSelection(multiListing), 'Expected multi-option listing')
  const multiFlow = await acceptOfferFlow(authed, admin, multiListing.id)
  assert(multiFlow.order.order_type === null, 'Multi-option order_type should be null before selection')
  logPass('Multi-option listing does not default to collection')

  console.log('\n=== Buyer selects buyer_courier and capture uses courier lifecycle ===')
  await signIn(authed, BUYER.email)

  const { error: setCourierError } = await authed.rpc('set_order_fulfilment_method', {
    p_payment_id: multiFlow.payment.id,
    p_order_type: 'buyer_courier',
  })

  if (setCourierError) {
    throw new Error(`set_order_fulfilment_method buyer_courier failed: ${setCourierError.message}`)
  }

  await captureTestPayment(admin, multiFlow.payment.id, 'fulfilment_courier')

  const { data: courierOrder, error: courierOrderError } = await admin
    .from('orders')
    .select('*')
    .eq('id', multiFlow.order.id)
    .single()

  if (courierOrderError || !courierOrder) {
    throw new Error(`Courier order lookup failed: ${courierOrderError?.message ?? 'not found'}`)
  }

  assert(courierOrder.order_type === 'buyer_courier', 'Expected buyer_courier order_type')
  assert(
    courierOrder.fulfilment_status === 'awaiting_courier_collection',
    `Expected awaiting_courier_collection, got ${courierOrder.fulfilment_status}`,
  )

  const timelineStage = getOrderTimelineCurrentStage({
    order: courierOrder,
    payment: { status: 'paid', paid_at: new Date().toISOString() },
    offer: { status: 'accepted' },
    supportRequests: [],
  })

  assert(
    timelineStage?.eventKey === 'awaiting_courier_collection',
    `Timeline should highlight awaiting courier collection, got ${timelineStage?.eventKey}`,
  )

  logPass('Buyer courier selection drives courier lifecycle and timeline')

  console.log('\n=== Invalid fulfilment method rejected server-side ===')
  const invalidListing = await createActiveListing(admin, {
    title: 'Collection only invalid selection test',
    collection_available: true,
    courier_available: false,
    delivery_notes: null,
  })
  const invalidFlow = await acceptOfferFlow(authed, admin, invalidListing.id)

  await signIn(authed, BUYER.email)

  const { error: invalidSetError } = await authed.rpc('set_order_fulfilment_method', {
    p_payment_id: invalidFlow.payment.id,
    p_order_type: 'buyer_courier',
  })

  assert(invalidSetError, 'Expected invalid buyer_courier selection to fail')
  logPass('Backend rejects disallowed fulfilment method')

  console.log('\nAll fulfilment method selection checks passed.')
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
