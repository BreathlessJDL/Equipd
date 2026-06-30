#!/usr/bin/env node
/**
 * Diagnose production Stripe webhook / stuck payments / onboarding.
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

const projectRef = 'mhwvzovxlqimcuxvyyjf'
const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/stripe-webhook`

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('=== Webhook gateway probe (no JWT) ===')
const probe = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
console.log({ status: probe.status, body: await probe.text() })

console.log('\n=== Stuck pending payments (recent) ===')
const { data: pendingPayments, error: payErr } = await admin
  .from('payments')
  .select('id, status, stripe_checkout_session_id, created_at, updated_at, buyer_id, seller_id, offer_id, listing_id')
  .eq('status', 'pending')
  .order('updated_at', { ascending: false })
  .limit(10)
console.log(payErr?.message ?? pendingPayments)

console.log('\n=== Recent paid-in-Stripe candidates (has checkout session, still pending) ===')
const { data: withSession } = await admin
  .from('payments')
  .select('id, status, stripe_checkout_session_id, created_at, updated_at')
  .not('stripe_checkout_session_id', 'is', null)
  .eq('status', 'pending')
  .order('updated_at', { ascending: false })
  .limit(10)
console.log(withSession)

console.log('\n=== Orders pending_payment (recent) ===')
const { data: pendingOrders } = await admin
  .from('orders')
  .select('id, payment_id, payment_status, fulfilment_status, created_at, updated_at, buyer_id, seller_id')
  .eq('payment_status', 'pending_payment')
  .order('updated_at', { ascending: false })
  .limit(10)
console.log(pendingOrders)

console.log('\n=== Sellers with Stripe account but onboarding incomplete ===')
const { data: incompleteOnboarding } = await admin
  .from('profiles')
  .select('id, username, display_name, stripe_account_id, stripe_onboarding_complete, updated_at')
  .not('stripe_account_id', 'is', null)
  .eq('stripe_onboarding_complete', false)
  .order('updated_at', { ascending: false })
  .limit(10)
console.log(incompleteOnboarding)

console.log('\n=== Recent payments marked paid ===')
const { data: paidPayments } = await admin
  .from('payments')
  .select('id, status, stripe_checkout_session_id, paid_at, updated_at')
  .eq('status', 'paid')
  .order('paid_at', { ascending: false })
  .limit(5)
console.log(paidPayments)
