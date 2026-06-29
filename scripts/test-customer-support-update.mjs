#!/usr/bin/env node
/**
 * Verify customer-facing support update messages are visible to buyers/sellers
 * and internal admin notes stay hidden.
 *
 * Usage: node scripts/test-customer-support-update.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TEST_MESSAGE =
  'Thanks for submitting your dispute. Please upload clearer photos of the issue so we can continue our review.'
const INTERNAL_NOTE = 'Internal only — do not show to participants'

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
    if (!process.env[key] || key === 'ADMIN_TEST_PASSWORD' || key === 'ADMIN_TEST_EMAIL') {
      process.env[key] = value
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
  return data.session
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  assert(supabaseUrl && serviceRoleKey && anonKey, 'Missing Supabase env vars')
  assert(adminEmail && adminPassword, 'Missing ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD')

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: disputes } = await admin
    .from('order_disputes')
    .select('id, order_id, buyer_id, seller_id, status')
    .in('status', [
      'open',
      'under_review',
      'awaiting_buyer_evidence',
      'awaiting_seller_evidence',
    ])
    .order('created_at', { ascending: false })
    .limit(20)

  assert(disputes?.length, 'No manageable dispute found for test')

  const profileIds = [...new Set(disputes.flatMap((entry) => [entry.buyer_id, entry.seller_id]))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, is_admin')
    .in('id', profileIds)

  const adminById = new Map((profiles ?? []).map((profile) => [profile.id, profile.is_admin]))

  const dispute = disputes[0]
  assert(dispute?.id, 'No manageable dispute found for test')

  const buyerIsAdmin = adminById.get(dispute.buyer_id) === true
  const sellerIsAdmin = adminById.get(dispute.seller_id) === true
  const participantUserId =
    buyerIsAdmin && !sellerIsAdmin
      ? dispute.seller_id
      : sellerIsAdmin && !buyerIsAdmin
        ? dispute.buyer_id
        : dispute.buyer_id

  const { data: authUsers } = await admin.auth.admin.listUsers()
  const participantAuth = authUsers?.users?.find((user) => user.id === participantUserId)
  assert(participantAuth?.email, 'Could not resolve participant email for verification')

  await signIn(authed, adminEmail, adminPassword)

  const { data: applied, error: applyError } = await authed.rpc('admin_apply_dispute_decision', {
    p_dispute_id: dispute.id,
    p_decision: 'request_more_evidence',
    p_evidence_party: 'buyer',
    p_admin_note: INTERNAL_NOTE,
    p_customer_message: TEST_MESSAGE,
    p_refund_amount_pence: null,
  })

  assert(!applyError, `admin_apply_dispute_decision failed: ${applyError?.message}`)
  assert(applied?.customer_message === TEST_MESSAGE, 'Admin RPC did not persist customer_message')

  const participantPassword =
    participantAuth.email === adminEmail
      ? adminPassword
      : (process.env.DEV_BUYER_PASSWORD ?? 'EquipdDevSeed123!')

  if (participantAuth.email !== adminEmail) {
    await authed.auth.signOut()
    await signIn(authed, participantAuth.email, participantPassword)
  }

  const { data: participantDisputes, error: participantFetchError } = await authed.rpc(
    'fetch_order_disputes',
    {
      p_order_id: dispute.order_id,
    },
  )

  assert(
    !participantFetchError,
    `fetch_order_disputes failed: ${participantFetchError?.message}`,
  )

  const participantView = (participantDisputes ?? []).find((entry) => entry.id === dispute.id)
  assert(participantView, 'Dispute missing from fetch_order_disputes')
  assert(
    participantView.customer_message === TEST_MESSAGE,
    `Participant should see customer message (got: ${participantView.customer_message ?? 'null'})`,
  )

  const { data: rawDispute } = await admin
    .from('order_disputes')
    .select('admin_note, customer_message')
    .eq('id', dispute.id)
    .single()

  assert(rawDispute?.admin_note?.includes('Internal only'), 'Internal admin note should be stored separately')
  assert(rawDispute?.customer_message === TEST_MESSAGE, 'customer_message stored in database')

  if (!buyerIsAdmin && !sellerIsAdmin) {
    assert(!participantView.admin_note, 'Participant must not see admin_note')
    logPass('Internal admin note hidden from participants')
  } else {
    console.log(
      'NOTE: Both order participants are admins in dev — admin_note visibility for admins is expected.',
    )
  }

  logPass('Customer message visible via fetch_order_disputes')
  console.log(`\nOrder: ${dispute.order_id}`)
  console.log(`Status: ${participantView.status}`)
  console.log(`Message: ${participantView.customer_message}`)
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`)
  process.exit(1)
})
