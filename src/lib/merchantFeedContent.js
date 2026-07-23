/**
 * Merchant-specific titles and descriptions (not SEO metadata clones).
 */

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

const CONDITION_TO_MERCHANT = Object.freeze({
  new: 'new',
  like_new: 'used',
  good: 'used',
  fair: 'used',
  poor: 'used',
})

const CONDITION_LABELS = Object.freeze({
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
})

const PROHIBITED_TITLE_PATTERNS = [
  /\bbest\b/i,
  /\bcheap\b/i,
  /\bsale\b/i,
  /\bbuy now\b/i,
  /\bcontact\b/i,
  /\bwhats?app\b/i,
  /\bcall me\b/i,
  /https?:\/\//i,
  /\b\d{11}\b/,
]

export function mapListingConditionToMerchant(condition) {
  const key = String(condition ?? '').trim().toLowerCase()
  return CONDITION_TO_MERCHANT[key] || null
}

export function getListingConditionLabel(condition) {
  const key = String(condition ?? '').trim().toLowerCase()
  return CONDITION_LABELS[key] || null
}

function stripPromotionalNoise(text) {
  let value = normalizeWhitespace(text)
  value = value.replace(/\bfor sale\b/gi, '')
  value = value.replace(/\s*[|–—-]\s*Equipd\s*$/i, '')
  return normalizeWhitespace(value)
}

/**
 * Suggested structure: {Brand} {Model} {Equipment Type} – Used
 */
export function buildMerchantFeedTitle(listing, equipmentProduct = null) {
  const brand = normalizeWhitespace(listing?.brand || equipmentProduct?.brand)
  const model = normalizeWhitespace(listing?.model || equipmentProduct?.model)
  const type = normalizeWhitespace(
    equipmentProduct?.equipment_type
    || equipmentProduct?.equipmentType
    || listing?.category?.name
    || listing?.equipment_type,
  )

  const parts = [brand, model, type].filter(Boolean)
  let title = parts.length
    ? `${parts.join(' ')} – Used`
    : stripPromotionalNoise(listing?.title) || 'Used gym equipment'

  title = stripPromotionalNoise(title)
  if (!/\bused\b/i.test(title) && mapListingConditionToMerchant(listing?.condition) === 'used') {
    title = `${title} – Used`
  }

  // Soft-scrub prohibited promo words without inventing a new product name
  for (const pattern of PROHIBITED_TITLE_PATTERNS) {
    title = title.replace(pattern, ' ')
  }
  title = normalizeWhitespace(title).slice(0, 150)
  return title || 'Used gym equipment'
}

function stripContactDetails(text) {
  return normalizeWhitespace(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, '')
    .replace(/\b(?:whats?app|telegram|signal)\b[:\s-]*/gi, '')
    .replace(/\b(?:0|\+44)\s?\d[\d\s-]{8,}\b/g, '')
    .replace(/https?:\/\/\S+/gi, '')
}

/**
 * Description from visible listing facts + seller text (sanitised).
 */
export function buildMerchantFeedDescription(listing, equipmentProduct = null) {
  const bits = []
  const title = buildMerchantFeedTitle(listing, equipmentProduct)
  bits.push(title)

  const conditionLabel = getListingConditionLabel(listing?.condition)
  if (conditionLabel) bits.push(`Condition: ${conditionLabel}.`)

  const brand = normalizeWhitespace(listing?.brand || equipmentProduct?.brand)
  const model = normalizeWhitespace(listing?.model || equipmentProduct?.model)
  if (brand) bits.push(`Brand: ${brand}.`)
  if (model) bits.push(`Model: ${model}.`)

  const sellerText = stripContactDetails(listing?.description)
  if (sellerText) {
    bits.push(sellerText.slice(0, 4000))
  } else {
    bits.push('Used gym equipment listed for sale on Equipd. Collection available after purchase.')
  }

  bits.push('Sold via Equipd marketplace with Buyer Protection on completed purchases.')

  return normalizeWhitespace(bits.join(' ')).slice(0, 5000)
}
