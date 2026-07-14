/**
 * Hardened image-candidate gates for catalogue import:
 * exact/compatible family, model-token overlap, generation conflicts,
 * generic-page rejection, shared-image collision reporting.
 */

import {
  compareProductIdentity,
  evaluateImageCandidateIdentity,
  identityTokenPresent,
  normalizeIdentityText,
} from './equipmentProductImageIdentity.js'
import {
  getImageSourceDomainFromCandidate,
  isManufacturerImageSourceDomain,
  isSuggestedRetailerImageSourceDomain,
  isConditionalRetailerImageDomain,
  isBlockedImageSourceDomain,
  isBlockedImageSourceUrl,
} from './equipmentProductImageDomains.js'

const GENERIC_PAGE_PATTERNS = [
  /\/collections?\//i,
  /\/product-category\//i,
  /\/category\b/i,
  /\/discovery\/all/i,
  /\/art-collection/i,
  /\/pure-strength\/?$/i,
  /\/selection\/?$/i,
  /\/products\/?$/i,
  /\/shop\/?$/i,
  /\/catalogue\/?$/i,
  /\/catalog\/?$/i,
  /\/strength-packages\/?$/i,
  /\/strength-equipment\/?$/i,
  /\/single-station\/[^/]+\/?$/i,
  /\/shoulder-machines\/?$/i,
  /\/selectorised-machines\/?$/i,
  /\/plate-loaded-strength-machines\/?$/i,
]

const SPARE_ACCESSORY_PATTERNS = [
  /\bspare\s+part/i,
  /\breplacement\s+part/i,
  /\baccessory\b/i,
  /\bconsole\s+only\b/i,
  /\bdisplay\s+only\b/i,
  /\bmonitor\s+only\b/i,
  /\bclose[\s-]?up\b/i,
  /\btouchscreen\b/i,
]

const GYM_FLOOR_PATTERNS = [
  /\bgym\s+floor\b/i,
  /\bin\s+gym\b/i,
  /\bcommercial\s+gym\b/i,
  /\bfitness\s+center\b/i,
  /\bstudio\s+photo\b/i,
  /\bpeople\b/i,
  /\bathlete\b/i,
  /\bworking\s+out\b/i,
  /paulo.?dybala/i,
  /mytechnogym-paulo/i,
]

const STOP_MODEL_TOKENS = new Set([
  'the', 'and', 'with', 'without', 'for', 'machine', 'strength', 'fitness',
  'technogym', 'matrix', 'precor', 'pulse', 'hammer', 'life', 'series',
  'line', 'pro', 'personal', 'range', 'commercial', 'gym', 'equipment',
])

export function normalizeSharedImageKey(url) {
  return String(url || '').trim().split('?')[0].toLowerCase()
}

export function scoreCandidateTextChannels(product, candidate = {}) {
  const channels = {
    title: String(candidate.title || candidate.pageTitle || ''),
    url: String(candidate.sourceUrl || candidate.link || ''),
    alt: String(candidate.alt || ''),
    surrounding: [
      candidate.snippet,
      candidate.source,
      candidate.metadata,
      candidate.pageText,
    ].filter(Boolean).join(' '),
  }

  const productTokens = extractMeaningfulModelTokens(product)
  const scores = {}
  for (const [channel, text] of Object.entries(channels)) {
    let hits = 0
    for (const token of productTokens) {
      if (identityTokenPresent(text, token)) hits += 1
    }
    scores[channel] = {
      hits,
      total: productTokens.length,
      ratio: productTokens.length ? hits / productTokens.length : 0,
      textSample: text.slice(0, 180),
    }
  }
  return scores
}

export function extractMeaningfulModelTokens(product) {
  const raw = [
    product?.model,
    product?.canonical_product_name,
    product?.product_family,
  ].filter(Boolean).join(' ')

  const tokens = normalizeIdentityText(raw)
    .replace(/[+/]/g, ' plus ')
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_MODEL_TOKENS.has(token))

  // Keep distinctive compound phrases.
  const phrases = []
  const name = normalizeIdentityText(product?.canonical_product_name || '')
  for (const phrase of [
    product?.model,
    product?.product_family,
  ].filter(Boolean)) {
    const normalized = normalizeIdentityText(phrase)
    if (normalized && normalized.length >= 4) phrases.push(normalized)
  }
  if (name) phrases.push(name)

  return [...new Set([...phrases, ...tokens])]
}

