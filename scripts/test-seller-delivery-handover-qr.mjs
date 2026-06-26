#!/usr/bin/env node
/**
 * Seller delivery in-person handover via collection QR infrastructure.
 *
 * Usage:
 *   node scripts/test-seller-delivery-handover-qr.mjs
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

function buildChecks() {
  return {
    item_collected: true,
    item_inspected: true,
    item_matches_listing: true,
  }
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

  logStep('Locate paid awaiting_seller_delivery order')
  const { data: candidateOrders, error: candidateError } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, fulfilment_status, order_type, payment_id')
    .eq('fulfilment_status', 'awaiting_seller_delivery')
    .eq('order_type', 'seller_delivery')
    .order('created_at', { ascending: false })
    .limit(10)

  if (candidateError) {
    throw new Error(`Order lookup failed: ${candidateError.message}`)
  }

  let order = null

  for (const candidate of candidateOrders ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status === 'paid') {
      order = candidate
      break
    }
  }

  if (!order) {
    throw new Error(
      'No paid awaiting_seller_delivery order found. Create a seller delivery order in dev first.',
    )
  }

  logPass(`Using order ${order.id}`)

  logStep('Seller cannot start protection via confirm_seller_delivery')
  await signIn(authed, SELLER.email)

  const { error: sellerDeliveryError } = await authed.rpc('confirm_seller_delivery', {
    p_order_id: order.id,
  })

  assert(sellerDeliveryError, 'confirm_seller_delivery should be disabled')
  logPass(`Seller-triggered delivery blocked: ${sellerDeliveryError.message}`)

  logStep('Seller generates handover QR token')
  const { data: tokenData, error: tokenError } = await authed.rpc('generate_collection_qr_token', {
    p_order_id: order.id,
  })

  if (tokenError) {
    throw new Error(`generate_collection_qr_token failed: ${tokenError.message}`)
  }

  assert(tokenData?.token, 'Token missing from generate_collection_qr_token response')
  assert(tokenData?.order_type === 'seller_delivery', 'Expected seller_delivery order_type in token response')
  logPass(`Handover token generated, expires ${tokenData.expires_at}`)

  logStep('Buyer preview is ready')
  await signIn(authed, BUYER.email)

  const { data: preview, error: previewError } = await authed.rpc('get_collection_qr_preview', {
    p_token: tokenData.token,
  })

  if (previewError) {
    throw new Error(`get_collection_qr_preview failed: ${previewError.message}`)
  }

  assert(preview?.status === 'ready', `Expected ready preview, got ${preview?.status}`)
  assert(preview?.order_type === 'seller_delivery', 'Expected seller_delivery in preview')
  logPass('Buyer preview ready for seller delivery handover')

  logStep('Buyer confirms handover via QR')
  const beforeConfirm = Date.now()

  const { data: confirmedOrder, error: confirmError } = await authed.rpc('confirm_collection_by_qr', {
    p_token: tokenData.token,
    p_checks: buildChecks(),
    p_user_agent: 'seller-delivery-handover-test',
  })

  if (confirmError) {
    throw new Error(`confirm_collection_by_qr failed: ${confirmError.message}`)
  }

  assert(confirmedOrder.fulfilment_status === 'collected', 'Expected collected status after handover')
  assert(confirmedOrder.collected_at, 'Expected collected_at')
  assert(confirmedOrder.collection_confirmed_by === BUYER.id, 'Expected buyer as confirmer')
  assert(confirmedOrder.payout_release_at, 'Expected payout_release_at')

  const releaseAtMs = new Date(confirmedOrder.payout_release_at).getTime()
  const hoursUntilRelease = (releaseAtMs - beforeConfirm) / (1000 * 60 * 60)
  assert(hoursUntilRelease > 23 && hoursUntilRelease < 25, `Expected ~24h hold, got ${hoursUntilRelease.toFixed(2)}h`)

  logPass('Buyer confirmed seller delivery handover with 24-hour payout hold')

  console.log('\nAll seller delivery handover QR checks passed.')
  console.log(`Order: ${order.id}`)
  console.log(`Token path: /orders/collect/${tokenData.token}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
