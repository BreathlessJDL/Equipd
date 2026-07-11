import { emptyListingForm } from './createListingForm.js'
import { LISTING_CATEGORY_OPTIONS } from './listingOptions.js'
import { resolveManufactureYearSelectValue } from './equipmentValuation.js'

const VALUATION_TO_LISTING_CONDITION = {
  Excellent: 'like_new',
  Good: 'good',
  Fair: 'fair',
  Poor: 'poor',
  Faulty: 'poor',
}

function hasPrefillValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return Boolean(value.trim())
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

function isEmptyPrefillValue(value) {
  return !hasPrefillValue(value)
}

const EQUIPMENT_TYPE_CATEGORY_RULES = [
  { pattern: /treadmill|\brun\b/i, slug: 'treadmill' },
  { pattern: /crosstrainer|cross[\s-]?trainer|elliptical/i, slug: 'crosstrainers' },
  { pattern: /recumbent/i, slug: 'recumbent-bikes' },
  { pattern: /spin/i, slug: 'spin-bikes' },
  { pattern: /upright bike|indoor bike|^bike$/i, slug: 'upright-bikes' },
  { pattern: /stair|stepper|climber/i, slug: 'stairclimbers' },
  { pattern: /upper body/i, slug: 'upper-body-bikes' },
  { pattern: /assault/i, slug: 'assault-bike' },
  { pattern: /rower|rowing/i, slug: 'rowers' },
  { pattern: /skierg|ski[\s-]?erg/i, slug: 'skierg' },
  { pattern: /plate loaded/i, slug: 'plate-loaded-machine' },
  { pattern: /pin loaded/i, slug: 'pin-loaded-machine' },
  { pattern: /multi[\s-]?gym/i, slug: 'multi-gyms' },
  { pattern: /cable pulley|dual cable/i, slug: 'dual-cable-pulley' },
  { pattern: /squat rack/i, slug: 'squat-rack' },
  { pattern: /\bbench\b/i, slug: 'bench' },
  { pattern: /dumbbell/i, slug: 'dumbbells' },
  { pattern: /weight plate/i, slug: 'weight-plates' },
  { pattern: /barbell/i, slug: 'barbells' },
  { pattern: /functional/i, slug: 'functional' },
]

export function buildCreateListingFromEquipmentPath(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return '/sell'
  return `/sell?equipment=${encodeURIComponent(key)}`
}

export function mapValuationConditionToListingCondition(condition) {
  const normalized = String(condition ?? '').trim()
  if (!normalized) return ''
  return VALUATION_TO_LISTING_CONDITION[normalized] ?? normalized.toLowerCase()
}

export function parseValuationListingSearchParams(searchParams) {
  const source = searchParams?.get?.('source')?.trim()
  if (source !== 'valuation') return null

  return {
    productId: searchParams.get('productId')?.trim() || '',
    equipmentKey: searchParams.get('equipment')?.trim() || '',
    title: searchParams.get('title')?.trim() || '',
    brand: searchParams.get('brand')?.trim() || '',
    model: searchParams.get('model')?.trim() || '',
    year: searchParams.get('year')?.trim() || '',
    condition: searchParams.get('condition')?.trim() || '',
    console: searchParams.get('console')?.trim() || '',
    estimatedMid: searchParams.get('estimatedMid')?.trim() || '',
    estimatedLow: searchParams.get('estimatedLow')?.trim() || '',
    estimatedHigh: searchParams.get('estimatedHigh')?.trim() || '',
    currency: searchParams.get('currency')?.trim() || 'GBP',
  }
}

export function mergeListingFormPrefill(current = emptyListingForm, prefill = emptyListingForm) {
  const merged = { ...current }

  for (const [key, value] of Object.entries(prefill)) {
    if (isEmptyPrefillValue(value)) continue
    if (!isEmptyPrefillValue(current?.[key])) continue
    merged[key] = value
  }

  return merged
}

export function buildCreateListingFromValuationPath({
  product,
  valuation,
  condition,
  manufactureYear = null,
  consoleName = null,
  displayName = '',
} = {}) {
  const params = new URLSearchParams()
  params.set('source', 'valuation')

  if (product?.id) params.set('productId', product.id)
  if (product?.canonical_product_key) params.set('equipment', product.canonical_product_key)

  const title = String(displayName || product?.canonical_product_name || '').trim()
  if (title) params.set('title', title)
  if (product?.brand) params.set('brand', product.brand)

  const model = String(product?.canonical_product_name || product?.model || '').trim()
  if (model) params.set('model', model)

  const year = manufactureYear ?? valuation?.depreciation_year_used
  if (year != null && year !== '') {
    const clamped = resolveManufactureYearSelectValue(product, String(year))
    if (clamped) params.set('year', clamped)
  }

  const listingCondition = mapValuationConditionToListingCondition(condition)
  if (listingCondition) params.set('condition', listingCondition)

  if (consoleName) params.set('console', consoleName)

  if (valuation?.estimated_mid != null) params.set('estimatedMid', String(valuation.estimated_mid))
  if (valuation?.estimated_low != null) params.set('estimatedLow', String(valuation.estimated_low))
  if (valuation?.estimated_high != null) params.set('estimatedHigh', String(valuation.estimated_high))
  if (valuation?.currency) params.set('currency', valuation.currency)

  return `/sell?${params.toString()}`
}

