import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isGoogleAnalyticsReady, trackPageView } from '../../lib/analytics'

/**
 * Sends a GA4 page_view on SPA route changes.
 * Skips the first effect run — googleAnalytics.init() already records the
 * landing page so we do not double-count the initial view.
 */
function AnalyticsPageViews() {
  const location = useLocation()
  const isFirstRouteEffect = useRef(true)

  useEffect(() => {
    if (isFirstRouteEffect.current) {
      isFirstRouteEffect.current = false
      return
    }

    if (!isGoogleAnalyticsReady()) return

    trackPageView(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  return null
}

export default AnalyticsPageViews
