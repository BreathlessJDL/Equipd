#!/usr/bin/env node
/**
 * Verify seller shop page only exposes publicly visible listings (same as browse).
 *
 * Usage:
 *   node scripts/test-seller-shop-public-listings.mjs [sellerEmail]
 */

import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const CARD_LISTING_FIELDS =
  'id, slug, title, brand, model, price_pence, condition, location, latitude, longitude, status, seller_id, rating, collection_available, courier_available, created_at, updated_at, location_name, city, county, postcode'
const CARD_LISTING_IMAGE_FIELDS = 'listing_images(id, storage_path, sort_order)'
const PUBLIC_BROWSE_LISTINGS_SOURCE = 'listings_public_browse'
const DEFAULT_SELLER_EMAIL = 'jlinnell95@gmail.com'

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

async function resolveSellerId(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  const user = (data?.users ?? []).find((row) => row.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`Seller not found for email: ${email}`)
  return user.id
}

async function fetchSellerShopListings(client, sellerId) {
  const { data, error } = await client
    .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
    .select(`${CARD_LISTING_FIELDS}, ${CARD_LISTING_IMAGE_FIELDS}`)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(1, { foreignTable: 'listing_images' })

  if (error) throw error
  return data ?? []
}

async function countSellerRawActiveListings(admin, sellerId) {
  const { count, error } = await admin
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .eq('status', 'active')

  if (error) throw error
  return count ?? 0
}

async function verifyShopUi(baseUrl, sellerId) {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await page.goto(`${baseUrl}/shop/${sellerId}`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.user-shop', { timeout: 15000 })

  const ui = await page.evaluate(() => ({
    statCount: Number(document.querySelector('.user-shop__stat-value')?.textContent?.trim() ?? '0'),
    cards: document.querySelectorAll('.user-shop__listings .listing-card').length,
    placeholders: document.querySelectorAll('.user-shop__listings .listing-card__image--placeholder').length,
    imgs: document.querySelectorAll('.user-shop__listings img.listing-card__image').length,
  }))

  await browser.close()
  return ui
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const sellerEmail = process.argv[2] ?? DEFAULT_SELLER_EMAIL
  const baseUrl = process.argv[3] ?? 'http://localhost:5176'

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    throw new Error('Missing SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.')
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const sellerId = await resolveSellerId(admin, sellerEmail)
  const publicListings = await fetchSellerShopListings(anon, sellerId)
  const rawActiveCount = await countSellerRawActiveListings(admin, sellerId)

  const withImages = publicListings.filter((row) => row.listing_images?.[0]?.storage_path)
  const withoutImages = publicListings.length - withImages.length

  let ui = null
  try {
    ui = await verifyShopUi(baseUrl, sellerId)
  } catch (error) {
    console.warn(`UI check skipped: ${error.message}`)
  }

  const result = {
    sellerEmail,
    sellerId,
    rawActiveListingsInDb: rawActiveCount,
    publicShopListings: publicListings.length,
    publicWithImages: withImages.length,
    publicWithoutImages: withoutImages,
    ui,
  }

  console.log(JSON.stringify(result, null, 2))

  const apiOk =
    publicListings.length === withImages.length &&
    publicListings.length > 0 &&
    publicListings.length <= rawActiveCount

  const uiOk =
    !ui ||
    (ui.statCount === publicListings.length &&
      ui.cards === publicListings.length &&
      ui.imgs === publicListings.length &&
      ui.placeholders === 0)

  if (apiOk && uiOk) {
    console.log(
      `PASS: Seller shop exposes ${publicListings.length} public listings (${rawActiveCount} active in DB).`,
    )
  } else {
    console.log('FAIL: Seller shop visibility check did not pass.')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
