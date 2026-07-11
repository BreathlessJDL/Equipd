export type QualityEquipmentContext = {
  brand: string
  series: string | null
  model: string
  category?: string | null
  equipment_type?: string | null
  original_rrp?: number | null
}

export type QualityRejection = {
  reason: string
  category:
    | 'likely_new_retail'
    | 'likely_parts_accessory'
    | 'below_minimum_used_price'
    | 'auction_bidding'
    | 'excluded_condition'
    | 'likely_new_retail_price'
    | 'weak_model_match'
    | 'no_used_signal'
    | 'no_price'
}

export const MIN_USED_PRICE_GBP = {
  rower: 250,
  rowing: 250,
  treadmill: 300,
  bike: 150,
  spin: 150,
  upright: 150,
  strength: 150,
  default: 100,
} as const

export const NEW_RETAIL_TOLERANCE_RATIO = 0.12

const ALWAYS_NEW_RETAIL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'brand new', pattern: /\bbrand\s+new\b/i },
  { label: 'buy new', pattern: /\bbuy\s+new\b/i },
  { label: 'add to basket', pattern: /\badd\s+to\s+basket\b/i },
  { label: 'add to cart', pattern: /\badd\s+to\s+cart\b/i },
  { label: 'in stock', pattern: /\bin\s+stock\b/i },
  { label: 'free delivery', pattern: /\bfree\s+delivery\b/i },
  { label: 'warranty', pattern: /\bwarranty\b/i },
  { label: 'retail', pattern: /\bretail\b/i },
  { label: 'official store', pattern: /\bofficial\s+store\b/i },
  { label: 'available now', pattern: /\bavailable\s+now\b/i },
]

const PARTS_ACCESSORY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'spare', pattern: /\bspare\b/i },
  { label: 'spares', pattern: /\bspares\b/i },
  { label: 'parts', pattern: /\bparts\b/i },
  { label: 'part', pattern: /\bpart\b/i },
  { label: 'replacement', pattern: /\breplacement\b/i },
  { label: 'seat', pattern: /\bseat\b/i },
  { label: 'handle', pattern: /\bhandle\b/i },
  { label: 'monitor only', pattern: /\bmonitor\s+only\b/i },
  { label: 'console only', pattern: /\bconsole\s+only\b/i },
  { label: 'belt', pattern: /\bbelt\b/i },
  { label: 'deck', pattern: /\bdeck\b/i },
  { label: 'motor', pattern: /\bmotor\b/i },
]

const AUCTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'auction', pattern: /\bauction\b/i },
  { label: 'bid', pattern: /\bbid(?:ding)?\b/i },
  { label: 'bidding', pattern: /\bbidding\b/i },
  { label: 'starting bid', pattern: /\bstarting\s+bid\b/i },
  { label: 'collection only auction', pattern: /\bcollection\s+only\s+auction\b/i },
]

const EXCLUDED_CONDITION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'refurbished', pattern: /\brefurbished\b/i },
  { label: 'remanufactured', pattern: /\bremanufactured\b/i },
  { label: 'renewed', pattern: /\brenewed\b/i },
  { label: 'ex-demo', pattern: /\bex[\s-]?demo\b/i },
  { label: 'faulty', pattern: /\bfaulty\b/i },
  { label: 'job lot', pattern: /\bjob\s+lot\b/i },
  { label: 'bundle', pattern: /\bbundle\b/i },
  { label: 'POA', pattern: /\bPOA\b/i },
  { label: 'price on application', pattern: /\bprice\s+on\s+application\b/i },
]

const USED_SIGNAL_PATTERNS = [
  /\bused\b/i,
  /\bpre[\s-]?owned\b/i,
  /\bsecond[\s-]?hand\b/i,
  /\bpreviously\s+owned\b/i,
  /\bex[\s-]?commercial\b/i,
  /\bfor\s+sale\b/i,
]

const KNOWN_NEW_RETAIL_BY_BRAND: Array<{
  brandKeys: string[]
  modelHints: string[]
  priceGbp: number
}> = [
  {
    brandKeys: ['concept2', 'conceptii'],
    modelHints: ['rowerg', 'model c', 'model d', 'rower'],
    priceGbp: 995,
  },
]

function normalizeText(value: string): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function matchPatternList(
  text: string,
  patterns: Array<{ label: string; pattern: RegExp }>,
): string | null {
  for (const { label, pattern } of patterns) {
    if (pattern.test(text)) return label
  }
  return null
}

export function hasNewAndUsedMarketplacePhrase(text: string): boolean {
  return (
    /\bnew\s+(?:and|&)\s+used\b/i.test(text) ||
    /\bused\s+(?:and|&)\s+new\b/i.test(text)
  )
}

export function hasUsedSignal(text: string): boolean {
  return USED_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))
}

export function hasRetailSignal(text: string): boolean {
  if (matchPatternList(text, ALWAYS_NEW_RETAIL_PATTERNS)) return true

  if (hasNewAndUsedMarketplacePhrase(text)) return false

  if (/\bnew\b/i.test(text) && !hasUsedSignal(text)) return true

  return false
}

