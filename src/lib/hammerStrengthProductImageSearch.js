/**
 * Hammer Strength dedicated product-image search helpers.
 * Official Hammer Strength / Life Fitness first, authorised dealers later.
 * Never pending-save brand_type_only or generic dealer/category images.
 */

import {
  evaluateHardenedImageCandidate,
} from './equipmentProductImageHardening.js'
import {
  isManufacturerImageSourceDomain,
  isSuggestedRetailerImageSourceDomain,
  isConditionalRetailerImageDomain,
  getImageSourceDomainFromCandidate,
  scoreImageSourceDomain,
} from './equipmentProductImageDomains.js'
import {
  filterQueriesToRetainIdentity,
  requiredIdentityQueryTokens,
} from './equipmentProductImageIdentity.js'

export const HAMMER_STRENGTH_MANUFACTURER_DOMAINS = Object.freeze([
  'lifefitness.com',
  'hammerstrength.com',
  'johnsonfitness.com',
  'johnsonhealthtech.com',
  'johnsonhealthtech.co.uk',
])

export const HAMMER_STRENGTH_AUTHORISED_DEALER_DOMAINS = Object.freeze([
  'fitkituk.com',
  'fitkit.co.uk',
  'fitnesssuperstore.co.uk',
  'fitnesssuperstore.com',
  'fitshop.co.uk',
  'powerhouse-fitness.co.uk',
  'completegyms.com',
])

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeQueryKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

export function isHammerStrengthBrand(brand) {
  return /hammer\s*strength/i.test(String(brand || ''))
}

export function buildHammerStrengthImageSearchQueries(product) {
  const queries = []
  const pushUnique = (query) => {
    const normalized = normalizeWhitespace(query)
    if (!normalized) return
    if (queries.some((existing) => normalizeQueryKey(existing) === normalizeQueryKey(normalized))) return
    queries.push(normalized)
  }

  const brand = 'Hammer Strength'
  const canonical = normalizeWhitespace(product?.canonical_product_name)
  const model = normalizeWhitespace(product?.model)
  const family = normalizeWhitespace(product?.product_family)
  const equipmentType = normalizeWhitespace(product?.equipment_type)
  const required = requiredIdentityQueryTokens(product)

  // Phase 1 — official manufacturer / Life Fitness.
  pushUnique(canonical)
  pushUnique(`${brand} ${model || ''}`.trim())
  pushUnique(`${brand} Plateloaded ${model || ''}`.trim())
  if (family && model) pushUnique(`${brand} ${family} ${model}`)
  if (required[0]) pushUnique(`${brand} ${required.join(' ')}`)
  pushUnique(`site:lifefitness.com "Hammer Strength" "${model || canonical}"`)
  pushUnique(`site:lifefitness.com "${model || canonical}"`)
  pushUnique(`site:hammerstrength.com "${model || canonical}"`)
  pushUnique(`site:johnsonfitness.com "Hammer Strength" "${model || canonical}"`)

  // Phase 2 — archive / CDN oriented.
  pushUnique(`"${brand}" "${model}" plateloaded brochure OR catalogue OR catalog`)
  pushUnique(`"${canonical}" site:johnsonhealthtech.com`)

  // Phase 3 — authorised dealers.
  for (const domain of HAMMER_STRENGTH_AUTHORISED_DEALER_DOMAINS.slice(0, 4)) {
    pushUnique(`site:${domain} "Hammer Strength" "${model || required[0] || canonical}"`)
  }

  if (equipmentType) pushUnique(`${brand} ${model} ${equipmentType}`)

  return filterQueriesToRetainIdentity(queries, product)
}

export function classifyHammerStrengthSearchPhase(query) {
  const text = String(query || '').toLowerCase()
  if (/site:(lifefitness|hammerstrength|johnsonfitness|johnsonhealthtech)/i.test(text)) {
    return 'manufacturer'
  }
  if (/brochure|catalogue|catalog|archive/i.test(text)) return 'archive'
  if (HAMMER_STRENGTH_AUTHORISED_DEALER_DOMAINS.some((domain) => text.includes(`site:${domain}`))) {
    return 'dealer'
  }
  return 'general'
}

export function partitionHammerStrengthQueries(product, maxQueries = 6) {
  const all = buildHammerStrengthImageSearchQueries(product)
  const manufacturer = []
  const archive = []
  const dealer = []
  for (const query of all) {
    const phase = classifyHammerStrengthSearchPhase(query)
    if (phase === 'manufacturer') manufacturer.push(query)
    else if (phase === 'archive') archive.push(query)
    else if (phase === 'dealer') dealer.push(query)
    else manufacturer.push(query)
  }
  return {
    manufacturerQueries: manufacturer.slice(0, Math.max(2, Math.ceil(maxQueries / 2))),
    archiveQueries: archive.slice(0, 2),
    dealerQueries: dealer.slice(0, Math.max(2, Math.ceil(maxQueries / 2))),
    allQueries: all.slice(0, maxQueries + 4),
  }
}

export function scoreHammerStrengthImageCandidate(candidate, product) {
  const hardened = evaluateHardenedImageCandidate(product, candidate, { hammerMode: true })
  if (!hardened.eligible) {
    return {
      score: 0,
      rejection: { reject: true, reason: hardened.reason },
      confidenceBand: 'rejected',
      domain: hardened.domain || getImageSourceDomainFromCandidate(candidate),
      identity: hardened.identityResult,
      identityEvidence: hardened.identityEvidence,
      channelScores: hardened.channelScores,
      pendingEligible: false,
    }
  }

  const domain = hardened.domain || getImageSourceDomainFromCandidate(candidate)
  let score = Number(hardened.identityResult?.evidenceLevel === 'exact' ? 85 : 60)
  score += Math.max(0, scoreImageSourceDomain(domain))
  if (isManufacturerImageSourceDomain(domain)
    || HAMMER_STRENGTH_MANUFACTURER_DOMAINS.some((entry) => String(domain || '').endsWith(entry))) {
    score += 20
  } else if (isSuggestedRetailerImageSourceDomain(domain) || isConditionalRetailerImageDomain(domain)) {
    score -= 5
  } else {
    score -= 40
  }

  score = Math.max(0, Math.min(100, score))
  return {
    score,
    rejection: null,
    confidenceBand: hardened.pendingEligible ? 'high_confidence' : 'needs_review',
    domain,
    identity: hardened.identityResult,
    identityEvidence: hardened.identityEvidence,
    channelScores: hardened.channelScores,
    pendingEligible: hardened.pendingEligible,
    status: hardened.status,
  }
}

export function rankHammerStrengthImageCandidates(candidates = [], product) {
  return candidates
    .map((candidate) => {
      const result = scoreHammerStrengthImageCandidate(candidate, product)
      return { candidate, ...result }
    })
    .filter((entry) => entry.score > 0 && !entry.rejection?.reject)
    .sort((left, right) => right.score - left.score)
}
