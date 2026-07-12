import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import type { SerpResearchHit } from './intelligenceEquipmentResearch.ts'

export type CanonicalProductIdentity = {
  brand: string
  productFamily: string | null
  model: string
  equipmentType: string | null
  canonicalProductName: string
}

export const IDENTITY_MATCH_LEVEL = {
  EXACT: 'exact',
  POSSIBLY_RELATED: 'possibly_related',
  WEAK: 'weak',
  REJECT: 'reject',
} as const

export type IdentityMatchLevel = typeof IDENTITY_MATCH_LEVEL[keyof typeof IDENTITY_MATCH_LEVEL]

export type ProductIdentityScore = {
  score: number
  level: IdentityMatchLevel
  label: string
  brandMatch: boolean
  productFamilyMatch: boolean
  modelMatch: boolean
  equipmentTypeMatch: boolean
  conflictingFamilies: string[]
  matchedTokens: string[]
  missingTokens: string[]
}

export const IDENTITY_EXTRACTION_MIN_SCORE = 70
export const IDENTITY_PAGE_READ_MIN_SCORE = 55
export const IDENTITY_RESEARCH_MIN_SCORE = 70

export const NO_RELIABLE_IDENTITY_MATCH = 'No reliable identity match'

const KNOWN_PLATFORM_FAMILIES = [
  'elevation',
  'discover',
  'integrity',
  'club',
  'platinum',
  'aspire',
  'activate',
  'symbio',
  'powermill',
  'flexstrider',
] as const

const ELEVATION_VARIANTS = ['achieve', 'engage', 'inspire'] as const

const EQUIPMENT_TYPE_ALIASES: Record<string, string[]> = {
  crosstrainer: ['crosstrainer', 'cross trainer', 'cross-trainer', 'elliptical'],
  treadmill: ['treadmill', 'treadmills'],
  'recumbent bike': ['recumbent bike', 'recumbent', 'rbk'],
  'upright bike': ['upright bike', 'upright cycle', 'lifecycle'],
  powermill: ['powermill', 'power mill', 'stepper'],
  flexstrider: ['flexstrider', 'flex strider'],
}

const MODEL_CODE_PATTERN = /\b[a-z]?\d{1,3}[a-z]{1,3}\b/gi

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function uniqueTokens(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>()
  for (const value of values) {
    for (const token of tokenize(value)) {
      if (token.length >= 3 || /^\d/.test(token)) tokens.add(token)
    }
  }
  return [...tokens]
}

function splitProductFamily(productFamily: string | null | undefined): {
  platform: string | null
  variant: string | null
} {
  const normalized = normalizeText(productFamily)
  if (!normalized) return { platform: null, variant: null }

  const parts = normalized.split(/\s*[-–]\s*/)
  const platform = parts[0]?.toLowerCase() ?? null
  const variant = parts[1]?.toLowerCase() ?? null
  return { platform, variant }
}

function detectPlatformFamilies(haystack: string): string[] {
  const lower = haystack.toLowerCase()
  return KNOWN_PLATFORM_FAMILIES.filter((family) => lower.includes(family))
}

function detectElevationVariant(haystack: string): string | null {
  const lower = haystack.toLowerCase()
  return ELEVATION_VARIANTS.find((variant) => lower.includes(variant)) ?? null
}

function matchesEquipmentType(
  equipmentType: string | null | undefined,
  haystack: string,
): boolean {
  if (!equipmentType) return true

  const lower = haystack.toLowerCase()
  const normalizedType = equipmentType.toLowerCase()
  const aliases = EQUIPMENT_TYPE_ALIASES[normalizedType] ?? [normalizedType]
  return aliases.some((alias) => lower.includes(alias))
}

function detectAlienModelCodes(
  haystack: string,
  identityTokens: Set<string>,
): string[] {
  const matches = haystack.match(MODEL_CODE_PATTERN) ?? []
  const alien: string[] = []

  for (const raw of matches) {
    const code = raw.toLowerCase()
    if (code.length < 2) continue
    if (identityTokens.has(code)) continue
    if (/^(19|20)\d{2}$/.test(code)) continue
    alien.push(code)
  }

  return [...new Set(alien)]
}

