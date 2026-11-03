/**
 * Consent-gated buyer conversion events for GA4.
 * Uses trackEvent from analytics.js — never sends before analytics consent.
 * Marketplace actions must keep working if tracking throws or is blocked.
 *
 * Recommended ecommerce events (view_item, view_item_list, select_item,
 * begin_checkout, purchase) follow GA4 item/currency/value shape.
 * Custom events contact_seller and submit_offer are separate funnel steps:
 * an offer that also opens a conversation can fire both. Do not add them
 * together as unique buyer counts.
 */

import { trackEvent } from './analytics.js'

export const BUYER_CONVERSION_EVENTS = Object.freeze({
  VIEW_ITEM: 'view_item',
  VIEW_ITEM_LIST: 'view_item_list',
  SELECT_ITEM: 'select_item',
  SEARCH: 'search',
  CONTACT_SELLER: 'contact_seller',
  SUBMIT_OFFER: 'submit_offer',
  BEGIN_CHECKOUT: 'begin_checkout',
  PURCHASE: 'purchase',
})

export const GA4_CURRENCY = 'GBP'
export const PURCHASE_DEDUPE_PREFIX = 'equipd.ga4.purchase.'

const MAX_LIST_ITEMS = 12
const MAX_SEARCH_TERM = 80
const MAX_CITY = 60

const BLOCKED_PARAM_PATTERN =
  /email|phone|address|message|user_id|buyer_id|seller_id|token|secret|password|credential|intent_id|session_id|postcode|street|^name$|_name$/i

const ALLOWED_PARAM_KEYS = new Set([
  'item_id',
  'item_brand',
  'item_category',
  'item_list_id',
  'item_list_name',
  'index',
  'price',
  'quantity',
  'currency',
  'value',
  'tax',
  'items',
  'listing_id',
  'location_city',
  'page_type',
  'search_term',
  'transaction_id',
])

const viewedItemIds = new Set()
const viewedListSignatures = new Set()

function safeTrack(eventName, params) {
  try {
    return trackEvent(eventName, sanitizeEventParams(params))
  } catch {
    return false
  }
}

export function penceToGa4Value(pence) {
  if (pence == null || pence === '') return undefined
  const numeric = Number(pence)
  if (!Number.isFinite(numeric) || numeric < 0) return undefined
  return Math.round(numeric) / 100
}

export function listingCityOnly(listing) {
  const city = String(listing?.city || '').trim()
  if (!city) return undefined
  if (/\d/.test(city)) return undefined
  if (city.includes('@') || city.includes(',')) return undefined
  return city.slice(0, MAX_CITY)
}

export function resolvePageType(pathname = '') {
  const path = String(pathname || '').split('?')[0]
  if (path === '/' || path === '') return 'home'
  if (path === '/browse') return 'browse'
  if (path === '/buy-used-gym-equipment') return 'buy'
  if (path.startsWith('/listings/') && path.endsWith('/edit')) return 'listing_edit'
  if (/^\/listings\/(leeds|manchester|birmingham|london|sheffield|bristol|liverpool|newcastle|glasgow|cardiff)$/.test(path)) {
    return 'location'
  }
  if (path.startsWith('/listings/')) return 'listing'
  if (path.startsWith('/brands/')) return 'brand'
  if (path.startsWith('/equipment/')) return 'equipment'
  if (path.startsWith('/orders/')) return 'order'
  if (path.startsWith('/messages')) return 'messages'
  if (path.startsWith('/shop/') || path.startsWith('/u/')) return 'shop'
  if (path.startsWith('/used-') || path.startsWith('/home-') || path.startsWith('/commercial-')) {
    return 'landing'
  }
  return 'other'
}

export function currentPageType() {
  if (typeof window === 'undefined') return 'other'
  return resolvePageType(window.location.pathname)
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export function sanitizeEventParams(params = {}) {
  const next = {}
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAM_KEYS.has(key) && BLOCKED_PARAM_PATTERN.test(key)) continue
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) continue
    next[key] = value
  }
  if (Array.isArray(params.items)) {
    next.items = params.items.map((item) => sanitizeEventParams(item)).filter((item) => item.item_id)
  }
  return compact(next)
}

