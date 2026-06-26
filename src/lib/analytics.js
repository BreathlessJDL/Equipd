/**
 * Consent-gated analytics and marketing scripts.
 * Register providers here; they only initialise after the user opts in.
 */

const initializedProviders = new Set()

const ANALYTICS_PROVIDERS = {
  // googleAnalytics: {
  //   category: 'analytics',
  //   init() {
  //     // load gtag with import.meta.env.VITE_GA_MEASUREMENT_ID
  //   },
  // },
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
}
