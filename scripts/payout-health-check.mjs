#!/usr/bin/env node
/**
 * Payout automation health check (read-only).
 *
 * Usage:
 *   node scripts/payout-health-check.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Run supabase/payout-release-ready-orders.sql (step 54) before using ready_eligible RPC.
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

async function countOrders(admin, filters) {
  let query = admin.from('orders').select('id', { count: 'exact', head: true })

  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      query = query.is(key, null)
    } else if (typeof value === 'object' && value.gte) {
      query = query.gte(key, value.gte)
    } else if (Array.isArray(value)) {
      query = query.in(key, value)
    } else {
      query = query.eq(key, value)
    }
  }

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    readyEligibleResult,
    readyStuckCount,
    failedCount,
    awaitingSetupCount,
    paidLast24hCount,
    processingCount,
  ] = await Promise.all([
    admin.rpc('get_ready_orders_for_payout_release'),
    countOrders(admin, {
      payout_status: 'ready',
      stripe_transfer_id: null,
      payout_released_at: null,
    }),
    countOrders(admin, { payout_status: 'failed' }),
    countOrders(admin, { payout_status: 'awaiting_seller_setup' }),
    countOrders(admin, {
      payout_status: 'paid',
      payout_released_at: { gte: since24h },
    }),
    countOrders(admin, { payout_status: 'processing' }),
  ])

  let readyEligible = []
  let readyEligibleError = null

  if (readyEligibleResult.error) {
    readyEligibleError = readyEligibleResult.error.message
  } else {
    readyEligible = normalizeRpcJsonbArray(readyEligibleResult.data)
  }

  const report = {
    checked_at: new Date().toISOString(),
    ready_eligible_for_worker: readyEligible.length,
    ready_eligible_order_ids: readyEligible.map((entry) => entry.order_id),
    ready_stuck_no_transfer: readyStuckCount,
    failed_payouts: failedCount,
    awaiting_seller_setup: awaitingSetupCount,
    processing_in_flight: processingCount,
    paid_last_24h: paidLast24hCount,
    ready_eligible_rpc_error: readyEligibleError,
  }

  console.log(JSON.stringify(report, null, 2))

  if (readyEligibleError) {
    console.log(
      '\nNote: ready_eligible RPC unavailable. Run supabase/payout-release-ready-orders.sql (README step 54).',
    )
  }

  if (readyEligible.length > 0 || failedCount > 0) {
    console.log(
      '\nAction: ensure stripe-release-due-payouts is scheduled every 15 minutes, or run:',
    )
    console.log('  node scripts/run-release-due-payouts.mjs --invoke-edge')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message)
  process.exit(1)
})
