#!/usr/bin/env node
/**
 * End-to-end verification for Buyer Protection Phase 4C (Dispute admin resolution).
 *
 * Usage:
 *   node scripts/test-buyer-protection-phase4c-dispute-resolution.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY.
 * Run buyer-protection-phase4c-dispute-admin-resolution.sql on Supabase first.
 * Requires at least one admin profile (profiles.is_admin = true).
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
const DEV_ADMIN = {
  email: 'dev-seller-london@equipd.dev',
  id: '11111111-1111-4111-8111-111111111103',
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

async function findAdminUser(admin) {
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()

  if (adminProfile?.id) {
    const { data: authUsers } = await admin.auth.admin.listUsers()
    const authUser = authUsers?.users?.find((user) => user.id === adminProfile.id)
    return { id: adminProfile.id, email: authUser?.email ?? DEV_ADMIN.email }
  }

  const { error: bootstrapError } = await admin
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', DEV_ADMIN.id)

  if (bootstrapError) {
    throw new Error(
      `No admin profile found and bootstrap failed: ${bootstrapError.message}. Set profiles.is_admin = true manually.`,
    )
  }

  return DEV_ADMIN
}

async function findTestOrder(admin) {
  const { data: candidates } = await admin
    .from('orders')
    .select('id, buyer_id, payment_id, fulfilment_status')
    .eq('buyer_id', BUYER.id)
    .order('created_at', { ascending: false })
    .limit(10)

  for (const candidate of candidates ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status === 'paid') {
      return candidate
    }
  }

  throw new Error('No paid buyer order found for dispute resolution tests.')
}

async function findOpenDisputeForOrder(admin, orderId) {
  const { data: dispute } = await admin
    .from('order_disputes')
    .select('id, order_id, status')
    .eq('order_id', orderId)
    .in('status', ['open', 'under_review'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return dispute ?? null
}

async function createFreshOpenDispute(admin, authed, preferredOrderId = null) {
  let candidate = null

  if (preferredOrderId) {
    const { data } = await admin
      .from('orders')
      .select('id, buyer_id, fulfilment_status, payout_release_at')
      .eq('id', preferredOrderId)
      .maybeSingle()

    candidate = data
  }

  if (!candidate?.id) {
    const { data } = await admin
      .from('orders')
      .select('id, buyer_id, fulfilment_status, payout_release_at')
      .in('fulfilment_status', ['collected', 'delivered'])
      .gt('payout_release_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()

    candidate = data
  }

  if (!candidate?.id) {
    throw new Error('No order available to open a fresh dispute.')
  }

  const futureReleaseAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  await admin
    .from('orders')
    .update({
      fulfilment_status: candidate.fulfilment_status === 'delivered' ? 'delivered' : 'collected',
      payout_status: 'not_due',
      protection_status: 'active',
      payout_release_at: futureReleaseAt,
    })
    .eq('id', candidate.id)

  const buyerEmail = candidate.buyer_id === BUYER.id ? BUYER.email : BUYER.email

  await signIn(authed, buyerEmail)

  const disputeId = crypto.randomUUID()
  const path = `${candidate.id}/disputes/${disputeId}/phase4c-test.jpg`
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
    'base64',
  )

  const { error: uploadError } = await authed.storage.from('order-evidence').upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Evidence upload failed: ${uploadError.message}`)
  }

  const { data, error } = await authed.rpc('open_order_dispute', {
    p_order_id: candidate.id,
    p_reason: 'significant_undisclosed_fault',
    p_description: 'Phase 4C admin resolution test dispute.',
    p_evidence_paths: [path],
    p_dispute_id: disputeId,
  })

  if (error) {
    throw new Error(`open_order_dispute failed: ${error.message}`)
  }

  return { id: data.id, order_id: candidate.id, status: data.status }
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

  const adminUser = await findAdminUser(admin)
  logPass(`Using admin ${adminUser.email}`)

  const testOrder = await findTestOrder(admin)
  logPass(`Using order ${testOrder.id}`)

  let dispute = await findOpenDisputeForOrder(admin, testOrder.id)

  if (!dispute?.id) {
    logStep('Create fresh open dispute for testing')
    dispute = await createFreshOpenDispute(admin, authed, testOrder.id)
    logPass(`Created dispute ${dispute.id}`)
  } else {
    logPass(`Using open dispute ${dispute.id}`)
  }

  logStep('Buyer cannot resolve dispute')
  await signIn(authed, BUYER.email)

  const { error: buyerError } = await authed.rpc('admin_resolve_dispute_for_seller', {
    p_dispute_id: dispute.id,
    p_admin_note: 'Should fail',
  })

  assert(buyerError, 'Buyer resolution should fail')
  logPass(`Buyer rejected: ${buyerError.message}`)

  logStep('Seller cannot resolve dispute')
  await signIn(authed, SELLER.email)

  const { error: sellerError } = await authed.rpc('admin_resolve_dispute_for_buyer', {
    p_dispute_id: dispute.id,
    p_admin_note: 'Should fail',
  })

  assert(sellerError, 'Seller resolution should fail')
  logPass(`Seller rejected: ${sellerError.message}`)

  logStep('Admin marks dispute under review')
  await signIn(authed, adminUser.email)

  const { data: underReview, error: reviewError } = await authed.rpc(
    'admin_mark_dispute_under_review',
    {
      p_dispute_id: dispute.id,
      p_admin_note: 'Phase 4C under review note',
    },
  )

  if (reviewError) {
    throw new Error(`admin_mark_dispute_under_review failed: ${reviewError.message}`)
  }

  assert(underReview.status === 'under_review', 'Expected under_review status')
  assert(underReview.admin_note?.includes('Phase 4C'), 'Expected admin note saved')
  logPass('Dispute marked under review')

  logStep('Admin resolves for seller')
  const { data: sellerResolved, error: sellerResolveError } = await authed.rpc(
    'admin_resolve_dispute_for_seller',
    {
      p_dispute_id: dispute.id,
      p_admin_note: 'Resolved for seller in phase 4C test',
    },
  )

  if (sellerResolveError) {
    throw new Error(`admin_resolve_dispute_for_seller failed: ${sellerResolveError.message}`)
  }

  assert(sellerResolved.status === 'resolved_seller', 'Expected resolved_seller')
  assert(sellerResolved.resolved_at, 'Expected resolved_at')

  const { data: sellerOrder } = await admin
    .from('orders')
    .select('fulfilment_status, payout_status, payout_release_at, stripe_transfer_id')
    .eq('id', dispute.order_id)
    .single()

  assert(
    ['collected', 'delivered', 'completed'].includes(sellerOrder.fulfilment_status),
    'Expected fulfilment restored or completed',
  )
  assert(
    ['ready', 'awaiting_seller_setup', 'paid'].includes(sellerOrder.payout_status),
    'Expected payout eligible after seller resolution',
  )
  assert(sellerOrder.payout_status !== 'on_hold', 'Payout should not remain on hold')
  assert(!sellerOrder.stripe_transfer_id, 'No Stripe transfer should be created by dispute resolution')
  logPass(`Seller resolution updated order payout_status=${sellerOrder.payout_status}`)

  logStep('Idempotent seller resolution')
  const { data: sellerResolvedAgain, error: sellerAgainError } = await authed.rpc(
    'admin_resolve_dispute_for_seller',
    {
      p_dispute_id: dispute.id,
      p_admin_note: 'Idempotent note',
    },
  )

  if (sellerAgainError) {
    throw new Error(`Idempotent seller resolve failed: ${sellerAgainError.message}`)
  }

  assert(sellerResolvedAgain.status === 'resolved_seller', 'Expected resolved_seller on re-run')
  logPass('Seller resolution is idempotent')

  logStep('Admin resolves buyer favour on separate dispute')
  let buyerDispute

  try {
    buyerDispute = await createFreshOpenDispute(admin, authed, dispute.order_id)
  } catch (error) {
    throw new Error(`Could not create buyer-resolution test dispute: ${error.message}`)
  }

  await signIn(authed, adminUser.email)

  const { data: buyerResolved, error: buyerResolveError } = await authed.rpc(
    'admin_resolve_dispute_for_buyer',
    {
      p_dispute_id: buyerDispute.id,
      p_admin_note: 'Resolved for buyer in phase 4C test',
    },
  )

  if (buyerResolveError) {
    throw new Error(`admin_resolve_dispute_for_buyer failed: ${buyerResolveError.message}`)
  }

  assert(buyerResolved.status === 'resolved_buyer', 'Expected resolved_buyer')
  assert(
    buyerResolved.resolution?.toLowerCase().includes('manual'),
    'Expected manual refund placeholder in resolution',
  )

  const { data: buyerOrder } = await admin
    .from('orders')
    .select('fulfilment_status, payout_status, payout_release_at, stripe_transfer_id')
    .eq('id', buyerDispute.order_id)
    .single()

  assert(buyerOrder.fulfilment_status === 'disputed', 'Expected order to remain disputed')
  assert(buyerOrder.payout_status === 'on_hold', 'Expected payout to remain on hold')
  assert(buyerOrder.payout_release_at === null, 'Expected payout_release_at null')
  assert(!buyerOrder.stripe_transfer_id, 'No Stripe transfer should occur')
  logPass('Buyer resolution keeps payout on hold')

  console.log('\nAll Buyer Protection Phase 4C dispute admin resolution checks passed.')
  console.log(`Seller-resolution dispute: ${dispute.id}`)
  console.log(`Buyer-resolution dispute: ${buyerDispute.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
