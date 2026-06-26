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

const orderId = process.argv.find((arg) => arg.startsWith('--order-id='))?.split('=')[1]
const shouldRepair = process.argv.includes('--repair-stuck')

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

if (shouldRepair) {
  const { data: stuck, error: stuckError } = await admin
    .from('orders')
    .select('id, fulfilment_status, protection_status, payout_status, payout_release_at, buyer_confirmed_at, collected_at, delivered_at, updated_at')
    .eq('protection_status', 'active')
    .eq('fulfilment_status', 'buyer_confirmed')
    .in('payout_status', ['ready', 'awaiting_seller_setup', 'processing', 'failed'])

  if (stuckError) {
    console.error(stuckError)
    process.exit(1)
  }

  for (const order of stuck ?? []) {
    const completedAt =
      order.buyer_confirmed_at ?? order.collected_at ?? order.delivered_at ?? order.updated_at

    const { data, error } = await admin
      .from('orders')
      .update({
        fulfilment_status: 'completed',
        protection_status: 'released',
        buyer_confirmed_at: completedAt,
        payout_release_at: order.payout_release_at ?? completedAt,
      })
      .eq('id', order.id)
      .select('id, fulfilment_status, protection_status, payout_status, payout_release_at, buyer_confirmed_at')
      .single()

    if (error) {
      console.error('repair failed', order.id, error)
      continue
    }

    console.log('repaired', data)
  }

  process.exit(0)
}

let query = admin
  .from('orders')
  .select(
    'id, fulfilment_status, protection_status, payout_status, payout_release_at, buyer_confirmed_at, collected_at, updated_at',
  )
  .order('updated_at', { ascending: false })
  .limit(orderId ? 1 : 10)

if (orderId) {
  query = query.eq('id', orderId)
}

const { data, error } = await query

if (error) {
  console.error(error)
  process.exit(1)
}

console.log(JSON.stringify(data, null, 2))
