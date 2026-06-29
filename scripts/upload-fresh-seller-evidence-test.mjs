#!/usr/bin/env node
/**
 * Upload a real displayable seller image on a different active dispute and verify viability.
 *
 * Usage:
 *   npx vite-node scripts/upload-fresh-seller-evidence-test.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  analyzeEvidenceImageBlob,
  analyzeEvidenceImageBytes,
  isEvidenceImageViableForThumbnail,
} from '../src/lib/orderEvidence.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'
const PROBLEMATIC_ORDER_ID = '30d3cd3e-82af-49b2-b8d8-5a480e4a80b0'

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

async function signInAsUser(admin, authed, userId) {
  const { data: userData } = await admin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (!email) throw new Error(`Could not resolve auth user ${userId}`)

  const passwordAttempt = await authed.auth.signInWithPassword({ email, password: DEV_PASSWORD })
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

  const sampleImagePath = join(ROOT, 'public', 'design-reference', 'Selling icon.png')
  assert(existsSync(sampleImagePath), `Missing sample image at ${sampleImagePath}`)
  const imageBytes = readFileSync(sampleImagePath)
  const sampleAnalysis = analyzeEvidenceImageBytes(imageBytes, 'png')
  console.log('Sample upload image:', sampleAnalysis)

  const { data: disputes } = await admin
    .from('order_disputes')
    .select('id, order_id, seller_id, status, seller_response_evidence_paths')
    .in('status', ['open', 'under_review', 'refund_pending', 'refund_completed'])
    .order('created_at', { ascending: false })

  const targetDispute = (disputes ?? []).find((row) => row.order_id !== PROBLEMATIC_ORDER_ID)
  assert(targetDispute?.id, 'No active dispute on a different order found')

  console.log('\nFresh upload target dispute:', targetDispute.id)
  console.log('Fresh upload target order:', targetDispute.order_id)

  await signInAsUser(admin, authed, targetDispute.seller_id)

  const storagePath = `${targetDispute.order_id}/disputes/${targetDispute.id}/seller/fresh-seller-thumb-${Date.now()}.png`

  const { error: uploadError } = await authed.storage.from('order-evidence').upload(storagePath, imageBytes, {
    contentType: 'image/png',
    upsert: false,
  })
  assert(!uploadError, `Upload failed: ${uploadError?.message}`)

  const { data: updatedDispute, error: appendError } = await authed.rpc('append_order_dispute_evidence', {
    p_dispute_id: targetDispute.id,
    p_evidence_paths: [storagePath],
  })
  assert(!appendError, `append_order_dispute_evidence failed: ${appendError?.message}`)

  const { data: downloaded, error: downloadError } = await authed.storage
    .from('order-evidence')
    .download(storagePath)
  assert(!downloadError, `Download failed: ${downloadError?.message}`)

  const imageAnalysis = await analyzeEvidenceImageBlob(downloaded, 'png')
  const thumbnailViable = isEvidenceImageViableForThumbnail(imageAnalysis)

  console.log('\nFresh seller evidence analysis:')
  console.log('  path:', storagePath)
  console.log('  thumbnailViable:', thumbnailViable)
  console.log('  imageAnalysis:', imageAnalysis)

  assert(thumbnailViable, 'Fresh seller PNG should be viable for thumbnail')

  console.log('\nPASS: Fresh seller evidence on different order is thumbnail-viable')

  const { data: problematicDispute } = await admin
    .from('order_disputes')
    .select('seller_id, seller_response_evidence_paths')
    .eq('order_id', PROBLEMATIC_ORDER_ID)
    .maybeSingle()

  if (!problematicDispute?.seller_response_evidence_paths?.length) {
    console.log('\nNo seller evidence on problematic order to compare.')
    return
  }

  console.log('\nProblematic order seller files:')
  await signInAsUser(admin, authed, problematicDispute.seller_id)

  for (const path of problematicDispute.seller_response_evidence_paths) {
    const filename = path.split('/').pop()
    const extension = filename.split('.').pop()?.toLowerCase() ?? ''
    const { data: blob, error } = await authed.storage.from('order-evidence').download(path)
    if (error) {
      console.log(`  ${filename}: download error ${error.message}`)
      continue
    }
    const analysis = await analyzeEvidenceImageBlob(blob, extension)
    console.log(`  ${filename}`)
    console.log('    thumbnailViable:', isEvidenceImageViableForThumbnail(analysis))
    console.log('    imageAnalysis:', analysis)
  }
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exit(1)
})
