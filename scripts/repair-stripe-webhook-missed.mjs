#!/usr/bin/env node
/**
 * Repair stuck payment + seller onboarding when Stripe webhooks were not delivered.
 * Uses same RPCs as stripe-webhook edge function.
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

const paymentId = '282cbde9-d646-4fa4-a4ad-b72e8e5ac00d'
const sellerId = '58ec12d8-80eb-4c97-8ec3-e2f35c1c644d'
const stripeAccountId = 'acct_1Tnnq3CWIlEYTp4R'
const sessionId = 'cs_test_b1H7cMxva4dVDUu6yhaoqbzhOltdE4MrIf13ZCkFkGfwZHCQEPgK3ieXNA'
const paymentIntentId = 'pi_3TnnwICzQs0ntJKP0CrYyQmn'

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('=== mark_payment_captured (webhook replay) ===')
const { data: payment, error: captureError } = await admin.rpc('mark_payment_captured', {
  p_payment_id: paymentId,
  p_stripe_checkout_session_id: sessionId,
  p_stripe_payment_intent_id: paymentIntentId,
  p_stripe_charge_id: null,
})
console.log(captureError?.message ?? payment)

console.log('\n=== sync_seller_stripe_onboarding ===')
const { data: profile, error: syncError } = await admin.rpc('sync_seller_stripe_onboarding', {
  p_seller_id: sellerId,
  p_stripe_account_id: stripeAccountId,
  p_onboarding_complete: true,
})
console.log(syncError?.message ?? {
  id: profile?.id,
  stripe_account_id: profile?.stripe_account_id,
  stripe_onboarding_complete: profile?.stripe_onboarding_complete,
})

const { data: order } = await admin
  .from('orders')
  .select('id, fulfilment_status, payout_status')
  .eq('payment_id', paymentId)
  .single()
console.log('\n=== order after repair ===')
console.log(order)