export function buildGa4Item(listing, extras = {}) {
  if (!listing?.id) return null
  const category = listing.category?.name || listing.category?.slug || listing.category_name || undefined
  return compact({
    item_id: String(listing.id),
    item_brand: listing.brand ? String(listing.brand).slice(0, 80) : undefined,
    item_category: category ? String(category).slice(0, 80) : undefined,
    price: penceToGa4Value(listing.price_pence ?? listing.price),
    quantity: 1,
    ...extras,
  })
}

function itemListFields(itemListId, itemListName, index) {
  return compact({
    item_list_id: itemListId || undefined,
    item_list_name: itemListName || undefined,
    index: Number.isFinite(index) ? index : undefined,
  })
}

function itemsValue(items = []) {
  const total = items.reduce((sum, item) => {
    const price = Number(item?.price)
    const quantity = Number(item?.quantity) || 1
    if (!Number.isFinite(price)) return sum
    return sum + price * quantity
  }, 0)
  return Number.isFinite(total) ? Number(total.toFixed(2)) : undefined
}

function listingContextParams(listing) {
  if (!listing) return {}
  return compact({
    listing_id: listing.id ? String(listing.id) : undefined,
    item_category: listing.category?.name || listing.category?.slug || undefined,
    item_brand: listing.brand ? String(listing.brand).slice(0, 80) : undefined,
    location_city: listingCityOnly(listing),
    page_type: currentPageType(),
  })
}

export function trackViewItem(listing) {
  const item = buildGa4Item(listing)
  if (!item) return false
  if (viewedItemIds.has(item.item_id)) return false
  viewedItemIds.add(item.item_id)
  const value = item.price
  return safeTrack(BUYER_CONVERSION_EVENTS.VIEW_ITEM, {
    currency: value != null ? GA4_CURRENCY : undefined,
    value,
    items: [item],
    ...listingContextParams(listing),
  })
}

export function trackViewItemList({ listings = [], itemListId, itemListName } = {}) {
  const items = (Array.isArray(listings) ? listings : [])
    .slice(0, MAX_LIST_ITEMS)
    .map((listing, index) => buildGa4Item(listing, itemListFields(itemListId, itemListName, index)))
    .filter(Boolean)
  if (!items.length) return false
  const signature = `${itemListId || ''}:${items.map((item) => item.item_id).join(',')}`
  if (viewedListSignatures.has(signature)) return false
  viewedListSignatures.add(signature)
  return safeTrack(BUYER_CONVERSION_EVENTS.VIEW_ITEM_LIST, {
    item_list_id: itemListId || undefined,
    item_list_name: itemListName || undefined,
    items,
    page_type: currentPageType(),
  })
}

export function trackSelectItem(listing, { itemListId, itemListName } = {}) {
  const item = buildGa4Item(listing, itemListFields(itemListId, itemListName, 0))
  if (!item) return false
  return safeTrack(BUYER_CONVERSION_EVENTS.SELECT_ITEM, {
    item_list_id: itemListId || undefined,
    item_list_name: itemListName || undefined,
    items: [item],
    ...listingContextParams(listing),
  })
}

export function trackEquipmentSearch(searchTerm) {
  const term = String(searchTerm || '').trim().slice(0, MAX_SEARCH_TERM)
  if (!term) return false
  if (term.includes('@') || /\d{6,}/.test(term)) return false
  return safeTrack(BUYER_CONVERSION_EVENTS.SEARCH, {
    search_term: term,
    page_type: currentPageType(),
  })
}

export function trackContactSeller(listing, { isBuyer = true } = {}) {
  if (!isBuyer) return false
  const item = buildGa4Item(listing)
  return safeTrack(BUYER_CONVERSION_EVENTS.CONTACT_SELLER, {
    items: item ? [item] : undefined,
    ...listingContextParams(listing),
  })
}

export function trackSubmitOffer(listing, { amountPence, isBuyer = true } = {}) {
  if (!isBuyer) return false
  const item = buildGa4Item(listing)
  const value = penceToGa4Value(amountPence)
  return safeTrack(BUYER_CONVERSION_EVENTS.SUBMIT_OFFER, {
    currency: value != null ? GA4_CURRENCY : undefined,
    value,
    items: item ? [item] : undefined,
    ...listingContextParams(listing),
  })
}

export function trackBeginCheckout({ listing, payment, isBuyer = true } = {}) {
  if (!isBuyer) return false
  const quantity = Number(payment?.quantity || 1) || 1
  const item = buildGa4Item(listing, {
    quantity,
    price: penceToGa4Value(
      payment?.agreed_unit_price_pence
        ?? payment?.listing_unit_price_pence
        ?? listing?.price_pence,
    ),
  })
  const value = itemsValue(item ? [item] : [])
    ?? penceToGa4Value(payment?.item_subtotal_pence ?? listing?.price_pence)
  return safeTrack(BUYER_CONVERSION_EVENTS.BEGIN_CHECKOUT, {
    currency: value != null ? GA4_CURRENCY : undefined,
    value,
    items: item ? [item] : undefined,
    ...listingContextParams(listing),
  })
}

function purchaseStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const trackedPurchaseIds = new Set()

export function purchaseDedupeKey(paymentId) {
  return `${PURCHASE_DEDUPE_PREFIX}${paymentId}`
}

export function hasTrackedPurchase(paymentId) {
  if (!paymentId) return true
  const id = String(paymentId)
  if (trackedPurchaseIds.has(id)) return true
  const storage = purchaseStorage()
  try {
    if (storage?.getItem(purchaseDedupeKey(id))) return true
  } catch {
    return trackedPurchaseIds.has(id)
  }
  return false
}

export function markPurchaseTracked(paymentId) {
  if (!paymentId) return
  const id = String(paymentId)
  trackedPurchaseIds.add(id)
  try {
    purchaseStorage()?.setItem(purchaseDedupeKey(id), '1')
  } catch {
    // ignore quota / private mode
  }
}

export function resetPurchaseDedupeForTesting() {
  trackedPurchaseIds.clear()
  viewedItemIds.clear()
  viewedListSignatures.clear()
  const storage = purchaseStorage()
  if (!storage) return
  try {
    const keys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(PURCHASE_DEDUPE_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch {
    // ignore
  }
}

/**
 * Fire purchase only after payment.status is paid, once per Equipd payment id.
 * transaction_id is the marketplace payment UUID, not a Stripe identifier.
 * Does not use checkout redirects or button clicks as the conversion.
 * Clearing localStorage can allow a later client retry; GA4 still dedupes
 * on transaction_id.
 */
export function trackPurchase({ payment, order, listing, viewerRole } = {}) {
  if (viewerRole && viewerRole !== 'buyer') return false
  if (payment?.status !== 'paid') return false
  const paymentId = payment?.id
  if (!paymentId || hasTrackedPurchase(paymentId)) return false

  const itemListing = listing || order?.listing || null
  const quantity = Number(payment.quantity || order?.quantity || 1) || 1
  const item = buildGa4Item(itemListing, {
    quantity,
    price: penceToGa4Value(
      payment.agreed_unit_price_pence
        ?? payment.listing_unit_price_pence
        ?? itemListing?.price_pence,
    ),
  })
  const value = itemsValue(item ? [item] : [])
    ?? penceToGa4Value(payment.item_subtotal_pence ?? order?.item_subtotal_pence)
  const tax = penceToGa4Value(
    payment.buyer_protection_fee_pence ?? order?.buyer_protection_fee_pence,
  )

  const sent = safeTrack(BUYER_CONVERSION_EVENTS.PURCHASE, {
    transaction_id: String(paymentId),
    currency: GA4_CURRENCY,
    value,
    tax,
    items: item ? [item] : undefined,
    ...listingContextParams(itemListing),
    page_type: currentPageType(),
  })
  if (sent) markPurchaseTracked(paymentId)
  return sent
}
