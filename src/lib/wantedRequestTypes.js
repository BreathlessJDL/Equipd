/**
 * Wanted-request payload types and client validation.
 */

import {
  WANTED_REQUEST_ENTRY_MODES,
  WANTED_REQUEST_UNKNOWN_BRAND,
} from './wantedRequestConstants.js'

/**
 * @typedef {Object} WantedRequestProductSummary
 * @property {string | null} [productId]
 * @property {string | null} [canonicalProductKey]
 * @property {string} [productName]
 * @property {string | null} [brand]
 * @property {string | null} [equipmentType]
 * @property {string | null} [imageUrl]
 */

/**
 * @typedef {Object} WantedRequestPayload
 * @property {'catalogue' | 'manual'} entryMode
 * @property {string | null} productId
 * @property {string | null} canonicalProductKey
 * @property {string | null} productName
 * @property {string | null} brand
 * @property {string | null} equipmentType
 * @property {string | null} manualBrand
 * @property {string | null} manualModelName
 * @property {string | null} searchTerm
 * @property {string} location
 * @property {string} radius
 * @property {number | null} maximumBudget
 * @property {string} conditionPreference
 * @property {string} notes
 * @property {string} email
 * @property {string} source
 * @property {string} currentPageUrl
 * @property {string} createdAt
 * @property {boolean} saveAsAlert
 */

/**
 * @typedef {Object} WantedRequestFormValues
 * @property {'catalogue' | 'manual'} entryMode
 * @property {WantedRequestProductSummary | null} product
 * @property {string} equipmentQuery
 * @property {string} manualBrand
 * @property {string} manualModelName
 * @property {string} manualEquipmentType
 * @property {string | null} [searchTerm]
 * @property {string} location
 * @property {string} radius
 * @property {string} maximumBudget
 * @property {string} conditionPreference
 * @property {string} notes
 * @property {string} email
 * @property {boolean} saveAsAlert
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidWantedRequestEmail(value) {
  const email = String(value ?? '').trim()
  if (!email) return false
  return EMAIL_PATTERN.test(email)
}

/**
 * Parse optional £ budget input into a non-negative number, or null when empty.
 * @param {string} raw
 * @returns {{ value: number | null, error: string | null }}
 */
export function parseWantedRequestBudget(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { value: null, error: null }

  const normalised = text.replace(/£/g, '').replace(/,/g, '').trim()
  if (!normalised) return { value: null, error: null }

  const amount = Number(normalised)
  if (!Number.isFinite(amount)) {
    return { value: null, error: 'Enter a valid budget amount.' }
  }
  if (amount < 0) {
    return { value: null, error: 'Budget cannot be negative.' }
  }

  return { value: amount, error: null }
}

export function isWantedRequestCatalogueSelectionValid(product) {
  if (!product || typeof product !== 'object') return false
  return Boolean(product.productId || product.canonicalProductKey)
}

/**
 * @param {WantedRequestFormValues} values
 * @param {{ requireEmail?: boolean, source?: string }} [options]
 * @returns {{ ok: true, payload: WantedRequestPayload } | { ok: false, errors: Record<string, string> }}
 */
export function validateWantedRequestForm(values, options = {}) {
  const requireEmail = options.requireEmail !== false
  const entryMode =
    values.entryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL
      ? WANTED_REQUEST_ENTRY_MODES.MANUAL
      : WANTED_REQUEST_ENTRY_MODES.CATALOGUE

  /** @type {Record<string, string>} */
  const errors = {}

  if (entryMode === WANTED_REQUEST_ENTRY_MODES.CATALOGUE) {
    if (!isWantedRequestCatalogueSelectionValid(values.product)) {
      errors.equipment = 'Select equipment from the catalogue, or enter it manually.'
    }
  } else {
    const manualModel = String(values.manualModelName ?? '').trim()
    const manualBrand = String(values.manualBrand ?? '').trim()
    if (!manualModel) {
      errors.manualModelName = 'Enter the model or equipment name.'
    }
    if (!manualBrand) {
      errors.manualBrand = 'Enter a brand, or choose Unknown.'
    }
  }

  if (requireEmail) {
    const email = String(values.email ?? '').trim()
    if (!email) {
      errors.email = 'Enter your email address.'
    } else if (!isValidWantedRequestEmail(email)) {
      errors.email = 'Enter a valid email address.'
    }
  }

  const budget = parseWantedRequestBudget(values.maximumBudget)
  if (budget.error) {
    errors.maximumBudget = budget.error
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    payload: createWantedRequestPayload({
      entryMode,
      product: values.product,
      manualBrand: values.manualBrand,
      manualModelName: values.manualModelName,
      equipmentType:
        entryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL
          ? values.manualEquipmentType
          : values.product?.equipmentType,
      searchTerm: values.searchTerm,
      location: values.location,
      radius: values.radius,
      maximumBudget: budget.value,
      conditionPreference: values.conditionPreference,
      notes: values.notes,
      email: String(values.email ?? '').trim(),
      source: options.source,
      saveAsAlert: Boolean(values.saveAsAlert),
    }),
  }
}

