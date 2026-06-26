import { getListingPrimaryImageUrl } from './listingImages'
import { formatOrderReference, ORDER_FULFILMENT_STATUSES } from './orders'
import { getProfileDisplayName, fetchPublicProfilesByIds } from './profiles'
import { supabase } from './supabase'

export const REVIEW_MIN_RATING = 1
export const REVIEW_MAX_RATING = 5

const reviewFields = `
  id,
  order_id,
  reviewer_user_id,
  reviewed_user_id,
  rating,
  review_text,
  created_at
`

const reviewWithReviewerFields = `
  ${reviewFields},
  reviewer:profiles!reviewer_user_id(
    id,
    display_name
  )
`

export function getReviewErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message || 'Something went wrong. Please try again.'

  if (/already reviewed/i.test(message)) {
    return 'You have already reviewed this order.'
  }

  return message
}

export function isDuplicateReviewError(error) {
  return /already reviewed/i.test(error?.message ?? '')
}

export function formatReviewTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatReviewDateShort(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatReviewerInitialName(displayName) {
  const trimmed = displayName?.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]

  const firstName = parts[0]
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  return `${firstName} ${lastInitial}.`
}

export function formatReviewRating(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(1)
}

export function formatReviewSummary(averageRating, reviewCount) {
  if (!reviewCount) return 'No reviews yet'

  return `${formatReviewRating(averageRating)} · ${reviewCount} review${
    reviewCount === 1 ? '' : 's'
  }`
}

export function formatReviewCompact(averageRating, reviewCount) {
  if (!reviewCount) return null
  return `${formatReviewRating(averageRating)} (${reviewCount})`
}

export function renderStarRating(rating) {
  const rounded = Math.max(REVIEW_MIN_RATING, Math.min(REVIEW_MAX_RATING, Math.round(rating)))
  return `${'★'.repeat(rounded)}${'☆'.repeat(REVIEW_MAX_RATING - rounded)}`
}

export function getReviewText(review) {
  return review?.review_text ?? review?.comment ?? ''
}

export function getReviewListingTitle(review) {
  const listingTitle = review?.listing_title
  if (typeof listingTitle === 'string' && listingTitle.trim()) {
    return listingTitle.trim()
  }

  const listing = review?.order?.listing
  const title = listing?.title?.trim()
  if (title) return title

  return 'Equipd listing'
}

export function getReviewVerifierLabel(review) {
  if (review?.is_buyer_reviewer === true) return 'Verified Buyer'
  if (review?.is_buyer_reviewer === false) return 'Verified Seller'

  const order = review?.order
  const reviewerId = review?.reviewer_user_id ?? review?.reviewer_id

  if (!order || !reviewerId) return 'Verified Buyer'
  if (reviewerId === order.buyer_id) return 'Verified Buyer'
  if (reviewerId === order.seller_id) return 'Verified Seller'
  return 'Verified Buyer'
}

export function isOrderReviewable(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED
}

export function getUserReviewForOrder(reviews, userId) {
  return (
    (reviews ?? []).find(
      (review) => review.reviewer_user_id === userId || review.reviewer_id === userId,
    ) ?? null
  )
}

export function hasUserReviewedOrder(userReviews, orderId, userId) {
  if (!userId || !orderId) return false

  return (userReviews ?? []).some(
    (review) =>
      review.order_id === orderId &&
      (review.reviewer_user_id === userId || review.reviewer_id === userId),
  )
}

export function canUserLeaveReview(order, userReviews, userId) {
  if (!userId || !isOrderReviewable(order)) return false
  return !hasUserReviewedOrder(userReviews, order.id, userId)
}

export function canUserReviewOrder(order, reviews, userId) {
  if (!userId || !isOrderReviewable(order)) return false
  return !getUserReviewForOrder(reviews, userId)
}

export function getRevieweeUserId(order, userId) {
  if (!order || !userId) return null

  if (order.buyer_id === userId) return order.seller_id
  if (order.seller_id === userId) return order.buyer_id
  return null
}

export function getReviewingRoleLabel(order, userId) {
  if (!order || !userId) return null

  if (order.buyer_id === userId) return 'Reviewing seller'
  if (order.seller_id === userId) return 'Reviewing buyer'
  return null
}

export function getRevieweeDisplayName(order, userId, revieweeProfile = null) {
  if (revieweeProfile) {
    return getProfileDisplayName(revieweeProfile)
  }

  if (!order || !userId) return 'the other party'

  if (order.buyer_id === userId) return 'Seller'
  if (order.seller_id === userId) return 'Buyer'
  return 'the other party'
}

export function buildLeaveReviewModalContext({
  order,
  userId,
  listing = null,
  revieweeProfile = null,
}) {
  const resolvedListing = listing ?? order?.listing ?? null
  const listingTitle = resolvedListing?.title?.trim() || 'Equipd listing'

  return {
    imageUrl: getListingPrimaryImageUrl(resolvedListing),
    listingTitle,
    orderReference: formatOrderReference(order?.id),
    revieweeName: getRevieweeDisplayName(order, userId, revieweeProfile),
    roleLabel: getReviewingRoleLabel(order, userId),
    revieweeUserId: getRevieweeUserId(order, userId),
  }
}

