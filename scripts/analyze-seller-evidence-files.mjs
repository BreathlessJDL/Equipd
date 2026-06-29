#!/usr/bin/env node
/**
 * Analyze seller dispute evidence files: size, dimensions, thumbnail viability.
 *
 * Usage:
 *   npx vite-node scripts/analyze-seller-evidence-files.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  analyzeEvidenceImageBytes,
  isEvidenceImageViableForThumbnail,
} from '../src/lib/orderEvidence.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
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

async function analyzePath(admin, authed, dispute, storagePath) {
  const filename = storagePath.split('/').pop()
  const { data: blob, error } = await authed.storage.from('order-evidence').download(storagePath)

  if (error) {
    console.log(`\n[${dispute.order_id}] ${filename}`)
    console.log('  download error:', error.message)
    return { storagePath, viable: false, error: error.message }
  }

  const bytes = Buffer.from(await blob.arrayBuffer())
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  const analysis = analyzeEvidenceImageBytes(bytes, extension)
  const viable = isEvidenceImageViableForThumbnail(analysis)

  console.log(`\n[${dispute.order_id}] ${filename}`)
  console.log('  path:', storagePath)
  console.log('  bytes:', analysis.bytes)
  console.log('  mime:', blob.type)
  console.log('  format:', analysis.format)
  console.log('  dimensions:', analysis.width && analysis.height ? `${analysis.width}x${analysis.height}` : 'unknown')
  console.log('  valid image:', analysis.valid)
  console.log('  thumbnail viable:', viable)
  if (analysis.reason) console.log('  reason:', analysis.reason)

  return { storagePath, dispute, analysis, viable }
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
    .select('id, order_id, seller_id, seller_response_evidence_paths')
    .order('created_at', { ascending: false })
    .limit(20)

  const withSeller = (disputes ?? []).filter((row) => (row.seller_response_evidence_paths?.length ?? 0) > 0)

  console.log(`Analyzing ${withSeller.length} dispute(s) with seller evidence...`)

  const results = []

  for (const dispute of withSeller) {
    await signInAsUser(admin, authed, dispute.seller_id)

    for (const storagePath of dispute.seller_response_evidence_paths) {
      results.push(await analyzePath(admin, authed, dispute, storagePath))
    }
  }

  const viableCount = results.filter((row) => row.viable).length
  const tinyCount = results.filter((row) => row.analysis?.reason === 'image_too_small').length
  const tinyBytesCount = results.filter((row) => row.analysis?.reason === 'file_too_small').length

  console.log('\n=== Summary ===')
  console.log(`Total seller image files: ${results.length}`)
  console.log(`Thumbnail viable: ${viableCount}`)
  console.log(`Too small dimensions: ${tinyCount}`)
  console.log(`Too small file size: ${tinyBytesCount}`)
  console.log(`Other/invalid: ${results.length - viableCount - tinyCount - tinyBytesCount}`)
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exit(1)
})
