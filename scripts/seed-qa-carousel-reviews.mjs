#!/usr/bin/env node
/**
 * QA CAROUSEL SEED — homepage review carousel test data (live-domain / staging QA).
 *
 * Creates 20 synthetic completed-order reviews for carousel QA on equipd.co.uk.
 * This is NOT a Supabase migration and must not run automatically in CI/deploy.
 *
 * Usage:
 *   node scripts/seed-qa-carousel-reviews.mjs --dry-run
 *   QA_CAROUSEL_SEED_CONFIRM=true node scripts/seed-qa-carousel-reviews.mjs
 *   QA_CAROUSEL_SEED_CONFIRM=true node scripts/seed-qa-carousel-reviews.mjs --reset
 *
 * Env (.env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   QA_CAROUSEL_SEED_CONFIRM=true          (required for seed/reset)
 *   QA_CAROUSEL_ADMIN_EMAIL=...            (optional, default jlinnell95@gmail.com)
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  QA_CAROUSEL_DEFAULT_ADMIN_EMAIL,
  QA_CAROUSEL_OFFER_MESSAGE,
  QA_CAROUSEL_REVIEW_BUYERS,
  QA_CAROUSEL_REVIEW_IDS,
  QA_CAROUSEL_REVIEW_PASSWORD,
  QA_CAROUSEL_REVIEWS,
  QA_CAROUSEL_REVIEW_SEED_ORDER,
} from './qa-carousel-reviews-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
export const QA_CAROUSEL_SEED_CONFIRM_ENV = 'QA_CAROUSEL_SEED_CONFIRM'

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

export function assertQaCarouselServiceRole({ requireConfirm = true } = {}) {
  if (requireConfirm && process.env[QA_CAROUSEL_SEED_CONFIRM_ENV] !== 'true') {
    throw new Error(
      `Refusing to run: set ${QA_CAROUSEL_SEED_CONFIRM_ENV}=true.\n` +
        'This script writes synthetic marketplace rows via the service role.',
    )
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url) throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }

  return url
}

export function createQaCarouselAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function resolveAdminProfile(supabase) {
  const email = (process.env.QA_CAROUSEL_ADMIN_EMAIL || QA_CAROUSEL_DEFAULT_ADMIN_EMAIL).trim()

  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const authUser = (authUsers?.users ?? []).find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  )
  if (!authUser) {
    throw new Error(`Admin account not found for email: ${email}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, is_admin')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) throw new Error(`Profile missing for admin ${email}`)

  return { ...profile, email }
}

async function ensureReviewBuyers(supabase) {
  console.log('Ensuring QA carousel buyer accounts…')

  for (const buyer of QA_CAROUSEL_REVIEW_BUYERS) {
    const { data: existing } = await supabase.auth.admin.getUserById(buyer.id)

    if (!existing?.user) {
      const { error } = await supabase.auth.admin.createUser({
        id: buyer.id,
        email: buyer.email,
        password: QA_CAROUSEL_REVIEW_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: buyer.displayName, qa_carousel_seed: true },
      })
      if (error) throw new Error(`Create user ${buyer.email}: ${error.message}`)
      console.log(`  Created ${buyer.email}`)
    } else {
      await supabase.auth.admin.updateUserById(buyer.id, {
        email: buyer.email,
        password: QA_CAROUSEL_REVIEW_PASSWORD,
        user_metadata: { display_name: buyer.displayName, qa_carousel_seed: true },
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

async function queryActiveListings(supabase, { sellerId = null, pattern = null, limit = 30 } = {}) {
  let query = supabase
    .from('listings')
    .select('id, title, seller_id, price_pence, status, slug')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sellerId) query = query.eq('seller_id', sellerId)
  if (pattern) query = query.ilike('title', pattern)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function findListingForQaReview(supabase, reviewDef, usedListingIds, adminId) {
  const patterns = [
    ...reviewDef.preferredTitlePatterns,
    ...(reviewDef.looseTitlePatterns ?? []),
  ]

  const sellerFilter = reviewDef.preferAdminSeller ? adminId : null

  for (const pattern of patterns) {
    const rows = await queryActiveListings(supabase, { sellerId: sellerFilter, pattern, limit: 30 })
    const listing = rows.find((row) => !usedListingIds.has(row.id))
    if (listing) return { listing, source: reviewDef.preferAdminSeller ? 'admin-active' : 'active', pattern }
  }

  if (reviewDef.preferAdminSeller) {
    const adminRows = await queryActiveListings(supabase, { sellerId: adminId, limit: 50 })
    const spare = adminRows.find((row) => !usedListingIds.has(row.id))
    if (spare) return { listing: spare, source: 'admin-any-active', pattern: '(admin spare)' }
  }

  const anyRows = await queryActiveListings(supabase, { limit: 80 })
  const spare = anyRows.find((row) => !usedListingIds.has(row.id) && row.seller_id !== reviewDef.buyerId)
  if (spare) return { listing: spare, source: 'any-active', pattern: '(unused active listing)' }

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
      message: QA_CAROUSEL_OFFER_MESSAGE,
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

  const orderType =
    reviewDef.purchaseType === 'home' && reviewDef.rating === 4 && reviewDef.index === 6
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

  return listing.id
}

export async function resetQaCarouselReviews(supabase) {
  console.log('Removing QA CAROUSEL SEED reviews and synthetic marketplace rows…')

  const { error: reviewsError } = await supabase
    .from('reviews')
    .delete()
    .in('id', QA_CAROUSEL_REVIEW_IDS.reviewIds)
  if (reviewsError) throw reviewsError

  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .in('id', QA_CAROUSEL_REVIEW_IDS.orderIds)
  if (ordersError) throw ordersError

  const { error: paymentsError } = await supabase
    .from('payments')
    .delete()
    .in('id', QA_CAROUSEL_REVIEW_IDS.paymentIds)
  if (paymentsError) throw paymentsError

  const { error: offersError } = await supabase
    .from('offers')
    .delete()
    .in('id', QA_CAROUSEL_REVIEW_IDS.offerIds)
  if (offersError) throw offersError

  for (const buyer of QA_CAROUSEL_REVIEW_BUYERS) {
    await supabase.auth.admin.deleteUser(buyer.id).catch(() => {})
  }

  console.log('  Removed QA carousel reviews, orders, payments, offers, and buyer accounts.')
}

async function dryRunQaCarouselReviews(supabase) {
  const admin = await resolveAdminProfile(supabase)
  console.log(`Admin: ${admin.email} (${admin.id})`)
  console.log(`Would seed ${QA_CAROUSEL_REVIEWS.length} QA carousel reviews.\n`)

  const usedListingIds = new Set()
  let fiveStar = 0
  let fourStar = 0
  let adminSellerCount = 0

  for (const reviewIndex of QA_CAROUSEL_REVIEW_SEED_ORDER) {
    const reviewDef = QA_CAROUSEL_REVIEWS[reviewIndex]
    const match = await findListingForQaReview(supabase, reviewDef, usedListingIds, admin.id)

    if (!match) {
      throw new Error(
        `Review #${reviewDef.index + 1}: no active listing found.\n` +
          `  Patterns: ${[...reviewDef.preferredTitlePatterns, ...(reviewDef.looseTitlePatterns ?? [])].join(', ')}`,
      )
    }

    usedListingIds.add(match.listing.id)
    if (match.listing.seller_id === admin.id) adminSellerCount += 1
    if (reviewDef.rating === 5) fiveStar += 1
    if (reviewDef.rating === 4) fourStar += 1

    const stars = '★'.repeat(reviewDef.rating) + (reviewDef.rating < 5 ? '☆' : '')
    console.log(
      `  ${stars} ${match.listing.title} [${match.listing.status}] (${match.source}) — ${QA_CAROUSEL_REVIEW_BUYERS[reviewDef.index].displayName}`,
    )
  }

  console.log(
    `\nDry run OK: ${QA_CAROUSEL_REVIEWS.length} reviews (${fiveStar}×5-star, ${fourStar}×4-star), ${adminSellerCount} on admin listings.`,
  )
  console.log('Listings would remain active — seed does not modify listing status.')
}

export async function seedQaCarouselReviews(supabase) {
  console.log('Seeding QA CAROUSEL SEED homepage reviews…')

  const admin = await resolveAdminProfile(supabase)
  console.log(`Admin: ${admin.email}`)

  await ensureReviewBuyers(supabase)

  const usedListingIds = new Set()
  const listingStatusBefore = new Map()
  let fiveStar = 0
  let fourStar = 0
  let adminSellerCount = 0

  for (const reviewIndex of QA_CAROUSEL_REVIEW_SEED_ORDER) {
    const reviewDef = QA_CAROUSEL_REVIEWS[reviewIndex]
    const match = await findListingForQaReview(supabase, reviewDef, usedListingIds, admin.id)

    if (!match) {
      throw new Error(`Review #${reviewDef.index + 1}: no active listing found.`)
    }

    if (!listingStatusBefore.has(match.listing.id)) {
      listingStatusBefore.set(match.listing.id, match.listing.status)
    }

    usedListingIds.add(match.listing.id)
    await upsertCompletedOrderReview(supabase, reviewDef, match.listing)

    if (match.listing.seller_id === admin.id) adminSellerCount += 1
    if (reviewDef.rating === 5) fiveStar += 1
    if (reviewDef.rating === 4) fourStar += 1

    const stars = '★'.repeat(reviewDef.rating) + (reviewDef.rating < 5 ? '☆' : '')
    console.log(
      `  ${stars} ${match.listing.title} (${match.source}) — ${QA_CAROUSEL_REVIEW_BUYERS[reviewDef.index].displayName}`,
    )
  }

  const listingIds = [...listingStatusBefore.keys()]
  const { data: afterListings, error: listingCheckError } = await supabase
    .from('listings')
    .select('id, status, title')
    .in('id', listingIds)

  if (listingCheckError) throw listingCheckError

  const notActive = (afterListings ?? []).filter((row) => row.status !== 'active')
  if (notActive.length > 0) {
    throw new Error(
      `Listing status changed after seed (expected all active): ${notActive.map((r) => r.title).join(', ')}`,
    )
  }

  console.log(
    `\nDone: ${QA_CAROUSEL_REVIEWS.length} QA reviews (${fiveStar}×5-star, ${fourStar}×4-star).`,
  )
  console.log(`${adminSellerCount} reviews on admin listings; ${listingIds.length} listings verified active.`)
  console.log('Homepage carousel reads from get_recent_reviews_for_homepage().')
}

async function main() {
  loadEnvFile('.env.local')

  const dryRun = process.argv.includes('--dry-run')
  const reset = process.argv.includes('--reset')

  if (dryRun) {
    assertQaCarouselServiceRole({ requireConfirm: false })
    const supabase = createQaCarouselAdminClient()
    await dryRunQaCarouselReviews(supabase)
    return
  }

  assertQaCarouselServiceRole({ requireConfirm: true })
  const supabase = createQaCarouselAdminClient()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  console.log(`Target: ${url}\n`)

  if (reset) {
    await resetQaCarouselReviews(supabase)
    return
  }

  await seedQaCarouselReviews(supabase)
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message ?? error)
    process.exit(1)
  })
}
