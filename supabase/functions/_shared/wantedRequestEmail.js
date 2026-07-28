/**
 * Wanted / equipment-request email formatting and composition helpers.
 * Shared by the create-wanted-request Edge Function.
 */

import { DEFAULT_EMAIL_LOGO_URL } from './transactionalEmailCore.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PRODUCTION_BASE_URL = 'https://www.equipd.co.uk'

const CONDITION_LABELS = {
  any: 'Any',
  new: 'New',
  used_excellent: 'Used – Excellent',
  used_good: 'Used – Good',
}

const RADIUS_LABELS = {
  '25': '25 miles',
  '50': '50 miles',
  '100': '100 miles',
  nationwide: 'Nationwide',
}

export const EQUIPMENT_REQUEST_SUPPORT_TO_DEFAULT = 'support@equipd.co.uk'
export const EQUIPMENT_REQUEST_TEMPLATE_KEY = 'equipment_request'

/**
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeWantedRequestPlainText(value) {
  return String(value ?? '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    // Strip NUL bytes that can break email providers / JSON logs.
    // eslint-disable-next-line no-control-regex -- intentional NUL strip
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatWantedRequestBudgetGbp(value) {
  if (value === null || value === undefined || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return ''

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * @param {unknown} radius
 * @returns {string}
 */
export function formatWantedRequestRadius(radius) {
  const key = String(radius ?? '').trim().toLowerCase()
  if (!key) return ''
  if (RADIUS_LABELS[key]) return RADIUS_LABELS[key]
  if (/^\d+$/.test(key)) return `${key} miles`
  return sanitizeWantedRequestPlainText(radius)
}

/**
 * @param {unknown} condition
 * @returns {string}
 */