/**
 * @param {Object} input
 * @param {'catalogue' | 'manual'} [input.entryMode]
 * @param {WantedRequestProductSummary | null} [input.product]
 * @param {string} [input.manualBrand]
 * @param {string} [input.manualModelName]
 * @param {string | null} [input.equipmentType]
 * @param {string | null} [input.searchTerm]
 * @param {string} [input.location]
 * @param {string} [input.radius]
 * @param {number | null} [input.maximumBudget]
 * @param {string} [input.conditionPreference]
 * @param {string} [input.notes]
 * @param {string} [input.email]
 * @param {string} [input.source]
 * @param {boolean} [input.saveAsAlert]
 * @param {string} [input.currentPageUrl]
 * @returns {WantedRequestPayload}
 */
export function createWantedRequestPayload(input = {}) {
  const entryMode =
    input.entryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL
      ? WANTED_REQUEST_ENTRY_MODES.MANUAL
      : WANTED_REQUEST_ENTRY_MODES.CATALOGUE
  const product = input.product ?? null

  if (entryMode === WANTED_REQUEST_ENTRY_MODES.MANUAL) {
    const manualBrand = String(input.manualBrand ?? '').trim() || null
    const manualModelName = String(input.manualModelName ?? '').trim() || null
    const equipmentType = String(input.equipmentType ?? '').trim() || null

    return {
      entryMode,
      productId: null,
      canonicalProductKey: null,
      productName: manualModelName,
      brand: manualBrand,
      equipmentType,
      manualBrand,
      manualModelName,
      searchTerm: String(input.searchTerm ?? '').trim() || null,
      location: String(input.location ?? '').trim(),
      radius: String(input.radius ?? 'nationwide'),
      maximumBudget: input.maximumBudget ?? null,
      conditionPreference: String(input.conditionPreference ?? 'any'),
      notes: String(input.notes ?? '').trim(),
      email: String(input.email ?? '').trim(),
      source: String(input.source ?? 'homepage'),
      currentPageUrl:
        input.currentPageUrl ||
        (typeof window !== 'undefined' ? window.location.href : ''),
      createdAt: new Date().toISOString(),
      saveAsAlert: Boolean(input.saveAsAlert),
    }
  }

  const productName = String(product?.productName ?? '').trim() || null

  return {
    entryMode,
    productId: product?.productId ?? null,
    canonicalProductKey: product?.canonicalProductKey ?? null,
    productName,
    brand: product?.brand ?? null,
    equipmentType: product?.equipmentType ?? null,
    manualBrand: null,
    manualModelName: null,
    searchTerm: String(input.searchTerm ?? '').trim() || null,
    location: String(input.location ?? '').trim(),
    radius: String(input.radius ?? 'nationwide'),
    maximumBudget: input.maximumBudget ?? null,
    conditionPreference: String(input.conditionPreference ?? 'any'),
    notes: String(input.notes ?? '').trim(),
    email: String(input.email ?? '').trim(),
    source: String(input.source ?? 'homepage'),
    currentPageUrl:
      input.currentPageUrl ||
      (typeof window !== 'undefined' ? window.location.href : ''),
    createdAt: new Date().toISOString(),
    saveAsAlert: Boolean(input.saveAsAlert),
  }
}

/**
 * Build a product summary from an equipment catalogue / page product.
 * @param {Record<string, unknown> | null | undefined} product
 * @param {{ imageUrl?: string | null, productName?: string | null }} [extras]
 * @returns {WantedRequestProductSummary | null}
 */
export function toWantedRequestProductSummary(product, extras = {}) {
  if (!product) return null

  const productName =
    extras.productName ||
    product.canonical_product_name ||
    [product.brand, product.model].filter(Boolean).join(' ') ||
    ''

  if (!String(productName).trim()) return null

  return {
    productId: product.id != null ? String(product.id) : null,
    canonicalProductKey: product.canonical_product_key
      ? String(product.canonical_product_key)
      : null,
    productName: String(productName).trim(),
    brand: product.brand != null ? String(product.brand) : null,
    equipmentType: product.equipment_type != null ? String(product.equipment_type) : null,
    imageUrl: extras.imageUrl ?? null,
  }
}

export { WANTED_REQUEST_UNKNOWN_BRAND }
