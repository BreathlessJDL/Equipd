#!/usr/bin/env node
/**
 * Verify order-evidence Storage RLS helpers (dispute + support paths).
 *
 * Usage:
 *   node scripts/test-dispute-support-storage-rls.mjs
 *
 * Requires dispute-support-simplified-03-storage-rls-fix.sql applied.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
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

function minimalJpegBuffer() {
  const base64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=='
  return Buffer.from(base64, 'base64')
}

async function signInAsUser(admin, authed, userId, fallbackEmail, fallbackPassword = DEV_PASSWORD) {
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

async function findPaidOrder(admin) {
  const { data: candidates } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, payment_id, fulfilment_status, payout_release_at, payout_released_at')
    .eq('fulfilment_status', 'collected')
    .gt('payout_release_at', new Date().toISOString())
    .is('payout_released_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  for (const candidate of candidates ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', candidate.payment_id)
      .single()

    if (payment?.status !== 'paid') continue

    const { data: disputes } = await admin
      .from('order_disputes')
      .select('id')
      .eq('order_id', candidate.id)
      .in('status', ['open', 'under_review'])

    if ((disputes ?? []).length === 0) return candidate
  }

  return null
}

function participantUserId(order) {
  return order.buyer_id
}

async function uploadPath(client, path) {
  const { error } = await client.storage.from('order-evidence').upload(path, minimalJpegBuffer(), {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (error) throw new Error(`${path}: ${error.message}`)
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

  const disputeOrder = await findPaidOrder(admin)
  if (!disputeOrder) {
    throw new Error(
      'No eligible collected order found. Complete a collection QR handover with active payout window first.',
    )
  }

  const disputeBuyerId = participantUserId(disputeOrder)
  const buyerEmail = await signInAsUser(
    admin,
    authed,
    disputeBuyerId,
    BUYER.email,
    process.env.ADMIN_TEST_PASSWORD || DEV_PASSWORD,
  )
  console.log(`Using buyer ${buyerEmail} for order ${disputeOrder.id}`)
  const disputeId = crypto.randomUUID()
  const disputePath = `${disputeOrder.id}/disputes/${disputeId}/storage-rls-test.jpg`
  await uploadPath(authed, disputePath)
  console.log(`PASS: buyer dispute evidence upload (${disputePath})`)

  const supportOrder = disputeOrder
  const supportUserId = participantUserId(supportOrder)
  await signInAsUser(
    admin,
    authed,
    supportUserId,
    BUYER.email,
    process.env.ADMIN_TEST_PASSWORD || DEV_PASSWORD,
  )
  const requestId = crypto.randomUUID()
  const supportPath = `${supportOrder.id}/support/${requestId}/storage-rls-test.jpg`
  await uploadPath(authed, supportPath)
  console.log(`PASS: participant support evidence upload (${supportPath})`)

  console.log('\nAll dispute/support storage RLS checks passed.')
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
