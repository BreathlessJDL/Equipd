#!/usr/bin/env node
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

const paymentId = process.argv[2] ?? '282cbde9-d646-4fa4-a4ad-b72e8e5ac00d'
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).single()
const { data: order } = await admin.from('orders').select('*').eq('payment_id', paymentId).maybeSingle()

console.log('payment', payment)
console.log('order', order)

if (payment?.stripe_checkout_session_id) {
  const sessionId = payment.stripe_checkout_session_id
  console.log('\nCheckout session mode from ID prefix:', sessionId.startsWith('cs_test_') ? 'TEST' : sessionId.startsWith('cs_live_') ? 'LIVE' : 'unknown')
}

if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  console.log('\nSTRIPE_SECRET_KEY prefix:', process.env.STRIPE_SECRET_KEY.slice(0, 8) + '...')

  if (payment?.stripe_checkout_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id)
      console.log('Stripe session:', {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        metadata: session.metadata,
      })
    } catch (e) {
      console.log('Could not retrieve session with local STRIPE_SECRET_KEY:', e.message)
    }
  }

  if (process.argv.includes('--check-account')) {
    const accountId = process.argv[process.argv.indexOf('--check-account') + 1]
    if (accountId) {
      const account = await stripe.accounts.retrieve(accountId)
      console.log('Connect account:', {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
      })
    }
  }
} else {
  console.log('\nSet STRIPE_SECRET_KEY in env to retrieve Stripe session status.')
}
