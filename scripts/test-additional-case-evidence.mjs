#!/usr/bin/env node
/**
 * Verification for additional evidence uploads on active cases.
 *
 * Usage:
 *   node scripts/test-additional-case-evidence.mjs
 *
 * Requires .env.local. Run supabase/case-management-additional-evidence.sql first.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

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

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signInAsUser(admin, authed, userId, fallbackPassword = DEV_PASSWORD) {
  const { data: userData } = await admin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (!email) throw new Error(`Could not resolve auth user ${userId}`)

  const passwordAttempt = await authed.auth.signInWithPassword({ email, password: fallbackPassword })
  if (!passwordAttempt.error) return email

  const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  await authed.auth.verifyOtp({ type: 'email', token_hash: linkData.properties.hashed_token })
  return email
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

  const { data: activeDispute } = await admin
    .from('order_disputes')
    .select('id, order_id, buyer_id, seller_id, status, evidence_paths, seller_response_evidence_paths')
    .in('status', ['open', 'under_review', 'refund_pending', 'refund_completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!activeDispute?.id) {
    throw new Error('No active dispute found. Run case management tests first.')
  }

  const { error: probeError } = await authed.rpc('append_order_dispute_evidence', {
    p_dispute_id: activeDispute.id,
    p_evidence_paths: ['invalid'],
  })
  assert(probeError, 'Expected RPC probe error')
  assert(
    !/could not find the function/i.test(probeError.message),
    'Missing append_order_dispute_evidence. Run case-management-additional-evidence.sql first.',
  )

  const buyerCountBefore = activeDispute.evidence_paths?.length ?? 0
  const sellerCountBefore = activeDispute.seller_response_evidence_paths?.length ?? 0

  await signInAsUser(admin, authed, activeDispute.buyer_id)

  const buyerPath = `${activeDispute.order_id}/disputes/${activeDispute.id}/buyer/additional-buyer-${Date.now()}.jpg`
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
    'base64',
  )

  const { error: uploadError } = await authed.storage.from('order-evidence').upload(buyerPath, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: afterBuyer, error: appendBuyerError } = await authed.rpc('append_order_dispute_evidence', {
    p_dispute_id: activeDispute.id,
    p_evidence_paths: [buyerPath],
  })

  if (appendBuyerError) {
    throw new Error(`append_order_dispute_evidence buyer failed: ${appendBuyerError.message}`)
  }

  assert((afterBuyer.evidence_paths?.length ?? 0) === buyerCountBefore + 1, 'Buyer evidence count should increase')
  logPass('Buyer uploaded additional dispute evidence')

  const { data: buyerUpdates } = await authed.rpc('fetch_order_case_updates', {
    p_order_id: activeDispute.order_id,
  })
  assert(
    (buyerUpdates ?? []).some((update) => update.event_type === 'additional_evidence'),
    'Expected additional_evidence case update',
  )
  logPass('Additional evidence case update recorded')

  await signInAsUser(admin, authed, activeDispute.seller_id)

  const sellerPath = `${activeDispute.order_id}/disputes/${activeDispute.id}/seller/additional-seller-${Date.now()}.jpg`
  const { error: sellerUploadError } = await authed.storage.from('order-evidence').upload(sellerPath, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (sellerUploadError) {
    throw new Error(`Storage upload failed: ${sellerUploadError.message}`)
  }

  const { data: afterSeller, error: appendSellerError } = await authed.rpc('append_order_dispute_evidence', {
    p_dispute_id: activeDispute.id,
    p_evidence_paths: [sellerPath],
  })

  if (appendSellerError) {
    throw new Error(`append_order_dispute_evidence seller failed: ${appendSellerError.message}`)
  }

  assert(
    (afterSeller.seller_response_evidence_paths?.length ?? 0) === sellerCountBefore + 1,
    'Seller evidence count should increase',
  )
  logPass('Seller uploaded additional dispute evidence')

  console.log('\nAll additional evidence checks passed.')
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exit(1)
})
