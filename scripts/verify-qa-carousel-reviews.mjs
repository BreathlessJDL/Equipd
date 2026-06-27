#!/usr/bin/env node
/**
 * QA REVIEW SEED DATA ONLY — DO NOT RUN FOR REAL PRODUCTION REVIEWS
 *
 * Verify QA CAROUSEL SEED reviews for homepage carousel testing.
 *
 *   node scripts/verify-qa-carousel-reviews.mjs
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  QA_CAROUSEL_LISTING_SLUG_PREFIX,
  QA_CAROUSEL_REVIEWS,
  QA_CAROUSEL_REVIEW_IDS,
} from './qa-carousel-reviews-data.mjs'
import {
  assertQaCarouselServiceRole,
  createQaCarouselAdminClient,
} from './seed-qa-carousel-reviews.mjs'

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

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
    return false
  }
  console.log(`PASS: ${message}`)
  return true
}

async function main() {
  loadEnvFile('.env.local')
  assertQaCarouselServiceRole({ requireConfirm: false })

  const supabase = createQaCarouselAdminClient()

  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, rating, created_at, order_id, review_text')
    .in('id', QA_CAROUSEL_REVIEW_IDS.reviewIds)

  if (reviewsError) throw reviewsError

  assert(
    (reviews ?? []).length === QA_CAROUSEL_REVIEWS.length,
    `${QA_CAROUSEL_REVIEWS.length} QA carousel reviews present`,
  )

  const ratings = (reviews ?? []).map((row) => row.rating)
  assert(
    ratings.every((rating) => rating >= 4 && rating <= 5),
    'All QA review ratings are 4–5 stars',
  )
  assert(
    ratings.filter((rating) => rating === 5).length === 14 &&
      ratings.filter((rating) => rating === 4).length === 6,
    'Rating mix is 14×5-star and 6×4-star',
  )

  const expectedTitles = new Set(QA_CAROUSEL_REVIEWS.map((row) => row.listingTitle))

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, listing_id, fulfilment_status, payout_status')
    .in('id', QA_CAROUSEL_REVIEW_IDS.orderIds)

  if (ordersError) throw ordersError

  assert(
    (orders ?? []).length === QA_CAROUSEL_REVIEW_IDS.orderIds.length,
    'All QA synthetic orders present',
  )
  assert(
    (orders ?? []).every(
      (row) => row.fulfilment_status === 'completed' && row.payout_status === 'paid',
    ),
    'QA orders are completed with paid payout (no live Stripe dependency)',
  )

  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id, status, title, slug')
    .in('id', QA_CAROUSEL_REVIEW_IDS.listingIds)

  if (listingsError) throw listingsError

  assert(
    (listings ?? []).length === QA_CAROUSEL_REVIEW_IDS.listingIds.length,
    'All QA stub listings present',
  )
  assert(
    (listings ?? []).every((row) => row.status === 'sold'),
    'QA stub listings are sold (not active in browse)',
  )
  assert(
    (listings ?? []).every((row) => row.slug.startsWith(QA_CAROUSEL_LISTING_SLUG_PREFIX)),
    `QA stub listing slugs use ${QA_CAROUSEL_LISTING_SLUG_PREFIX} prefix`,
  )
  assert(
    (listings ?? []).every((row) => expectedTitles.has(row.title)),
    'QA stub listing titles match seeded equipment names',
  )

  const { data: activeMarketplace, error: activeError } = await supabase
    .from('listings')
    .select('id, title')
    .eq('status', 'active')
    .in('title', [...expectedTitles])

  if (activeError) throw activeError

  assert(
    (activeMarketplace ?? []).length === 0,
    'Seeded equipment titles do not appear as active marketplace listings',
  )

  const { data: homepageReviews, error: rpcError } = await supabase.rpc(
    'get_recent_reviews_for_homepage',
    { p_limit: 20 },
  )

  if (rpcError) throw rpcError

  assert(
    (homepageReviews ?? []).length >= 12,
    'Homepage RPC returns at least 12 reviews for carousel',
  )
  assert(
    (homepageReviews ?? []).length > 4,
    'Enough reviews for interactive carousel (>4 threshold)',
  )

  const qaOnHomepage = (homepageReviews ?? []).filter((row) =>
    QA_CAROUSEL_REVIEW_IDS.reviewIds.includes(row.id),
  )

  assert(
    qaOnHomepage.length >= Math.min(QA_CAROUSEL_REVIEWS.length, 20),
    'QA reviews appear in homepage RPC results',
  )

  assert(
    qaOnHomepage.every((row) => expectedTitles.has(row.listing_title)),
    'Homepage review cards show QA equipment titles (anonymous — no buyer names in RPC)',
  )

  console.log(
    `INFO: ${qaOnHomepage.length} QA reviews in top ${(homepageReviews ?? []).length} homepage results`,
  )

  if (failures > 0) {
    console.error(`\n${failures} verification check(s) failed`)
    process.exitCode = 1
  } else {
    console.log('\nAll QA carousel verification checks passed')
  }
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
