#!/usr/bin/env node
/**
 * Inspect fulfilment data for a listing by title.
 * Usage: node scripts/debug-listing-fulfilment.mjs "Matrix Climbmill Old Console"
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const titleQuery = process.argv[2] ?? 'Matrix Climbmill Old Console'

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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const { data: listings, error: listingError } = await supabase
  .from('listings')
  .select('*')
  .ilike('title', `%${titleQuery}%`)
  .limit(5)

if (listingError) throw listingError

console.log(`Listings matching "${titleQuery}":`, listings?.length ?? 0)

for (const listing of listings ?? []) {
  console.log('\n--- Listing ---')
  console.log({
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    status: listing.status,
    collection_available: listing.collection_available,
    courier_available: listing.courier_available,
    delivery_notes: listing.delivery_notes,
    seller_delivery_radius_miles: listing.seller_delivery_radius_miles,
    latitude: listing.latitude,
    longitude: listing.longitude,
  })

  const { data: privateRow } = await supabase
    .from('listing_fulfilment_private')
    .select('*')
    .eq('listing_id', listing.id)
    .maybeSingle()

  console.log('listing_fulfilment_private:', privateRow ?? null)

  const { data: orderTypes } = await supabase.rpc('get_listing_order_types', {
    p_listing_id: listing.id,
  })
  console.log('get_listing_order_types:', orderTypes)

  const { data: radiusRpc } = await supabase.rpc('listing_seller_delivery_radius_miles', {
    p_listing_id: listing.id,
  })
  console.log('listing_seller_delivery_radius_miles:', radiusRpc)

  const { data: offers } = await supabase
    .from('offers')
    .select('id, status, buyer_id, amount_pence, created_at, updated_at')
    .eq('listing_id', listing.id)
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })
    .limit(3)

  console.log('accepted offers:', offers)

  for (const offer of offers ?? []) {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, buyer_id, expires_at')
      .eq('offer_id', offer.id)
      .maybeSingle()

    const { data: order } = payment
      ? await supabase.from('orders').select('*').eq('payment_id', payment.id).maybeSingle()
      : { data: null }

    console.log('offer payment/order:', {
      offer_id: offer.id,
      payment,
      order_type: order?.order_type ?? null,
      fulfilment_status: order?.fulfilment_status ?? null,
    })

    if (payment?.buyer_id) {
      const { data: allows } = await supabase.rpc('listing_allows_order_type', {
        p_listing_id: listing.id,
        p_order_type: 'seller_delivery',
        p_buyer_id: payment.buyer_id,
      })
      const { data: buyerCan } = await supabase.rpc('buyer_can_select_seller_delivery', {
        p_listing_id: listing.id,
        p_buyer_id: payment.buyer_id,
      })
      console.log('listing_allows_order_type(seller_delivery):', allows)
      console.log('buyer_can_select_seller_delivery:', buyerCan)

      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('id, latitude, longitude, city, location')
        .eq('id', payment.buyer_id)
        .maybeSingle()
      console.log('buyer profile coords:', buyerProfile)
    }
  }
}
