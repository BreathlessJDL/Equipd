#!/usr/bin/env node
/**
 * Clear Stripe Connect onboarding for selected sellers (e.g. test-mode accounts
 * after switching to live Stripe keys). Uses service_role RPC
 * reset_seller_stripe_connect_onboarding.
 *
 * Usage:
 *   node scripts/reset-seller-stripe-onboarding.mjs --email seller@example.com
 *   node scripts/reset-seller-stripe-onboarding.mjs --user-id <uuid>
 *   node scripts/reset-seller-stripe-onboarding.mjs --email a@x.com --email b@x.com --dry-run
 *   node scripts/reset-seller-stripe-onboarding.mjs --user-id <uuid> --no-notify
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(relativePath) {
  const envPath = path.join(ROOT, relativePath)
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')

function parseArgs(argv) {
  const emails = []
  const userIds = []
  let dryRun = false
  let notify = true

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--email') {
      emails.push(argv[i + 1])
      i += 1
    } else if (arg === '--user-id') {
      userIds.push(argv[i + 1])
      i += 1
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--no-notify') {
      notify = false
    } else if (arg === '--notify') {
      notify = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  node scripts/reset-seller-stripe-onboarding.mjs --email seller@example.com
  node scripts/reset-seller-stripe-onboarding.mjs --user-id <uuid>
  node scripts/reset-seller-stripe-onboarding.mjs --email a@x.com --dry-run
  node scripts/reset-seller-stripe-onboarding.mjs --user-id <uuid> --no-notify`)
      process.exit(0)
    }
  }

  return { emails, userIds, dryRun, notify }
}

const { emails, userIds, dryRun, notify } = parseArgs(process.argv.slice(2))

if (emails.length === 0 && userIds.length === 0) {
  console.error('Provide at least one --email or --user-id (use --help for usage).')
  process.exit(1)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function resolveUserIdFromEmail(email) {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw new Error(`Auth lookup failed for ${email}: ${error.message}`)
    }

    const users = data?.users ?? []
    const match = users.find((user) => user.email?.toLowerCase() === normalized)

    if (match) {
      return match.id
    }

    if (users.length < perPage) {
      break
    }

    page += 1
  }

  throw new Error(`No user found for email ${email}`)
}

async function fetchProfileSummary(sellerId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, username, stripe_account_id, stripe_onboarding_complete')
    .eq('id', sellerId)
    .single()

  if (error) {
    throw new Error(`Profile not found for ${sellerId}: ${error.message}`)
  }

  return data
}

async function resetSeller(sellerId) {
  const before = await fetchProfileSummary(sellerId)

  console.log('\n--- Seller ---')
  console.log({
    id: before.id,
    username: before.username,
    stripe_account_id: before.stripe_account_id,
    stripe_onboarding_complete: before.stripe_onboarding_complete,
  })

  if (dryRun) {
    console.log('[dry-run] Would call reset_seller_stripe_connect_onboarding')
    return
  }

  const { data, error } = await admin.rpc('reset_seller_stripe_connect_onboarding', {
    p_seller_id: sellerId,
    p_notify: notify,
  })

  if (error) {
    throw new Error(`Reset failed for ${sellerId}: ${error.message}`)
  }

  const after = await fetchProfileSummary(sellerId)

  console.log('Reset result:', data)
  console.log('After:', {
    stripe_account_id: after.stripe_account_id,
    stripe_onboarding_complete: after.stripe_onboarding_complete,
  })
}

const sellerIds = [...new Set(userIds)]

for (const email of emails) {
  try {
    const sellerId = await resolveUserIdFromEmail(email)
    sellerIds.push(sellerId)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}

if (sellerIds.length === 0) {
  process.exit(process.exitCode ?? 1)
}

for (const sellerId of [...new Set(sellerIds)]) {
  try {
    await resetSeller(sellerId)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}

console.log('\nDone.')
