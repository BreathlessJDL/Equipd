import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isGoogleAnalyticsReady, trackPageView } from '../../lib/analytics'
import { useCookieConsent } from '../../hooks/useCookieConsent'
import { isCategoryEnabled } from '../../lib/cookieConsent'

/**
 * Sends a GA4 page_view on SPA route changes after analytics consent is granted.
 *
 * The analytics loader records the landing page view on init. This component
 * tracks subsequent navigations only, and stays idle while analytics is denied.
 */
function AnalyticsPageViews() {
  const location = useLocation()
  const { consent } = useCookieConsent()
  const lastTrackedPathRef = useRef(null)
  const analyticsGranted = isCategoryEnabled(consent, 'analytics')

  useEffect(() => {
    if (!analyticsGranted || !isGoogleAnalyticsReady()) {
      return
    }

    const pagePath = `${location.pathname}${location.search}`

    // Initial view is sent by analytics.init; skip until the route actually changes.
    if (lastTrackedPathRef.current === null) {
      lastTrackedPathRef.current = pagePath
      return
    }

    if (lastTrackedPathRef.current === pagePath) return

    lastTrackedPathRef.current = pagePath
    trackPageView(pagePath)
  }, [analyticsGranted, location.pathname, location.search])

  useEffect(() => {
    if (!analyticsGranted) {
      lastTrackedPathRef.current = null
    }
  }, [analyticsGranted])

  return null
}

export default AnalyticsPageViews