export function findQualityRejection(
  text: string,
  equipment: QualityEquipmentContext,
  price: number | null,
  options: {
    similarityLevel: 'High' | 'Medium' | 'Low'
    hasStrongModelMatch: boolean
    priceNearModelTerms: boolean
  },
): QualityRejection | null {
  const auctionMatch = matchPatternList(text, AUCTION_PATTERNS)
  if (auctionMatch) {
    return {
      category: 'auction_bidding',
      reason: `Auction/bidding page: ${auctionMatch}`,
    }
  }

  const partsMatch = matchPatternList(text, PARTS_ACCESSORY_PATTERNS)
  if (partsMatch) {
    return {
      category: 'likely_parts_accessory',
      reason: `Likely parts/accessory: ${partsMatch}`,
    }
  }

  const conditionMatch = matchPatternList(text, EXCLUDED_CONDITION_PATTERNS)
  if (conditionMatch) {
    return {
      category: 'excluded_condition',
      reason: `${conditionMatch.charAt(0).toUpperCase()}${conditionMatch.slice(1)} listing`,
    }
  }

  const retailMatch = matchPatternList(text, ALWAYS_NEW_RETAIL_PATTERNS)
  if (retailMatch) {
    return {
      category: 'likely_new_retail',
      reason: `Likely new retail: ${retailMatch}`,
    }
  }

  if (!hasNewAndUsedMarketplacePhrase(text) && /\bnew\b/i.test(text) && !hasUsedSignal(text)) {
    return {
      category: 'likely_new_retail',
      reason: 'Likely new retail: new',
    }
  }

  if (options.similarityLevel === 'Low') {
    return {
      category: 'weak_model_match',
      reason: 'Weak model match — not comparable used equipment listing',
    }
  }

  if (!price) {
    return null
  }

  const minPrice = getMinimumUsedPrice(equipment)
  if (price < minPrice) {
    return {
      category: 'below_minimum_used_price',
      reason: `Below minimum sensible used price (£${minPrice} floor)`,
    }
  }

  const retailPriceRejection = findLikelyNewRetailPriceRejection(text, equipment, price)
  if (retailPriceRejection) {
    return retailPriceRejection
  }

  if (!hasUsedSignal(text)) {
    return {
      category: 'no_used_signal',
      reason: 'No used/pre-owned signal found',
    }
  }

  return null
}

export function getMinimumUsedPrice(equipment: EquipmentIntelligenceRow): number {
  const haystack = [
    equipment.equipment_type,
    equipment.category,
    equipment.model,
    equipment.series,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/(rower|rowing)/.test(haystack)) return MIN_USED_PRICE_GBP.rower
  if (/treadmill/.test(haystack)) return MIN_USED_PRICE_GBP.treadmill
  if (/(spin|upright|\bbike\b|cycle|cycling)/.test(haystack)) return MIN_USED_PRICE_GBP.bike
  if (/(strength|rack|press|machine)/.test(haystack)) return MIN_USED_PRICE_GBP.strength

  return MIN_USED_PRICE_GBP.default
}

function getReferenceNewRetailPrice(
  equipment: QualityEquipmentContext,
  text: string,
): number | null {
  const originalRrp = Number(equipment.original_rrp)
  if (Number.isFinite(originalRrp) && originalRrp > 0) {
    return Math.round(originalRrp)
  }

  const brandKey = normalizeKey(equipment.brand ?? '')
  const textLower = text.toLowerCase()
  const modelPhrase = [
    equipment.series,
    equipment.model,
    equipment.equipment_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const known of KNOWN_NEW_RETAIL_BY_BRAND) {
    if (!known.brandKeys.includes(brandKey)) continue
    if (known.modelHints.some((hint) => textLower.includes(hint) || modelPhrase.includes(hint))) {
      return known.priceGbp
    }
  }

  return null
}

function findLikelyNewRetailPriceRejection(
  text: string,
  equipment: QualityEquipmentContext,
  price: number,
): QualityRejection | null {
  const referencePrice = getReferenceNewRetailPrice(equipment, text)
  if (!referencePrice) return null

  const lowerBound = referencePrice * (1 - NEW_RETAIL_TOLERANCE_RATIO)
  const upperBound = referencePrice * (1 + NEW_RETAIL_TOLERANCE_RATIO)
  const nearKnownRetail = price >= lowerBound && price <= upperBound

  if (!nearKnownRetail) return null

  if (hasRetailSignal(text) || !hasUsedSignal(text)) {
    return {
      category: 'likely_new_retail_price',
      reason: `Likely new retail price near £${referencePrice} current RRP`,
    }
  }

  return null
}

export function buildAcceptedReason(options: {
  similarityLevel: 'High' | 'Medium' | 'Low'
  exactModelMatch: boolean
  usedSignalFound: boolean
  priceNearModelTerms: boolean
  sanityFloor: number
}): string {
  const parts: string[] = []

  if (options.exactModelMatch) {
    parts.push('Exact/strong model match')
  } else if (options.similarityLevel === 'High') {
    parts.push('Exact/strong model match')
  } else {
    parts.push('Strong model match')
  }

  if (options.usedSignalFound) {
    parts.push('Used/pre-owned signal found')
  }

  if (options.priceNearModelTerms) {
    parts.push('Price found near model terms')
  }

  parts.push(`Passed sanity checks (min £${options.sanityFloor})`)

  return parts.join('; ')
}
