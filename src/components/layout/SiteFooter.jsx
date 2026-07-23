import { Link } from 'react-router-dom'
import EquipdLogo from '../EquipdLogo'
import ProtectedLink from '../auth/ProtectedLink'
import { useCookieConsent } from '../../hooks/useCookieConsent'
import { BUYER_PROTECTION_HELP_PATH } from '../../lib/trustMessaging'
import {
  COOKIE_POLICY_PATH,
  PRIVACY_POLICY_PATH,
  TERMS_PATH,
} from '../../lib/cookieConsent'
import './SiteFooter.css'

const FOOTER_COLUMNS = [
  {
    title: 'Buy',
    links: [
      { label: 'Buy Used Gym Equipment', to: '/buy-used-gym-equipment' },
      { label: 'Browse Listings', to: '/browse' },
      { label: 'Equipment Values', to: '/brands' },
      { label: 'Instant Valuation', to: '/valuation' },
      { label: 'How Buying Works', to: '/help/how-buying-works' },
      { label: 'Buyer Protection', to: BUYER_PROTECTION_HELP_PATH },
      { label: 'Collection & Delivery', to: '/help/collection-orders' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { label: 'Sell Gym Equipment', to: '/sell-gym-equipment' },
      { label: 'Create a Listing', to: '/listings/new' },
      { label: 'How Selling Works', to: '/help/how-selling-works' },
      { label: 'Getting Paid', to: '/help/getting-paid' },
      { label: 'Seller Payouts', to: '/help/seller-payouts' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Centre', to: '/help' },
      { label: 'Contact Support', to: '/support' },
      { label: 'Refunds & Returns', to: '/help/refunds-and-returns' },
      { label: 'Report a Problem', to: '/support' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Equipd', to: '/about' },
    ],
  },
]

function SiteFooter() {
  const { openCookieSettings } = useCookieConsent()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Link to="/" className="site-footer__logo-link">
              <EquipdLogo variant="header" className="site-footer__logo" />
            </Link>
            <p className="site-footer__tagline">
              The UK marketplace for used gym equipment.
            </p>
          </div>

          <div className="site-footer__columns">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="site-footer__column">
                <h3 className="site-footer__heading">{column.title}</h3>
                <ul className="site-footer__links">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.to === '/listings/new' ? (
                        <ProtectedLink to={link.to}>{link.label}</ProtectedLink>
                      ) : (
                        <Link to={link.to}>{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="site-footer__legal">
        <div className="site-footer__legal-inner">
          <p className="site-footer__copyright">&copy; 2026 Equipd</p>
          <nav className="site-footer__legal-nav" aria-label="Legal">
            <Link to={COOKIE_POLICY_PATH} className="site-footer__legal-link">
              Cookie Policy
            </Link>
            <button
              type="button"
              className="site-footer__legal-link"
              onClick={openCookieSettings}
            >
              Cookie Settings
            </button>
            <Link to={PRIVACY_POLICY_PATH} className="site-footer__legal-link">
              Privacy Policy
            </Link>
            <Link to={TERMS_PATH} className="site-footer__legal-link">
              Terms &amp; Conditions
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
