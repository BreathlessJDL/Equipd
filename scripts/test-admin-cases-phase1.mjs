#!/usr/bin/env node
/**
 * Phase 1 admin cases verification.
 * Usage: node scripts/test-admin-cases-phase1.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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

function logPass(message) {
  console.log(`PASS: ${message}`)
}

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  assert(supabaseUrl && anonKey && adminEmail && adminPassword, 'Missing env vars')

  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await signIn(authed, adminEmail, adminPassword)

  const { data: cases, error: listError } = await authed.rpc('admin_list_cases', {
    p_filter: 'all',
  })

  assert(!listError, `admin_list_cases failed: ${listError?.message}`)
  assert(Array.isArray(cases), 'admin_list_cases should return an array')

  const disputeCases = cases.filter((row) => row.case_type === 'buyer_protection_dispute')
  const supportCases = cases.filter((row) => row.case_type === 'support_request')

  logPass(`admin_list_cases returned ${cases.length} case(s)`)
  console.log(`  Buyer Protection: ${disputeCases.length}`)
  console.log(`  Support requests: ${supportCases.length}`)

  if (cases[0]?.order_id) {
    const { data: updates, error: updatesError } = await authed.rpc('fetch_order_case_updates', {
      p_order_id: cases[0].order_id,
    })

    assert(!updatesError, `fetch_order_case_updates failed: ${updatesError?.message}`)
    logPass(`fetch_order_case_updates returned ${updates?.length ?? 0} update(s) for sample order`)
  }

  await authed.auth.signOut()

  const { error: deniedError } = await authed.rpc('admin_list_cases', { p_filter: 'all' })
  assert(deniedError, 'Non-admin/anonymous should not call admin_list_cases')
  logPass('admin_list_cases blocked without admin session')
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`)
  process.exit(1)
})
