#!/usr/bin/env node
/**
 * Equipd development seed script.
 *
 * Populates Supabase with realistic marketplace data for UI testing.
 * Requires service role access — never run against production.
 *
 * Usage:
 *   SEED_DEV_ALLOW=true npm run seed:dev
 *   SEED_DEV_ALLOW=true npm run seed:dev -- --reset
 *
 * Env (.env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_DEV_ALLOW=true
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  CATEGORY_IMAGE_ASSETS,
  DEV_LISTINGS,
  DEV_LOCATION_COORDINATES,
  DEV_OFFERS,
  DEV_ORDER_ID,
  DEV_PAYMENT_ID,
  DEV_PROFILE_COORDINATES,
  DEV_REVIEWS,
  DEV_SAVED_LISTINGS,
  DEV_SEED_PREFIX,
  DEV_USER_KEYS,
  DEV_USERS,
} from './seed-dev-data.mjs'
import { calculateBuyerProtectionFee } from '../src/lib/buyerProtection.js'
import { calculateSellerNetPayout, calculateSellerServiceFee } from '../src/lib/sellerServiceFee.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'
const LISTING_IMAGES_BUCKET = 'listing-images'

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function buildDevCheckoutTotals(itemPricePence) {
  const buyerProtectionFeePence = calculateBuyerProtectionFee(itemPricePence)
  const sellerServiceFeePence = calculateSellerServiceFee(itemPricePence)
  const platformFeePence = buyerProtectionFeePence

  return {
    itemPricePence,
    buyerProtectionFeePence,
    buyerTotalPence: itemPricePence + buyerProtectionFeePence,
    platformFeePence,
    sellerServiceFeePence,
    sellerNetPence: calculateSellerNetPayout(itemPricePence),
  }
}

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

function assertDevSafe() {
  if (process.env.SEED_DEV_ALLOW !== 'true') {
    throw new Error(
      'Refusing to seed: set SEED_DEV_ALLOW=true in your environment.\n' +
        'This script uses the Supabase service role and is for local/dev only.',
    )
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }

  if (/prod/i.test(url) && process.env.SEED_DEV_IGNORE_PROD_URL !== 'true') {
    throw new Error(
      `Refusing to seed: Supabase URL looks like production (${url}).\n` +
        'Set SEED_DEV_IGNORE_PROD_URL=true only if you are certain this is a dev project.',
    )
  }
}

function createAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function resetDevSeed(supabase) {
  console.log('Resetting dev seed data…')

  const { data: listings } = await supabase
    .from('listings')
    .select('id, slug')
    .like('slug', `${DEV_SEED_PREFIX}%`)

  if (listings?.length) {
    const { error } = await supabase.from('listings').delete().like('slug', `${DEV_SEED_PREFIX}%`)
    if (error) throw error
    console.log(`  Removed ${listings.length} dev listings (cascades related rows).`)
  }

  for (const user of DEV_USERS) {
    await supabase.auth.admin.deleteUser(user.id).catch(() => {})
  }

  console.log('  Removed dev auth users.')
}

async function ensureDevUsers(supabase) {
  console.log('Ensuring dev users…')

  for (const user of DEV_USERS) {
    const { data: existing } = await supabase.auth.admin.getUserById(user.id)

    if (!existing?.user) {
      const { error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: user.displayName },
      })
      if (error) throw new Error(`Create user ${user.email}: ${error.message}`)
      console.log(`  Created ${user.email}`)
    } else {
      await supabase.auth.admin.updateUserById(user.id, {
        email: user.email,
        password: DEV_PASSWORD,
        user_metadata: { display_name: user.displayName },
      })
      console.log(`  Updated ${user.email}`)
    }

    const profileRow = {
      id: user.id,
      display_name: user.displayName,
      location: user.location,
      stripe_onboarding_complete: true,
    }

    const profileCoords = DEV_PROFILE_COORDINATES[user.id]
    if (profileCoords) {
      profileRow.latitude = profileCoords.latitude
      profileRow.longitude = profileCoords.longitude
    }

    const { error: profileError } = await supabase.from('profiles').upsert(profileRow, {
      onConflict: 'id',
    })

    if (profileError) throw profileError
  }
}

async function fetchCategoryMap(supabase) {
  const slugs = [...new Set(DEV_LISTINGS.map((listing) => listing.categorySlug))]
  const { data, error } = await supabase.from('categories').select('id, slug').in('slug', slugs)

  if (error) throw error

  const map = Object.fromEntries((data ?? []).map((row) => [row.slug, row.id]))
  const missing = slugs.filter((slug) => !map[slug])

  if (missing.length) {
    throw new Error(
      `Missing categories: ${missing.join(', ')}. Run supabase/seed-categories.sql first.`,
    )
  }

  return map
}

async function uploadListingImage(supabase, { listing, sellerId, categorySlug }) {
  const assetRelative = CATEGORY_IMAGE_ASSETS[categorySlug]
  if (!assetRelative) return

  const assetPath = join(ROOT, 'public', assetRelative)
  if (!existsSync(assetPath)) {
    console.warn(`  Image asset missing for ${listing.slug}: ${assetRelative}`)
    return
  }

  const ext = extname(assetPath).toLowerCase() || '.jpg'
  const contentType = MIME_BY_EXT[ext] ?? 'image/jpeg'
  const storagePath = `dev-seed/${sellerId}/${listing.id}/primary${ext}`
  const fileBuffer = readFileSync(assetPath)

  const { error: uploadError } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    })

  if (uploadError) throw uploadError

  await supabase.from('listing_images').delete().eq('listing_id', listing.id)

  const { error: insertError } = await supabase.from('listing_images').insert({
    listing_id: listing.id,
    storage_path: storagePath,
    sort_order: 0,
  })

  if (insertError) throw insertError
}

async function seedListings(supabase, categoryMap) {
  console.log(`Seeding ${DEV_LISTINGS.length} listings…`)

  for (const listing of DEV_LISTINGS) {
    const sellerId = DEV_USER_KEYS[listing.sellerKey]
    const categoryId = categoryMap[listing.categorySlug]
    const status = listing.status ?? 'active'

    const row = {
      id: listing.id,
      seller_id: sellerId,
      category_id: categoryId,
      slug: listing.slug,
      title: listing.title,
      brand: listing.brand,
      model: listing.model,
      rating: listing.rating,
      description: listing.description,
      price_pence: listing.pricePence,
      condition: listing.condition,
      location: listing.location,
      collection_available: true,
      courier_available: false,
      status,
      source: 'manual',
      published_at: status === 'active' || status === 'sold' ? new Date().toISOString() : null,
    }

    const coords = DEV_LOCATION_COORDINATES[listing.location]
    if (coords) {
      row.latitude = coords.latitude
      row.longitude = coords.longitude
      row.location_name = coords.location_name
      row.city = coords.city
      row.county = coords.county
    }

    const { error } = await supabase.from('listings').upsert(row, { onConflict: 'slug' })
    if (error) throw error

    await uploadListingImage(supabase, {
      listing,
      sellerId,
      categorySlug: listing.categorySlug,
    })

    console.log(`  ${listing.slug} (${status})`)
  }

  console.log('Backfilling listing coordinates for known dev cities…')
  await backfillListingCoordinates(supabase)
}

async function backfillListingCoordinates(supabase) {
  const { DEV_LOCATION_COORDINATES } = await import('./seed-dev-data.mjs')
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, slug, location, latitude, longitude')
    .is('latitude', null)

  if (error) throw error

  let updated = 0

  for (const listing of listings ?? []) {
    const coords = DEV_LOCATION_COORDINATES[listing.location?.trim()]
    if (!coords) continue

    const patch = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      location_name: coords.location_name,
      city: coords.city,
      county: coords.county,
    }

    const { error: updateError } = await supabase.from('listings').update(patch).eq('id', listing.id)

    if (updateError) {
      if (/column .* does not exist/i.test(updateError.message)) {
        const { error: legacyError } = await supabase
          .from('listings')
          .update({
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
          .eq('id', listing.id)
        if (legacyError) throw legacyError
      } else {
        throw updateError
      }
    }

    updated += 1
  }

  console.log(`  Backfilled coordinates on ${updated} listing(s).`)
}

async function seedOffersOrdersAndReviews(supabase) {
  console.log('Seeding offers, orders, and reviews…')

  const { data: listings } = await supabase
    .from('listings')
    .select('id, slug, seller_id, price_pence, status')
    .like('slug', `${DEV_SEED_PREFIX}%`)

  const listingBySlug = Object.fromEntries((listings ?? []).map((row) => [row.slug, row]))

  for (const offer of DEV_OFFERS) {
    const listing = listingBySlug[offer.listingSlug]
    if (!listing) throw new Error(`Listing not found for offer: ${offer.listingSlug}`)

    const { error } = await supabase.from('offers').upsert(
      {
        id: offer.id,
        listing_id: listing.id,
        buyer_id: DEV_USER_KEYS[offer.buyerKey],
        seller_id: listing.seller_id,
        amount_pence: offer.amountPence,
        status: offer.status,
        message: offer.message,
      },
      { onConflict: 'id' },
    )

    if (error) throw error
    console.log(`  Offer ${offer.status}: ${offer.listingSlug}`)
  }

  const completedOffer = DEV_OFFERS.find((offer) => offer.id.endsWith('302'))
  const completedListing = listingBySlug[completedOffer.listingSlug]
  const checkoutTotals = buildDevCheckoutTotals(completedOffer.amountPence)

  const { error: paymentError } = await supabase.from('payments').upsert(
    {
      id: DEV_PAYMENT_ID,
      offer_id: completedOffer.id,
      listing_id: completedListing.id,
      buyer_id: DEV_USER_KEYS[completedOffer.buyerKey],
      seller_id: completedListing.seller_id,
      amount_pence: checkoutTotals.itemPricePence,
      platform_fee_pence: checkoutTotals.platformFeePence,
      buyer_protection_fee_pence: checkoutTotals.buyerProtectionFeePence,
      buyer_total_pence: checkoutTotals.buyerTotalPence,
      seller_service_fee_pence: checkoutTotals.sellerServiceFeePence,
      seller_net_pence: checkoutTotals.sellerNetPence,
      status: 'paid',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      paid_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (paymentError) throw paymentError

  const { error: orderError } = await supabase.from('orders').upsert(
    {
      id: DEV_ORDER_ID,
      offer_id: completedOffer.id,
      payment_id: DEV_PAYMENT_ID,
      listing_id: completedListing.id,
      buyer_id: DEV_USER_KEYS[completedOffer.buyerKey],
      seller_id: completedListing.seller_id,
      amount_pence: checkoutTotals.itemPricePence,
      item_price_pence: checkoutTotals.itemPricePence,
      platform_fee_pence: checkoutTotals.platformFeePence,
      buyer_protection_fee_pence: checkoutTotals.buyerProtectionFeePence,
      buyer_total_pence: checkoutTotals.buyerTotalPence,
      seller_service_fee_pence: checkoutTotals.sellerServiceFeePence,
      seller_net_pence: checkoutTotals.sellerNetPence,
      fulfilment_status: 'completed',
      payout_status: 'paid',
      buyer_confirmed_at: new Date().toISOString(),
      payout_released_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (orderError) throw orderError

  await supabase
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', completedListing.id)

  for (const review of DEV_REVIEWS) {
    await supabase
      .from('reviews')
      .delete()
      .eq('order_id', review.orderId)
      .eq('reviewer_user_id', DEV_USER_KEYS[review.reviewerKey])

    const { error } = await supabase.from('reviews').insert({
      order_id: review.orderId,
      reviewer_user_id: DEV_USER_KEYS[review.reviewerKey],
      reviewed_user_id: DEV_USER_KEYS[review.revieweeKey],
      rating: review.rating,
      review_text: review.comment,
    })

    if (error) throw error
    console.log(`  Review on ${review.listingSlug}`)
  }
}

async function seedSavedListings(supabase) {
  console.log('Seeding saved listings…')

  const { data: listings } = await supabase
    .from('listings')
    .select('id, slug')
    .like('slug', `${DEV_SEED_PREFIX}%`)

  const listingBySlug = Object.fromEntries((listings ?? []).map((row) => [row.slug, row.id]))

  for (const saved of DEV_SAVED_LISTINGS) {
    const listingId = listingBySlug[saved.listingSlug]
    if (!listingId) continue

    const { error } = await supabase.from('saved_listings').upsert(
      {
        user_id: DEV_USER_KEYS[saved.userKey],
        listing_id: listingId,
      },
      { onConflict: 'user_id,listing_id' },
    )

    if (error) throw error
    console.log(`  ${saved.userKey} → ${saved.listingSlug}`)
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  assertDevSafe()

  const reset = process.argv.includes('--reset')
  const supabase = createAdminClient()

  if (reset) {
    await resetDevSeed(supabase)
  }

  await ensureDevUsers(supabase)
  const categoryMap = await fetchCategoryMap(supabase)
  await seedListings(supabase, categoryMap)
  await seedOffersOrdersAndReviews(supabase)
  await seedSavedListings(supabase)

  console.log('\nDev seed complete.')
  console.log('\nDev login accounts (password for all):', DEV_PASSWORD)
  for (const user of DEV_USERS) {
    console.log(`  ${user.email} — ${user.displayName}`)
  }
  console.log(`\nListings prefixed with "${DEV_SEED_PREFIX}" are safe to delete.`)
  console.log('Re-run safely: SEED_DEV_ALLOW=true npm run seed:dev')
  console.log('Full reset first: SEED_DEV_ALLOW=true npm run seed:dev -- --reset')
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message)
  process.exit(1)
})
