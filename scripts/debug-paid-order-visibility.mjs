#!/usr/bin/env node
/**
 * Inspect payment/order/listing state and Hub visibility flags after checkout.
 *
 * Usage:
 *   node scripts/debug-paid-order-visibility.mjs --offer-id <uuid>
 *   node scripts/debug-paid-order-visibility.mjs --payment-id <uuid>
 *   node scripts/debug-paid-order-visibility.mjs --order-id <uuid>
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

function readArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

async function main() {
  loadEnvFile('.env.local')

  const offerId = readArg('--offer-id')
  const paymentId = readArg('--payment-id')
  const orderId = readArg('--order-id')

  if (!offerId && !paymentId && !orderId) {
    throw new Error('Provide one of --offer-id, --payment-id, or --order-id')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let resolvedOfferId = offerId
  let resolvedPaymentId = paymentId
  let resolvedOrderId = orderId

  let payment = null
  let order = null
  let offer = null
  let listing = null

  if (resolvedOrderId) {
    const { data, error } = await admin.from('orders').select('*').eq('id', resolvedOrderId).maybeSingle()
    if (error || !data) throw new Error(`Order lookup failed: ${error?.message ?? 'not found'}`)
    order = data
    resolvedOfferId ??= order.offer_id
    resolvedPaymentId ??= order.payment_id
  }

  if (resolvedPaymentId) {
    const { data, error } = await admin
      .from('payments')
      .select('*')
      .eq('id', resolvedPaymentId)
      .maybeSingle()
    if (error || !data) throw new Error(`Payment lookup failed: ${error?.message ?? 'not found'}`)
    payment = data
    resolvedOfferId ??= payment.offer_id
  }

  if (resolvedOfferId) {
    const { data, error } = await admin.from('offers').select('*').eq('id', resolvedOfferId).maybeSingle()
    if (error || !data) throw new Error(`Offer lookup failed: ${error?.message ?? 'not found'}`)
    offer = data
  }

  if (!payment) {
    const { data, error } = await admin
      .from('payments')
      .select('*')
      .eq('offer_id', resolvedOfferId)
      .maybeSingle()

    if (error || !data) throw new Error(`Payment lookup failed: ${error?.message ?? 'not found'}`)
    payment = data
  }

  if (!order) {
    const { data, error } = await admin
      .from('orders')
      .select('*')
      .eq('offer_id', payment.offer_id)
      .maybeSingle()

    if (error || !data) throw new Error(`Order lookup failed: ${error?.message ?? 'not found'}`)
    order = data
  }

  if (!offer) {
    const { data, error } = await admin.from('offers').select('*').eq('id', payment.offer_id).maybeSingle()
    if (error || !data) throw new Error(`Offer lookup failed: ${error?.message ?? 'not found'}`)
    offer = data
  }

  const { data: listingRow, error: listingError } = await admin
    .from('listings')
    .select('id, title, status, seller_id')
    .eq('id', order.listing_id)
    .single()

  if (listingError || !listingRow) {
    throw new Error(`Listing lookup failed: ${listingError?.message ?? 'not found'}`)
  }

  listing = listingRow

  const { count: activeBrowseCount, error: browseError } = await admin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('id', listing.id)
    .eq('status', 'active')

  if (browseError) {
    throw new Error(`Browse visibility query failed: ${browseError.message}`)
  }

  console.log('\n=== Payment ===')
  console.log(JSON.stringify(payment, null, 2))

  console.log('\n=== Order ===')
  console.log(JSON.stringify(order, null, 2))

  console.log('\n=== Offer ===')
  console.log(JSON.stringify(offer, null, 2))

  console.log('\n=== Listing ===')
  console.log(JSON.stringify(listing, null, 2))

  console.log('\n=== Hub visibility flags ===')
  console.log({
    paymentComplete: isPaymentComplete(payment),
    buyerHubPurchase: isBuyerHubPurchase(order, payment),
    sellerHubSaleInProgress: isSellerHubSaleInProgress(order, payment),
    paidHubOrder: isPaidHubOrder(order, payment),
    awaitingFulfilment: isOrderAwaitingFulfilment(order, payment),
    canBuyerConfirm: canBuyerConfirmOrder(order, payment),
    listingHubManageable: isHubManageableListing(listing),
    listingInProgressSale: isHubInProgressSaleListing(listing),
    visibleInActiveBrowse: activeBrowseCount === 1,
  })

  console.log('\n=== Diagnosis ===')
  if (!order) {
    console.log('Case A: order row missing — check webhook / mark_payment_captured.')
  } else if (!isPaymentComplete(payment)) {
    console.log('Payment not marked paid — webhook may not have fired yet.')
  } else if (!isBuyerHubPurchase(order, payment)) {
    console.log('Order exists and payment paid, but fulfilment_status not in Hub paid set.')
  } else if (!isOrderAwaitingFulfilment(order, payment) && !canBuyerConfirmOrder(order, payment)) {
    console.log('Paid order should appear in buyer In progress or Confirmed Hub sections.')
  } else {
    console.log('Paid order should appear in buyer Orders and seller Active sales Hub sections.')
  }

  if (isHubManageableListing(listing)) {
    console.log('Listing still treated as manageable in Hub/My listings — expected only for draft/active/archived.')
  }

  if (activeBrowseCount === 1) {
    console.log('Listing still visible in active browse results.')
  } else {
    console.log('Listing correctly excluded from active browse.')
  }
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