export async function fetchRevieweeProfileForOrder(order, userId) {
  const revieweeUserId = getRevieweeUserId(order, userId)

  if (!revieweeUserId) {
    return null
  }

  const profiles = await fetchPublicProfilesByIds([revieweeUserId])
  return profiles.get(revieweeUserId) ?? null
}

export function getRevieweeLabel(order, userId) {
  if (!order || !userId) return 'the other party'

  if (order.buyer_id === userId) return 'the seller'
  if (order.seller_id === userId) return 'the buyer'
  return 'the other party'
}

export function getReviewerRoleLabel(review, order) {
  if (!review || !order) return 'Participant'

  const reviewerId = review.reviewer_user_id ?? review.reviewer_id

  if (reviewerId === order.buyer_id) return 'Buyer'
  if (reviewerId === order.seller_id) return 'Seller'
  return 'Participant'
}

function normalizeRelation(value) {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeReviewer(review) {
  if (!review) return review

  return {
    ...review,
    reviewer: normalizeRelation(review.reviewer),
  }
}

function normalizeReviewSummaryRow(row) {
  if (!row) {
    return {
      averageRating: null,
      reviewCount: 0,
    }
  }

  const reviewCount = Number(row.review_count ?? row.reviewCount ?? 0)
  const averageRating =
    row.average_rating != null || row.averageRating != null
      ? Number(row.average_rating ?? row.averageRating)
      : null

  return {
    averageRating: reviewCount > 0 ? averageRating : null,
    reviewCount,
  }
}

export async function fetchReviewsForOrder(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(reviewWithReviewerFields)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  return { data: (data ?? []).map(normalizeReviewer), error }
}

export async function fetchReviewsForUser(userId, { limit = 5 } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('reviews')
    .select(reviewWithReviewerFields)
    .eq('reviewed_user_id', userId)
    .order('created_at', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  return { data: (data ?? []).map(normalizeReviewer), error }
}

export async function fetchUserReviewSummary(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('get_user_review_summary', {
    p_user_id: userId,
  })

  if (error) {
    return { data: null, error }
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : data

  return {
    data: normalizeReviewSummaryRow(row),
    error: null,
  }
}

/** @deprecated Use fetchUserReviewSummary */
export async function fetchSellerReviewSummary(sellerId) {
  return fetchUserReviewSummary(sellerId)
}

export async function fetchUserCompletedSalesCount(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('get_user_completed_sales_count', {
    p_user_id: userId,
  })

  return {
    data: error ? null : Number(data ?? 0),
    error,
  }
}

export async function fetchReviewsByReviewer(userId, { limit = 20 } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('reviews')
    .select(reviewWithReviewerFields)
    .eq('reviewer_user_id', userId)
    .order('created_at', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  return { data: (data ?? []).map(normalizeReviewer), error }
}

function normalizeHomepageReviewRow(row) {
  if (!row) return row

  return {
    id: row.id,
    order_id: row.order_id,
    reviewer_user_id: row.reviewer_user_id,
    rating: row.rating,
    review_text: row.review_text,
    created_at: row.created_at,
    listing_title: typeof row.listing_title === 'string' ? row.listing_title : null,
    is_buyer_reviewer: row.is_buyer_reviewer,
  }
}

export async function fetchRecentReviews({ limit = 6, includeOrderListing = false } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (includeOrderListing) {
    const { data, error } = await supabase.rpc('get_recent_reviews_for_homepage', {
      p_limit: limit,
    })

    return { data: (data ?? []).map(normalizeHomepageReviewRow), error }
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(reviewWithReviewerFields)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: (data ?? []).map(normalizeReviewer), error }
}

export async function fetchPlatformReviewSummary() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { count, error: countError } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    return { data: null, error: countError }
  }

  const reviewCount = count ?? 0

  if (!reviewCount) {
    return { data: { averageRating: null, reviewCount: 0 }, error: null }
  }

  const { data, error } = await supabase.from('reviews').select('rating.avg()').maybeSingle()

  if (error) {
    return { data: null, error }
  }

  const averageRating =
    data?.avg != null && !Number.isNaN(Number(data.avg)) ? Number(data.avg) : null

  return {
    data: {
      averageRating,
      reviewCount,
    },
    error: null,
  }
}

export async function submitReview({ orderId, rating, reviewText }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('submit_review', {
    p_order_id: orderId,
    p_rating: rating,
    p_review_text: reviewText?.trim() || null,
  })

  return { data, error }
}

/** @deprecated Use submitReview */
export async function createOrderReview({ orderId, rating, comment }) {
  return submitReview({ orderId, rating, reviewText: comment })
}