export function hasMeaningfulModelTokenOverlap(product, candidate) {
  const tokens = extractMeaningfulModelTokens(product)
  if (!tokens.length) return false
  const haystack = [
    candidate?.title,
    candidate?.sourceUrl,
    candidate?.imageUrl,
    candidate?.alt,
    candidate?.snippet,
    candidate?.pageText,
  ].filter(Boolean).join(' ')

  let hits = 0
  for (const token of tokens) {
    if (identityTokenPresent(haystack, token)) hits += 1
  }
  // At least one distinctive multi-word phrase, or >=2 token hits.
  const phraseHit = tokens.some((token) => token.includes(' ') && identityTokenPresent(haystack, token))
  return phraseHit || hits >= 2 || (tokens.length === 1 && hits === 1)
}

export function rejectGenericOrUnsuitableImageCandidate(candidate = {}) {
  const haystack = [
    candidate.title,
    candidate.sourceUrl,
    candidate.imageUrl,
    candidate.alt,
    candidate.snippet,
    candidate.pageText,
  ].filter(Boolean).join(' ')

  const domain = getImageSourceDomainFromCandidate(candidate)
  if (isBlockedImageSourceDomain(domain) || isBlockedImageSourceUrl(candidate.sourceUrl) || isBlockedImageSourceUrl(candidate.imageUrl)) {
    return { reject: true, reason: 'blocked_dealer_or_marketplace_source' }
  }
  if (/instagram\.com|facebook\.com|fbcdn\.|youtube\.com|youtu\.be|ebay\./i.test(String(candidate.sourceUrl || ''))) {
    return { reject: true, reason: 'social_or_marketplace_listing_photo' }
  }
  if (GENERIC_PAGE_PATTERNS.some((pattern) => pattern.test(String(candidate.sourceUrl || '')))) {
    return { reject: true, reason: 'generic_brand_or_category_page' }
  }
  if (SPARE_ACCESSORY_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { reject: true, reason: 'spare_part_accessory_or_console' }
  }
  if (GYM_FLOOR_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { reject: true, reason: 'gym_floor_or_lifestyle_photo' }
  }
  return { reject: false, reason: null }
}

/**
 * Hardened pending-save eligibility.
 * brand_type_only never qualifies. Family conflicts always reject.
 */
