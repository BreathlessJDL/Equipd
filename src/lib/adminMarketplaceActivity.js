/**
 * Admin marketplace activity helpers (pure — safe for Node tests).
 * Offer statuses mirror public.offer_status; do not invent values.
 */

import { getPublicUserName } from './publicUserName.js'

export const ADMIN_OFFER_STATUSES = Object.freeze([
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'countered',
  'cancelled',
])

export const ADMIN_ACTIVITY_CLASS_LABELS = Object.freeze({
  seller: 'Seller',
  buyer: 'Buyer activity',
  buyer_seller: 'Buyer + Seller',
  none: 'No marketplace activity',
})

/**
 * @param {string | null | undefined} activityClass
 */
export function formatAdminActivityClass(activityClass) {
  return ADMIN_ACTIVITY_CLASS_LABELS[activityClass] || ADMIN_ACTIVITY_CLASS_LABELS.none
}

/**
 * Build ordered status breakdown rows, always including every known status (zeros visible).
 * @param {Record<string, number> | null | undefined} byStatus
 */
export function buildAdminOfferStatusBreakdown(byStatus = {}) {
  const source = byStatus && typeof byStatus === 'object' ? byStatus : {}
  return ADMIN_OFFER_STATUSES.map((status) => ({
    status,
    count: Number(source[status]) || 0,
  }))
}

/**
 * Derive activity class from counts (client-side mirror of SQL).
 * Buyer signal uses buyer-initiated conversations only — not seller-side threads.
 */
export function deriveAdminActivityClass({
  listingCount = 0,
  savedCount = 0,
  offersMadeCount = 0,
  buyerConversationCount = 0,
} = {}) {
  const isSeller = Number(listingCount) > 0
  const isBuyer =
    Number(savedCount) > 0 ||
    Number(offersMadeCount) > 0 ||
    Number(buyerConversationCount) > 0

  if (isSeller && isBuyer) return 'buyer_seller'
  if (isSeller) return 'seller'
  if (isBuyer) return 'buyer'
  return 'none'
}

/**
 * Direction-aware: did this user make the offer row?
 * Counters from sellers use direction seller_to_buyer.
 */
export function adminOfferWasMadeBy(offer, userId) {
  if (!offer || !userId) return false
  const direction = offer.direction ?? 'buyer_to_seller'
  if (direction === 'buyer_to_seller') return String(offer.buyer_id) === String(userId)
  if (direction === 'seller_to_buyer') return String(offer.seller_id) === String(userId)
  return false
}

/**
 * Direction-aware: was this offer sent to the user?
 */
export function adminOfferWasReceivedBy(offer, userId) {
  if (!offer || !userId) return false
  const direction = offer.direction ?? 'buyer_to_seller'
  if (direction === 'buyer_to_seller') return String(offer.seller_id) === String(userId)
  if (direction === 'seller_to_buyer') return String(offer.buyer_id) === String(userId)
  return false
}

function normalizeParticipant(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id ?? null,
    username: raw.username ?? null,
    displayName: raw.displayName ?? raw.display_name ?? null,
    label: getPublicUserName({
      username: raw.username,
      display_name: raw.displayName ?? raw.display_name,
    }),
  }
}

function normalizeOfferRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    listingId: raw.listingId ?? raw.listing_id ?? null,
    listingTitle: raw.listingTitle ?? raw.listing_title ?? 'Listing unavailable',
    listingSlug: raw.listingSlug ?? raw.listing_slug ?? null,
    listingStatus: raw.listingStatus ?? raw.listing_status ?? null,
    amountPence: Number(raw.amountPence ?? raw.amount_pence) || 0,
    quantity: Number(raw.quantity) || 1,
    status: raw.status || 'pending',
    direction: raw.direction ?? 'buyer_to_seller',
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    otherParticipant: normalizeParticipant(raw.otherParticipant ?? raw.other_participant),
  }
}

function normalizeSavedRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    savedId: raw.savedId ?? raw.saved_id ?? raw.id,
    savedAt: raw.savedAt ?? raw.saved_at ?? raw.created_at ?? null,
    listingId: raw.listingId ?? raw.listing_id ?? null,
    listingTitle: raw.listingTitle ?? raw.listing_title ?? 'Listing unavailable',
    listingSlug: raw.listingSlug ?? raw.listing_slug ?? null,
    listingStatus: raw.listingStatus ?? raw.listing_status ?? 'unavailable',
    pricePence:
      raw.pricePence == null && raw.price_pence == null
        ? null
        : Number(raw.pricePence ?? raw.price_pence) || 0,
    seller: normalizeParticipant(raw.seller),
  }
}

function normalizeConversationRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    listingId: raw.listingId ?? raw.listing_id ?? null,
    listingTitle: raw.listingTitle ?? raw.listing_title ?? 'Listing',
    listingSlug: raw.listingSlug ?? raw.listing_slug ?? null,
    role: raw.role === 'seller' ? 'seller' : 'buyer',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    otherParticipant: normalizeParticipant(raw.otherParticipant ?? raw.other_participant),
  }
}

/**
 * @param {unknown} payload
 */
export function parseAdminUserMarketplaceActivity(payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  const user = data.user && typeof data.user === 'object' ? data.user : {}
  const summary = data.summary && typeof data.summary === 'object' ? data.summary : {}

  const offersMadeByStatus = buildAdminOfferStatusBreakdown(data.offersMadeByStatus)
  const offersReceivedByStatus = buildAdminOfferStatusBreakdown(data.offersReceivedByStatus)

  return {
    user: {
      id: user.id,
      username: user.username ?? null,
      displayName: user.displayName ?? user.display_name ?? null,
      email: user.email ?? null,
      createdAt: user.createdAt ?? user.created_at ?? null,
      isAdmin: user.isAdmin === true || user.is_admin === true,
      isOfficialEquipd: user.isOfficialEquipd === true || user.is_official_equipd === true,
      isSuspended: user.isSuspended === true || user.is_suspended === true,
    },
    summary: {
      listingCount: Number(summary.listingCount) || 0,
      savedCount: Number(summary.savedCount) || 0,
      conversationCount: Number(summary.conversationCount) || 0,
      offersMadeCount: Number(summary.offersMadeCount) || 0,
      offersReceivedCount: Number(summary.offersReceivedCount) || 0,
      purchaseCount: Number(summary.purchaseCount) || 0,
      saleCount: Number(summary.saleCount) || 0,
      activityClass: summary.activityClass || 'none',
      activityLabel: formatAdminActivityClass(summary.activityClass),
    },
    offersMadeByStatus,
    offersReceivedByStatus,
    offersMade: Array.isArray(data.offersMade)
      ? data.offersMade.map(normalizeOfferRow).filter(Boolean)
      : [],
    offersReceived: Array.isArray(data.offersReceived)
      ? data.offersReceived.map(normalizeOfferRow).filter(Boolean)
      : [],
    savedListings: Array.isArray(data.savedListings)
      ? data.savedListings.map(normalizeSavedRow).filter(Boolean)
      : [],
    conversations: Array.isArray(data.conversations)
      ? data.conversations.map(normalizeConversationRow).filter(Boolean)
      : [],
  }
}

/**
 * @param {unknown} payload
 */
export function parseAdminMarketplaceActivityStatistics(payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  const saved = data.savedListings && typeof data.savedListings === 'object' ? data.savedListings : {}
  const offers = data.offers && typeof data.offers === 'object' ? data.offers : {}
  const conversations =
    data.conversations && typeof data.conversations === 'object' ? data.conversations : {}

  return {
    savedListings: {
      total: Number(saved.total) || 0,
      last7Days: Number(saved.last7Days) || 0,
    },
    offers: {
      total: Number(offers.total) || 0,
      last7Days: Number(offers.last7Days) || 0,
      byStatus: buildAdminOfferStatusBreakdown(offers.byStatus),
      pending: Number(offers.byStatus?.pending) || 0,
      accepted: Number(offers.byStatus?.accepted) || 0,
    },
    conversations: {
      total: Number(conversations.total) || 0,
      last7Days: Number(conversations.last7Days) || 0,
    },
  }
}
