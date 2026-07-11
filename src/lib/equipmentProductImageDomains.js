export const BLOCKED_IMAGE_SOURCE_DOMAINS = [
  'equip4gyms.com',
  'equipd4gyms.com',
  'usedgymequipment.com',
  'usedgymequipment.co.uk',
  'ebay.com',
  'ebay.co.uk',
  'ebayimg.com',
  'facebook.com',
  'fb.com',
  'fbcdn.net',
  'gumtree.com',
  'gumtree.co.uk',
  'amazon.com',
  'amazon.co.uk',
  'marketplace.facebook.com',
  'bidspotter.co.uk',
  'the-saleroom.com',
  'craigslist.org',
  'shpock.com',
  'depop.com',
  'vinted.co.uk',
  'vinted.com',
  'preloved.co.uk',
  'gymwarehouse.co.uk',
  'gymequipment.co.uk',
  'gymstore.co.uk',
]

export const BLOCKED_IMAGE_SOURCE_DOMAIN_PATTERNS = [
  /equip4gyms/i,
  /equipd4gyms/i,
  /usedgymequipment/i,
  /ebay\./i,
  /facebook\.com/i,
  /fbcdn\.net/i,
  /gumtree\./i,
  /marketplace/i,
  /\/auction\b/i,
  /\bauction\b/i,
]

export const MANUFACTURER_IMAGE_SOURCE_DOMAINS = [
  'technogym.com',
  'lifefitness.com',
  'precor.com',
  'matrixfitness.com',
  'cybexintl.com',
  'cybex.com',
  'startrac.com',
  'pulsefitness.com',
]

export const AUTO_APPROVE_IMAGE_SOURCE_DOMAINS = [
  'technogym.com',
  'lifefitness.com',
  'shop.lifefitness.com',
  'matrixfitness.com',
  'precor.com',
  'cybexintl.com',
  'startrac.com',
  'pulsefitness.com',
]

export const SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS = [
  'fitshop.co.uk',
  'powerhouse-fitness.co.uk',
  'fitkit.co.uk',
  'fitkituk.com',
  'johnsonfitness.com',
  'completegyms.com',
  'pulseresale.com',
]

export const CONDITIONAL_RETAILER_IMAGE_DOMAINS = [
  ...SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS,
  'fitnesssuperstore.co.uk',
  'fitnesssuperstore.com',
]

export const DEALER_WATERMARK_URL_PATTERNS = [
  /watermark/i,
  /dealer[-_]?logo/i,
  /company[-_]?logo/i,
  /equip4gyms/i,
  /equipd4gyms/i,
  /used[-_]?gym[-_]?equipment/i,
  /second[-_]?hand/i,
  /pre[-_]?owned/i,
  /clearance[-_]?stock/i,
]

export const HIGH_RISK_IMAGE_SOURCE_DOMAINS = [
  'equip4gyms.com',
  'freedomfitnessequipment.com',
  'bnbsupplements.com',
  'fitnessequipmentempire.com',
  'superfitnessgymequipment.com',
  'cmlgymsolution.com',
  'carolinafitnessequipment.com',
  'buyandsellfitness.com',
  'uzed.com',
  'cffstrengthequipment.com',
]

export const PROTECTED_IMAGE_SOURCE_DOMAINS = [
  'technogym.com',
  'lifefitness.com',
  'shop.lifefitness.com',
]

export const FITNESS_SUPERSTORE_IMAGE_SOURCE_DOMAINS = [
  'fitnesssuperstore.co.uk',
  'fitnesssuperstore.com',
]

export const REPLACEMENT_IMAGE_SOURCE_TIERS = [
  { label: 'manufacturer', domains: AUTO_APPROVE_IMAGE_SOURCE_DOMAINS },
  { label: 'fitkit_uk', domains: ['fitkituk.com'] },
  { label: 'fitness_superstore', domains: FITNESS_SUPERSTORE_IMAGE_SOURCE_DOMAINS },
  { label: 'matrix_johnson', domains: ['johnsonfitness.com', 'johnsonhealthtech.com', 'johnsonhealthtech.co.uk'] },
  { label: 'fitshop', domains: ['fitshop.co.uk'] },
  { label: 'powerhouse', domains: ['powerhouse-fitness.co.uk'] },
  { label: 'fitkit', domains: ['fitkit.co.uk'] },
]

export const BLOCKED_DEALER_IMAGE_REJECTION_REASON = 'blocked_dealer_source_domain'