export function evaluateHardenedImageCandidate(product, candidate, {
  hammerMode = false,
  requireManufacturer = false,
} = {}) {
  const unsuitable = rejectGenericOrUnsuitableImageCandidate(candidate)
  if (unsuitable.reject) {
    return {
      eligible: false,
      pendingEligible: false,
      status: 'rejected',
      reason: unsuitable.reason,
      identityEvidence: null,
      channelScores: scoreCandidateTextChannels(product, candidate),
      identityResult: null,
    }
  }

  const identityGate = evaluateImageCandidateIdentity(product, candidate)
  const identityResult = identityGate.identityResult || compareProductIdentity(product, candidate)
  const channelScores = scoreCandidateTextChannels(product, candidate)
  const domain = getImageSourceDomainFromCandidate(candidate)
  const modelOverlap = hasMeaningfulModelTokenOverlap(product, candidate)

  if (!identityGate.eligible || identityResult.hasConflict) {
    return {
      eligible: false,
      pendingEligible: false,
      status: 'rejected',
      reason: 'conflicting_product_family_or_identity',
      identityEvidence: {
        evidenceLevel: identityResult.evidenceLevel,
        matched: identityResult.matched,
        conflicts: identityResult.conflicts,
      },
      channelScores,
      identityResult,
      domain,
    }
  }

  if (identityResult.evidenceLevel === 'brand_type_only') {
    return {
      eligible: false,
      pendingEligible: false,
      status: 'rejected',
      reason: 'brand_type_only_insufficient',
      identityEvidence: {
        evidenceLevel: identityResult.evidenceLevel,
        matched: identityResult.matched,
        conflicts: identityResult.conflicts,
      },
      channelScores,
      identityResult,
      domain,
    }
  }

  if (!modelOverlap) {
    return {
      eligible: false,
      pendingEligible: false,
      status: 'rejected',
      reason: 'insufficient_model_token_overlap',
      identityEvidence: {
        evidenceLevel: identityResult.evidenceLevel,
        matched: identityResult.matched,
        conflicts: identityResult.conflicts,
      },
      channelScores,
      identityResult,
      domain,
    }
  }

  if (requireManufacturer || hammerMode) {
    if (!isManufacturerImageSourceDomain(domain)
      && !(hammerMode && (isSuggestedRetailerImageSourceDomain(domain) || isConditionalRetailerImageDomain(domain)))) {
      // Hammer mode allows authorised dealers only after manufacturer phase fails — still not brand_type_only.
      if (hammerMode && !isManufacturerImageSourceDomain(domain)
        && !isSuggestedRetailerImageSourceDomain(domain)
        && !isConditionalRetailerImageDomain(domain)) {
        return {
          eligible: false,
          pendingEligible: false,
          status: 'rejected',
          reason: 'non_authorised_image_source',
          identityEvidence: {
            evidenceLevel: identityResult.evidenceLevel,
            matched: identityResult.matched,
            conflicts: identityResult.conflicts,
          },
          channelScores,
          identityResult,
          domain,
        }
      }
    }
  }

  if (hammerMode) {
    // Exact family/model match required for Hammer pending-save eligibility.
    if (identityResult.evidenceLevel !== 'exact') {
      return {
        eligible: true,
        pendingEligible: false,
        status: 'needs_review',
        reason: 'hammer_requires_exact_family_model',
        identityEvidence: {
          evidenceLevel: identityResult.evidenceLevel,
          matched: identityResult.matched,
          conflicts: identityResult.conflicts,
        },
        channelScores,
        identityResult,
        domain,
      }
    }
    if (!isManufacturerImageSourceDomain(domain)
      && !isSuggestedRetailerImageSourceDomain(domain)
      && !isConditionalRetailerImageDomain(domain)) {
      return {
        eligible: false,
        pendingEligible: false,
        status: 'rejected',
        reason: 'hammer_non_authorised_source',
        identityEvidence: {
          evidenceLevel: identityResult.evidenceLevel,
          matched: identityResult.matched,
          conflicts: identityResult.conflicts,
        },
        channelScores,
        identityResult,
        domain,
      }
    }
  }

  const pendingEligible = identityResult.evidenceLevel === 'exact'
    || (identityResult.evidenceLevel === 'family' && modelOverlap && !hammerMode)

  return {
    eligible: true,
    pendingEligible,
    status: pendingEligible
      ? (identityResult.evidenceLevel === 'exact' ? 'high_confidence' : 'medium_confidence')
      : 'needs_review',
    reason: null,
    identityEvidence: {
      evidenceLevel: identityResult.evidenceLevel,
      matched: identityResult.matched,
      conflicts: identityResult.conflicts,
      modelTokenOverlap: modelOverlap,
      channelScores,
    },
    channelScores,
    identityResult,
    domain,
  }
}

export function collectSharedImageCollisions(rows = []) {
  const byImage = new Map()
  for (const row of rows) {
    const key = normalizeSharedImageKey(row.candidate_image_url || row.image_url)
    if (!key) continue
    if (!byImage.has(key)) byImage.set(key, [])
    byImage.get(key).push({
      product_id: row.product_id,
      canonical_product_name: row.canonical_product_name,
      brand: row.brand,
      confidence_bucket: row.confidence_bucket,
      source_url: row.candidate_source_url || row.image_source_url,
    })
  }
  return [...byImage.entries()]
    .filter(([, products]) => products.length > 1)
    .map(([image_url, products]) => ({ image_url, products, count: products.length }))
    .sort((a, b) => b.count - a.count || a.image_url.localeCompare(b.image_url))
}

export function filterRowsForSharedImageCollisions(rows = [], {
  allowSamePhysicalProof = false,
} = {}) {
  if (allowSamePhysicalProof) return { accepted: rows, collisions: [] }
  const collisions = collectSharedImageCollisions(rows)
  const blockedUrls = new Set(collisions.map((entry) => entry.image_url))
  const accepted = []
  const rejected = []
  for (const row of rows) {
    const key = normalizeSharedImageKey(row.candidate_image_url || row.image_url)
    if (key && blockedUrls.has(key)) {
      rejected.push({
        ...row,
        outcome: 'rejected_shared_image_collision',
        rejection_reason: 'same_source_image_assigned_to_distinct_canonical_models',
      })
    } else {
      accepted.push(row)
    }
  }
  return { accepted, rejected, collisions }
}
