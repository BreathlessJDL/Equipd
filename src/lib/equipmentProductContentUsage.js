/**
 * Product-content usage segments for AI overview generation.
 * Determines commercial / home / strength / light-commercial prompt rules.
 */

import { parseLifeFitnessHomeIdentity } from './lifeFitnessConsoleCompat.js'
import { parseMatrixHomeIdentity } from './matrixConsoleCompat.js'

export const CONTENT_USAGE_SEGMENT = Object.freeze({
  COMMERCIAL: 'commercial',
  PREMIUM_HOME: 'premium_home',
  HOME: 'home',
  /** @deprecated Alias of HOME — kept for older callers/tests. */
  HOME_USE: 'home',
  STRENGTH: 'strength',
  LIGHT_COMMERCIAL: 'light_commercial',
})

/** Connected / premium home fitness brands. */
export const PREMIUM_HOME_CONTENT_BRANDS = Object.freeze([
  'Peloton',
  'NordicTrack',
  'BowFlex',
  'Bowflex',
])

/** Mainstream home-use brands (not commercial gym lines). */
export const HOME_CONTENT_BRANDS = Object.freeze([
  'ProForm',
  'Pro Form',
  'Sole',
  'Sole Fitness',
  'Horizon',
  'Horizon Fitness',
  'York Fitness',
  'York',
  'Reebok',
  'Schwinn',
  'WaterRower',
  'Water Rower',
  'BH Fitness',
  'BH',
  'Spirit Fitness',
  'Spirit',
  'Powertec',
  'REP',
  'REP Fitness',
])

/** Brands that may be home or light commercial / studio. */
export const LIGHT_COMMERCIAL_CONTENT_BRANDS = Object.freeze([
  'Wattbike',
])

/** Full commercial / club catalogue brands. */
export const COMMERCIAL_CONTENT_BRANDS = Object.freeze([
  'Life Fitness',
  'Technogym',
  'Matrix Fitness',
  'Matrix',
  'Precor',
  'Cybex',
  'Woodway',
  'Hammer Strength',
  'Pulse Fitness',
  'Pulse',
  'StairMaster',
  'Stair Master',
])

/** Combined home-like brands (home + premium_home). */
export const HOME_USE_CONTENT_BRANDS = Object.freeze([
  ...PREMIUM_HOME_CONTENT_BRANDS,
  ...HOME_CONTENT_BRANDS,
])

const STRENGTH_EQUIPMENT_TYPE_KEYS = new Set([
  'selectorised strength',
  'plate loaded strength',
  'chest press',
  'shoulder press',
  'leg extension',
  'leg curl',
  'lat pulldown',
  'abdominal machine',
  'biceps curl',
  'triceps machine',
  'glute machine',
  'hip abductor/adductor',
  'back extension',
  'row machine',
  'strength machine',
  'leg press',
  'functional trainer',
  'cable machine',
  'cable / functional trainer',
  'multi gym',
  'bench',
  'rack',
  'rack/smith machine',
  'smith machine',
  'free weights',
  'accessories',
  'accessory',
])

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeBrandKey(brand) {
  return normalizeWhitespace(brand).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeTypeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

const PREMIUM_HOME_KEYS = new Set(PREMIUM_HOME_CONTENT_BRANDS.map(normalizeBrandKey))
const HOME_KEYS = new Set(HOME_CONTENT_BRANDS.map(normalizeBrandKey))
const LIGHT_COMMERCIAL_KEYS = new Set(LIGHT_COMMERCIAL_CONTENT_BRANDS.map(normalizeBrandKey))
const COMMERCIAL_KEYS = new Set(COMMERCIAL_CONTENT_BRANDS.map(normalizeBrandKey))
const HOME_LIKE_KEYS = new Set([...PREMIUM_HOME_KEYS, ...HOME_KEYS])

export function isPremiumHomeContentBrand(brand) {
  return PREMIUM_HOME_KEYS.has(normalizeBrandKey(brand))
}

export function isHomeContentBrand(brand) {
  return HOME_KEYS.has(normalizeBrandKey(brand))
}

export function isHomeUseContentBrand(brand) {
  return HOME_LIKE_KEYS.has(normalizeBrandKey(brand))
}

export function isLightCommercialContentBrand(brand) {
  return LIGHT_COMMERCIAL_KEYS.has(normalizeBrandKey(brand))
}

export function isCommercialContentBrand(brand) {
  return COMMERCIAL_KEYS.has(normalizeBrandKey(brand))
}

export function isHomeLikeUsageSegment(segment) {
  return segment === CONTENT_USAGE_SEGMENT.HOME
    || segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME
    || segment === 'home_use'
}

export function isStrengthEquipmentType(equipmentType) {
  const key = normalizeTypeKey(equipmentType)
  if (!key) return false
  if (STRENGTH_EQUIPMENT_TYPE_KEYS.has(key)) return true
  return /\b(press|curl|extension|pulldown|abductor|adductor|bench|rack|smith|functional|cable|multi[\s-]?gym|plate[\s-]?loaded|selectorised|free weights)\b/i.test(key)
}

function familyHintsSegment(product = {}) {
  const haystack = [
    product.product_family,
    product.series,
    product.model,
    product.canonical_product_name,
    product.equipment_type,
  ].map(normalizeWhitespace).filter(Boolean).join(' ').toLowerCase()

  if (!haystack) return null
  if (/\blight[\s-]?commercial\b/.test(haystack) || /\bstudio\b/.test(haystack) || /\bpt studio\b/.test(haystack)) {
    return CONTENT_USAGE_SEGMENT.LIGHT_COMMERCIAL
  }
  if (/\bhome[\s-]?use\b/.test(haystack) || /\bhome gym\b/.test(haystack) || /\bresidential\b/.test(haystack)) {
    return CONTENT_USAGE_SEGMENT.HOME
  }
  return null
}

/**
 * Resolve usage segment from brand, equipment type, family and known catalogues.
 * Strength equipment stays neutral unless a brand forces home/commercial cardio framing.
 * Dual commercial/home brands (Life Fitness, Matrix): home catalogue identities use home wording.
 */
export function resolveProductContentUsageSegment(product = {}) {
  // Life Fitness / Matrix home ranges on otherwise-commercial brands.
  if (parseLifeFitnessHomeIdentity(product) || parseMatrixHomeIdentity(product)) {
    return CONTENT_USAGE_SEGMENT.HOME
  }

  const brand = product?.brand
  const brandKey = normalizeBrandKey(brand)
  const equipmentType = product?.equipment_type

  if (isStrengthEquipmentType(equipmentType)) {
    // Home-brand strength stays home-like (never claim commercial gym use).
    if (PREMIUM_HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.PREMIUM_HOME
    if (HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.HOME
    // Commercial / unknown strength → neutral strength wording.
    return CONTENT_USAGE_SEGMENT.STRENGTH
  }

  if (PREMIUM_HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.PREMIUM_HOME
  if (HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.HOME
  if (LIGHT_COMMERCIAL_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.LIGHT_COMMERCIAL
  if (COMMERCIAL_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.COMMERCIAL

  const hinted = familyHintsSegment(product)
  if (hinted) return hinted

  return CONTENT_USAGE_SEGMENT.COMMERCIAL
}
