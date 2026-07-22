#!/usr/bin/env node
/**
 * Production-deployed Stage 1.1 smoke test.
 *
 * Creates one isolated quantity-2 fixture, sends real Stripe test-mode
 * checkout.session.completed events to the configured production webhook,
 * verifies normal/duplicate/late/duplicate-late behavior, then archives the
 * listing and resolves the deliberately-created test exception.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !serviceKey || !anonKey) throw new Error('Missing Supabase environment')

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anonymous = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function stripeTestKey() {
  const raw = readFileSync(join(homedir(), '.config', 'stripe', 'config.toml'), 'utf8')
  const match = raw.match(/test_mode_api_key\s*=\s*'([^']+)'/)
  if (!match?.[1]?.startsWith('sk_test_')) throw new Error('Stripe test key unavailable')
  return match[1]
}

const stripeKey = stripeTestKey()
const endpointId = 'we_1TnopECzQs0ntJKPbBwXAlnr'
const runTag = `stage11-deploy-${Date.now()}`
const password = `Equipd-${crypto.randomUUID()}-Aa1!`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stripeGet(path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  })
  const json = await response.json()
  if (!response.ok) throw new Error(json?.error?.message || `Stripe ${response.status}`)
  return json
}

function stripeCli(args) {
  const result = spawnSync('stripe', args, {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `stripe exited ${result.status}`)
  }
  return `${result.stdout}\n${result.stderr}`.trim()
}

async function findEvent(paymentId, afterUnix) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const events = await stripeGet(
      `/events?type=checkout.session.completed&limit=25&created[gte]=${afterUnix}`,
    )
    const event = events.data.find(
      (row) => row.data?.object?.metadata?.payment_id === paymentId,
    )
    if (event) return event
    await sleep(1000)
  }
  throw new Error(`Stripe event not found for payment ${paymentId}`)
}

async function waitFor(description, check) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const value = await check()
    if (value) return value
    await sleep(1000)
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function assertFixtureNonPublic(listingId, slug, phase) {
  const { data: internal, error: internalError } = await admin
    .from('listings')
    .select('id, slug, title, status, published_at, is_test_data')
    .eq('id', listingId)
    .single()
  if (internalError) throw internalError

  assert(internal.is_test_data === true, `${phase}: fixture lost is_test_data marker`)
  assert(
    internal.status === 'draft' || internal.status === 'archived',
    `${phase}: fixture status became ${internal.status}`,
  )
  assert(internal.published_at === null, `${phase}: fixture acquired published_at`)

  const [
    { data: direct, error: directError },
    { data: browseById, error: browseIdError },
    { data: browseSearch, error: browseSearchError },
    sitemapResponse,
  ] = await Promise.all([
    anonymous.from('listings').select('id').eq('id', listingId),
    anonymous.from('listings_public_browse').select('id').eq('id', listingId),
    anonymous
      .from('listings_public_browse')
      .select('id')
      .or(`id.eq.${listingId},slug.eq.${slug}`),
    fetch('https://www.equipd.co.uk/sitemap.xml', { cache: 'no-store' }),
  ])

  if (directError) throw directError
  if (browseIdError) throw browseIdError
  if (browseSearchError) throw browseSearchError
  if (!sitemapResponse.ok) {
    throw new Error(`${phase}: sitemap returned ${sitemapResponse.status}`)
  }
  const sitemap = await sitemapResponse.text()

  assert(direct.length === 0, `${phase}: anonymous RLS returned fixture`)
  assert(browseById.length === 0, `${phase}: browse returned fixture by id`)
  assert(browseSearch.length === 0, `${phase}: browse/search returned fixture`)
  assert(!sitemap.includes(listingId), `${phase}: sitemap contains fixture id`)
  assert(!sitemap.includes(slug), `${phase}: sitemap contains fixture slug`)
}

async function triggerPaidCheckout(paymentId) {
  const afterUnix = Math.floor(Date.now() / 1000) - 2
  const output = stripeCli([
    'trigger',
    'checkout.session.completed',
    '--override',
    `checkout_session:metadata.payment_id=${paymentId}`,
  ])
  const event = await findEvent(paymentId, afterUnix)
  return { output, event }
}

async function resend(eventId) {
  return stripeCli([
    'events',
    'resend',
    eventId,
    '--webhook-endpoint',
    endpointId,
  ])
}

async function main() {
  // Controlled configuration remediation must happen before this explicit gate
  // is enabled. It prevents any production fixture creation while the Stripe
  // endpoint signing secret is known to be mismatched.
  if (process.env.EQUIPD_PRODUCTION_STRIPE_WEBHOOK_CONFIG_VERIFIED !== 'yes') {
    throw new Error(
      'Refusing to create production fixtures: set '
      + 'EQUIPD_PRODUCTION_STRIPE_WEBHOOK_CONFIG_VERIFIED=yes only after '
      + 'the Stripe signing-secret mismatch is resolved and verified.',
    )
  }

  const created = {
    sellerId: null,
    buyerId: null,
    listingId: null,
    lateExceptionId: null,
  }

  const { data: category, error: categoryError } = await admin
    .from('categories')
    .select('id')
    .order('sort_order')
    .limit(1)
    .single()
  if (categoryError) throw categoryError

  const sellerEmail = `${runTag}-seller@example.invalid`
  const buyerEmail = `${runTag}-buyer@example.invalid`

  const { data: sellerUser, error: sellerError } = await admin.auth.admin.createUser({
    email: sellerEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Stage 1.1 Deploy Seller' },
  })
  if (sellerError) throw sellerError
  created.sellerId = sellerUser.user.id

  const { data: buyerUser, error: buyerError } = await admin.auth.admin.createUser({
    email: buyerEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Stage 1.1 Deploy Buyer' },
  })
  if (buyerError) throw buyerError
  created.buyerId = buyerUser.user.id

  const { error: sellerProfileError } = await admin
    .from('profiles')
    .update({
      display_name: 'Stage 1.1 Deploy Seller',
      stripe_onboarding_complete: true,
    })
    .eq('id', created.sellerId)
  if (sellerProfileError) throw sellerProfileError

  const { error: buyerProfileError } = await admin
    .from('profiles')
    .update({ display_name: 'Stage 1.1 Deploy Buyer' })
    .eq('id', created.buyerId)
  if (buyerProfileError) throw buyerProfileError

  const { data: listing, error: listingError } = await admin
    .from('listings')
    .insert({
      seller_id: created.sellerId,
      category_id: category.id,
      slug: runTag,
      title: 'Stage 1.1 deployed webhook smoke fixture',
      description: 'Temporary production verification fixture; archived after test.',
      price_pence: 2000,
      condition: 'good',
      status: 'draft',
      published_at: null,
      is_test_data: true,
      source: 'manual',
      collection_available: true,
      courier_available: false,
      quantity_total: 2,
      quantity_available: 2,
      quantity_reserved: 0,
      quantity_sold: 0,
    })
    .select('id, quantity_total, quantity_available')
    .single()
  if (listingError) throw listingError
  created.listingId = listing.id
  assert(listing.quantity_total === 2 && listing.quantity_available === 2,
    `service-role fixture quantity was not preserved: ${JSON.stringify(listing)}`)

  await assertFixtureNonPublic(listing.id, listing.slug ?? runTag, 'after fixture insert')

  // Service-role-only helper creates accepted offer/payment/order records and
  // reserves inventory without ever requiring an active listing.
  const fixtures = []
  for (let index = 0; index < 2; index += 1) {
    const { data: fixture, error: fixtureError } = await admin.rpc(
      'create_test_fixture_payment_and_order',
      {
        p_listing_id: listing.id,
        p_buyer_id: created.buyerId,
        p_quantity: 1,
        p_total_offer_amount_pence: 2000,
      },
    )
    if (fixtureError) throw fixtureError
    fixtures.push(fixture)
    await assertFixtureNonPublic(
      listing.id,
      listing.slug ?? runTag,
      `after commerce fixture ${index + 1}`,
    )
  }

  const paymentIds = fixtures.map((row) => row.payment_id)
  const { data: payments, error: paymentsError } = await admin
    .from('payments')
    .select('id, offer_id, status')
    .in('id', paymentIds)
    .order('created_at')
  if (paymentsError) throw paymentsError
  assert(payments.length === 2, `expected 2 payments, got ${payments.length}`)

  const normalPayment = payments.find((row) => row.id === fixtures[0].payment_id)
  const latePayment = payments.find((row) => row.id === fixtures[1].payment_id)

  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .update({ order_type: 'collection' })
    .in('payment_id', paymentIds)
    .select('id, payment_id')
  if (ordersError) throw ordersError
  const normalOrder = orders.find((row) => row.payment_id === normalPayment.id)
  const lateOrder = orders.find((row) => row.payment_id === latePayment.id)

  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after order setup',
  )

  const { error: expiryUpdateError } = await admin
    .from('payments')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', latePayment.id)
  if (expiryUpdateError) throw expiryUpdateError

  const { error: expireError } = await admin.rpc('expire_payment', {
    p_payment_id: latePayment.id,
  })
  if (expireError) throw expireError

  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after reservation release',
  )

  // Normal on-time capture.
  const normalTrigger = await triggerPaidCheckout(normalPayment.id)
  const normalState = await waitFor('normal payment capture', async () => {
    const [{ data: payment }, { data: order }, { data: currentListing }] = await Promise.all([
      admin.from('payments').select('status').eq('id', normalPayment.id).single(),
      admin.from('orders').select('inventory_state, fulfilment_status, payout_status').eq('id', normalOrder.id).single(),
      admin.from('listings').select('quantity_available, quantity_reserved, quantity_sold').eq('id', listing.id).single(),
    ])
    if (payment?.status !== 'paid') return null
    return { payment, order, listing: currentListing }
  })

  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after normal webhook',
  )

  assert(normalState.order.inventory_state === 'sold', 'normal order inventory not sold')
  assert(normalState.order.fulfilment_status !== 'awaiting_payment',
    'normal order did not progress fulfilment')

  const normalBeforeReplay = JSON.stringify(normalState)
  const normalResendOutput = await resend(normalTrigger.event.id)
  await sleep(3000)
  const [{ data: normalAfterPayment }, { data: normalAfterOrder }, { data: normalAfterListing }] =
    await Promise.all([
      admin.from('payments').select('status').eq('id', normalPayment.id).single(),
      admin.from('orders').select('inventory_state, fulfilment_status, payout_status').eq('id', normalOrder.id).single(),
      admin.from('listings').select('quantity_available, quantity_reserved, quantity_sold').eq('id', listing.id).single(),
    ])
  const normalAfterReplay = JSON.stringify({
    payment: normalAfterPayment,
    order: normalAfterOrder,
    listing: normalAfterListing,
  })
  assert(normalAfterReplay === normalBeforeReplay, 'duplicate normal webhook changed state')
  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after duplicate normal webhook',
  )

  // Late payment after release.
  const lateInventoryBefore = await admin
    .from('listings')
    .select('quantity_available, quantity_reserved, quantity_sold, inventory_version')
    .eq('id', listing.id)
    .single()
  const lateTrigger = await triggerPaidCheckout(latePayment.id)

  const lateException = await waitFor('late-payment exception', async () => {
    const { data } = await admin
      .from('commerce_exceptions')
      .select('*')
      .eq('payment_id', latePayment.id)
      .eq('exception_type', 'late_payment_after_release')
      .maybeSingle()
    return data
  })
  created.lateExceptionId = lateException.id

  const [{ data: lateAfterListing }, { data: lateAfterOrder }, { data: lateAfterPayment }] =
    await Promise.all([
      admin.from('listings').select('quantity_available, quantity_reserved, quantity_sold, inventory_version').eq('id', listing.id).single(),
      admin.from('orders').select('inventory_state, fulfilment_status, payout_status').eq('id', lateOrder.id).single(),
      admin.from('payments').select('status').eq('id', latePayment.id).single(),
    ])

  assert(
    JSON.stringify(lateAfterListing) === JSON.stringify(lateInventoryBefore.data),
    'late webhook mutated listing inventory',
  )
  assert(lateAfterOrder.inventory_state === 'released', 'late order inventory changed')
  assert(lateAfterOrder.fulfilment_status === 'cancelled', 'late order fulfilment changed')
  assert(lateAfterOrder.payout_status === 'cancelled', 'late order payout changed')
  assert(lateAfterPayment.status === 'expired', 'late payment status changed')
  assert(lateException.status === 'open', 'late exception is not open')
  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after late webhook',
  )

  const { count: lateEmailCount, error: emailCountError } = await admin
    .from('transactional_email_log')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', lateOrder.id)
    .in('event_key', ['payment_successful', 'new_order_received'])
  if (emailCountError) throw emailCountError
  assert(lateEmailCount === 0, `late webhook created ${lateEmailCount} payment emails`)

  const lateResendOutput = await resend(lateTrigger.event.id)
  await sleep(3000)
  const { count: lateExceptionCount, error: exceptionCountError } = await admin
    .from('commerce_exceptions')
    .select('id', { count: 'exact', head: true })
    .eq('payment_id', latePayment.id)
    .eq('exception_type', 'late_payment_after_release')
  if (exceptionCountError) throw exceptionCountError
  assert(lateExceptionCount === 1, `duplicate late webhook produced ${lateExceptionCount} exceptions`)
  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after duplicate late webhook',
  )

  const [normalEventFinal, lateEventFinal] = await Promise.all([
    stripeGet(`/events/${normalTrigger.event.id}`),
    stripeGet(`/events/${lateTrigger.event.id}`),
  ])
  assert(normalEventFinal.pending_webhooks === 0,
    `normal event still has ${normalEventFinal.pending_webhooks} pending webhooks`)
  assert(lateEventFinal.pending_webhooks === 0,
    `late event still has ${lateEventFinal.pending_webhooks} pending webhooks`)

  // Cleanup changes draft -> archived, but visibility safety never depends on
  // this: is_test_data has excluded the fixture since insertion.
  const { error: archiveError } = await admin
    .from('listings')
    .update({ status: 'archived' })
    .eq('id', listing.id)
  if (archiveError) throw archiveError

  const { error: resolveError } = await admin
    .from('commerce_exceptions')
    .update({
      status: 'resolved',
      resolution_notes: 'Resolved: Stage 1.1 production deployment smoke fixture.',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', lateException.id)
  if (resolveError) throw resolveError

  await assertFixtureNonPublic(
    listing.id,
    listing.slug ?? runTag,
    'after cleanup',
  )

  const { data: normalEmailLogs } = await admin
    .from('transactional_email_log')
    .select('event_key, status')
    .eq('order_id', normalOrder.id)
    .in('event_key', ['payment_successful', 'new_order_received'])

  const report = {
    passed: true,
    run_tag: runTag,
    fixture: {
      listing_id: listing.id,
      final_status: 'archived',
      is_test_data: true,
      public_visibility_assertions: [
        'after fixture insert',
        'after each commerce fixture',
        'after order setup',
        'after reservation release',
        'after normal webhook',
        'after duplicate normal webhook',
        'after late webhook',
        'after duplicate late webhook',
        'after cleanup',
      ],
      normal_payment_id: normalPayment.id,
      late_payment_id: latePayment.id,
    },
    normal_capture: {
      stripe_event_id: normalTrigger.event.id,
      initial_pending_webhooks: normalTrigger.event.pending_webhooks,
      final_pending_webhooks: normalEventFinal.pending_webhooks,
      state: normalState,
      duplicate_unchanged: normalAfterReplay === normalBeforeReplay,
      email_log_rows: normalEmailLogs ?? [],
      trigger_output: normalTrigger.output,
      resend_output: normalResendOutput,
    },
    late_capture: {
      stripe_event_id: lateTrigger.event.id,
      initial_pending_webhooks: lateTrigger.event.pending_webhooks,
      final_pending_webhooks: lateEventFinal.pending_webhooks,
      exception_id: lateException.id,
      exception_was_open: lateException.status === 'open',
      final_exception_status: 'resolved',
      exact_exception_count_after_duplicate: lateExceptionCount,
      inventory_unchanged: JSON.stringify(lateAfterListing) === JSON.stringify(lateInventoryBefore.data),
      order: lateAfterOrder,
      payment: lateAfterPayment,
      payment_email_log_count: lateEmailCount,
      trigger_output: lateTrigger.output,
      resend_output: lateResendOutput,
    },
  }

  mkdirSync('reports/inventory-stage1/stage1_1-production-smoke', { recursive: true })
  writeFileSync(
    'reports/inventory-stage1/stage1_1-production-smoke/result.json',
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(`FAIL: ${error.stack || error.message}`)
  process.exit(1)
})
