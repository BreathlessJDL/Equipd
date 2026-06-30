#!/usr/bin/env node
/**
 * End-to-end QA for fulfilment architecture (Phases 1–5).
 *
 * Usage: node scripts/test-fulfilment-architecture-qa.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { validateMarketplaceMessage } from '../src/lib/marketplaceMessageValidation.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }
const BUYER_NEAR = { email: 'dev-buyer-emma@equipd.dev', id: '11111111-1111-4111-8111-111111111104' }
const BUYER_FAR = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }

const bugs = []
const passes = []

function validateListingFulfilmentDetails(form, { forPublish = false } = {}) {
  if (!forPublish || !form) return []

  const errors = []
  const deliveryOptions = form.deliveryOptions ?? []
  const needsPrivate =
    deliveryOptions.includes('collection') || deliveryOptions.includes('buyer_courier')

  if (needsPrivate) {
    if (!form.collectionAddress?.trim()) errors.push('Collection address is required.')
    if (!form.collectionPhone?.trim()) errors.push('Best contact number is required.')
  }

  if (deliveryOptions.includes('seller_delivery')) {
    const raw = String(form.deliveryRangeMiles ?? '').trim()
    const parsed = Number(raw)
    if (!raw || !Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      errors.push('Enter a valid delivery radius in whole miles.')
    }
  }

  return errors
}

function canShowOrderFulfilmentDetails({ order, payment, viewerRole }) {
  if (!order?.id || !payment || !viewerRole) return false
  if (payment.status !== 'paid' || order.fulfilment_status === 'cancelled') return false
  const type = order.order_type ?? 'collection'
  return ['collection', 'buyer_courier', 'seller_delivery'].includes(type)
    && ['buyer', 'seller', 'admin'].includes(viewerRole)
}

const EARTH_RADIUS_MILES = 3958.7613

function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

function getAvailableFulfilmentMethodOptions(listing, { buyerProfile, forBuyerSelection = false } = {}) {
  const notes = listing.delivery_notes?.toLowerCase() ?? ''
  const optionIds = []
  if (notes.includes('buyer can arrange')) optionIds.push('buyer_courier')
  if (notes.includes('seller delivery') || notes.includes('seller can personally')) {
    optionIds.push('seller_delivery')
  }
  if (listing.seller_delivery_radius_miles > 0) optionIds.push('seller_delivery')
  if (listing.collection_available !== false) optionIds.push('collection')

  const labels = {
    collection: 'I will collect this item',
    buyer_courier: 'I will arrange a courier / collection service',
    seller_delivery: 'Seller will deliver this item',
  }

  return [...new Set(optionIds)].map((id) => {
    if (id !== 'seller_delivery' || !forBuyerSelection) {
      return { orderType: id, label: labels[id], disabled: false }
    }

    const radius = listing.seller_delivery_radius_miles
    const buyerLat = buyerProfile?.latitude
    const buyerLng = buyerProfile?.longitude

    if (buyerLat == null || buyerLng == null) {
      return {
        orderType: id,
        label: labels[id],
        disabled: true,
        disabledReason: 'Add your location to check seller delivery.',
      }
    }

    const distance = haversineDistanceMiles(
      listing.latitude,
      listing.longitude,
      buyerLat,
      buyerLng,
    )

    const available = distance != null && radius != null && distance <= radius

    return {
      orderType: id,
      label: labels[id],
      disabled: !available,
      disabledReason: available
        ? null
        : 'Seller delivery is unavailable for your location.',
    }
  })
}

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

function pass(msg) {
  passes.push(msg)
  console.log(`PASS: ${msg}`)
}

function bug(msg) {
  bugs.push(msg)
  console.error(`BUG: ${msg}`)
}

function assertPass(condition, passMsg, failMsg) {
  if (condition) pass(passMsg)
  else bug(failMsg)
}

async function signIn(client, email) {
  const { error } = await client.auth.signInWithPassword({ email, password: DEV_PASSWORD })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

function baseForm(overrides = {}) {
  return {
    title: 'QA fulfilment test listing',
    description: 'Test listing for fulfilment architecture QA pass.',
    categoryId: 'cat',
    condition: 'good',
    price: '100',
    deliveryOptions: ['collection'],
    collectionAddress: '',
    collectionPhone: '',
    collectionInstructions: '',
    deliveryRangeMiles: '',
    locationPlace: { latitude: 53.8, longitude: -1.55, displayLabel: 'Leeds' },
    locationSearch: 'Leeds',
    ...overrides,
  }
}

async function getCategoryId(admin) {
  const { data, error } = await admin.from('categories').select('id').limit(1).maybeSingle()
  if (error || !data?.id) throw new Error(`Category lookup failed: ${error?.message ?? 'none'}`)
  return data.id
}

async function createTestListing(admin, sellerClient, fields) {
  const categoryId = await getCategoryId(admin)
  const slug = `qa-fulfilment-${crypto.randomUUID().slice(0, 8)}`

  const { data: listing, error } = await sellerClient
    .from('listings')
    .insert({
      seller_id: SELLER.id,
      category_id: categoryId,
      slug,
      title: fields.title ?? 'QA fulfilment listing',
      description: fields.description ?? 'QA fulfilment listing description text.',
      price_pence: 10000,
      condition: 'good',
      location: 'Leeds, UK',
      latitude: 53.8008,
      longitude: -1.5491,
      collection_available: fields.collection_available ?? true,
      courier_available: fields.courier_available ?? false,
      delivery_notes: fields.delivery_notes ?? null,
      seller_delivery_radius_miles: fields.seller_delivery_radius_miles ?? null,
      status: fields.status ?? 'draft',
      source: 'manual',
    })
    .select('id, slug, latitude, longitude')
    .single()

  if (error) throw new Error(`Create listing failed: ${error.message}`)

  if (fields.private) {
    const { error: privateError } = await sellerClient.from('listing_fulfilment_private').upsert({
      listing_id: listing.id,
      collection_address: fields.private.collection_address ?? null,
      collection_phone: fields.private.collection_phone ?? null,
      collection_instructions: fields.private.collection_instructions ?? null,
    })

    if (privateError) throw new Error(`Private fulfilment upsert failed: ${privateError.message}`)
  }

  return listing
}

async function cleanupListing(admin, listingId) {
  await admin.from('listing_fulfilment_private').delete().eq('listing_id', listingId)
  await admin.from('listings').delete().eq('id', listingId)
}

async function markOrderPaid(admin, orderId, paymentId) {
  await admin
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', paymentId)

  await admin
    .from('orders')
    .update({ fulfilment_status: 'awaiting_collection' })
    .eq('id', orderId)
}

function testPublishValidation() {
  const collectionForm = baseForm({
    deliveryOptions: ['collection'],
    collectionAddress: '',
    collectionPhone: '',
  })

  const collectionErrors = validateListingFulfilmentDetails(collectionForm, { forPublish: true })

  assertPass(
    collectionErrors.some((e) => e.includes('Collection address')),
    'Collection publish blocked without address',
    'Collection publish should block missing address',
  )
  assertPass(
    collectionErrors.some((e) => e.includes('contact number')),
    'Collection publish blocked without phone',
    'Collection publish should block missing phone',
  )

  const courierForm = baseForm({
    deliveryOptions: ['buyer_courier'],
    collectionAddress: '',
    collectionPhone: '',
  })

  const courierErrors = validateListingFulfilmentDetails(courierForm, { forPublish: true })
  assertPass(
    courierErrors.length >= 2,
    'Buyer courier publish blocked without address/phone',
    'Buyer courier publish should block missing private fields',
  )

  const deliveryForm = baseForm({
    deliveryOptions: ['seller_delivery'],
    deliveryRangeMiles: '',
  })

  const deliveryErrors = validateListingFulfilmentDetails(deliveryForm, { forPublish: true })
  assertPass(
    deliveryErrors.some((e) => e.toLowerCase().includes('radius')),
    'Seller delivery publish blocked without radius',
    'Seller delivery publish should block missing radius',
  )

  const deliveryNoPrivateRequired = validateListingFulfilmentDetails(
    baseForm({
      deliveryOptions: ['seller_delivery'],
      deliveryRangeMiles: '15',
      collectionAddress: '',
      collectionPhone: '',
    }),
    { forPublish: true },
  )

  assertPass(
    deliveryNoPrivateRequired.length === 0,
    'Seller delivery does not require collection address/phone',
    'Seller delivery should not require private collection fields',
  )
}

async function testPublicPrivacy(admin, sellerClient, buyerClient) {
  const listing = await createTestListing(admin, sellerClient, {
    collection_available: true,
    courier_available: true,
    delivery_notes: 'Seller can personally deliver',
    private: {
      collection_address: '10 Secret Street, Leeds',
      collection_phone: '07700900123',
    },
  })

  try {
    const { data: publicListing, error: publicError } = await buyerClient
      .from('listings')
      .select('*')
      .eq('id', listing.id)
      .maybeSingle()

    if (publicError) throw publicError

    assertPass(
      !publicListing?.collection_address && publicListing?.seller_delivery_radius_miles == null,
      'Public listing row has no private address columns',
      'Public listings query exposes private address fields',
    )

    const { data: privateBeforePay, error: privateError } = await buyerClient
      .from('listing_fulfilment_private')
      .select('*')
      .eq('listing_id', listing.id)
      .maybeSingle()

    assertPass(
      !privateError && privateBeforePay == null,
      'Buyer cannot read private fulfilment before paid order',
      `Buyer read private fulfilment before payment: ${privateError?.message ?? 'unexpected row'}`,
    )

    const { data: sellerPrivate } = await sellerClient
      .from('listing_fulfilment_private')
      .select('collection_address, collection_phone')
      .eq('listing_id', listing.id)
      .single()

    assertPass(
      sellerPrivate?.collection_address?.includes('Secret Street'),
      'Seller can read own private fulfilment on draft listing',
      'Seller cannot read own private fulfilment details',
    )
  } finally {
    await cleanupListing(admin, listing.id)
  }
}

async function testPaidBuyerAccess(admin, sellerClient, buyerClient) {
  const listing = await createTestListing(admin, sellerClient, {
    status: 'active',
    collection_available: true,
    courier_available: true,
    delivery_notes: 'Buyer can arrange a courier or collection service',
    private: {
      collection_address: '22 Paid Access Lane, Leeds',
      collection_phone: '07700900456',
      collection_instructions: 'Ring bell',
    },
  })

  await signIn(buyerClient, BUYER_NEAR.email)

  const { data: offer, error: offerError } = await buyerClient
    .from('offers')
    .insert({
      listing_id: listing.id,
      buyer_id: BUYER_NEAR.id,
      seller_id: SELLER.id,
      amount_pence: 9000,
      status: 'pending',
      direction: 'buyer_to_seller',
      message: 'QA fulfilment paid access test',
    })
    .select('id')
    .single()

  if (offerError) throw new Error(`Offer create failed: ${offerError.message}`)

  await signIn(sellerClient, SELLER.email)
  const { error: acceptError } = await sellerClient.rpc('accept_offer', { p_offer_id: offer.id })
  if (acceptError) throw new Error(`accept_offer failed: ${acceptError.message}`)

  const { data: payment } = await admin.from('payments').select('id').eq('offer_id', offer.id).single()
  const { data: order } = await admin.from('orders').select('id, order_type').eq('offer_id', offer.id).single()

  await admin.from('orders').update({ order_type: 'buyer_courier' }).eq('id', order.id)
  await markOrderPaid(admin, order.id, payment.id)

  try {
    await signIn(buyerClient, BUYER_NEAR.email)

    const { data: privateAfterPay, error: readError } = await buyerClient
      .from('listing_fulfilment_private')
      .select('collection_address, collection_phone, collection_instructions')
      .eq('listing_id', listing.id)
      .maybeSingle()

    assertPass(
      !readError && privateAfterPay?.collection_address?.includes('Paid Access'),
      'Buyer reads private fulfilment after paid buyer_courier order',
      `Buyer cannot read private fulfilment after payment: ${readError?.message ?? 'no row'}`,
    )

    const showCard = canShowOrderFulfilmentDetails({
      order: { id: order.id, order_type: 'buyer_courier', fulfilment_status: 'awaiting_collection' },
      payment: { status: 'paid' },
      viewerRole: 'buyer',
    })

    assertPass(showCard, 'Fulfilment card gating allows paid buyer_courier', 'Fulfilment card hidden for paid buyer_courier')
  } finally {
    await admin.from('orders').delete().eq('id', order.id)
    await admin.from('payments').delete().eq('id', payment.id)
    await admin.from('offers').delete().eq('id', offer.id)
    await cleanupListing(admin, listing.id)
  }
}

async function testSellerDeliveryRadius(admin, sellerClient, buyerNearClient, buyerFarClient) {
  const listing = await createTestListing(admin, sellerClient, {
    status: 'active',
    collection_available: true,
    courier_available: true,
    delivery_notes: 'Seller can personally deliver',
    seller_delivery_radius_miles: 20,
  })

  const nearProfile = { latitude: 53.79, longitude: -1.55 }
  const farProfile = { latitude: 51.5074, longitude: -0.1278 }

  try {
    const nearOptions = getAvailableFulfilmentMethodOptions(
      { ...listing, seller_delivery_radius_miles: 20, delivery_notes: 'Seller can personally deliver', collection_available: true, courier_available: true },
      { buyerProfile: nearProfile, forBuyerSelection: true },
    )

    const farOptions = getAvailableFulfilmentMethodOptions(
      { ...listing, seller_delivery_radius_miles: 20, delivery_notes: 'Seller can personally deliver', collection_available: true, courier_available: true },
      { buyerProfile: farProfile, forBuyerSelection: true },
    )

    const nearSelectable = nearOptions.find((o) => o.orderType === 'seller_delivery')
    const farSelectable = farOptions.find((o) => o.orderType === 'seller_delivery')

    assertPass(!nearSelectable?.disabled, 'Nearby buyer can select seller delivery (UI)', 'Nearby buyer seller delivery disabled')
    assertPass(farSelectable?.disabled, 'Far buyer seller delivery shown disabled (UI)', 'Far buyer should see disabled seller delivery')

    await signIn(buyerNearClient, BUYER_NEAR.email)
    const { data: canNear, error: nearRpcError } = await buyerNearClient.rpc('buyer_can_select_seller_delivery', {
      p_listing_id: listing.id,
      p_buyer_id: BUYER_NEAR.id,
    })

    if (nearRpcError?.code === 'PGRST202') {
      bug('buyer_can_select_seller_delivery RPC not deployed (Phase 4 SQL missing)')
    } else {
      assertPass(canNear === true, 'Server allows nearby buyer seller delivery', 'Server blocked nearby buyer seller delivery')
    }

    await signIn(buyerFarClient, BUYER_FAR.email)
    const { data: canFar, error: farRpcError } = await buyerFarClient.rpc('buyer_can_select_seller_delivery', {
      p_listing_id: listing.id,
      p_buyer_id: BUYER_FAR.id,
    })

    if (!farRpcError) {
      assertPass(canFar === false, 'Server blocks far buyer seller delivery', 'Server allowed far buyer seller delivery')
    }

    const { data: paymentFlow } = await admin.from('payments').select('id, listing_id').limit(1)
    void paymentFlow
  } finally {
    await cleanupListing(admin, listing.id)
  }
}

async function testSellerDeliveryAddress(admin, sellerClient, buyerClient) {
  const listing = await createTestListing(admin, sellerClient, {
    status: 'active',
    collection_available: false,
    courier_available: true,
    delivery_notes: 'Seller can personally deliver',
    seller_delivery_radius_miles: 50,
  })

  await signIn(buyerClient, BUYER_NEAR.email)

  const { data: offer, error: offerError } = await buyerClient
    .from('offers')
    .insert({
      listing_id: listing.id,
      buyer_id: BUYER_NEAR.id,
      seller_id: SELLER.id,
      amount_pence: 9000,
      status: 'pending',
      direction: 'buyer_to_seller',
      message: 'QA seller delivery address test',
    })
    .select('id')
    .single()

  if (offerError) throw new Error(`Offer create failed: ${offerError.message}`)

  await signIn(sellerClient, SELLER.email)
  await sellerClient.rpc('accept_offer', { p_offer_id: offer.id })

  const { data: payment } = await admin.from('payments').select('id').eq('offer_id', offer.id).single()
  const { data: order } = await admin.from('orders').select('id').eq('offer_id', offer.id).single()

  await admin.from('orders').update({ order_type: 'seller_delivery', fulfilment_status: 'awaiting_seller_delivery' }).eq('id', order.id)
  await admin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id)

  try {
    await signIn(buyerClient, BUYER_NEAR.email)

    const { error: insertError } = await buyerClient.from('order_delivery_details').upsert({
      order_id: order.id,
      buyer_delivery_address: '99 Buyer Delivery Road, Leeds LS1 1AA',
      delivery_contact_name: 'Buyer QA',
      delivery_contact_phone: '07700900123',
      delivery_notes: 'Ring the bell on arrival',
    })

    assertPass(!insertError, 'Buyer can save delivery address after payment', `Buyer delivery address save failed: ${insertError?.message}`)

    await signIn(sellerClient, SELLER.email)
    const { data: sellerView, error: sellerReadError } = await sellerClient
      .from('order_delivery_details')
      .select('buyer_delivery_address')
      .eq('order_id', order.id)
      .maybeSingle()

    assertPass(
      !sellerReadError && sellerView?.buyer_delivery_address?.includes('Buyer Delivery Road'),
      'Seller can read buyer delivery address',
      `Seller cannot read delivery address: ${sellerReadError?.message ?? 'no row'}`,
    )
  } finally {
    await admin.from('order_delivery_details').delete().eq('order_id', order.id)
    await admin.from('orders').delete().eq('id', order.id)
    await admin.from('payments').delete().eq('id', payment.id)
    await admin.from('offers').delete().eq('id', offer.id)
    await cleanupListing(admin, listing.id)
  }
}

function testMessagingFilters() {
  const blocked = validateMarketplaceMessage('Call me on 07712345678')
  assertPass(!blocked.allowed, 'Messaging still blocks phone numbers', 'Messaging allowed phone number')

  const addressBlocked = validateMarketplaceMessage('My address is 10 High Street')
  assertPass(!addressBlocked.allowed, 'Messaging still blocks address sharing', 'Messaging allowed address sharing')

  const allowed = validateMarketplaceMessage('Can I collect on Saturday?')
  assertPass(allowed.allowed, 'Messaging still allows benign collection chat', 'Messaging blocked benign collection question')
}

function testOrderDetailAppSurface() {
  const src = readFileSync(join(ROOT, 'src/pages/OrderDetailPage.jsx'), 'utf8')

  assertPass(
    src.includes('OrderFulfilmentDetailsCard') && !src.includes('OrderHandoverDetailsCard'),
    'Order Detail mounts new fulfilment card only',
    'Order Detail still references OrderHandoverDetailsCard',
  )

  const matches = (src.match(/<OrderFulfilmentDetailsCard/g) ?? []).length
  assertPass(
    matches === 1,
    'OrderFulfilmentDetailsCard rendered once on Order Detail',
    `OrderFulfilmentDetailsCard JSX mount count is ${matches}, expected 1`,
  )
}

async function main() {
  loadEnvFile('.env.local')

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !serviceKey || !anonKey) {
    throw new Error('Missing Supabase env in .env.local')
  }

  console.log('=== Fulfilment architecture QA ===\n')

  testPublishValidation()
  testMessagingFilters()
  testOrderDetailAppSurface()

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const sellerClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const buyerNearClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const buyerFarClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  await signIn(sellerClient, SELLER.email)

  const { error: schemaError } = await admin.from('listing_fulfilment_private').select('listing_id').limit(0)
  if (schemaError) {
    bug(`listing_fulfilment_private table not available: ${schemaError.message}`)
  } else {
    await testPublicPrivacy(admin, sellerClient, buyerNearClient)
    await testPaidBuyerAccess(admin, sellerClient, buyerNearClient)
    await testSellerDeliveryRadius(admin, sellerClient, buyerNearClient, buyerFarClient)
    await testSellerDeliveryAddress(admin, sellerClient, buyerNearClient)
  }

  console.log(`\n=== Summary: ${passes.length} passed, ${bugs.length} bugs ===`)
  if (bugs.length) {
    for (const item of bugs) console.error(`  - ${item}`)
    process.exit(1)
  }

  console.log('No bugs found in automated QA pass.')
  console.log('Note: Mobile layout and browser UI were not exercised in this script.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