function deriveIdentityProfile(identity: CanonicalProductIdentity) {
  const familyParts = splitProductFamily(identity.productFamily)
  const canonicalTokens = uniqueTokens([
    identity.canonicalProductName,
    identity.model,
    identity.productFamily,
  ])
  const brandTokens = tokenize(identity.brand)
  const modelTokens = uniqueTokens([
    identity.model,
    familyParts.variant,
  ]).filter((token) => !brandTokens.includes(token))

  const platformFamily = familyParts.platform
    ?? detectPlatformFamilies(identity.canonicalProductName)[0]
    ?? null

  const variantFamily = familyParts.variant
    ?? (platformFamily === 'elevation'
      ? detectElevationVariant(identity.canonicalProductName)
      : null)

  const identityTokenSet = new Set([
    ...canonicalTokens,
    ...brandTokens,
    ...modelTokens,
    ...(platformFamily ? [platformFamily] : []),
    ...(variantFamily ? [variantFamily] : []),
  ])

  return {
    brand: normalizeText(identity.brand).toLowerCase(),
    platformFamily,
    variantFamily,
    modelTokens,
    canonicalTokens,
    identityTokenSet,
    equipmentType: identity.equipmentType,
  }
}

function resolveIdentityLevel(score: number): {
  level: IdentityMatchLevel
  label: string
} {
  if (score >= 90) {
    return { level: IDENTITY_MATCH_LEVEL.EXACT, label: 'Exact match' }
  }
  if (score >= 65) {
    return { level: IDENTITY_MATCH_LEVEL.POSSIBLY_RELATED, label: 'Possibly related' }
  }
  if (score >= 35) {
    return { level: IDENTITY_MATCH_LEVEL.WEAK, label: 'Weak match' }
  }
  return { level: IDENTITY_MATCH_LEVEL.REJECT, label: 'Reject — unrelated product' }
}

export function freezeCanonicalProductIdentity(
  identity: CanonicalProductIdentity,
): CanonicalProductIdentity {
  return Object.freeze({
    brand: normalizeText(identity.brand),
    productFamily: identity.productFamily ? normalizeText(identity.productFamily) : null,
    model: normalizeText(identity.model),
    equipmentType: identity.equipmentType ? normalizeText(identity.equipmentType) : null,
    canonicalProductName: normalizeText(identity.canonicalProductName),
  })
}

export function buildCanonicalProductIdentityFromEquipment(
  equipment: EquipmentIntelligenceRow & {
    product_family?: string | null
    core_product_name?: string | null
  },
): CanonicalProductIdentity {
  const canonicalProductName = normalizeText(
    equipment.core_product_name
    || [equipment.brand, equipment.series, equipment.model].filter(Boolean).join(' '),
  )

  return freezeCanonicalProductIdentity({
    brand: equipment.brand,
    productFamily: equipment.product_family ?? equipment.series ?? null,
    model: equipment.model,
    equipmentType: equipment.equipment_type ?? null,
    canonicalProductName,
  })
}

