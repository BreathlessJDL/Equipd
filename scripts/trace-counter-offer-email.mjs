#!/usr/bin/env node
/**
 * Trace counter-offer email pipeline against live Supabase.
 * Run: node scripts/trace-counter-offer-email.mjs
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookSecret = process.env.MARKETPLACE_EMAIL_WEBHOOK_SECRET

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

function section(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`)
}

async function sqlQuery(label, query) {
  const { data, error } = await admin.rpc('exec_sql_readonly', { query_text: query })
  if (error?.message?.includes('Could not find the function')) {
    return { skip: true, label }
  }
  if (error) {
    console.log(`[${label}] ERROR: ${error.message}`)
    return { error: error.message }
  }
  console.log(`[${label}]`, JSON.stringify(data, null, 2))
  return { data }
}

async function main() {
  section('CHECK 1 — Recent counter offers (offers with parent_offer_id)')
  const { data: counterOffers, error: offersErr } = await admin
    .from('offers')
    .select('id, parent_offer_id, direction, status, amount_pence, created_at, buyer_id, seller_id')
    .not('parent_offer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (offersErr) {
    console.log('ERROR:', offersErr.message)
  } else if (!counterOffers?.length) {
    console.log('No counter offers found in offers table.')
  } else {
    console.table(counterOffers)
  }

  section('CHECK 2 — transactional_email_log for counter_offer_received')
  const { data: emailLogs, error: logErr } = await admin
    .from('transactional_email_log')
    .select('id, template_key, status, error_message, idempotency_key, related_offer_id, created_at, sent_at')
    .eq('template_key', 'counter_offer_received')
    .order('created_at', { ascending: false })
    .limit(10)

  if (logErr) {
    console.log('ERROR:', logErr.message)
  } else if (!emailLogs?.length) {
    console.log('❌ No counter_offer_received rows in transactional_email_log')
  } else {
    console.table(emailLogs)
  }

  section('CHECK 3 — app_config email webhook settings')
  const { data: configRows } = await admin
    .from('app_config')
    .select('key, value')
    .in('key', ['support_email_functions_base_url', 'marketplace_email_webhook_secret'])

  for (const row of configRows ?? []) {
    const masked =
      row.key.includes('secret') && row.value
        ? `${row.value.slice(0, 4)}…${row.value.slice(-4)} (len=${row.value.length})`
        : row.value
    console.log(`${row.key}: ${masked}`)
    if (row.key === 'support_email_functions_base_url' && row.value) {
      const webhookUrl = `${row.value.replace(/\/+$/, '')}/send-marketplace-email`
      console.log(`  → resolved webhook URL: ${webhookUrl}`)
    }
    if (row.key === 'marketplace_email_webhook_secret') {
      if (!row.value || row.value.includes('YOUR_')) {
        console.log('  ❌ placeholder or missing secret')
      }
      if (webhookSecret && row.value !== webhookSecret) {
        console.log('  ⚠ DB secret does NOT match MARKETPLACE_EMAIL_WEBHOOK_SECRET in .env.local')
      } else if (webhookSecret) {
        console.log('  ✅ matches MARKETPLACE_EMAIL_WEBHOOK_SECRET in .env.local')
      }
    }
  }

  section('CHECK 4 — Direct edge function invoke (latest counter offer)')
  const latestCounter = counterOffers?.[0]
  if (!latestCounter) {
    console.log('Skip: no counter offer to test')
  } else if (!webhookSecret) {
    console.log('Skip: MARKETPLACE_EMAIL_WEBHOOK_SECRET not in .env.local')
  } else {
    const functionsUrl = `${url}/functions/v1/send-marketplace-email`
    console.log(`POST ${functionsUrl}`)
    console.log(`payload: { eventKey: counter_offer_received, offerId: ${latestCounter.id} }`)

    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-marketplace-email-secret': webhookSecret,
      },
      body: JSON.stringify({
        eventKey: 'counter_offer_received',
        payload: { offerId: latestCounter.id },
      }),
    })

    const bodyText = await response.text()
    console.log(`HTTP ${response.status}`)
    try {
      console.log(JSON.stringify(JSON.parse(bodyText), null, 2))
    } catch {
      console.log(bodyText)
    }

    const { data: afterLog } = await admin
      .from('transactional_email_log')
      .select('id, status, error_message, idempotency_key, sent_at')
      .eq('template_key', 'counter_offer_received')
      .eq('related_offer_id', latestCounter.id)
      .order('created_at', { ascending: false })
      .limit(3)

    console.log('Log rows for this offer after invoke:', afterLog ?? [])
  }

  section('CHECK 5 — pg_net HTTP responses (if accessible)')
  const { data: netRows, error: netErr } = await admin
    .from('net._http_response')
    .select('id, status_code, error_msg, created, content')
    .order('created', { ascending: false })
    .limit(5)

  if (netErr) {
    console.log('Cannot read net._http_response:', netErr.message)
    console.log('(Expected — table may be restricted; check Supabase Database → Extensions → pg_net logs)')
  } else {
    console.table(
      (netRows ?? []).map((r) => ({
        id: r.id,
        status_code: r.status_code,
        error_msg: r.error_msg,
        created: r.created,
        content_preview: String(r.content ?? '').slice(0, 200),
      })),
    )
  }

  section('CHECK 6 — Trigger/function via information_schema (SQL)')
  const triggerQuery = `
    select tgname, pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'offers' and not t.tgisinternal
    order by tgname;
  `
  await sqlQuery('offer_triggers', triggerQuery)

  const notifyFnQuery = `
    select pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_marketplace_email'
    limit 1;
  `
  await sqlQuery('notify_marketplace_email', notifyFnQuery)

  const counterTriggerFnQuery = `
    select pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_counter_offer_received_email'
    limit 1;
  `
  await sqlQuery('notify_counter_offer_received_email', counterTriggerFnQuery)

  section('SUMMARY')
  if (!emailLogs?.length && latestCounter) {
    console.log('Failure likely BEFORE edge function (no transactional_email_log row).')
    console.log('→ Check: trigger offers_email_counter_offer_received installed')
    console.log('→ Check: notify_marketplace_email allowlist includes counter_offer_received')
    console.log('→ Check: pg_net webhook URL/auth')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
