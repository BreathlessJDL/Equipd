#!/usr/bin/env node
/**
 * Verify admins can read order-evidence; non-participants cannot.
 * Usage: node scripts/test-admin-order-evidence-access.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ORDER_EVIDENCE_BUCKET = 'order-evidence'

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
    if (!process.env[key] || key === 'ADMIN_TEST_EMAIL' || key === 'ADMIN_TEST_PASSWORD') {
      process.env[key] = value
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

function firstEvidencePath(dispute) {
  return (
    dispute?.evidence_paths?.[0]
    ?? dispute?.seller_response_evidence_paths?.[0]
    ?? null
  )
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  assert(supabaseUrl && anonKey && serviceKey && adminEmail && adminPassword, 'Missing env vars')

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await signIn(authed, adminEmail, adminPassword)

  const { data: adminUser } = await authed.auth.getUser()
  const adminId = adminUser?.user?.id
  assert(adminId, 'Admin user id missing')

  const { data: cases, error: listError } = await authed.rpc('admin_list_cases', {
    p_filter: 'active',
  })
  assert(!listError, `admin_list_cases failed: ${listError?.message}`)

  let orderId = null
  let evidencePath = null

  for (const caseRow of cases ?? []) {
    const { data: disputes, error: disputeError } = await authed.rpc('fetch_order_disputes', {
      p_order_id: caseRow.order_id,
    })
    assert(!disputeError, `fetch_order_disputes failed: ${disputeError?.message}`)

    const dispute = disputes?.find((row) => firstEvidencePath(row))
    const path = firstEvidencePath(dispute)
    if (path) {
      orderId = caseRow.order_id
      evidencePath = path
      break
    }
  }

  assert(evidencePath, 'Need an active dispute with evidence to test')

  const { data: signed, error: signError } = await authed.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .createSignedUrl(evidencePath, 3600)

  assert(!signError, `Admin signed URL failed: ${signError?.message}`)
  assert(signed?.signedUrl, 'Admin signed URL missing')

  const { data: blob, error: downloadError } = await authed.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .download(evidencePath)

  assert(!downloadError, `Admin download failed: ${downloadError?.message}`)
  assert(blob && blob.size > 0, 'Admin download returned empty blob')

  const { data: orderRow } = await adminClient
    .from('orders')
    .select('buyer_id, seller_id')
    .eq('id', orderId)
    .single()

  assert(orderRow, 'Order row missing')

  const outsiderId =
    [orderRow.buyer_id, orderRow.seller_id, adminId].find(
      (id) => id && id !== orderRow.buyer_id && id !== orderRow.seller_id,
    ) ?? null

  if (outsiderId) {
    const { data: outsiderAuth } = await adminClient.auth.admin.getUserById(outsiderId)
    const outsiderEmail = outsiderAuth?.user?.email

    if (outsiderEmail) {
      const outsider = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { error: outsiderSignInError } = await outsider.auth.signInWithPassword({
        email: outsiderEmail,
        password: process.env.DEV_SEED_PASSWORD || 'EquipdDevSeed123!',
      })

      if (!outsiderSignInError) {
        const { error: outsiderSignError } = await outsider.storage
          .from(ORDER_EVIDENCE_BUCKET)
          .createSignedUrl(evidencePath, 3600)

        assert(outsiderSignError, 'Outsider should not get signed URL for order evidence')
      }
    }
  }

  console.log('PASS: admin order evidence access')
  console.log(`  order: ${orderId}`)
  console.log(`  path: ${evidencePath}`)
  console.log(`  signedUrl: ${signed.signedUrl.slice(0, 72)}…`)
  console.log(`  bytes: ${blob.size}`)
}

main().catch((error) => {
  console.error('FAIL:', error.message)
  process.exit(1)
})
