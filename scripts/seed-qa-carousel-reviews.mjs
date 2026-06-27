#!/usr/bin/env node
/**
 * QA REVIEW SEED DATA ONLY — DO NOT RUN FOR REAL PRODUCTION REVIEWS
 *
 * QA CAROUSEL SEED — homepage review carousel test data (live-domain / staging QA).
 *
 * Creates 20 synthetic completed-order reviews backed by QA-only sold stub listings.
 * Does not modify, reserve, or sell any real active marketplace listings.
 *
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
  QA_CAROUSEL_LISTING_DESCRIPTION,
  QA_CAROUSEL_LISTING_SLUG_PREFIX,
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
        'QA REVIEW SEED DATA ONLY — this script writes synthetic marketplace rows via the service role.',
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

async function loadCategoryIdMap(supabase) {
  const slugs = [...new Set(QA_CAROUSEL_REVIEWS.map((row) => row.categorySlug))]

  const { data, error } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', slugs)

  if (error) throw error

  const map = new Map((data ?? []).map((row) => [row.slug, row.id]))
  const missing = slugs.filter((slug) => !map.has(slug))

  if (missing.length > 0) {
    throw new Error(`Missing category slugs for QA listings: ${missing.join(', ')}`)
  }

  return map
}

async function ensureQaCarouselListings(supabase, adminId, categoryIdBySlug) {
  console.log('Ensuring QA-only sold stub listings…')

  for (const reviewDef of QA_CAROUSEL_REVIEWS) {
    const categoryId = categoryIdBySlug.get(reviewDef.categorySlug)

    const { error } = await supabase.from('listings').upsert(
      {
        id: reviewDef.listingId,
        seller_id: adminId,
        category_id: categoryId,
        slug: reviewDef.listingSlug,
        title: reviewDef.listingTitle,
        description: QA_CAROUSEL_LISTING_DESCRIPTION,
        price_pence: reviewDef.pricePence,
        condition: 'good',
        location: 'Leeds, UK',
        status: 'sold',
        source: 'manual',
        created_at: reviewDef.createdAt,
        updated_at: reviewDef.createdAt,
        published_at: reviewDef.createdAt,
      },
      { onConflict: 'id' },
    )

    if (error) {
      throw new Error(`Upsert QA listing "${reviewDef.listingTitle}": ${error.message}`)
    }
  }

  console.log(`  Upserted ${QA_CAROUSEL_REVIEWS.length} sold stub listings (${QA_CAROUSEL_LISTING_SLUG_PREFIX}* slugs).`)
}

async function assertNoQaListingsActive(supabase) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, slug')
    .in('id', QA_CAROUSEL_REVIEW_IDS.listingIds)

  if (error) throw error

  const activeRows = (data ?? []).filter((row) => row.status !== 'sold')
  if (activeRows.length > 0) {
    throw new Error(
      `QA stub listings must stay sold: ${activeRows.map((row) => `${row.title} (${row.status})`).join(', ')}`,
    )
  }
}

async function logActiveMarketplaceCount(supabase) {
  const { count, error } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  if (error) throw error
  console.log(`INFO: ${count ?? 0} active listings remain in marketplace browse.`)
}

async function upsertCompletedOrderReview(supabase, reviewDef, sellerId) {
  const amountPence = reviewDef.pricePence
  const buyerId = reviewDef.buyerId

  if (buyerId === sellerId) {
    throw new Error(
      `Review #${reviewDef.index + 1}: buyer and seller are the same for "${reviewDef.listingTitle}".`,
    )
  }

  const completedAt = reviewDef.createdAt
  const expiresAt = new Date(new Date(completedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { error: offerError } = await supabase.from('offers').upsert(
    {
      id: reviewDef.offerId,
      listing_id: reviewDef.listingId,
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
      listing_id: reviewDef.listingId,
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
      listing_id: reviewDef.listingId,
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

export async function resetQaCarouselReviews(supabase) {
  console.log('Removing QA REVIEW SEED DATA reviews, orders, payments, offers, and stub listings…')

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

  const { error: listingsError } = await supabase
    .from('listings')
    .delete()
    .in('id', QA_CAROUSEL_REVIEW_IDS.listingIds)
  if (listingsError) throw listingsError

  for (const buyer of QA_CAROUSEL_REVIEW_BUYERS) {
    await supabase.auth.admin.deleteUser(buyer.id).catch(() => {})
  }

  console.log('  Removed QA reviews, synthetic orders, sold stub listings, and buyer accounts.')
}

async function dryRunQaCarouselReviews(supabase) {
  const admin = await resolveAdminProfile(supabase)
  await loadCategoryIdMap(supabase)

  console.log(`Admin seller: ${admin.email} (${admin.id})`)
  console.log(`Would seed ${QA_CAROUSEL_REVIEWS.length} QA carousel reviews.\n`)
  console.log('Each review uses a dedicated sold stub listing (not real active inventory).\n')

  let fiveStar = 0
  let fourStar = 0

  for (const reviewIndex of QA_CAROUSEL_REVIEW_SEED_ORDER) {
    const reviewDef = QA_CAROUSEL_REVIEWS[reviewIndex]
    if (reviewDef.rating === 5) fiveStar += 1
    if (reviewDef.rating === 4) fourStar += 1

    const stars = '★'.repeat(reviewDef.rating) + (reviewDef.rating < 5 ? '☆' : '')
    console.log(
      `  ${stars} ${reviewDef.listingTitle} [sold stub] — ${QA_CAROUSEL_REVIEW_BUYERS[reviewDef.index].displayName}`,
    )
  }

  console.log(
    `\nDry run OK: ${QA_CAROUSEL_REVIEWS.length} reviews (${fiveStar}×5-star, ${fourStar}×4-star).`,
  )
  console.log('Real active listings would not be matched or modified.')
}

export async function seedQaCarouselReviews(supabase) {
  console.log('Seeding QA REVIEW SEED DATA homepage reviews…')

  const admin = await resolveAdminProfile(supabase)
  console.log(`Admin seller: ${admin.email}`)

  const categoryIdBySlug = await loadCategoryIdMap(supabase)
  await ensureReviewBuyers(supabase)
  await ensureQaCarouselListings(supabase, admin.id, categoryIdBySlug)

  let fiveStar = 0
  let fourStar = 0

  for (const reviewIndex of QA_CAROUSEL_REVIEW_SEED_ORDER) {
    const reviewDef = QA_CAROUSEL_REVIEWS[reviewIndex]
    await upsertCompletedOrderReview(supabase, reviewDef, admin.id)

    if (reviewDef.rating === 5) fiveStar += 1
    if (reviewDef.rating === 4) fourStar += 1

    const stars = '★'.repeat(reviewDef.rating) + (reviewDef.rating < 5 ? '☆' : '')
    console.log(
      `  ${stars} ${reviewDef.listingTitle} — ${QA_CAROUSEL_REVIEW_BUYERS[reviewDef.index].displayName}`,
    )
  }

  await assertNoQaListingsActive(supabase)
  await logActiveMarketplaceCount(supabase)

  console.log(
    `\nDone: ${QA_CAROUSEL_REVIEWS.length} QA reviews (${fiveStar}×5-star, ${fourStar}×4-star).`,
  )
  console.log('Stub listings remain sold — they do not appear in browse.')
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
