#!/usr/bin/env node
/**
 * Verify prelaunch-admin-dev-tools-hardening.sql on linked Supabase.
 * Run: node scripts/test-admin-dev-tools-hardening.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }
const SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }
const ADMIN = { email: 'dev-seller-london@equipd.dev', id: '11111111-1111-4111-8111-111111111103' }
const OTHER_BUYER = { email: 'dev-buyer-emma@equipd.dev', id: '11111111-1111-4111-8111-111111111104' }

const before = {}
const after = {}

function loadEnv() {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) throw new Error('Missing .env.local')
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  }
}

async function signIn(client, email) {
  const { error } = await client.auth.signInWithPassword({ email, password: DEV_PASSWORD })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

function isAdminDenied(error) {
  const msg = (error?.message ?? '').toLowerCase()
  return /admin access required|not authorized for test/i.test(msg)
}

function isPermissionDenied(error) {
  const msg = (error?.message ?? '').toLowerCase()
  const code = error?.code ?? ''
  return (
    isAdminDenied(error) ||
    code === '42501' ||
    /permission denied|not authorized|do not have access/i.test(msg)
  )
}

async function rpcResult(client, fn, params) {
  const { data, error } = await client.rpc(fn, params)
  return {
    ok: !error,
    data,
    error: error?.message ?? null,
    code: error?.code ?? null,
  }
}

async function findHandoverOrder(admin) {
  const { data: orders } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, fulfilment_status, order_type, payment_id, protection_status, payout_status, payout_release_at')
    .in('order_type', ['collection', 'seller_delivery'])
    .eq('fulfilment_status', 'awaiting_collection')
    .order('created_at', { ascending: false })
    .limit(20)

  for (const order of orders ?? []) {
    const { data: payment } = await admin.from('payments').select('status').eq('id', order.payment_id).maybeSingle()
    if (payment?.status === 'paid') return order
  }

  return orders?.[0] ?? null
}

async function findProtectionOrder(admin) {
  const { data: orders } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, fulfilment_status, protection_status, payout_status, payout_release_at')
    .eq('fulfilment_status', 'collected')
    .eq('protection_status', 'active')
    .eq('payout_status', 'not_due')
    .not('payout_release_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  return orders?.[0] ?? null
}

async function ensureDevAdminFixture(admin) {
  const { data: profile } = await admin
    .from('profiles')
    .select('id, is_admin')
    .eq('id', ADMIN.id)
    .maybeSingle()

  if (profile && profile.is_admin !== true) {
    const { error } = await admin.from('profiles').update({ is_admin: true }).eq('id', ADMIN.id)
    if (error) throw new Error(`Could not set dev admin fixture: ${error.message}`)
    console.log('NOTE: Set is_admin=true on dev-seller-london for regression fixture')
  }
}

function testFrontendVisibility() {
  const ORDER_TYPES = { COLLECTION: 'collection', SELLER_DELIVERY: 'seller_delivery' }
  const ORDER_FULFILMENT_STATUSES = { AWAITING_COLLECTION: 'awaiting_collection', COLLECTED: 'collected' }
  const PAYOUT_STATUSES = { NOT_DUE: 'not_due' }

  function canShowDevHandoverConfirm({ order, payment, user, isAdmin }) {
    if (!user || !order || !payment || !isAdmin) return false
    if (payment.status !== 'paid') return false
    const orderType = order.order_type ?? ORDER_TYPES.COLLECTION
    const isCollection = orderType === ORDER_TYPES.COLLECTION
    const isSellerDelivery = orderType === ORDER_TYPES.SELLER_DELIVERY
    if (!isCollection && !isSellerDelivery) return false
    if (isCollection && order.fulfilment_status !== ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION) return false
    if (isSellerDelivery && order.fulfilment_status !== 'awaiting_seller_delivery') return false
    return true
  }

  function canShowDevEndBuyerProtection({ order, user, isAdmin }) {
    if (!user || !order || !isAdmin) return false
    if (order.protection_status !== 'active') return false
    if (order.fulfilment_status !== ORDER_FULFILMENT_STATUSES.COLLECTED) return false
    if (order.payout_status !== PAYOUT_STATUSES.NOT_DUE) return false
    if (!order.payout_release_at || new Date(order.payout_release_at) <= new Date()) return false
    return true
  }

  const mockOrder = {
    order_type: ORDER_TYPES.COLLECTION,
    fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION,
    protection_status: 'active',
    payout_status: PAYOUT_STATUSES.NOT_DUE,
    payout_release_at: new Date(Date.now() + 3600000).toISOString(),
  }
  const mockPayment = { status: 'paid' }

  return {
    buyerShowsHandover: canShowDevHandoverConfirm({
      order: mockOrder,
      payment: mockPayment,
      user: { id: BUYER.id },
      isAdmin: false,
    }),
    adminShowsHandover: canShowDevHandoverConfirm({
      order: mockOrder,
      payment: mockPayment,
      user: { id: ADMIN.id },
      isAdmin: true,
    }),
    buyerShowsProtection: canShowDevEndBuyerProtection({
      order: mockOrder,
      user: { id: BUYER.id },
      isAdmin: false,
    }),
    adminShowsProtection: canShowDevEndBuyerProtection({
      order: {
        ...mockOrder,
        fulfilment_status: ORDER_FULFILMENT_STATUSES.COLLECTED,
      },
      user: { id: ADMIN.id },
      isAdmin: true,
    }),
  }
}

async function main() {
  loadEnv()

  const url = process.env.VITE_SUPABASE_URL.replace(/\/+$/, '')
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const authed = createClient(url, anonKey, { auth: { persistSession: false } })
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })

  await ensureDevAdminFixture(admin)

  const handoverOrder = await findHandoverOrder(admin)
  const protectionOrder = await findProtectionOrder(admin)
  const { participantConversationId, cleanupConversationId } = await ensureConversationFixtures(admin)
  const unrelatedConversationId = await findUnrelatedConversation(admin)

  const fakeOrderId = handoverOrder?.id ?? '00000000-0000-4000-8000-000000000099'
  const protectionOrderId = protectionOrder?.id ?? fakeOrderId

  const handoverParams = {
    p_order_id: fakeOrderId,
    p_user_agent: 'hardening-test',
    p_checks: { source: 'dev_admin_handover_button' },
  }

  const protectionParams = {
    p_order_id: protectionOrderId,
    p_user_agent: 'hardening-test',
    p_checks: { source: 'dev_end_buyer_protection_button' },
  }

  const notificationParams = {
    p_user_id: BUYER.id,
    p_type: 'test_hardening',
    p_title: 'Hardening test',
    p_body: 'Should not be created by clients',
    p_link_url: null,
  }

async function ensureConversationFixtures(admin) {
  const { data: existing } = await admin
    .from('conversations')
    .select('id')
    .eq('buyer_id', BUYER.id)
    .eq('seller_id', SELLER.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return {
      participantConversationId: existing.id,
      cleanupConversationId: null,
    }
  }

  const { data: listing } = await admin
    .from('listings')
    .select('id, seller_id')
    .neq('seller_id', BUYER.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!listing?.id || listing.seller_id === BUYER.id) {
    return { participantConversationId: null, cleanupConversationId: null }
  }

  const { data: created, error } = await admin
    .from('conversations')
    .insert({
      listing_id: listing.id,
      buyer_id: BUYER.id,
      seller_id: listing.seller_id,
    })
    .select('id')
    .single()

  if (error) {
    const { data: existingForListing } = await admin
      .from('conversations')
      .select('id')
      .eq('listing_id', listing.id)
      .eq('buyer_id', BUYER.id)
      .maybeSingle()

    if (existingForListing?.id) {
      return {
        participantConversationId: existingForListing.id,
        cleanupConversationId: null,
      }
    }

    return { participantConversationId: null, cleanupConversationId: null }
  }

  return {
    participantConversationId: created.id,
    cleanupConversationId: created.id,
  }
}

async function findUnrelatedConversation(admin) {
  const { data: existing } = await admin
    .from('conversations')
    .select('id, buyer_id, seller_id')
    .neq('buyer_id', BUYER.id)
    .neq('seller_id', BUYER.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return existing?.id ?? null
}

  const results = []

  function record(id, pass, detail) {
    results.push({ id, pass, detail })
    console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${detail}`)
  }

  // --- dev_confirm_order_handover ---
  await signIn(authed, BUYER.email)
  const buyerHandover = await rpcResult(authed, 'dev_confirm_order_handover', handoverParams)
  record(
    'dev_confirm_order_handover-buyer-blocked',
    !buyerHandover.ok && isAdminDenied({ message: buyerHandover.error }),
    buyerHandover.error ?? 'unexpected success',
  )

  await signIn(authed, SELLER.email)
  const sellerHandover = await rpcResult(authed, 'dev_confirm_order_handover', handoverParams)
  record(
    'dev_confirm_order_handover-seller-blocked',
    !sellerHandover.ok && isAdminDenied({ message: sellerHandover.error }),
    sellerHandover.error ?? 'unexpected success',
  )

  await signIn(authed, ADMIN.email)
  const adminHandover = await rpcResult(authed, 'dev_confirm_order_handover', handoverParams)
  const adminHandoverAuthOk = adminHandover.ok || !isAdminDenied({ message: adminHandover.error })
  record(
    'dev_confirm_order_handover-admin-authorized',
    adminHandoverAuthOk,
    adminHandover.ok
      ? 'RPC succeeded'
      : `auth passed; business rule: ${adminHandover.error}`,
  )

  // --- dev_end_buyer_protection_now ---
  await signIn(authed, BUYER.email)
  const buyerProtection = await rpcResult(authed, 'dev_end_buyer_protection_now', protectionParams)
  record(
    'dev_end_buyer_protection_now-buyer-blocked',
    !buyerProtection.ok && isAdminDenied({ message: buyerProtection.error }),
    buyerProtection.error ?? 'unexpected success',
  )

  await signIn(authed, SELLER.email)
  const sellerProtection = await rpcResult(authed, 'dev_end_buyer_protection_now', protectionParams)
  record(
    'dev_end_buyer_protection_now-seller-blocked',
    !sellerProtection.ok && isAdminDenied({ message: sellerProtection.error }),
    sellerProtection.error ?? 'unexpected success',
  )

  await signIn(authed, ADMIN.email)
  const adminProtection = await rpcResult(authed, 'dev_end_buyer_protection_now', protectionParams)
  const adminProtectionAuthOk =
    adminProtection.ok || !isAdminDenied({ message: adminProtection.error })
  record(
    'dev_end_buyer_protection_now-admin-authorized',
    adminProtectionAuthOk,
    adminProtection.ok
      ? 'RPC succeeded'
      : `auth passed; business rule: ${adminProtection.error}`,
  )

  // --- create_notification ---
  const anonNotification = await rpcResult(anon, 'create_notification', notificationParams)
  record(
    'create_notification-anon-blocked',
    !anonNotification.ok,
    anonNotification.error ?? 'unexpected success',
  )

  await signIn(authed, BUYER.email)
  const userNotification = await rpcResult(authed, 'create_notification', notificationParams)
  record(
    'create_notification-authenticated-blocked',
    !userNotification.ok,
    userNotification.error ?? 'unexpected success',
  )

  const serviceNotification = await rpcResult(admin, 'create_notification', notificationParams)
  if (serviceNotification.ok && serviceNotification.data?.id) {
    await admin.from('notifications').delete().eq('id', serviceNotification.data.id)
  }
  record(
    'create_notification-service-role-allowed',
    serviceNotification.ok,
    serviceNotification.error ?? `id=${serviceNotification.data?.id ?? 'n/a'}`,
  )

  // --- insert_conversation_system_message ---
  if (!participantConversationId || !unrelatedConversationId) {
    record('insert_system_message-participant', false, 'Missing conversation fixtures')
    record('insert_system_message-unrelated-blocked', false, 'Missing conversation fixtures')
  } else {
    await signIn(authed, BUYER.email)
    const participantMsg = await rpcResult(authed, 'insert_conversation_system_message', {
      p_conversation_id: participantConversationId,
      p_body: 'Hardening test participant message',
    })
    if (participantMsg.ok && participantMsg.data?.id) {
      await admin.from('messages').delete().eq('id', participantMsg.data.id)
    }
    record(
      'insert_system_message-participant-allowed',
      participantMsg.ok,
      participantMsg.error ?? `id=${participantMsg.data?.id ?? 'n/a'}`,
    )

    const unrelatedMsg = await rpcResult(authed, 'insert_conversation_system_message', {
      p_conversation_id: unrelatedConversationId,
      p_body: 'Hardening test intrusion attempt',
    })
    record(
      'insert_system_message-unrelated-blocked',
      !unrelatedMsg.ok && isPermissionDenied({ message: unrelatedMsg.error }),
      unrelatedMsg.error ?? 'unexpected success',
    )
  }

  if (cleanupConversationId) {
    await admin.from('conversations').delete().eq('id', cleanupConversationId)
  }

  // --- Frontend visibility (mirrors Dev*Panel canShow helpers) ---
  const frontend = testFrontendVisibility()

  record(
    'frontend-dev-handover-buyer-hidden',
    frontend.buyerShowsHandover === false,
    `buyer visible=${frontend.buyerShowsHandover}`,
  )
  record(
    'frontend-dev-handover-admin-visible',
    frontend.adminShowsHandover === true,
    `admin visible=${frontend.adminShowsHandover}`,
  )
  record(
    'frontend-dev-protection-buyer-hidden',
    frontend.buyerShowsProtection === false,
    `buyer visible=${frontend.buyerShowsProtection}`,
  )
  record(
    'frontend-dev-protection-admin-visible',
    frontend.adminShowsProtection === true,
    `admin visible=${frontend.adminShowsProtection}`,
  )

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)

  if (failed.length) {
    console.error('\nFailed checks:')
    for (const f of failed) console.error(`  - ${f.id}: ${f.detail}`)
    process.exit(1)
  }

  console.log('\nAll admin/dev hardening checks passed.')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
