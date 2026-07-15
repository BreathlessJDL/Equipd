/**
 * Consent-gated analytics and marketing scripts.
 * Register providers here; they only initialise after the user opts in.
 *
 * Google Analytics 4 loads only when:
 * - the user consents to the analytics category, and
 * - we are in production, or local analytics is explicitly enabled
 *   via VITE_ENABLE_ANALYTICS=true.
 */

const initializedProviders = new Set()
let googleAnalyticsConfigured = false

/** Public GA4 measurement ID (override with VITE_GA_MEASUREMENT_ID if needed). */
const DEFAULT_GA_MEASUREMENT_ID = 'G-M5767NZQ85'

function getGaMeasurementId() {
  const fromEnv = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
  return fromEnv || DEFAULT_GA_MEASUREMENT_ID
}

/**
 * Production always may send (when consented + ID present).
 * Local / non-production stays silent unless VITE_ENABLE_ANALYTICS=true.
 */
export function shouldSendAnalytics() {
  if (import.meta.env.PROD) return true
  return import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
}

export function isGoogleAnalyticsReady() {
  return googleAnalyticsConfigured && typeof window !== 'undefined' && typeof window.gtag === 'function'
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag === 'function') return window.gtag

  function gtag(...args) {
    window.dataLayer.push(args)
  }
  window.gtag = gtag
  return gtag
}

function injectGtagScript(measurementId) {
  const existing = document.querySelector(`script[data-ga-measurement-id="${measurementId}"]`)
  if (existing) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  script.dataset.gaMeasurementId = measurementId
  document.head.appendChild(script)
}

function initGoogleAnalytics() {
  if (!shouldSendAnalytics()) return

  const measurementId = getGaMeasurementId()
  if (!measurementId) return

  const gtag = ensureGtag()
  injectGtagScript(measurementId)

  gtag('js', new Date())
  // Disable the automatic first page_view — SPA routing owns page views.
  gtag('config', measurementId, {
    send_page_view: false,
    anonymize_ip: true,
  })

  googleAnalyticsConfigured = true
  trackPageView(`${window.location.pathname}${window.location.search}`)
}

/**
 * Record a GA4 page_view for the current SPA route.
 * Safe to call when GA is not ready (no-op).
 */
export function trackPageView(pagePath) {
  if (!isGoogleAnalyticsReady()) return

  const path = pagePath || `${window.location.pathname}${window.location.search}`
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  })
}

/**
 * Record a custom GA4 event. Safe no-op until GA is initialised.
 * @param {string} eventName
 * @param {Record<string, unknown>} [params]
 */
export function trackEvent(eventName, params = {}) {
  if (!eventName || !isGoogleAnalyticsReady()) return
  window.gtag('event', eventName, params)
}

const ANALYTICS_PROVIDERS = {
  googleAnalytics: {
    category: 'analytics',
    init: initGoogleAnalytics,
  },
  // microsoftClarity: {
  //   category: 'analytics',
  //   init() {
  //     // inject Clarity script
  //   },
  // },
  // metaPixel: {
  //   category: 'marketing',
  //   init() {
  //     // inject Meta Pixel
  //   },
  // },
}

export function getRegisteredAnalyticsProviders() {
  return ANALYTICS_PROVIDERS
}

export function applyConsentedAnalytics(consent) {
  if (!consent?.categories) return

  for (const [providerId, provider] of Object.entries(ANALYTICS_PROVIDERS)) {
    if (initializedProviders.has(providerId)) continue
    if (!consent.categories[provider.category]) continue

    try {
      provider.init()
      initializedProviders.add(providerId)
    } catch (error) {
      console.error(`Failed to initialise analytics provider "${providerId}"`, error)
    }
  }
}

export function resetAnalyticsProvidersForTesting() {
  initializedProviders.clear()
  googleAnalyticsConfigured = false
}
