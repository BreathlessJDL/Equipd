#!/usr/bin/env node
/**
 * Promote due buyer-protection orders and attempt Stripe payout release.
 *
 * Usage (dry-run / SQL visibility only):
 *   node scripts/run-release-due-payouts.mjs
 *
 * Usage (full worker: promotion + already-ready release via Edge Function):
 *   node scripts/run-release-due-payouts.mjs --invoke-edge
 *
 * Requires .env.local with:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * For --invoke-edge also add CRON_SECRET to .env.local (must match the Supabase
 * Edge Function secret for stripe-release-due-payouts).
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
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeRpcJsonbArray(data) {
  if (Array.isArray(data)) return data
  if (data == null) return []
  return [data]
}

function printWorkerSummary(result) {
  const promoted = result?.promoted ?? []
  const readyEligible = result?.ready_eligible ?? []
  const releases = result?.releases ?? []
  const skipped = result?.skipped ?? []

  console.log(`Newly promoted: ${promoted.length}`)
  if (promoted.length > 0) {
    console.log(JSON.stringify(promoted, null, 2))
  }

  console.log(`Already-ready eligible: ${readyEligible.length}`)
  if (readyEligible.length > 0) {
    console.log(JSON.stringify(readyEligible, null, 2))
  }

  const released = releases.filter((entry) => entry.released)
  const failed = releases.filter((entry) => !entry.released)

  console.log(`Stripe releases succeeded: ${released.length}`)
  if (released.length > 0) {
    console.log(JSON.stringify(released, null, 2))
  }

  if (failed.length > 0) {
    console.log(`Stripe releases not completed: ${failed.length}`)
    console.log(JSON.stringify(failed, null, 2))
  }

  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.length}`)
    console.log(JSON.stringify(skipped, null, 2))
  }
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const invokeEdge = process.argv.includes('--invoke-edge')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  if (invokeEdge) {
    if (!cronSecret) {
      throw new Error(
        'CRON_SECRET is required when using --invoke-edge. Add it to .env.local (same value as the Supabase Edge Function secret).',
      )
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-release-due-payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(body.error ?? body.message ?? `Edge function failed (${response.status})`)
    }

    printWorkerSummary(body)
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [{ data: promotedRaw, error: promoteError }, { data: readyRaw, error: readyError }] =
    await Promise.all([
      admin.rpc('release_due_order_payouts'),
      admin.rpc('get_ready_orders_for_payout_release'),
    ])

  if (promoteError) {
    throw new Error(promoteError.message)
  }

  if (readyError) {
    if (readyError.message?.includes('get_ready_orders_for_payout_release')) {
      throw new Error(
        `${readyError.message}\nRun supabase/payout-release-ready-orders.sql (README step 54) first.`,
      )
    }
    throw new Error(readyError.message)
  }

  const promoted = normalizeRpcJsonbArray(promotedRaw)
  const readyEligible = normalizeRpcJsonbArray(readyRaw)

  console.log(`Newly promoted: ${promoted.length}`)
  console.log(JSON.stringify(promoted, null, 2))
  console.log(`Already-ready eligible: ${readyEligible.length}`)
  console.log(JSON.stringify(readyEligible, null, 2))

  const needsStripe =
    promoted.some((entry) => ['ready', 'failed'].includes(entry.payout_status)) ||
    readyEligible.length > 0

  if (needsStripe) {
    console.log(
      '\nOrders require Stripe transfer. Run the full worker with:\n  node scripts/run-release-due-payouts.mjs --invoke-edge',
    )
    console.log('Ensure CRON_SECRET is set in .env.local and stripe-release-due-payouts is deployed.')
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message)
  process.exit(1)
})
