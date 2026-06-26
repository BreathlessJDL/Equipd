export const COOKIE_CONSENT_VERSION = '1.0'

export const COOKIE_CONSENT_STORAGE_KEY = 'equipd_cookie_consent'

export const COOKIE_POLICY_PATH = '/help/cookie-policy'
export const PRIVACY_POLICY_PATH = '/help/privacy-policy'
export const TERMS_PATH = '/help/terms-and-conditions'

export const COOKIE_CATEGORIES = {
  necessary: {
    id: 'necessary',
    label: 'Necessary',
    description:
      'Required for Equipd to work. Includes sign-in, security, and saving your cookie choices. These cannot be switched off.',
    required: true,
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    description:
      'Help us understand how the site is used so we can improve performance and features. Data is aggregated where possible.',
    required: false,
  },
  marketing: {
    id: 'marketing',
    label: 'Marketing',
    description:
      'Used to measure advertising and show relevant Equipd promotions on other platforms.',
    required: false,
  },
  preferences: {
    id: 'preferences',
    label: 'Preferences',
    description:
      'Remember choices such as layout or saved filters to personalise your experience.',
    required: false,
  },
}

const OPTIONAL_CATEGORY_IDS = ['analytics', 'marketing', 'preferences']

export function getDefaultCategoryPreferences() {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  }
}

export function getAcceptAllCategoryPreferences() {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
    preferences: true,
  }
}

export function getRejectNonEssentialCategoryPreferences() {
  return getDefaultCategoryPreferences()
}

function normalizeCategories(categories = {}) {
  const normalized = getDefaultCategoryPreferences()

  for (const id of OPTIONAL_CATEGORY_IDS) {
    if (typeof categories[id] === 'boolean') {
      normalized[id] = categories[id]
    }
  }

  normalized.necessary = true
  return normalized
}

export function readStoredCookieConsent() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    if (parsed.version !== COOKIE_CONSENT_VERSION) return null
    if (!parsed.consentedAt || typeof parsed.consentedAt !== 'string') return null

    return {
      version: parsed.version,
      consentedAt: parsed.consentedAt,
      categories: normalizeCategories(parsed.categories),
    }
  } catch {
    return null
  }
}

export function writeStoredCookieConsent(categories) {
  const record = {
    version: COOKIE_CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
    categories: normalizeCategories(categories),
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
  return record
}

export function hasRecordedCookieConsent() {
  return readStoredCookieConsent() !== null
}

export function isCategoryEnabled(consent, categoryId) {
  if (!consent?.categories) return categoryId === 'necessary'
  if (categoryId === 'necessary') return true
  return Boolean(consent.categories[categoryId])
}
