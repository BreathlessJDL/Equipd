/**
 * Consent-gated analytics and marketing scripts.
 * Register providers here; they only initialise after the user opts in.
 *
 * Google tag loads only when:
 * - the user consents to the analytics category, and
 * - we are in production, or local analytics is explicitly enabled
 *   via VITE_ENABLE_ANALYTICS=true.
 *
 * Script loads with the Google tag ID (GT-…). GA4 events are configured and
 * sent explicitly to the connected measurement ID (G-…). Do not load gtag.js
 * with the G- ID (that URL 404s).
 */

const viteEnv = import.meta.env ?? {}

const initializedProviders = new Set()
let googleAnalyticsConfigured = false
let initialPageViewSent = false

/** Google tag ID — used only to load gtag.js (script src). */
export const GOOGLE_TAG_ID = 'GT-MK48KZH9'

/** Connected GA4 destination — used for gtag config + event send_to. */
export const GA4_MEASUREMENT_ID = 'G-M5767NZQ85'

/** @deprecated Prefer GOOGLE_TAG_ID / GA4_MEASUREMENT_ID. */
export const GA_MEASUREMENT_ID_DEFAULT = GA4_MEASUREMENT_ID

export function getGoogleTagId() {
  const fromEnv = typeof viteEnv.VITE_GOOGLE_TAG_ID === 'string' ? viteEnv.VITE_GOOGLE_TAG_ID.trim() : ''
  return fromEnv || GOOGLE_TAG_ID
}

export function getGa4MeasurementId() {
  const fromEnv =
    typeof viteEnv.VITE_GA_MEASUREMENT_ID === 'string' ? viteEnv.VITE_GA_MEASUREMENT_ID.trim() : ''
  return fromEnv || GA4_MEASUREMENT_ID
}

/** @deprecated Prefer getGa4MeasurementId(). */
export function getGaMeasurementId() {
  return getGa4MeasurementId()
}

/**
 * Production always may send (when consented + ID present).
 * Local / non-production stays silent unless VITE_ENABLE_ANALYTICS=true.
 */
export function shouldSendAnalytics() {
  if (viteEnv.PROD) return true
  return viteEnv.VITE_ENABLE_ANALYTICS === 'true'
}

export function isGoogleAnalyticsReady() {
  return (
    googleAnalyticsConfigured &&
    typeof window !== 'undefined' &&
    typeof window.gtag === 'function' &&
    !isGaDisabled()
  )
}

function gaDisableKey(id = getGa4MeasurementId()) {
  return `ga-disable-${id}`
}

function isGaDisabled() {
  if (typeof window === 'undefined') return true
  return Boolean(window[gaDisableKey(getGa4MeasurementId())])
}

function setGaDisabled(disabled) {
  if (typeof window === 'undefined') return
  window[gaDisableKey(getGa4MeasurementId())] = Boolean(disabled)
}

/**
 * Official gtag stub must push the Arguments object, not a rest-parameter Array.
 * Pushing an Array breaks queued commands before gtag.js loads.
 */
export function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag === 'function' && window.gtag.__equipdGtag) {
    return window.gtag
  }

  function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  gtag.__equipdGtag = true
  window.gtag = gtag
  return gtag
}

function injectGtagScript(googleTagId) {
  const existing = document.querySelector(`script[data-google-tag-id="${googleTagId}"]`)
  if (existing) return existing

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`
  script.dataset.googleTagId = googleTagId
  document.head.appendChild(script)
  return script
}

/**
 * Best-effort removal of GA cookies (_ga and _ga_*).
 */
export function clearGoogleAnalyticsCookies() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const hostname = window.location.hostname
  const domains = ['', hostname]
  if (hostname.includes('.')) {
    const parts = hostname.split('.')
    domains.push(`.${parts.slice(-2).join('.')}`)
    if (parts.length > 2) {
      domains.push(`.${hostname}`)
    }
  }

  const cookieNames = document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter((name) => name === '_ga' || name.startsWith('_ga_'))

  for (const name of cookieNames) {
    for (const domain of domains) {
      const domainPart = domain ? `; domain=${domain}` : ''
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainPart}`
    }
  }
}

