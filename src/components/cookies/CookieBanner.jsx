import { Link } from 'react-router-dom'
import { useCookieConsent } from '../../hooks/useCookieConsent'
import { COOKIE_POLICY_PATH } from '../../lib/cookieConsent'
import './CookieBanner.css'

function CookieBanner() {
  const { bannerVisible, acceptAll, rejectNonEssential, openCookieSettings } = useCookieConsent()

  if (!bannerVisible) return null

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <div className="cookie-banner__panel">
        <div className="cookie-banner__copy">
          <h2 className="cookie-banner__title">We use cookies</h2>
          <p className="cookie-banner__text">
            Equipd uses necessary cookies to run the site. You can also allow optional Analytics
            cookies (Google Analytics) to help us improve the marketplace and valuation tools.
            Choose Accept all, Reject non-essential, or Cookie settings. Read our{' '}
            <Link to={COOKIE_POLICY_PATH}>Cookie Policy</Link> for details.
          </p>
        </div>

        <div className="cookie-banner__actions">
          <button
            type="button"
            className="cookie-banner__button cookie-banner__button--primary"
            onClick={acceptAll}
          >
            Accept all
          </button>
          <button
            type="button"
            className="cookie-banner__button cookie-banner__button--secondary"
            onClick={rejectNonEssential}
          >
            Reject non-essential
          </button>
          <button
            type="button"
            className="cookie-banner__button cookie-banner__button--secondary"
            onClick={openCookieSettings}
          >
            Cookie settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieBanner
