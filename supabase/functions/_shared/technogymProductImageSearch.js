/**
 * Technogym-specific product image search, ranking, and confidence rules.
 */

import {
  extractDomainFromUrl,
  getImageSourceDomainFromCandidate,
  isFitnessSuperstoreImageSourceDomain,
  normalizeHostname,
  scoreImageSourceDomain,
} from './equipmentProductImageDomains.js'

export const TECHNOGYM_IMAGE_NEEDS_REVIEW_REASON = 'technogym_image_needs_review'

export const TECHNOGYM_PREFERRED_IMAGE_DOMAINS = [
  'fitkituk.com',
  'fitnesssuperstore.co.uk',
  'fitnesssuperstore.com',
]

export const TECHNOGYM_PRODUCT_LINE_RULES = [
  {
    id: 'element',
    labels: ['element', 'element+'],
    patterns: [/\belement\s*\+?\b/i],
  },
  {
    id: 'selection',
    labels: ['selection'],
    patterns: [/\bselection\b/i],
  },
  {
    id: 'artis',
    labels: ['artis'],
    patterns: [/\bartis\b/i],
  },
  {
    id: 'excite',
    labels: ['excite', 'excite+'],
    patterns: [/\bexcite\s*\+?\b/i],
  },
  {
    id: 'skill_line',
    labels: ['skill line', 'skillline', 'skillmill', 'skillrun', 'skill run', 'skill mill'],
    patterns: [/\bskill\s*line\b/i, /\bskillmill\b/i, /\bskillrun\b/i, /\bskill\s*run\b/i, /\bskill\s*mill\b/i],
  },
  {
    id: 'pure_strength',
    labels: ['pure strength'],
    patterns: [/\bpure\s+strength\b/i],
  },
  {
    id: 'personal',
    labels: ['personal', 'forma'],
    patterns: [/\bpersonal\b/i, /\bforma\b/i],
  },
  {
    id: 'kinesis',
    labels: ['kinesis'],
    patterns: [/\bkinesis\b/i],
  },
  {
    id: 'unity',
    labels: ['unity'],
    patterns: [/\bunity\b/i],
  },
]

const PEOPLE_IMAGE_PATTERNS = [
  /\bpeople\b/i,
  /\bperson\b/i,
  /\bgym\s+user/i,
  /\btrainer\b/i,
  /\bwoman\b/i,
  /\bman\b/i,
  /\bmen\b/i,
  /\bwomen\b/i,
  /\bathlete\b/i,
  /\bworking\s+out\b/i,
  /\bexercis(?:e|ing)\b/i,
  /\bin\s+use\b/i,
  /\bwith\s+user/i,
]

const CONSOLE_ONLY_PATTERNS = [
  /\bconsole\s+only\b/i,
  /\bscreen\s+only\b/i,
  /\bdisplay\s+only\b/i,
  /\bclose[\s-]?up\b/i,
  /\bcloseup\b/i,
  /\btouchscreen\b/i,
  /\bunity\s+console\b/i,
  /\bvisio\s+console\b/i,
  /\bconsole\s+close/i,
  /\bmonitor\s+only\b/i,
]

const PARTIAL_MACHINE_PATTERNS = [
  /\bspare\s+part/i,
  /\breplacement\s+part/i,
  /\baccessory\s+only/i,
  /\bpartial\s+view/i,
  /\bcropped\b/i,
  /\bonly\s+console\b/i,
  /\bconsole\s+photo\b/i,
]

const GYM_FLOOR_PATTERNS = [
  /\bgym\s+floor\b/i,
  /\bin\s+gym\b/i,
  /\bcommercial\s+gym\b/i,
  /\bfitness\s+center\b/i,
  /\bstudio\s+photo\b/i,
]

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function tokenize(value) {
  return normalizeKey(value).split(/[^a-z0-9+]+/).filter((token) => token.length >= 2)
}

export function isTechnogymBrand(brand) {
  return normalizeKey(brand) === 'technogym'
}

export function detectTechnogymProductLineFromText(text) {
  const haystack = normalizeWhitespace(text)
  if (!haystack) return null

  for (const rule of TECHNOGYM_PRODUCT_LINE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.id
    }
  }

  return null
}

export function detectTechnogymProductLine(product) {
  if (!isTechnogymBrand(product?.brand)) return null

  const haystack = [
    product?.product_family,
    product?.model,
    product?.canonical_product_name,
    product?.equipment_type,
  ].filter(Boolean).join(' ')

  return detectTechnogymProductLineFromText(haystack)
}

export function getTechnogymProductLineLabel(lineId) {
  const rule = TECHNOGYM_PRODUCT_LINE_RULES.find((entry) => entry.id === lineId)
  if (!rule) return null
  return rule.labels[0]
}

export function detectConflictingTechnogymProductLine(productLineId, text) {
  if (!productLineId) return null
  const detected = detectTechnogymProductLineFromText(text)
  if (!detected || detected === productLineId) return null
  return detected
}