export const HIGH_RISK_REPLACEMENT_MANUAL_REVIEW_REASON = 'high_risk_replacement_manual_review_required'

export const IMAGE_REVIEW_FILTER = {
  ALL: 'all',
  NON_MANUFACTURER: 'non_manufacturer',
  SUSPECTED_WATERMARK: 'suspected_watermark',
  FAILED_REJECTED: 'failed_rejected',
}

export function normalizeHostname(hostname) {
  return String(hostname ?? '').toLowerCase().replace(/^www\./, '')
}

export function domainMatchesList(domain, entries = []) {
  const normalized = normalizeHostname(domain)
  if (!normalized) return false
  return entries.some((entry) => (
    normalized === entry || normalized.endsWith(`.${entry}`)
  ))
}

export function extractDomainFromUrl(url) {
  try {
    return normalizeHostname(new URL(url).hostname)
  } catch {
    return null
  }
}

export function isBlockedImageSourceDomain(domain) {
  const normalized = normalizeHostname(domain)
  if (!normalized) return false
  if (domainMatchesList(normalized, BLOCKED_IMAGE_SOURCE_DOMAINS)) return true
  return BLOCKED_IMAGE_SOURCE_DOMAIN_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isBlockedImageSourceUrl(url) {
  const value = String(url ?? '').trim()
  if (!value) return false
  const domain = extractDomainFromUrl(value)
  if (domain && isBlockedImageSourceDomain(domain)) return true
  return BLOCKED_IMAGE_SOURCE_DOMAIN_PATTERNS.some((pattern) => pattern.test(value))
    || DEALER_WATERMARK_URL_PATTERNS.some((pattern) => pattern.test(value))
}

export function isManufacturerImageSourceDomain(domain) {
  return domainMatchesList(domain, MANUFACTURER_IMAGE_SOURCE_DOMAINS)
}

export function isAutoApproveImageSourceDomain(domain) {
  return domainMatchesList(domain, AUTO_APPROVE_IMAGE_SOURCE_DOMAINS)
}

export function isSuggestedRetailerImageSourceDomain(domain) {
  return domainMatchesList(domain, SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS)
}

export function isConditionalRetailerImageDomain(domain) {
  return domainMatchesList(domain, CONDITIONAL_RETAILER_IMAGE_DOMAINS)
}

export function isAllowlistedCleanRetailerImageDomain(domain) {
  return isConditionalRetailerImageDomain(domain)
}

export function isAllowlistedImageSourceDomain(domain) {
  return isAutoApproveImageSourceDomain(domain) || isAllowlistedCleanRetailerImageDomain(domain)
}

export function resolveImageStatusForSourceDomain(domain, { failureReason = null } = {}) {
  if (failureReason) return 'failed'
  if (!domain) return 'suggested'
  if (isBlockedImageSourceDomain(domain)) return 'rejected'
  if (isAutoApproveImageSourceDomain(domain)) return 'approved'
  if (isSuggestedRetailerImageSourceDomain(domain)) return 'suggested'
  if (isConditionalRetailerImageDomain(domain)) return 'suggested'
  if (isManufacturerImageSourceDomain(domain)) return 'suggested'
  return 'suggested'
}

export function classifyImageSourceDomain(domain) {
  if (!domain) return 'unknown'
  if (isBlockedImageSourceDomain(domain)) return 'blocked'
  if (isManufacturerImageSourceDomain(domain)) return 'manufacturer'
  if (isConditionalRetailerImageDomain(domain)) return 'conditional_retailer'
  return 'other'
}

export function hasSuspectedDealerWatermarkSignals({ sourceUrl = '', imageUrl = '', title = '' } = {}) {
  const haystack = [sourceUrl, imageUrl, title].filter(Boolean).join(' ')
  if (!haystack) return false
  if (isBlockedImageSourceUrl(sourceUrl) || isBlockedImageSourceUrl(imageUrl)) return true
  return DEALER_WATERMARK_URL_PATTERNS.some((pattern) => pattern.test(haystack))
}

export function getImageSourceDomainFromCandidate(candidate) {
  return extractDomainFromUrl(candidate?.sourceUrl ?? candidate?.link)
    || extractDomainFromUrl(candidate?.imageUrl ?? candidate?.original)
}

export function scoreImageSourceDomain(domain) {
  const classification = classifyImageSourceDomain(domain)
  if (classification === 'blocked') return -100
  if (isAutoApproveImageSourceDomain(domain)) {
    const index = AUTO_APPROVE_IMAGE_SOURCE_DOMAINS.findIndex((entry) => domainMatchesList(domain, [entry]))
    return 100 - Math.max(index, 0)
  }
  if (classification === 'manufacturer') {
    const index = MANUFACTURER_IMAGE_SOURCE_DOMAINS.findIndex((entry) => domainMatchesList(domain, [entry]))
    return 70 - Math.max(index, 0)
  }
  if (classification === 'conditional_retailer') {
    const index = CONDITIONAL_RETAILER_IMAGE_DOMAINS.findIndex((entry) => domainMatchesList(domain, [entry]))
    return 45 - Math.max(index, 0)
  }
  return 0
}

export function isHighRiskImageSourceDomain(domain) {
  return domainMatchesList(domain, HIGH_RISK_IMAGE_SOURCE_DOMAINS)
}

export function findEmbeddedImageSourceDomains(text, {
  includeHighRisk = true,
  includeBlocked = true,
} = {}) {
  const haystack = String(text ?? '').toLowerCase()
  if (!haystack) return []

  const matches = []
  if (includeHighRisk) {
    for (const domain of HIGH_RISK_IMAGE_SOURCE_DOMAINS) {
      if (haystack.includes(domain)) matches.push(domain)
    }
  }
  if (includeBlocked) {
    for (const domain of BLOCKED_IMAGE_SOURCE_DOMAINS) {
      if (haystack.includes(domain)) matches.push(domain)
    }
  }

  return [...new Set(matches)]
}

export function classifyEmbeddedImageSourceDomain(domain) {
  if (!domain) return null
  if (isHighRiskImageSourceDomain(domain)) return 'high_risk'
  if (isBlockedImageSourceDomain(domain)) return 'blocked_dealer'
  return null
}

export function isHighRiskImageSourceUrl(url) {
  const value = String(url ?? '').trim()
  if (!value) return false
  const domain = extractDomainFromUrl(value)
  if (domain && isHighRiskImageSourceDomain(domain)) return true
  return findEmbeddedImageSourceDomains(value, { includeHighRisk: true, includeBlocked: false }).length > 0
}

export function isProtectedImageSourceDomain(domain) {
  return domainMatchesList(domain, PROTECTED_IMAGE_SOURCE_DOMAINS)
}

export function isFitnessSuperstoreImageSourceDomain(domain) {
  return domainMatchesList(domain, FITNESS_SUPERSTORE_IMAGE_SOURCE_DOMAINS)
}

export function getReplacementImageSourceTier(domain) {
  if (!domain) return null
  for (const [index, tier] of REPLACEMENT_IMAGE_SOURCE_TIERS.entries()) {
    if (domainMatchesList(domain, tier.domains)) {
      return { ...tier, priority: index }
    }
  }
  return null
}

export function isReplacementImageSourceDomain(domain) {
  return Boolean(getReplacementImageSourceTier(domain))
}

export function isExcludedReplacementCandidateDomain(domain, excludedDomains = []) {
  const normalized = normalizeHostname(domain)
  if (!normalized) return true
  if (isHighRiskImageSourceDomain(normalized)) return true
  if (isBlockedImageSourceDomain(normalized)) return true
  return excludedDomains.some((entry) => domainMatchesList(normalized, [entry]))
}

export function shouldUseReplacementImageCandidate(candidate, excludedDomains = []) {
  const domain = getImageSourceDomainFromCandidate(candidate)
  if (!domain || isExcludedReplacementCandidateDomain(domain, excludedDomains)) return false
  if (hasSuspectedDealerWatermarkSignals({
    sourceUrl: candidate?.sourceUrl ?? candidate?.link,
    imageUrl: candidate?.imageUrl ?? candidate?.original,
    title: candidate?.title,
  })) {
    return false
  }
  return isReplacementImageSourceDomain(domain)
}

export function shouldAutoSuggestImageCandidate(candidate) {
  const domain = getImageSourceDomainFromCandidate(candidate)
  if (!domain) return false
  if (isBlockedImageSourceDomain(domain)) return false
  if (hasSuspectedDealerWatermarkSignals({
    sourceUrl: candidate?.sourceUrl ?? candidate?.link,
    imageUrl: candidate?.imageUrl ?? candidate?.original,
    title: candidate?.title,
  })) {
    return false
  }
  return isAutoApproveImageSourceDomain(domain) || isAllowlistedCleanRetailerImageDomain(domain)
}
