#!/usr/bin/env node
/**
 * End-to-end verification for Case Management Phase 3 (refund completion & closure).
 *
 * Usage:
 *   node scripts/test-case-management-phase3.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY.
 * Run supabase/case-management-phase3-01-enums.sql then phase3-refund-closure.sql first.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const CASE_OUTCOMES = {
  BUYER_UPHELD_FULL_REFUND: 'buyer_upheld_full_refund',
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const DISPUTE_REASON_BY_ORDER_TYPE = {
  collection: 'significant_undisclosed_fault',
  seller_delivery: 'significant_undisclosed_fault',
  buyer_courier: 'significant_seller_misrepresentation',
}

function getDisputeReasonForOrder(orderType) {
  return DISPUTE_REASON_BY_ORDER_TYPE[orderType] ?? 'significant_undisclosed_fault'
}
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

async function findPaidOrder(admin) {
  const { data: candidates } = await admin
    .from('orders')
    .select(
      'id, buyer_id, seller_id, payment_id, fulfilment_status, payout_release_at, payout_released_at, order_type',
    )
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

    const { data: buyerProfile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', candidate.buyer_id)
      .maybeSingle()

    if (buyerProfile?.is_admin) continue

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
        'partial_refund_pending',
        'refund_completed',
      ])

    if ((activeDisputes ?? []).length === 0) return candidate
  }

  return null
}

async function createFreshOpenDispute(admin, authed) {
  const candidate = await findPaidOrder(admin)

  if (!candidate?.id) {
    throw new Error('No eligible paid order found without an active dispute.')
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
      payout_released_at: null,
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
      'partial_refund_pending',
      'refund_completed',
    ])

  await signInAsUser(admin, authed, candidate.buyer_id)

  const disputeId = crypto.randomUUID()
  const path = `${candidate.id}/disputes/${disputeId}/phase3-closure-test.jpg`
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
    'base64',
  )

  const { error: uploadError } = await admin.storage.from('order-evidence').upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Evidence upload failed: ${uploadError.message}`)
  }

  const { data, error } = await authed.rpc('open_order_dispute', {
    p_order_id: candidate.id,
    p_reason: getDisputeReasonForOrder(candidate.order_type),
    p_description: 'Phase 3 refund completion and closure test dispute.',
    p_evidence_paths: [path],
    p_dispute_id: disputeId,
  })

  if (error) {
    throw new Error(`open_order_dispute failed: ${error.message}`)
  }

  return { dispute: data, orderId: candidate.id, buyerId: candidate.buyer_id }
}

function hasCaseUpdate(updates, eventType) {
  return (updates ?? []).some((update) => update.event_type === eventType)
}

function testCaseClosureHelpers() {
  const canMarkRefundCompleted = (record) =>
    record?.status === 'refund_pending' || record?.status === 'partial_refund_pending'
  const canCloseCase = (record) => {
    if (!record || record.case_outcome) return false
    if (['refund_pending', 'partial_refund_pending', 'ready_for_refund'].includes(record.status)) {
      return false
    }
    return ['refund_completed', 'rejected', 'resolved'].includes(record.status)
  }

  assert(canMarkRefundCompleted({ status: 'refund_pending' }), 'refund_pending should allow mark completed')
  assert(
    canMarkRefundCompleted({ status: 'partial_refund_pending' }),
    'partial_refund_pending should allow mark completed',
  )
  assert(!canMarkRefundCompleted({ status: 'ready_for_refund' }), 'ready_for_refund should not allow mark completed')
  assert(canCloseCase({ status: 'refund_completed' }), 'refund_completed should allow close')
  assert(canCloseCase({ status: 'rejected' }), 'rejected should allow close')
  assert(!canCloseCase({ status: 'refund_pending' }), 'refund_pending should block close')
  assert(!canCloseCase({ status: 'resolved', case_outcome: 'seller_upheld' }), 'closed case should block re-close')
  logPass('caseClosure helper guards')
}

async function assertRpcExists(authed, functionName) {
  const { error } = await authed.rpc(functionName, {
    p_dispute_id: '00000000-0000-4000-8000-000000000001',
    p_admin_note: null,
    p_customer_message: null,
    p_refund_reference: null,
  })

  assert(error, `Expected ${functionName} to return an error for missing dispute`)
  assert(
    !/could not find the function/i.test(error.message),
    `Missing ${functionName}. Run phase 3 SQL migrations first.`,
  )
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  testCaseClosureHelpers()

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const adminUser = await findAdminUser(admin)
  logPass(`Using admin ${adminUser.email}`)

  logStep('Verify Phase 3 RPCs exist')
  await signInAdmin(admin, authed, adminUser)
  await assertRpcExists(authed, 'admin_mark_dispute_refund_completed')

  const { error: closeProbeError } = await authed.rpc('admin_close_dispute_case', {
    p_dispute_id: '00000000-0000-4000-8000-000000000001',
    p_case_outcome: CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND,
    p_admin_note: null,
    p_customer_message: null,
  })
  assert(closeProbeError, 'Expected admin_close_dispute_case probe error')
  assert(
    !/could not find the function/i.test(closeProbeError.message),
    'Missing admin_close_dispute_case. Run phase 3 SQL migrations first.',
  )
  logPass('Phase 3 RPCs available')

  logStep('Create fresh dispute and move to refund pending')
  const { dispute, orderId, buyerId } = await createFreshOpenDispute(admin, authed)
  logPass(`Created dispute ${dispute.id} on order ${orderId}`)

  await signInAdmin(admin, authed, adminUser)

  const { data: refundPending, error: refundError } = await authed.rpc('admin_apply_dispute_decision', {
    p_dispute_id: dispute.id,
    p_decision: 'approve_full_refund',
    p_admin_note: 'Full refund approved for phase 3 test',
    p_customer_message: 'A full refund has been approved.',
    p_refund_amount_pence: null,
    p_evidence_party: null,
  })

  if (refundError) {
    throw new Error(`admin_apply_dispute_decision approve_full_refund failed: ${refundError.message}`)
  }

  assert(refundPending.status === 'refund_pending', 'Expected refund_pending')
  logPass('Dispute moved to refund pending')

  logStep('Mark refund completed')
  const refundReference = `PHASE3-REF-${Date.now()}`

  const { data: refundCompleted, error: completedError } = await authed.rpc(
    'admin_mark_dispute_refund_completed',
    {
      p_dispute_id: dispute.id,
      p_admin_note: 'Refund processed via bank transfer',
      p_customer_message: 'The refund has now been completed. Equipd will close this case once final checks are complete.',
      p_refund_reference: refundReference,
    },
  )

  if (completedError) {
    throw new Error(`admin_mark_dispute_refund_completed failed: ${completedError.message}`)
  }

  assert(refundCompleted.status === 'refund_completed', 'Expected refund_completed')
  assert(refundCompleted.refund_reference === refundReference, 'Expected refund reference saved')
  assert(refundCompleted.refund_completed_at, 'Expected refund_completed_at')
  assert(refundCompleted.refund_completed_by === adminUser.id, 'Expected refund_completed_by')
  logPass('Refund marked completed')

  const { data: updatesAfterRefund } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  assert(hasCaseUpdate(updatesAfterRefund, 'refund_completed'), 'Expected refund_completed update')

  const refundUpdate = updatesAfterRefund.find((update) => update.event_type === 'refund_completed')
  assert(refundUpdate?.internal_note?.includes('bank transfer'), 'Admin should see internal note')
  assert(refundUpdate?.message_to_customer?.includes('refund has now been completed'), 'Customer message saved')

  logStep('Buyer cannot see internal notes')
  await signInAsUser(admin, authed, buyerId)

  const { data: buyerUpdates } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  const buyerRefundUpdate = buyerUpdates.find((update) => update.event_type === 'refund_completed')
  assert(!buyerRefundUpdate?.internal_note, 'Buyer should not see internal note')
  assert(buyerRefundUpdate?.message_to_customer, 'Buyer should see customer message')
  logPass('Internal notes hidden from buyer')

  logStep('Buyer cannot close case')
  const { error: buyerCloseError } = await authed.rpc('admin_close_dispute_case', {
    p_dispute_id: dispute.id,
    p_case_outcome: CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND,
    p_admin_note: 'Should fail',
    p_customer_message: 'Should fail',
  })
  assert(buyerCloseError, 'Buyer should not close case')
  logPass(`Buyer blocked from close: ${buyerCloseError.message}`)

  logStep('Admin closes case')
  await signInAdmin(admin, authed, adminUser)

  const { data: closed, error: closeError } = await authed.rpc('admin_close_dispute_case', {
    p_dispute_id: dispute.id,
    p_case_outcome: CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND,
    p_admin_note: 'Case closed after manual refund',
    p_customer_message: 'This case has now been resolved and closed. Thank you for working with Equipd while we reviewed the issue.',
  })

  if (closeError) {
    throw new Error(`admin_close_dispute_case failed: ${closeError.message}`)
  }

  assert(closed.status === 'resolved', 'Expected resolved status')
  assert(closed.case_outcome === CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND, 'Expected case outcome')
  assert(closed.resolved_at, 'Expected resolved_at')
  logPass('Case closed with outcome')

  const { data: updatesAfterClose } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: orderId,
  })
  assert(hasCaseUpdate(updatesAfterClose, 'case_closed'), 'Expected case_closed update')

  logStep('Closed case hidden from active admin queue')
  const { data: activeCases, error: activeError } = await authed.rpc('admin_list_cases', {
    p_filter: 'active',
  })

  if (activeError) {
    throw new Error(`admin_list_cases active failed: ${activeError.message}`)
  }

  assert(
    !(activeCases ?? []).some((row) => row.case_id === dispute.id),
    'Closed dispute should not appear in active filter',
  )
  logPass('Closed case hidden from active filter')

  const { data: closedCases, error: closedListError } = await authed.rpc('admin_list_cases', {
    p_filter: 'closed',
  })

  if (closedListError) {
    throw new Error(`admin_list_cases closed failed: ${closedListError.message}`)
  }

  assert(
    (closedCases ?? []).some((row) => row.case_id === dispute.id),
    'Closed dispute should appear in closed filter',
  )
  logPass('Closed case visible in closed filter')

  console.log('\nAll Case Management Phase 3 checks passed.')
  console.log(`Order: ${orderId}`)
  console.log(`Dispute: ${dispute.id}`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