export function scoreProductIdentity(
  haystack: string,
  identity: CanonicalProductIdentity,
): ProductIdentityScore {
  const text = normalizeText(haystack)
  const lower = text.toLowerCase()
  const profile = deriveIdentityProfile(identity)

  const brandMatch = lower.includes(profile.brand)
  if (!brandMatch) {
    return {
      score: 0,
      level: IDENTITY_MATCH_LEVEL.REJECT,
      label: 'Brand mismatch',
      brandMatch: false,
      productFamilyMatch: false,
      modelMatch: false,
      equipmentTypeMatch: false,
      conflictingFamilies: [],
      matchedTokens: [],
      missingTokens: profile.modelTokens,
    }
  }

  const haystackPlatforms = detectPlatformFamilies(lower)
  const conflictingFamilies = profile.platformFamily
    ? haystackPlatforms.filter((family) => family !== profile.platformFamily)
    : []

  const equipmentTypeMatch = matchesEquipmentType(profile.equipmentType, lower)
  const productFamilyMatch = profile.platformFamily
    ? lower.includes(profile.platformFamily)
    : haystackPlatforms.length === 0

  const matchedModelTokens = profile.modelTokens.filter((token) => lower.includes(token))
  const missingTokens = profile.modelTokens.filter((token) => !lower.includes(token))
  const modelMatch = profile.modelTokens.length === 0
    || matchedModelTokens.length === profile.modelTokens.length

  const variantMatch = profile.variantFamily
    ? lower.includes(profile.variantFamily)
    : true

  const alienCodes = detectAlienModelCodes(lower, profile.identityTokenSet)

  let score = 22

  if (equipmentTypeMatch) score += 14

  if (profile.platformFamily) {
    if (lower.includes(profile.platformFamily)) {
      score += 24
    } else if (conflictingFamilies.length > 0) {
      score -= 28
    } else {
      score -= 8
    }
  } else if (conflictingFamilies.length > 1) {
    score -= 12
  }

  if (profile.modelTokens.length > 0) {
    const modelRatio = matchedModelTokens.length / profile.modelTokens.length
    score += Math.round(modelRatio * 22)
    if (modelRatio < 1 && modelRatio >= 0.5) score += 4
  }

  if (profile.variantFamily) {
    if (variantMatch) score += 14
    else if (productFamilyMatch) score -= 6
    else score -= 12
  }

  const canonicalLower = identity.canonicalProductName.toLowerCase()
  if (lower.includes(canonicalLower)) {
    score += 12
  } else {
    const canonicalCoverage = profile.canonicalTokens.filter((token) => (
      !['life', 'fitness'].includes(token) && lower.includes(token)
    ))
    const requiredCanonical = profile.canonicalTokens.filter((token) => (
      !['life', 'fitness'].includes(token)
    ))
    if (requiredCanonical.length > 0) {
      score += Math.round((canonicalCoverage.length / requiredCanonical.length) * 8)
    }
  }

  if (alienCodes.length > 0) {
    score -= Math.min(40, alienCodes.length * 18)
  }

  if (conflictingFamilies.length > 0 && !productFamilyMatch) {
    score -= 18
  }

  if (productFamilyMatch && !equipmentTypeMatch && profile.equipmentType) {
    score -= 10
  }

  score = Math.max(0, Math.min(100, score))

  const { level, label } = resolveIdentityLevel(score)

  return {
    score,
    level,
    label,
    brandMatch,
    productFamilyMatch,
    modelMatch,
    equipmentTypeMatch,
    conflictingFamilies,
    matchedTokens: matchedModelTokens,
    missingTokens,
  }
}

export function isIdentityStrongEnoughForExtraction(score: ProductIdentityScore): boolean {
  return score.score >= IDENTITY_EXTRACTION_MIN_SCORE
    && score.level !== IDENTITY_MATCH_LEVEL.REJECT
    && score.level !== IDENTITY_MATCH_LEVEL.WEAK
}

export function isIdentityStrongEnoughForPageRead(score: ProductIdentityScore): boolean {
  return score.score >= IDENTITY_PAGE_READ_MIN_SCORE
    && score.level !== IDENTITY_MATCH_LEVEL.REJECT
}

export function scoreSerpHitIdentity(
  hit: SerpResearchHit,
  identity: CanonicalProductIdentity,
): ProductIdentityScore {
  const haystack = [hit.title, hit.snippet].filter(Boolean).join('\n')
  return scoreProductIdentity(haystack, identity)
}

export function filterHitsByIdentity<T extends SerpResearchHit>(
  hits: T[],
  identity: CanonicalProductIdentity,
  minScore = IDENTITY_PAGE_READ_MIN_SCORE,
): { accepted: T[]; rejected: Array<T & { identityScore: ProductIdentityScore }> } {
  const accepted: T[] = []
  const rejected: Array<T & { identityScore: ProductIdentityScore }> = []

  for (const hit of hits) {
    const identityScore = scoreSerpHitIdentity(hit, identity)
    if (identityScore.score >= minScore && identityScore.level !== IDENTITY_MATCH_LEVEL.REJECT) {
      accepted.push(hit)
    } else {
      rejected.push({ ...hit, identityScore })
    }
  }

  return { accepted, rejected }
}

export function formatIdentityScoreLabel(score: ProductIdentityScore): string {
  return `${score.label} (${score.score})`
}