export function buildListingFormPrefillFromValuationParams(params, categories = []) {
  if (!params) return { ...emptyListingForm }

  const prefill = { ...emptyListingForm }

  if (params.title) prefill.title = params.title
  if (params.brand) prefill.brand = params.brand
  if (params.model) prefill.model = params.model
  if (params.productId) prefill.equipmentProductId = params.productId
  if (params.equipmentKey) prefill.equipmentProductKey = params.equipmentKey
  if (params.condition) prefill.condition = params.condition
  if (params.estimatedMid) prefill.price = params.estimatedMid

  if (params.equipmentKey && categories.length) {
    // Category is resolved once the equipment product is fetched.
  }

  return prefill
}

export function buildListingFormPrefillFromValuation({
  product,
  categories = [],
  valuationParams = null,
  valuation = null,
  condition = null,
  displayName = '',
} = {}) {
  const productPrefill = product
    ? buildListingFormPrefillFromEquipmentProduct(product, categories)
    : { ...emptyListingForm }

  const prefill = { ...productPrefill }

  const title = displayName || valuationParams?.title || product?.canonical_product_name || ''
  if (title) prefill.title = title

  if (valuationParams?.brand || product?.brand) {
    prefill.brand = valuationParams?.brand || product.brand
  }

  const model = valuationParams?.model || product?.canonical_product_name || product?.model || ''
  if (model) prefill.model = model

  const listingCondition = valuationParams?.condition
    || mapValuationConditionToListingCondition(condition || valuation?.condition)
  if (listingCondition) prefill.condition = listingCondition

  const suggestedPrice = valuationParams?.estimatedMid
    || (valuation?.estimated_mid != null ? String(valuation.estimated_mid) : '')
  if (suggestedPrice) prefill.price = suggestedPrice

  if (valuationParams?.productId || product?.id) {
    prefill.equipmentProductId = valuationParams?.productId || product.id
  }
  if (valuationParams?.equipmentKey || product?.canonical_product_key) {
    prefill.equipmentProductKey = valuationParams?.equipmentKey || product.canonical_product_key
  }

  if (product?.product_family) prefill.equipmentProductFamily = product.product_family
  if (product?.original_base_price != null) prefill.estimatedOriginalRrp = product.original_base_price
  if (product?.original_base_price_currency) {
    prefill.estimatedOriginalRrpCurrency = product.original_base_price_currency
  } else if (valuationParams?.currency) {
    prefill.estimatedOriginalRrpCurrency = valuationParams.currency
  }

  return prefill
}

export function resolveCategorySlugForEquipmentType(equipmentType) {
  const normalized = String(equipmentType ?? '').trim()
  if (!normalized) return null

  for (const rule of EQUIPMENT_TYPE_CATEGORY_RULES) {
    if (rule.pattern.test(normalized)) return rule.slug
  }

  return null
}

export function resolveCategoryIdForEquipmentType(equipmentType, categories = []) {
  const slug = resolveCategorySlugForEquipmentType(equipmentType)
  if (!slug) return ''

  const match = categories.find((category) => category.slug === slug)
  return match?.id ?? ''
}

export function buildListingFormPrefillFromEquipmentProduct(product, categories = []) {
  if (!product) return { ...emptyListingForm }

  const displayName = String(
    product.canonical_product_name || product.model || '',
  ).trim()

  return {
    ...emptyListingForm,
    title: displayName,
    brand: product.brand ?? '',
    model: displayName || product.model || '',
    categoryId: resolveCategoryIdForEquipmentType(product.equipment_type, categories),
    equipmentProductId: product.id ?? '',
    equipmentProductKey: product.canonical_product_key ?? '',
    equipmentProductFamily: product.product_family ?? '',
    estimatedOriginalRrp: product.original_base_price ?? null,
    estimatedOriginalRrpCurrency: product.original_base_price_currency ?? 'GBP',
  }
}

export function getEquipmentTypeCategorySlugOptions() {
  return LISTING_CATEGORY_OPTIONS.map((option) => option.slug)
}
