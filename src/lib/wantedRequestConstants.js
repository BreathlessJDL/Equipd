/**
 * Wanted-request shared constants.
 */

/** Show low-stock banner when matching active listings are in this inclusive range. */
export const WANTED_REQUEST_LOW_STOCK_MAX = 4
export const WANTED_REQUEST_LOW_STOCK_MIN = 1

/** @typedef {'homepage' | 'product_page' | 'browse_no_results' | 'browse_low_stock' | 'brand_page' | 'buyer_dashboard'} WantedRequestSource */

export const WANTED_REQUEST_SOURCES = Object.freeze({
  HOMEPAGE: 'homepage',
  PRODUCT_PAGE: 'product_page',
  BROWSE_NO_RESULTS: 'browse_no_results',
  BROWSE_LOW_STOCK: 'browse_low_stock',
  BRAND_PAGE: 'brand_page',
  BUYER_DASHBOARD: 'buyer_dashboard',
})

export const WANTED_REQUEST_RADIUS_OPTIONS = Object.freeze([
  { value: '25', label: '25 miles' },
  { value: '50', label: '50 miles' },
  { value: '100', label: '100 miles' },
  { value: 'nationwide', label: 'Nationwide' },
])

export const WANTED_REQUEST_DEFAULT_RADIUS = 'nationwide'

export const WANTED_REQUEST_CONDITION_OPTIONS = Object.freeze([
  { value: 'any', label: 'Any' },
  { value: 'new', label: 'New' },
  { value: 'used_excellent', label: 'Used – Excellent' },
  { value: 'used_good', label: 'Used – Good' },
])

export const WANTED_REQUEST_DEFAULT_CONDITION = 'any'

/** @typedef {'catalogue' | 'manual'} WantedRequestEntryMode */

export const WANTED_REQUEST_ENTRY_MODES = Object.freeze({
  CATALOGUE: 'catalogue',
  MANUAL: 'manual',
})

export const WANTED_REQUEST_UNKNOWN_BRAND = 'Unknown'

export const WANTED_REQUEST_EQUIPMENT_TYPE_OPTIONS = Object.freeze([
  { value: '', label: 'Select type (optional)' },
  { value: 'Treadmill', label: 'Treadmill' },
  { value: 'Cross Trainer', label: 'Cross Trainer' },
  { value: 'Exercise Bike', label: 'Exercise Bike' },
  { value: 'Rowing Machine', label: 'Rowing Machine' },
  { value: 'Strength Equipment', label: 'Strength Equipment' },
  { value: 'Multi-gym', label: 'Multi-gym' },
  { value: 'Other', label: 'Other' },
])

/** Account UI filters (not persisted in this stage). */
export const WANTED_REQUEST_ACCOUNT_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'match_found', label: 'Match found' },
  { id: 'expired', label: 'Expired' },
])

export const WANTED_REQUEST_ANALYTICS_EVENTS = Object.freeze({
  CTA_VIEWED: 'wanted_request_cta_viewed',
  CTA_CLICKED: 'wanted_request_cta_clicked',
  MODAL_OPENED: 'wanted_request_modal_opened',
  FORM_VALIDATION_FAILED: 'wanted_request_form_validation_failed',
  UI_COMPLETED: 'wanted_request_ui_completed',
})

export function isWantedRequestLowStockCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n)) return false
  return n >= WANTED_REQUEST_LOW_STOCK_MIN && n <= WANTED_REQUEST_LOW_STOCK_MAX
}