function disableGoogleAnalytics() {
  setGaDisabled(true)
  googleAnalyticsConfigured = false
  initialPageViewSent = false
  initializedProviders.delete('googleAnalytics')
  clearGoogleAnalyticsCookies()
}

function initGoogleAnalytics() {
  if (!shouldSendAnalytics()) return false

  const googleTagId = getGoogleTagId()
  const ga4MeasurementId = getGa4MeasurementId()
  if (!googleTagId || !ga4MeasurementId) return false

  setGaDisabled(false)

  const gtag = ensureGtag()
  injectGtagScript(googleTagId)

  if (!googleAnalyticsConfigured) {
    gtag('js', new Date())
    // Configure the GA4 destination explicitly. Script still loads via GT-…
    // Do not also config GT-MK48KZH9 for analytics (avoids Ads-only / duplicate routing).
    gtag('config', ga4MeasurementId, {
      send_page_view: false,
    })
    googleAnalyticsConfigured = true
  }

  if (!initialPageViewSent) {
    trackPageView(`${window.location.pathname}${window.location.search}`)
    initialPageViewSent = true
  }

  return true
}

/**
 * Record a GA4 page_view for the current SPA route.
 * Safe to call when GA is not ready (no-op).
 */
export function trackPageView(pagePath) {
  if (!isGoogleAnalyticsReady()) return false

  const path = pagePath || `${window.location.pathname}${window.location.search}`
  const ga4MeasurementId = getGa4MeasurementId()
  window.gtag('event', 'page_view', {
    send_to: ga4MeasurementId,
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  })
  return true
}

/**
 * Record a custom GA4 event. Safe no-op until GA is initialised and allowed.
 * Always routes to the GA4 destination via send_to.
 * @param {string} eventName
 * @param {Record<string, unknown>} [params]
 */
export function trackEvent(eventName, params = {}) {
  if (!eventName || !isGoogleAnalyticsReady()) return false
  window.gtag('event', eventName, {
    ...params,
    send_to: getGa4MeasurementId(),
  })
  return true
}

const ANALYTICS_PROVIDERS = {
  googleAnalytics: {
    category: 'analytics',
    init: initGoogleAnalytics,
    disable: disableGoogleAnalytics,
  },
  // microsoftClarity: {
  //   category: 'analytics',
  //   init() {},
  //   disable() {},
  // },
  // metaPixel: {
  //   category: 'marketing',
  //   init() {},
  //   disable() {},
  // },
}

/** Categories currently shown in Cookie Settings (active providers only). */
export const ACTIVE_COOKIE_SETTING_CATEGORIES = ['analytics']

export function getRegisteredAnalyticsProviders() {
  return ANALYTICS_PROVIDERS
}

/**
 * Sync third-party scripts with the latest consent record.
 * Grants initialise providers once; denials disable them and clear GA cookies.
 */
export function applyConsentedAnalytics(consent) {
  if (!consent?.categories) {
    disableGoogleAnalytics()
    return
  }

  for (const [providerId, provider] of Object.entries(ANALYTICS_PROVIDERS)) {
    const granted = Boolean(consent.categories[provider.category])

    if (!granted) {
      if (typeof provider.disable === 'function') {
        provider.disable()
      }
      initializedProviders.delete(providerId)
      continue
    }

    if (initializedProviders.has(providerId) && isGoogleAnalyticsReady()) {
      continue
    }

    try {
      const ok = provider.init()
      if (ok !== false) {
        initializedProviders.add(providerId)
      }
    } catch (error) {
      console.error(`Failed to initialise analytics provider "${providerId}"`, error)
    }
  }
}

export function resetAnalyticsProvidersForTesting() {
  initializedProviders.clear()
  googleAnalyticsConfigured = false
  initialPageViewSent = false
  if (typeof window !== 'undefined') {
    setGaDisabled(false)
  }
}
