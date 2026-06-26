#!/usr/bin/env node
/**
 * Debug browse path exactly as the frontend Supabase client would call it.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, anonKey)

const LISTING_IMAGES_BUCKET = 'listing-images'
const DEFAULT_LISTINGS_PAGE_SIZE = 24

const CARD_LISTING_FIELDS_LEGACY =
  'id, slug, title, brand, model, price_pence, condition, location, latitude, longitude, status, seller_id, rating, collection_available, courier_available, created_at, updated_at'
const CARD_LISTING_FIELDS = `${CARD_LISTING_FIELDS_LEGACY}, location_name, city, county, postcode`
const CARD_LISTING_IMAGE_FIELDS = 'listing_images(id, storage_path, sort_order)'

function getListingImagePublicUrl(storagePath) {
  if (!supabase || !storagePath) return null
  const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

function enrichListingWithImages(listing) {
  const listingImages = [...(listing.listing_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      ...image,
      url: getListingImagePublicUrl(image.storage_path),
    }))
  return {
    ...listing,
    listing_images: listingImages,
    primary_image_url: listingImages[0]?.url ?? null,
  }
}

function withPrimaryListingImageOnly(query) {
  return query
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(1, { foreignTable: 'listing_images' })
}

async function supportsStructuredListingLocation() {
  const { error } = await supabase.from('listings').select('location_name, city, county, postcode').limit(0)
  return !error
}

async function fetchActiveListingsDirect({ limit = DEFAULT_LISTINGS_PAGE_SIZE } = {}) {
  const structuredLocation = await supportsStructuredListingLocation()
  const cardFields = structuredLocation ? CARD_LISTING_FIELDS : CARD_LISTING_FIELDS_LEGACY

  let query = withPrimaryListingImageOnly(
    supabase
      .from('listings_public_browse')
      .select(`${cardFields}, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit),
  )

  const { data, error } = await query
  return { data, error }
}

function mapDistanceSearchListing(row) {
  const listing = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    listing_images: row.primary_image_storage_path
      ? [{ storage_path: row.primary_image_storage_path, sort_order: 0 }]
      : [],
  }
  return enrichListingWithImages(listing)
}

async function main() {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Anon key prefix:', anonKey.slice(0, 20) + '...')

  const { data: raw, error } = await fetchActiveListingsDirect()
  if (error) {
    console.error('Direct fetch error:', error)
    process.exit(1)
  }

  const before = raw?.[0] ?? null
  const after = (raw ?? []).map(enrichListingWithImages)
  const firstAfter = after[0] ?? null

  console.log('\n=== DIRECT PATH (fetchActiveListingsDirect) ===')
  console.log('row count:', raw?.length ?? 0)
  console.log('\nFirst listing BEFORE mapping:')
  console.log(JSON.stringify(before, null, 2))
  console.log('\nFirst listing AFTER mapping:')
  console.log(JSON.stringify(firstAfter, null, 2))

  const withImages = after.filter((l) => l.primary_image_url)
  console.log(`\nWith primary_image_url: ${withImages.length}/${after.length}`)

  // RPC path (typical logged-in user with profile location)
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_listings_with_distance', {
    p_buyer_lat: 53.8,
    p_buyer_lng: -1.55,
    p_radius_miles: null,
    p_search: null,
    p_category_id: null,
    p_condition: null,
    p_brand: null,
    p_rating: null,
    p_min_price_pence: null,
    p_max_price_pence: null,
    p_location_areas: null,
    p_sort: 'newest',
    p_limit: 24,
  })

  console.log('\n=== RPC PATH (search_listings_with_distance) ===')
  console.log('rpc error:', rpcError?.message ?? null)
  const rpcRaw = rpcData?.[0] ?? null
  const rpcMapped = rpcData?.[0] ? mapDistanceSearchListing(rpcData[0]) : null
  console.log('\nFirst RPC row BEFORE mapping:')
  console.log(JSON.stringify(rpcRaw, null, 2))
  console.log('\nFirst RPC row AFTER mapping:')
  console.log(JSON.stringify(rpcMapped, null, 2))

  // Raw REST URL shape (what Network tab shows)
  const select = encodeURIComponent(
    `${CARD_LISTING_FIELDS},category:categories(id,name,slug),${CARD_LISTING_IMAGE_FIELDS}`,
  )
  const restUrl = `${supabaseUrl}/rest/v1/listings?select=${select}&status=eq.active&order=created_at.desc&limit=1`
  const restRes = await fetch(restUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
  })
  const restJson = await restRes.json()
  console.log('\n=== RAW REST (first row only, limit=1) ===')
  console.log('status:', restRes.status)
  console.log(JSON.stringify(Array.isArray(restJson) ? restJson[0] : restJson, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
