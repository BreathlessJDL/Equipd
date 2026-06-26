#!/usr/bin/env node
/**
 * DEV SEED DATA — homepage review carousel samples.
 *
 * Populates the local/dev Supabase project with 10 realistic completed-order
 * reviews for UI testing. Never run against production.
 *
 * This is NOT a Supabase migration and must not be deployed to production.
 *
 * Usage:
 *   SEED_DEV_ALLOW=true npm run seed:dev-reviews
 *   SEED_DEV_ALLOW=true npm run seed:dev-reviews -- --reset
 *
 * Env (.env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_DEV_ALLOW=true
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  DEV_HOMEPAGE_REVIEW_BUYERS,
  DEV_HOMEPAGE_REVIEW_IDS,
  DEV_HOMEPAGE_REVIEW_PASSWORD,
  DEV_HOMEPAGE_REVIEW_SEED_ORDER,
  DEV_HOMEPAGE_REVIEWS,
} from './seed-dev-reviews-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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
      'Refusing to seed reviews: set SEED_DEV_ALLOW=true in your environment.\n' +
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

async function ensureReviewBuyers(supabase) {
  console.log('Ensuring dev homepage-review buyers…')

  for (const buyer of DEV_HOMEPAGE_REVIEW_BUYERS) {
    const { data: existing } = await supabase.auth.admin.getUserById(buyer.id)

    if (!existing?.user) {
      const { error } = await supabase.auth.admin.createUser({
        id: buyer.id,
        email: buyer.email,
        password: DEV_HOMEPAGE_REVIEW_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: buyer.displayName },
      })
      if (error) throw new Error(`Create user ${buyer.email}: ${error.message}`)
      console.log(`  Created ${buyer.email}`)
    } else {
      await supabase.auth.admin.updateUserById(buyer.id, {
        email: buyer.email,
        password: DEV_HOMEPAGE_REVIEW_PASSWORD,
        user_metadata: { display_name: buyer.displayName },
      })
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: buyer.id,
        display_name: buyer.displayName,
        location: buyer.location,
      },
      { onConflict: 'id' },
    )

    if (profileError) throw profileError
  }
}

async function findListingForReview(supabase, reviewDef, usedListingIds) {
  const patterns = [
    ...reviewDef.preferredTitlePatterns,
    ...(reviewDef.looseTitlePatterns ?? []),
  ]

  for (const pattern of patterns) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, seller_id, price_pence, status, slug')
      .ilike('title', pattern)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const listing = (data ?? []).find((row) => !usedListingIds.has(row.id))
    if (listing) return { listing, source: 'imported', pattern }
  }

  if (reviewDef.fallbackDevSlug) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, seller_id, price_pence, status, slug')
      .eq('slug', reviewDef.fallbackDevSlug)
      .maybeSingle()

    if (error) throw error
    if (data && !usedListingIds.has(data.id)) {
      return { listing: data, source: 'dev-seed-fallback', pattern: reviewDef.fallbackDevSlug }
    }
  }

  const { data: anyListings, error: anyError } = await supabase
    .from('listings')
    .select('id, title, seller_id, price_pence, status, slug')
    .in('status', ['active', 'sold', 'reserved'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (anyError) throw anyError

  const spare = (anyListings ?? []).find((row) => !usedListingIds.has(row.id))
  if (spare) return { listing: spare, source: 'any-available', pattern: '(unused listing)' }

  return null
}

function resolveAmountPence(listing) {
  const price = Number(listing.price_pence)
  if (Number.isFinite(price) && price > 0) return price
  return 50000
}

async function upsertCompletedOrderReview(supabase, reviewDef, listing) {
  const amountPence = resolveAmountPence(listing)
  const sellerId = listing.seller_id
  const buyerId = reviewDef.buyerId

  if (buyerId === sellerId) {
    throw new Error(
      `Review #${reviewDef.index + 1}: buyer and seller are the same for listing "${listing.title}".`,
    )
  }

  const completedAt = reviewDef.createdAt
  const expiresAt = new Date(new Date(completedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { error: offerError } = await supabase.from('offers').upsert(
    {
      id: reviewDef.offerId,
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: sellerId,
      amount_pence: amountPence,
      status: 'accepted',
      message: 'DEV SEED DATA — accepted offer for homepage review sample.',
      created_at: completedAt,
      updated_at: completedAt,
    },
    { onConflict: 'id' },
  )
  if (offerError) throw offerError

  const { error: paymentError } = await supabase.from('payments').upsert(
    {
      id: reviewDef.paymentId,
      offer_id: reviewDef.offerId,
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: sellerId,
      amount_pence: amountPence,
      platform_fee_pence: 0,
      seller_net_pence: amountPence,
      buyer_protection_fee_pence: 0,
      buyer_total_pence: amountPence,
      status: 'paid',
      expires_at: expiresAt,
      paid_at: completedAt,
      created_at: completedAt,
      updated_at: completedAt,
    },
    { onConflict: 'id' },
  )
  if (paymentError) throw paymentError

  const orderType = reviewDef.purchaseType === 'home' && reviewDef.rating === 4 && reviewDef.index === 6
    ? 'seller_delivery'
    : 'collection'

  const { error: orderError } = await supabase.from('orders').upsert(
    {
      id: reviewDef.orderId,
      offer_id: reviewDef.offerId,
      payment_id: reviewDef.paymentId,
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: sellerId,
      amount_pence: amountPence,
      item_price_pence: amountPence,
      platform_fee_pence: 0,
      seller_net_pence: amountPence,
      buyer_protection_fee_pence: 0,
      buyer_total_pence: amountPence,
      order_type: orderType,
      fulfilment_status: 'completed',
      payout_status: 'paid',
      buyer_confirmed_at: completedAt,
      payout_released_at: completedAt,
      created_at: completedAt,
      updated_at: completedAt,
    },
    { onConflict: 'id' },
  )
  if (orderError) throw orderError

  const { error: reviewError } = await supabase.from('reviews').upsert(
    {
      id: reviewDef.reviewId,
      order_id: reviewDef.orderId,
      reviewer_user_id: buyerId,
      reviewed_user_id: sellerId,
      rating: reviewDef.rating,
      review_text: reviewDef.reviewText,
      created_at: reviewDef.createdAt,
    },
    { onConflict: 'id' },
  )
  if (reviewError) throw reviewError
}

async function resetDevHomepageReviews(supabase) {
  console.log('Removing DEV SEED DATA homepage reviews…')

  const { error: reviewsError } = await supabase
    .from('reviews')
    .delete()
    .in('id', DEV_HOMEPAGE_REVIEW_IDS.reviewIds)
  if (reviewsError) throw reviewsError

  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .in('id', DEV_HOMEPAGE_REVIEW_IDS.orderIds)
  if (ordersError) throw ordersError

  const { error: paymentsError } = await supabase
    .from('payments')
    .delete()
    .in('id', DEV_HOMEPAGE_REVIEW_IDS.paymentIds)
  if (paymentsError) throw paymentsError

  const { error: offersError } = await supabase
    .from('offers')
    .delete()
    .in('id', DEV_HOMEPAGE_REVIEW_IDS.offerIds)
  if (offersError) throw offersError

  for (const buyer of DEV_HOMEPAGE_REVIEW_BUYERS) {
    await supabase.auth.admin.deleteUser(buyer.id).catch(() => {})
  }

  console.log('  Removed seeded reviews, orders, payments, offers, and buyer accounts.')
}

async function seedDevHomepageReviews(supabase) {
  console.log('Seeding DEV SEED DATA homepage reviews…')

  await ensureReviewBuyers(supabase)

  let fiveStar = 0
  let fourStar = 0
  const usedListingIds = new Set()

  for (const reviewIndex of DEV_HOMEPAGE_REVIEW_SEED_ORDER) {
    const reviewDef = DEV_HOMEPAGE_REVIEWS[reviewIndex]
    const match = await findListingForReview(supabase, reviewDef, usedListingIds)
    if (!match) {
      const patterns = [
        ...reviewDef.preferredTitlePatterns,
        ...(reviewDef.looseTitlePatterns ?? []),
      ]
      throw new Error(
        `Review #${reviewDef.index + 1}: no listing found.\n` +
          `  Tried patterns: ${patterns.join(', ')}\n` +
          `  Fallback slug: ${reviewDef.fallbackDevSlug ?? '(none)'}\n` +
          '  Run SEED_DEV_ALLOW=true npm run seed:dev first, or import bubble listings.',
      )
    }

    usedListingIds.add(match.listing.id)
    await upsertCompletedOrderReview(supabase, reviewDef, match.listing)

    if (reviewDef.rating === 5) fiveStar += 1
    if (reviewDef.rating === 4) fourStar += 1

    const stars = '★'.repeat(reviewDef.rating) + (reviewDef.rating < 5 ? '☆' : '')
    console.log(
      `  ${stars} ${match.listing.title} (${match.source}) — ${DEV_HOMEPAGE_REVIEW_BUYERS[reviewDef.index].displayName}`,
    )
  }

  console.log(`\nDone: ${DEV_HOMEPAGE_REVIEWS.length} reviews (${fiveStar}×5-star, ${fourStar}×4-star).`)
  console.log('Homepage carousel reads from get_recent_reviews_for_homepage().')
}

async function main() {
  loadEnvFile('.env.local')
  assertDevSafe()

  const reset = process.argv.includes('--reset')
  const supabase = createAdminClient()

  if (reset) {
    await resetDevHomepageReviews(supabase)
    return
  }

  await seedDevHomepageReviews(supabase)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