export function formatWantedRequestCondition(condition) {
  const key = String(condition ?? '').trim().toLowerCase()
  if (!key) return ''
  return CONDITION_LABELS[key] || sanitizeWantedRequestPlainText(condition)
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
export function formatWantedRequestEquipmentName(payload = {}) {
  const entryMode = String(payload.entryMode ?? '').trim()

  if (entryMode === 'manual') {
    const brand = sanitizeWantedRequestPlainText(payload.manualBrand ?? payload.brand)
    const model = sanitizeWantedRequestPlainText(
      payload.manualModelName ?? payload.productName,
    )
    if (brand && model && brand.toLowerCase() !== 'unknown') {
      const modelHasBrand = model.toLowerCase().startsWith(brand.toLowerCase())
      return modelHasBrand ? model : `${brand} ${model}`.trim()
    }
    return model || brand || 'Equipment request'
  }

  const catalogueName = sanitizeWantedRequestPlainText(payload.productName)
  if (catalogueName) return catalogueName

  const brand = sanitizeWantedRequestPlainText(payload.brand)
  const model = sanitizeWantedRequestPlainText(payload.model)
  return [brand, model].filter(Boolean).join(' ').trim() || 'Equipment request'
}

/**
 * Best-effort first name for email greeting (profiles have no first_name column).
 * @param {Record<string, unknown> | null | undefined} profile
 * @param {string | null | undefined} email
 * @returns {string}
 */
export function resolveWantedRequestFirstName(profile, email) {
  const displayName = String(profile?.display_name ?? '').trim()
  if (displayName) {
    return displayName.split(/\s+/)[0] || ''
  }

  const username = String(profile?.username ?? '').trim()
  if (username) {
    return username.split(/[._\-\s]+/)[0] || username
  }

  const prefix = String(email ?? '')
    .split('@')[0]
    ?.trim()
  if (!prefix) return ''
  return prefix.split(/[._\-\s]+/)[0] || prefix
}

/**
 * @param {unknown} milesOrNationwide
 * @returns {number | null}
 */
export function wantedRequestRadiusToKm(milesOrNationwide) {
  const key = String(milesOrNationwide ?? '').trim().toLowerCase()
  if (!key || key === 'nationwide') return null
  const miles = Number(key)
  if (!Number.isFinite(miles) || miles <= 0) return null
  return Math.round(miles * 1.60934)
}

/**
 * @param {unknown} budgetPounds
 * @returns {number | null}
 */
export function wantedRequestBudgetToPence(budgetPounds) {
  if (budgetPounds === null || budgetPounds === undefined || budgetPounds === '') return null
  const amount = Number(budgetPounds)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isValidWantedRequestEmail(email) {
  return EMAIL_PATTERN.test(String(email ?? '').trim())
}

/**
 * Build dynamic template data for buyer + support copies of equipment_request.
 * @param {object} args
 * @param {Record<string, unknown>} args.payload
 * @param {Record<string, unknown> | null} [args.profile]
 * @param {string} args.buyerEmail
 * @param {'buyer' | 'support'} args.recipientType
 * @param {(key: string) => string} args.getEnv
 */
export function buildEquipmentRequestEmailDynamicData({
  payload,
  profile = null,
  buyerEmail,
  recipientType,
  getEnv,
}) {
  // getEnv reserved for future APP_BASE_URL overrides; emails use production URLs.
  void getEnv
  const equipmentName = formatWantedRequestEquipmentName(payload)
  const location = sanitizeWantedRequestPlainText(payload.location)
  const radius = formatWantedRequestRadius(payload.radius)
  const maximumBudget = formatWantedRequestBudgetGbp(payload.maximumBudget)
  const conditionPreference = formatWantedRequestCondition(payload.conditionPreference)
  const notes = sanitizeWantedRequestPlainText(payload.notes)
  const firstName = resolveWantedRequestFirstName(profile, buyerEmail)
  const year = String(new Date().getFullYear())
  const tagline = 'The marketplace for used gym equipment'

  if (recipientType === 'support') {
    return {
      subject: `New wanted request: ${equipmentName}`,
      title: 'New wanted equipment request',
      subtitle: 'A buyer has submitted a new wanted equipment request on Equipd.',
      preheader: 'A new wanted equipment request has been submitted.',
      base_url: PRODUCTION_BASE_URL,
      logo_url: DEFAULT_EMAIL_LOGO_URL,
      tagline,
      first_name: firstName,
      buyer_email: String(buyerEmail ?? '').trim(),
      equipment_name: equipmentName,
      location,
      radius,
      maximum_budget: maximumBudget,
      condition_preference: conditionPreference,
      notes,
      cta_text: '',
      cta_url: '',
      secondary_text: '',
      secondary_url: '',
      year,
    }
  }

  return {
    subject: "We've received your wanted equipment request",
    title: "We've received your wanted equipment request",
    subtitle:
      "Your request is now active and we'll let you know if matching equipment becomes available.",
    preheader: 'Your Equipd wanted equipment request is now active.',
    base_url: PRODUCTION_BASE_URL,
    logo_url: DEFAULT_EMAIL_LOGO_URL,
    tagline,
    first_name: firstName,
    equipment_name: equipmentName,
    location,
    radius,
    maximum_budget: maximumBudget,
    condition_preference: conditionPreference,
    notes,
    cta_text: 'View my wanted requests',
    cta_url: `${PRODUCTION_BASE_URL}/wanted`,
    secondary_text: 'Browse equipment',
    secondary_url: `${PRODUCTION_BASE_URL}/browse`,
    year,
    // Intentionally omit buyer_email for the buyer confirmation copy.
  }
}

export function buildEquipmentRequestIdempotencyKey(recipientType, wantedRequestId) {
  return `equipment_request:${recipientType}:${wantedRequestId}`
}

export function resolveEquipmentRequestSupportTo(getEnv) {
  return getEnv('SUPPORT_EMAIL_TO')?.trim() || EQUIPMENT_REQUEST_SUPPORT_TO_DEFAULT
}
