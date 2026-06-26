import { Link } from 'react-router-dom'
import { TRUST_LINKS, TRUST_VARIANTS } from '../lib/trustMessaging'
import BuyerProtectionListingCard from './BuyerProtectionListingCard'
import './BuyerProtectionInfo.css'

function BuyerProtectionInfo({
  variant = 'listing',
  role = 'buyer',
  compact = false,
  showLinks = true,
}) {
  if (variant === 'listing') {
    return <BuyerProtectionListingCard compact={compact} />
  }

  const contentKey =
    variant === 'order' ? (role === 'seller' ? 'orderSeller' : 'orderBuyer') : variant
  const content = TRUST_VARIANTS[contentKey] ?? TRUST_VARIANTS.listing

  return (
    <aside
      className={`trust-info${compact ? ' trust-info--compact' : ''}`}
      aria-label={content.title}
    >
      <h2 className="trust-info__title">{content.title}</h2>
      <ul className="trust-info__list">
        {content.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {showLinks ? (
        <p className="trust-info__links">
          <Link to={TRUST_LINKS.buyerProtection}>Buyer protection</Link>
        </p>
      ) : null}
    </aside>
  )
}

export default BuyerProtectionInfo