export function isTechnogymPreferredImageDomain(domain) {
  const normalized = normalizeHostname(domain)
  if (!normalized) return false
  return TECHNOGYM_PREFERRED_IMAGE_DOMAINS.some((entry) => (
    normalized === entry || normalized.endsWith(`.${entry}`)
  ))
}

export function scoreTechnogymPreferredDomain(domain) {
  if (!isTechnogymPreferredImageDomain(domain)) return 0
  if (normalizeHostname(domain)?.includes('fitkituk')) return 28
  if (isFitnessSuperstoreImageSourceDomain(domain)) return 22
  return 16
}

function titleCaseLineLabel(lineLabel) {
  if (!lineLabel) return null
  return lineLabel
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildPrimaryTechnogymSearchQuery(product) {
  const brand = 'Technogym'
  const lineId = detectTechnogymProductLine(product)
  const lineRule = TECHNOGYM_PRODUCT_LINE_RULES.find((entry) => entry.id === lineId)
  const lineLabel = lineRule?.labels?.[0] ?? getTechnogymProductLineLabel(lineId)
  const model = normalizeWhitespace(product?.model)
  const equipmentType = normalizeWhitespace(product?.equipment_type)
  const canonical = normalizeWhitespace(product?.canonical_product_name)

  if (canonical && lineRule?.patterns.some((pattern) => pattern.test(canonical))) {
    return canonical.replace(/^technogym\s+/i, 'Technogym ')
  }

  const parts = [brand]
  if (lineLabel) {
    parts.push(titleCaseLineLabel(lineLabel))
  }
  if (model && model.toUpperCase() !== 'OTHER') {
    parts.push(model)
  } else if (equipmentType) {
    parts.push(equipmentType)
  }

  if (parts.length > 1) {
    return parts.join(' ')
  }

  if (canonical) {
    return canonical.replace(/^technogym\s+/i, 'Technogym ')
  }

  return brand
}

function buildFallbackTechnogymSearchQuery(product) {
  const canonical = normalizeWhitespace(product?.canonical_product_name)
  if (canonical) return canonical
  return ['Technogym', product?.model, product?.equipment_type].filter(Boolean).join(' ')
}

export function buildTechnogymImageSearchQueries(product) {
  const primary = buildPrimaryTechnogymSearchQuery(product)
  const fallback = buildFallbackTechnogymSearchQuery(product)
  const queries = [primary]
  if (fallback && normalizeKey(fallback) !== normalizeKey(primary)) {
    queries.push(fallback)
  }
  return [...new Set(queries.map((query) => normalizeWhitespace(query)).filter(Boolean))]
}

export function buildTechnogymImageSearchQuery(product) {
  return buildTechnogymImageSearchQueries(product)[0] ?? 'Technogym'
}

export function assessTechnogymImageCandidateContent(candidate) {
  const haystack = [
    candidate?.title,
    candidate?.source,
    candidate?.sourceUrl,
    candidate?.imageUrl,
  ].filter(Boolean).join(' ')

  const warnings = []
  const penalties = []

  if (PEOPLE_IMAGE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('contains_people')
    penalties.push(45)
  }
  if (CONSOLE_ONLY_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('console_only_or_close_up')
    penalties.push(50)
  }
  if (PARTIAL_MACHINE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('partial_machine_or_parts')
    penalties.push(35)
  }
  if (GYM_FLOOR_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('gym_floor_context')
    penalties.push(18)
  }

  const width = Number(candidate?.width)
  const height = Number(candidate?.height)
  if (Number.isFinite(width) && Number.isFinite(height)) {
    if (width < 320 || height < 240) {
      warnings.push('low_resolution')
      penalties.push(20)
    }
    const aspect = width / height
    if (aspect > 2.4 || aspect < 0.45) {
      warnings.push('unusual_aspect_ratio')
      penalties.push(12)
    }
  }

  return {
    warnings,
    penalty: penalties.reduce((sum, value) => sum + value, 0),
    reject: warnings.includes('console_only_or_close_up') && warnings.includes('contains_people'),
  }
}

function countTokenMatches(tokens, haystack) {
  let matched = 0
  for (const token of tokens) {
    if (haystack.includes(token)) matched += 1
  }
  return matched
}

export function scoreTechnogymImageCandidate(candidate, product, {
  baseRejection = null,
} = {}) {
  if (baseRejection?.reject) {
    return {
      score: 0,
      rejection: baseRejection,
      domain: getImageSourceDomainFromCandidate(candidate),
      warnings: [],
      reasons: [],
      productLine: detectTechnogymProductLine(product),
      confidenceBand: 'rejected',
    }
  }

  const productLine = detectTechnogymProductLine(product)
  const haystack = [
    candidate?.title,
    candidate?.source,
    candidate?.sourceUrl,
    candidate?.imageUrl,
  ].filter(Boolean).join(' ').toLowerCase()

  const productTokens = new Set([
    ...tokenize(product?.canonical_product_name),
    ...tokenize(product?.model),
    ...tokenize(product?.product_family),
    ...tokenize(product?.equipment_type),
    ...tokenize(getTechnogymProductLineLabel(productLine)),
  ].filter((token) => token !== 'technogym'))

  const warnings = []
  const reasons = []
  let score = 24

  const domain = getImageSourceDomainFromCandidate(candidate)
  const domainScore = scoreImageSourceDomain(domain)
  if (domainScore < 0) {
    return {
      score: 0,
      rejection: { reject: true, reason: 'blocked_dealer_source_domain' },
      domain,
      warnings,
      reasons,
      productLine,
      confidenceBand: 'rejected',
    }
  }

  score += domainScore
  score += scoreTechnogymPreferredDomain(domain)

  const matchedTokens = countTokenMatches(productTokens, haystack)
  if (matchedTokens > 0) {
    score += Math.min(30, matchedTokens * 8)
    reasons.push(`${matchedTokens} product token(s) matched`)
  } else {
    score -= 20
    warnings.push('weak_model_match')
  }

  if (productLine) {
    const lineLabel = getTechnogymProductLineLabel(productLine)
    if (lineLabel && new RegExp(`\\b${lineLabel.replace('+', '\\+')}\\b`, 'i').test(haystack)) {
      score += 24
      reasons.push(`product line matched (${lineLabel})`)
    } else if (tokenize(lineLabel).some((token) => haystack.includes(token))) {
      score += 16
      reasons.push(`partial product line matched (${lineLabel})`)
    } else {
      score -= 28
      warnings.push('missing_product_line')
    }

    const conflictingLine = detectConflictingTechnogymProductLine(productLine, haystack)
    if (conflictingLine) {
      score -= 55
      warnings.push(`conflicting_product_line:${conflictingLine}`)
    }
  } else {
    score -= 18
    warnings.push('ambiguous_product_line')
  }

  const content = assessTechnogymImageCandidateContent(candidate)
  warnings.push(...content.warnings)
  score -= content.penalty
  if (content.reject) {
    return {
      score: 0,
      rejection: { reject: true, reason: 'technogym_content_rejected' },
      domain,
      warnings,
      reasons,
      productLine,
      confidenceBand: 'rejected',
    }
  }

  const width = Number(candidate?.width)
  const height = Number(candidate?.height)
  if (Number.isFinite(width) && Number.isFinite(height) && width >= 480 && height >= 360) {
    score += 10
    reasons.push('large_image_dimensions')
  }

  if (normalizeKey(haystack).includes(normalizeKey(product?.canonical_product_name))) {
    score += 18
    reasons.push('canonical_name_match')
  }

  const normalizedScore = Math.max(0, Math.min(100, score))
  let confidenceBand = 'needs_review'
  if (normalizedScore >= 85 && warnings.length === 0 && productLine && !warnings.some((w) => w.startsWith('conflicting'))) {
    confidenceBand = 'high_confidence'
  } else if (
    normalizedScore >= 68
    && !warnings.some((warning) => warning.startsWith('conflicting_product_line'))
    && !warnings.includes('missing_product_line')
  ) {
    confidenceBand = 'suggested'
  }

  return {
    score: normalizedScore,
    rejection: null,
    domain,
    warnings,
    reasons,
    productLine,
    confidenceBand,
  }
}

export function rankTechnogymImageCandidates(candidates = [], product) {
  return candidates
    .map((candidate) => {
      const result = scoreTechnogymImageCandidate(candidate, product)
      return { candidate, ...result }
    })
    .filter((entry) => entry.score > 0 && !entry.rejection?.reject)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return (left.warnings?.length ?? 0) - (right.warnings?.length ?? 0)
    })
}

export function resolveTechnogymImageImportMetadata({
  imageUrl,
  storagePath,
  sourceUrl,
  scoreResult,
}) {
  const domain = extractDomainFromUrl(sourceUrl)
  const confidence = scoreResult?.score ?? 0
  const warnings = scoreResult?.warnings ?? []
  const band = scoreResult?.confidenceBand ?? 'needs_review'

  const needsReview = band === 'needs_review'
    || warnings.some((warning) => warning.startsWith('conflicting_product_line'))
    || warnings.includes('missing_product_line')
    || warnings.includes('ambiguous_product_line')
    || warnings.includes('contains_people')
    || warnings.includes('console_only_or_close_up')

  const reviewReason = needsReview
    ? [
      TECHNOGYM_IMAGE_NEEDS_REVIEW_REASON,
      ...warnings,
      ...(scoreResult?.reasons ?? []),
    ].join('; ')
    : null

  return {
    image_url: imageUrl,
    image_storage_path: storagePath,
    image_source_url: sourceUrl,
    image_source_domain: domain,
    image_confidence: confidence,
    image_status: 'suggested',
    image_failure_reason: reviewReason,
    image_updated_at: new Date().toISOString(),
  }
}
