#!/usr/bin/env node
/**
 * Compare buyer vs seller dispute evidence signed URL image loading.
 *
 * Usage:
 *   npx vite-node scripts/diagnose-seller-evidence-thumbnails.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  getEvidencePathExtension,
  getEvidencePathKind,
  isImageEvidencePath,
  normalizeEvidenceStoragePath,
} from '../src/lib/orderEvidence.js'

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

async function inspectPath(label, rawPath, authed) {
  const normalized = normalizeEvidenceStoragePath(rawPath)
  const extension = getEvidencePathExtension(rawPath)
  const kind = getEvidencePathKind(rawPath)
  const isImage = isImageEvidencePath(rawPath)

  console.log(`\n=== ${label} ===`)
  console.log('raw path:', rawPath)
  console.log('normalized:', normalized)
  console.log('extension:', extension)
  console.log('kind:', kind)
  console.log('isImage:', isImage)

  const { data, error } = await authed.storage
    .from('order-evidence')
    .createSignedUrl(normalized, 3600)

  if (error) {
    console.log('signed URL error:', error.message)
    return { ok: false }
  }

  const url = data.signedUrl
  console.log('signed URL path segment:', new URL(url).pathname)
  console.log('href === img src candidate:', url)

  const downloadResult = await authed.storage.from('order-evidence').download(normalized)
  if (downloadResult.error) {
    console.log('download error:', downloadResult.error.message)
  } else {
    console.log('download bytes:', downloadResult.data?.size ?? 0)
    console.log('download mime:', downloadResult.data?.type)
  }

  const response = await fetch(url, { method: 'GET' })
  console.log('HTTP status:', response.status, response.statusText)
  console.log('content-type:', response.headers.get('content-type'))
  console.log('content-length:', response.headers.get('content-length'))

  const buffer = Buffer.from(await response.arrayBuffer())
  console.log('body bytes:', buffer.length)
  console.log('magic hex:', buffer.slice(0, 4).toString('hex'))

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50
  console.log('valid jpeg:', isJpeg)
  console.log('valid png:', isPng)

  return { ok: response.ok, url, kind, isImage, buffer }
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

  const { data: disputes } = await admin
    .from('order_disputes')
    .select('id, order_id, buyer_id, seller_id, evidence_paths, seller_response_evidence_paths')
    .order('created_at', { ascending: false })
    .limit(20)

  const dispute = (disputes ?? []).find(
    (row) => (row.seller_response_evidence_paths?.length ?? 0) > 0,
  )

  if (!dispute?.id) {
    throw new Error('No dispute with seller evidence found')
  }

  console.log('Dispute:', dispute.id)
  console.log('Buyer paths:', dispute.evidence_paths)
  console.log('Seller paths:', dispute.seller_response_evidence_paths)

  await signInAsUser(admin, authed, dispute.seller_id)

  const buyerPath = dispute.evidence_paths?.find((path) => /\.(jpe?g|png|webp)$/i.test(path))
  const sellerPath = dispute.seller_response_evidence_paths?.find((path) =>
    /\.(jpe?g|png|webp)$/i.test(path),
  )

  const buyerResult = buyerPath ? await inspectPath('Buyer image evidence', buyerPath, authed) : null
  const sellerResult = sellerPath ? await inspectPath('Seller image evidence', sellerPath, authed) : null

  const samplePrefixed = `order-evidence/${dispute.order_id}/disputes/${dispute.id}/seller/seller-test.jpg`
  console.log('\n=== Sample prefixed path ===')
  console.log('normalized:', normalizeEvidenceStoragePath(samplePrefixed))
  console.log('kind:', getEvidencePathKind(samplePrefixed))
  console.log('isImage:', isImageEvidencePath(samplePrefixed))

  if (sellerResult?.ok && sellerResult.isImage) {
    console.log('\nSeller signed URL returns image bytes — img tag failure is likely client-side (CSS/onError/decode).')
  } else if (sellerResult && !sellerResult.ok) {
    console.log('\nSeller signed URL fetch failed — thumbnail cannot render.')
  }

  if (buyerResult?.ok && sellerResult?.ok) {
    console.log('\nBoth buyer and seller URLs fetch successfully from Node.')
  }
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exit(1)
})
