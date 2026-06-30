#!/usr/bin/env node
/**
 * Live diagnostics for order_delivery_details write failures.
 * Usage: node scripts/diagnose-order-delivery-details-live.mjs [order_id]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ORDER_ID = process.argv[2] ?? '2bac67ec-398a-473e-82b8-3388b4f6e571'

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
const baseUrl = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = env.VITE_SUPABASE_ANON_KEY

const admin = createClient(baseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function rpc(name, params) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(params),
  })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body }
}

async function sqlCheck(name, query) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/diag_order_delivery_details_check`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_query: query }),
  }).catch(() => null)

  if (!res) {
    return { name, skipped: true, reason: 'diag RPC not installed' }
  }

  const text = await res.text()
  return { name, status: res.status, body: text }
}

async function main() {
  console.log('=== order_delivery_details live diagnostics ===')
  console.log('order_id:', ORDER_ID)

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(
      'id, buyer_id, seller_id, order_type, fulfilment_status, payment_id, collected_at, collection_confirmed_at',
    )
    .eq('id', ORDER_ID)
    .maybeSingle()

  if (orderError) {
    console.error('Order read failed:', orderError)
    process.exit(1)
  }

  console.log('\n--- order ---')
  console.log(order)

  const { data: payment } = await admin
    .from('payments')
    .select('id, status')
    .eq('id', order.payment_id)
    .maybeSingle()

  console.log('\n--- payment ---')
  console.log(payment)

  const writable = await rpc('is_seller_delivery_order_writable', { p_order_id: ORDER_ID })
  console.log('\n--- rpc is_seller_delivery_order_writable ---')
  console.log(writable)

  const buyerOwns = await rpc('order_delivery_details_buyer_owns_order', {
    p_order_id: ORDER_ID,
    p_user_id: order.buyer_id,
  })
  console.log('\n--- rpc order_delivery_details_buyer_owns_order (as buyer_id) ---')
  console.log(buyerOwns)

  const { data: existing } = await admin
    .from('order_delivery_details')
    .select('*')
    .eq('order_id', ORDER_ID)
    .maybeSingle()

  console.log('\n--- existing delivery row ---')
  console.log(existing ?? null)

  const { data: buyerUser, error: buyerUserError } = await admin.auth.admin.getUserById(
    order.buyer_id,
  )
  console.log('\n--- buyer auth user ---')
  if (buyerUserError) {
    console.error(buyerUserError)
  } else {
    console.log({ id: buyerUser.user.id, email: buyerUser.user.email })
  }

  if (buyerUser?.user?.email) {
    const buyerClient = createClient(baseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: buyerUser.user.email,
    })

    if (linkError) {
      console.log('\n--- buyer impersonation skipped ---')
      console.log(linkError.message)
    } else {
      const otp = linkData.properties?.email_otp
      if (otp) {
        const { data: sessionData, error: otpError } = await buyerClient.auth.verifyOtp({
          email: buyerUser.user.email,
          token: otp,
          type: 'email',
        })

        if (otpError) {
          console.log('\n--- buyer OTP verify failed ---')
          console.log(otpError)
        } else {
          console.log('\n--- buyer session established ---')
          const payload = {
            order_id: ORDER_ID,
            buyer_delivery_address: '1 Diagnostic Street, Test Town TE1 1ST',
            delivery_contact_name: 'Diag Buyer',
            delivery_contact_phone: '07700900999',
            delivery_notes: 'Diagnostic insert test',
          }

          const insertAttempt = await buyerClient
            .from('order_delivery_details')
            .insert(payload)
            .select(
              'order_id, buyer_delivery_address, delivery_contact_name, delivery_contact_phone, delivery_notes, delivery_details_submitted_at, created_at, updated_at',
            )
            .single()

          console.log('\n--- buyer INSERT attempt (exact Supabase error) ---')
          if (insertAttempt.error) {
            console.log({
              message: insertAttempt.error.message,
              code: insertAttempt.error.code,
              details: insertAttempt.error.details,
              hint: insertAttempt.error.hint,
            })
          } else {
            console.log('INSERT succeeded:', insertAttempt.data)
            await buyerClient.from('order_delivery_details').delete().eq('order_id', ORDER_ID)
            console.log('Cleaned up diagnostic row')
          }

          const updateAttempt = await buyerClient
            .from('order_delivery_details')
            .update({
              buyer_delivery_address: '2 Updated Street',
              delivery_contact_name: 'Diag Buyer',
              delivery_contact_phone: '07700900999',
            })
            .eq('order_id', ORDER_ID)
            .select('order_id, buyer_delivery_address')
            .single()

          if (!insertAttempt.error && existing) {
            console.log('\n--- buyer UPDATE attempt ---')
            console.log(
              updateAttempt.error
                ? {
                    message: updateAttempt.error.message,
                    code: updateAttempt.error.code,
                    details: updateAttempt.error.details,
                    hint: updateAttempt.error.hint,
                  }
                : updateAttempt.data,
            )
          }
        }
      }
    }
  }

  console.log('\n--- trigger metadata (requires diag SQL in Supabase) ---')
  console.log(
    'Run supabase/order-delivery-details-diag.sql in SQL editor if trigger security is unknown.',
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
