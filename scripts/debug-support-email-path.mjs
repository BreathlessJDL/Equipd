#!/usr/bin/env node
/**
 * Debug support email database → edge function path.
 *
 * Usage: node scripts/debug-support-email-path.mjs
 *
 * Requires .env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env.local')

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('Missing .env.local')
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

function maskSecret(value) {
  if (!value) return '(missing)'
  if (value === 'YOUR_SECRET') return 'YOUR_SECRET (placeholder — emails skipped)'
  if (value.length <= 8) return `*** (len=${value.length})`
  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`
}

async function main() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('=== Support email path debug ===\n')
  console.log('Project:', url)

  // app_config via service role (bypasses RLS)
  const { data: configRows, error: configError } = await supabase
    .from('app_config')
    .select('key, value, updated_at')
    .in('key', ['support_email_functions_base_url', 'support_email_webhook_secret'])

  if (configError) {
    console.log('\n[app_config] ERROR:', configError.message)
    if (configError.message.includes('does not exist')) {
      console.log('  → Table missing. Run supabase/support-team-email-notifications.sql')
    }
  } else {
    console.log('\n[app_config] rows (service_role read):')
    const byKey = Object.fromEntries((configRows ?? []).map((r) => [r.key, r]))
    for (const key of ['support_email_functions_base_url', 'support_email_webhook_secret']) {
      const row = byKey[key]
      if (!row) {
        console.log(`  - ${key}: MISSING`)
        continue
      }
      const preview = key.includes('secret') ? maskSecret(row.value) : row.value
      console.log(`  - ${key}: ${preview}`)
      console.log(`    updated_at: ${row.updated_at}`)
    }

    const secret = byKey.support_email_webhook_secret?.value?.trim()
    const baseUrl = byKey.support_email_functions_base_url?.value?.trim()
    if (!baseUrl) console.log('\n  ⚠ base URL missing → notify_support_team_email exits early')
    if (!secret || secret === 'YOUR_SECRET') {
      console.log('\n  ⚠ webhook secret missing or still YOUR_SECRET → notify_support_team_email exits early')
    }
  }

  // Try invoking notify via RPC (may fail if not granted to service_role)
  console.log('\n[RPC] Attempting notify_support_team_email via PostgREST...')
  const { error: rpcError } = await supabase.rpc('notify_support_team_email', {
    p_event_type: 'support_request',
    p_metadata: {
      request_id: '00000000-0000-0000-0000-000000000001',
      order_id: '00000000-0000-0000-0000-000000000002',
      listing_title: 'Debug test from script',
      reason: 'debug',
      message: 'Manual path test — safe to ignore',
      opened_by_label: 'debug-script',
    },
  })

  if (rpcError) {
    console.log('  RPC error:', rpcError.message)
    if (rpcError.message.includes('Could not find the function')) {
      console.log('  → notify_support_team_email not in DB. Run support-team-email-notifications.sql')
    } else if (rpcError.message.includes('permission denied')) {
      console.log('  → Function exists but not granted to service_role (expected). Use SQL editor test below.')
    }
  } else {
    console.log('  RPC call accepted (pg_net queues async HTTP after commit).')
    console.log('  Check Edge Function logs and net._http_response in SQL editor within ~30s.')
  }

  // Direct edge function smoke test (does not use pg_net)
  const secret = configRows?.find((r) => r.key === 'support_email_webhook_secret')?.value?.trim()
  const baseUrl = configRows?.find((r) => r.key === 'support_email_functions_base_url')?.value?.trim()

  if (baseUrl && secret && secret !== 'YOUR_SECRET') {
    const edgeUrl = `${baseUrl.replace(/\/$/, '')}/send-support-email`
    console.log('\n[Edge] Direct POST to', edgeUrl)
    try {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-support-email-secret': secret,
        },
        body: JSON.stringify({
          eventType: 'support_request',
          metadata: {
            request_id: 'debug-direct',
            listing_title: 'Direct edge test',
            reason: 'debug',
            message: 'Direct fetch test — safe to ignore',
          },
        }),
      })
      const body = await res.text()
      console.log(`  Status: ${res.status}`)
      console.log(`  Body: ${body.slice(0, 200)}`)
      if (res.ok) {
        console.log('  → Edge function + Resend path works when called directly.')
      } else {
        console.log('  → Edge reachable but rejected/failed — check secrets and Resend.')
      }
    } catch (err) {
      console.log('  Fetch failed:', err.message)
    }
  } else {
    console.log('\n[Edge] Skipped direct test — app_config incomplete')
  }

  console.log('\n=== Run in Supabase SQL editor ===')
  console.log('See scripts/debug-support-email-path.sql for full DB diagnostics.')
  console.log('\nManual pg_net trigger:')
  console.log(`  select public.notify_support_team_email(`)
  console.log(`    'support_request',`)
  console.log(`    '{"listing_title":"SQL manual test","reason":"debug","message":"ignore"}'::jsonb`)
  console.log(`  );`)
  console.log('Then: select * from net._http_response order by created desc limit 5;')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
