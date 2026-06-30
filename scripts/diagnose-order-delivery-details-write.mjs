#!/usr/bin/env node
/**
 * Diagnose order_delivery_details write path on live/staging Supabase.
 * Usage: node scripts/diagnose-order-delivery-details-write.mjs [order_id]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const env = loadEnv()
const orderIdArg = process.argv[2]

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const { data: columns, error: columnsError } = await admin
    .from('order_delivery_details')
    .select('*')
    .limit(0)

  if (columnsError) {
    console.error('Table/columns check failed:', columnsError)
    process.exit(1)
  }

  console.log('order_delivery_details table reachable')

  let orderQuery = admin
    .from('orders')
    .select('id, buyer_id, seller_id, order_type, fulfilment_status, payment_id, collected_at, collection_confirmed_at')
    .eq('order_type', 'seller_delivery')
    .eq('fulfilment_status', 'awaiting_seller_delivery')
    .limit(5)

  if (orderIdArg) {
    orderQuery = admin
      .from('orders')
      .select('id, buyer_id, seller_id, order_type, fulfilment_status, payment_id, collected_at, collection_confirmed_at')
      .eq('id', orderIdArg)
      .limit(1)
  }

  const { data: orders, error: ordersError } = await orderQuery
  if (ordersError) {
    console.error('Orders query failed:', ordersError)
    process.exit(1)
  }

  console.log('Seller-delivery orders:', orders?.length ?? 0)
  for (const order of orders ?? []) {
    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', order.payment_id)
      .maybeSingle()

    const { data: existing } = await admin
      .from('order_delivery_details')
      .select('order_id')
      .eq('order_id', order.id)
      .maybeSingle()

    console.log({
      orderId: order.id,
      fulfilment_status: order.fulfilment_status,
      payment_status: payment?.status,
      hasDeliveryRow: Boolean(existing),
      buyer_id: order.buyer_id,
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
