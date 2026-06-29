#!/usr/bin/env node
/**
 * End-to-end verification for Case Management Phase 2 (return workflow).
 *
 * Usage:
 *   node scripts/test-case-return-workflow.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY.
 * Run supabase/case-management-phase2-return-workflow.sql on Supabase first.
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

async function signInAsUser(admin, authed, userId, fallbackPassword = DEV_PASSWORD) {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !userData?.user?.email) {
    throw new Error(`Could not resolve auth user ${userId}`)
  }

  const email = userData.user.email
  const passwordAttempt = await authed.auth.signInWithPassword({
    email,
    password: fallbackPassword,
  })

  if (!passwordAttempt.error) return email

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`Sign in failed for ${email}: ${passwordAttempt.error.message}`)
  }

  const { error: otpError } = await authed.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  })

  if (otpError) {
    throw new Error(`Sign in failed for ${email}: ${otpError.message}`)
  }

  return email
}

async function signInAdmin(admin, authed, adminUser) {
  const password = process.env.ADMIN_TEST_PASSWORD || DEV_PASSWORD
  const passwordAttempt = await authed.auth.signInWithPassword({
    email: adminUser.email,
    password,
  })

  if (!passwordAttempt.error) return

  await signInAsUser(admin, authed, adminUser.id, password)
}

async function findPaidOrder(admin) {
  const { data: candidates } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payment_id, fulfilment_status, payout_release_at, payout_released_at')
    .not('buyer_id', 'is', null)
    .not('seller_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  for (const candidate of candidates ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .maybeSingle()

    if (payment?.status !== 'paid') continue

    const { data: activeDisputes } = await admin
      .from('order_disputes')
      .select('id')
      .eq('order_id', candidate.id)
      .in('status', [
        'open',
        'under_review',
        'awaiting_seller_collection',
        'collection_arranged',
        'ready_for_refund',
        'refund_pending',
      ])

    if ((activeDisputes ?? []).length === 0) return candidate
  }

  return null
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
    throw new Error(`No admin profile found: ${bootstrapError.message}`)
  }

  return DEV_ADMIN
}

async function createFreshOpenDispute(admin, authed) {
  const candidate = await findPaidOrder(admin)

  if (!candidate?.id) {
    throw new Error(
      'No eligible paid order found without an active dispute. Complete a paid order first.',
    )
  }

  const futureReleaseAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  await admin
    .from('orders')
    .update({
      fulfilment_status:
        candidate.fulfilment_status === 'delivered' ? 'delivered' : 'collected',
      payout_status: 'not_due',
      protection_status: 'active',
      payout_release_at: futureReleaseAt,
    })
    .eq('id', candidate.id)

  await admin
    .from('order_disputes')
    .update({ status: 'resolved_seller' })
    .eq('order_id', candidate.id)
    .in('status', [
      'open',
      'under_review',
      'awaiting_seller_collection',
      'collection_arranged',
      'ready_for_refund',
      'refund_pending',
    ])

  const buyerEmail = await signInAsUser(admin, authed, candidate.buyer_id)
  void buyerEmail

  const disputeId = crypto.randomUUID()
  const path = `${candidate.id}/disputes/${disputeId}/phase2-return-test.jpg`
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
    p_description: 'Phase 2 return workflow test dispute.',
    p_evidence_paths: [path],
    p_dispute_id: disputeId,
  })

  if (error) {
    throw new Error(`open_order_dispute failed: ${error.message}`)
  }

  return { dispute: data, orderId: candidate.id, buyerId: candidate.buyer_id, sellerId: candidate.seller_id }
}

function hasCaseUpdate(updates, eventType) {
  return (updates ?? []).some((update) => update.event_type === eventType)
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

  logStep('Create fresh open dispute')
  const { dispute, orderId, buyerId, sellerId } = await createFreshOpenDispute(admin, authed)
  logPass(`Created dispute ${dispute.id} on order ${orderId}`)

  logStep('Admin authorises return')
  await signInAdmin(admin, authed, adminUser)

  const { data: authorised, error: authoriseError } = await authed.rpc('admin_authorise_case_return', {
    p_dispute_id: dispute.id,
    p_admin_note: 'Phase 2 return authorised',
    p_customer_message: null,
  })

  if (authoriseError) {
    throw new Error(`admin_authorise_case_return failed: ${authoriseError.message}`)
  }

  assert(authorised.status === 'awaiting_seller_collection', 'Expected awaiting_seller_collection')
  logPass('Return authorised')

  const { data: updatesAfterAuthorise } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  assert(hasCaseUpdate(updatesAfterAuthorise, 'return_authorised'), 'Expected return_authorised update')

  logStep('Seller arranges collection')
  await signInAsUser(admin, authed, sellerId)

  const collectionDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: logistics, error: arrangeError } = await authed.rpc('seller_arrange_case_collection', {
    p_dispute_id: dispute.id,
    p_collection_date: collectionDate,
    p_courier_name: 'DPD',
    p_tracking_reference: 'PHASE2-TEST-001',
    p_message_to_buyer: 'Collection booked for tomorrow morning.',
  })

  if (arrangeError) {
    throw new Error(`seller_arrange_case_collection failed: ${arrangeError.message}`)
  }

  assert(logistics.courier_name === 'DPD', 'Expected courier saved')
  logPass('Seller arranged collection')

  const { data: disputeAfterArrange } = await admin
    .from('order_disputes')
    .select('status')
    .eq('id', dispute.id)
    .single()

  assert(disputeAfterArrange.status === 'collection_arranged', 'Expected collection_arranged')

  const { data: updatesAfterArrange } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  assert(hasCaseUpdate(updatesAfterArrange, 'collection_arranged'), 'Expected collection_arranged update')

  logStep('Buyer confirms collection')
  await signInAsUser(admin, authed, buyerId)

  const { data: confirmed, error: confirmError } = await authed.rpc('buyer_confirm_case_collection', {
    p_dispute_id: dispute.id,
  })

  if (confirmError) {
    throw new Error(`buyer_confirm_case_collection failed: ${confirmError.message}`)
  }

  assert(confirmed.status === 'ready_for_refund', 'Expected ready_for_refund')
  logPass('Buyer confirmed collection')

  const { data: updatesAfterConfirm } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  assert(hasCaseUpdate(updatesAfterConfirm, 'collection_confirmed'), 'Expected collection_confirmed update')

  logStep('Admin marks refund pending')
  await signInAdmin(admin, authed, adminUser)

  const { data: refundPending, error: refundError } = await authed.rpc('admin_issue_case_refund_pending', {
    p_dispute_id: dispute.id,
    p_admin_note: 'Manual refund queued',
    p_customer_message: null,
  })

  if (refundError) {
    throw new Error(`admin_issue_case_refund_pending failed: ${refundError.message}`)
  }

  assert(refundPending.status === 'refund_pending', 'Expected refund_pending')
  logPass('Refund marked pending')

  const { data: updatesAfterRefund } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  assert(hasCaseUpdate(updatesAfterRefund, 'refund_pending'), 'Expected refund_pending update')

  logStep('Buyer cannot authorise return')
  await signInAsUser(admin, authed, buyerId)

  const { error: buyerDenied } = await authed.rpc('admin_authorise_case_return', {
    p_dispute_id: dispute.id,
    p_admin_note: 'Should fail',
    p_customer_message: null,
  })

  assert(buyerDenied, 'Buyer should not authorise return')
  logPass(`Buyer blocked: ${buyerDenied.message}`)

  logStep('Non-dispute order logistics fetch')
  const { data: normalOrders } = await admin
    .from('orders')
    .select('id, buyer_id')
    .neq('id', orderId)
    .limit(5)

  if (normalOrders?.[0]?.id) {
    if (normalOrders[0].buyer_id) {
      await signInAsUser(admin, authed, normalOrders[0].buyer_id)
      const { data: normalLogistics, error: normalError } = await authed.rpc(
      'fetch_order_case_return_logistics',
      { p_order_id: normalOrders[0].id },
    )
    assert(!normalError, `fetch_order_case_return_logistics failed: ${normalError?.message}`)
    assert((normalLogistics ?? []).length === 0, 'Non-dispute order should have no return logistics')
    logPass('Non-dispute order unaffected')
    }
  } else {
    logPass('Skipped non-dispute order check (no alternate order found)')
  }

  console.log('\nAll Case Management Phase 2 return workflow checks passed.')
  console.log(`Order: ${orderId}`)
  console.log(`Dispute: ${dispute.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
