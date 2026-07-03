#!/usr/bin/env node
/**
 * Verify production deployment security + email configuration.
 * Run: node scripts/verify-production-deployment.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(filename) {
  const filePath = join(ROOT, filename)
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
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
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } })
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const results = []

function record(status, area, detail) {
  results.push({ status, area, detail })
  const icon = status === 'applied' ? '✅' : status === 'needs_deployment' ? '⚠' : '❌'
  console.log(`${icon} [${area}] ${detail}`)
}

async function main() {
  // Profiles: anon must not read sensitive columns from profiles table
  const { data: profileRow, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (profileRow?.id) {
    const { data: anonProfile, error: anonProfileErr } = await anon
      .from('profiles')
      .select('id,stripe_account_id,is_admin,latitude,longitude')
      .eq('id', profileRow.id)
      .maybeSingle()

    if (anonProfileErr?.message?.includes('permission denied')) {
      record('applied', 'profiles', 'Direct profiles SELECT blocked for anon')
    } else if (!anonProfile && !anonProfileErr) {
      record('applied', 'profiles', 'Anon direct profiles read returns no sensitive row (RLS)')
    } else if (anonProfile?.stripe_account_id || anonProfile?.is_admin != null) {
      record('missing', 'profiles', 'Anon can read sensitive profile fields — apply 20260703150000')
    } else {
      record('applied', 'profiles', 'Anon profiles read safe')
    }
  }

  // Orders: direct SELECT must be denied
  const { error: ordersErr } = await anon.from('orders').select('id,collection_qr_token').limit(1)
  if (ordersErr?.message?.includes('permission denied')) {
    record('applied', 'orders', 'Direct orders SELECT revoked for API roles')
  } else {
    record('missing', 'orders', 'orders table still readable — apply 20260703150000')
  }

  // orders_client must work for authenticated (smoke only if we had a session)
  const { error: clientViewErr } = await anon.from('orders_client').select('id').limit(1)
  if (clientViewErr?.message?.includes('permission denied') || clientViewErr?.code === '42501') {
    record('applied', 'orders_client', 'View exists; anon denied as expected')
  } else if (!clientViewErr) {
    record('applied', 'orders_client', 'orders_client view queryable (RLS on view)')
  } else {
    record('needs_deployment', 'orders_client', clientViewErr.message)
  }

  // Dev bypass flag
  const { data: bypassRow } = await admin
    .from('app_config')
    .select('value')
    .eq('key', 'dev_handover_bypass_enabled')
    .maybeSingle()

  if (!bypassRow) {
    record('applied', 'dev_bypass', 'dev_handover_bypass_enabled not set (defaults safe)')
  } else if (String(bypassRow.value).toLowerCase() === 'true') {
    record('needs_deployment', 'dev_bypass', 'dev_handover_bypass_enabled=true — apply 20260703160000')
  } else {
    record('applied', 'dev_bypass', 'dev_handover_bypass_enabled is false')
  }

  // Email app_config
  for (const key of ['support_email_functions_base_url', 'marketplace_email_webhook_secret']) {
    const { data: row } = await admin.from('app_config').select('value').eq('key', key).maybeSingle()
    if (!row?.value || row.value.includes('YOUR_')) {
      record('missing', 'email_config', `${key} not configured in app_config`)
    } else if (key === 'support_email_functions_base_url' && !row.value.includes('/functions/v1')) {
      record('needs_deployment', 'email_config', `${key} should end with /functions/v1`)
    } else {
      record('applied', 'email_config', `${key} configured`)
    }
  }

  // notify_marketplace_email webhook path (manual verify after db push)
  record(
    'needs_deployment',
    'notify_marketplace_email',
    'After db push, confirm function uses rtrim(base_url) || \'/send-marketplace-email\' and x-marketplace-email-secret header (20260703140000)',
  )

  // create_notification must not be callable by authenticated
  const { error: notifErr } = await anon.rpc('create_notification', {
    p_user_id: '00000000-0000-0000-0000-000000000001',
    p_type: 'system',
    p_title: 'verify',
    p_body: 'verify',
    p_link_url: null,
  })
  if (notifErr?.message?.includes('permission denied')) {
    record('applied', 'create_notification', 'Blocked for anon')
  } else {
    record('missing', 'create_notification', `Unexpected: ${notifErr?.message ?? 'allowed'}`)
  }

  // Email triggers existence (offers)
  const triggerChecks = [
    'offers_email_offer_received',
    'offers_email_offer_accepted',
    'offers_email_counter_offer_received',
  ]
  for (const triggerName of triggerChecks) {
    record('needs_deployment', 'email_triggers', `Confirm trigger ${triggerName} exists after db push`)
  }

  console.log('\n--- Summary ---')
  const counts = { applied: 0, needs_deployment: 0, missing: 0 }
  for (const r of results) counts[r.status]++
  console.log(`✅ Applied checks: ${counts.applied}`)
  console.log(`⚠ Needs deployment / manual verify: ${counts.needs_deployment}`)
  console.log(`❌ Missing / failed: ${counts.missing}`)

  if (counts.missing > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
