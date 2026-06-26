#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

if (!existsSync(envPath)) {
  console.error('Missing .env.local')
  process.exit(1)
}

const env = {}
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const index = line.indexOf('=')
  if (index === -1) continue
  env[line.slice(0, index)] = line.slice(index + 1).replace(/^"|"$/g, '')
}

const orderId =
  process.argv.find((arg) => arg.startsWith('--order-id='))?.split('=')[1] ??
  '1e0c98c8-9d87-41e7-a244-10772a958f86'

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: order, error } = await admin
  .from('orders')
  .select(
    `
    id,
    fulfilment_status,
    protection_status,
    payout_status,
    payout_release_at,
    payout_released_at,
    stripe_transfer_id,
    seller_net_pence,
    buyer_confirmed_at,
    collected_at,
    updated_at,
    payment:payments(id, status, stripe_charge_id, stripe_payment_intent_id),
    seller:profiles!orders_seller_id_fkey(id, stripe_account_id, stripe_onboarding_complete),
    listing:listings(id, status, title)
  `,
  )
  .eq('id', orderId)
  .single()

if (error) {
  console.error(error)
  process.exit(1)
}

console.log('=== Order payout state ===')
console.log(JSON.stringify(order, null, 2))

const { data: disputes } = await admin
  .from('order_disputes')
  .select('id, status, created_at')
  .eq('order_id', orderId)

console.log('\n=== Disputes ===')
console.log(JSON.stringify(disputes ?? [], null, 2))

const { data: promoteResult } = await admin.rpc('release_due_order_payouts')
console.log('\n=== release_due_order_payouts() now ===')
console.log(JSON.stringify(promoteResult, null, 2))

const { data: readyRaw, error: readyError } = await admin.rpc(
  'get_ready_orders_for_payout_release',
)

console.log('\n=== get_ready_orders_for_payout_release() ===')
console.log(JSON.stringify(readyRaw ?? [], null, 2))
if (readyError) console.error('ready RPC error:', readyError.message)

const { data: readyOrders } = await admin
  .from('orders')
  .select('id, payout_status, payout_release_at, stripe_transfer_id, updated_at')
  .eq('payout_status', 'ready')
  .is('stripe_transfer_id', null)
  .is('payout_released_at', null)

console.log('\n=== All orders stuck at ready (no transfer) ===')
console.log(JSON.stringify(readyOrders ?? [], null, 2))
