import { useState } from 'react'
import { EnvelopeIcon } from './icons/NavIcons'
import BuyerProtectionModal from './BuyerProtectionModal'
import { LISTING_BUYER_PROTECTION_CARD } from '../lib/trustMessaging'
import './BuyerProtectionListingCard.css'

function ShieldIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 4 8 10v11.5c0 9.8 6.4 18.9 16 22.5 9.6-3.6 16-12.7 16-22.5V10L24 4Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M24 4 8 10v11.5c0 9.8 6.4 18.9 16 22.5 9.6-3.6 16-12.7 16-22.5V10L24 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M17 24.5 21.5 29 31 19.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BenefitIcon({ benefitId }) {
  const className = 'buyer-protection-listing-card__benefit-icon'

  if (benefitId === 'secure-checkout') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 9V7a5 5 0 0 1 10 0v2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M6 9h12l1 11H5L6 9Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (benefitId === 'protected-funds') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 7h8l1 14H7L8 7Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9 7V5.5A3 3 0 0 1 15 5.5V7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M9.5 12h5M9.5 15.5h3.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (benefitId === 'protection-window') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M12 8v4.25l2.75 1.75"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (benefitId === 'uk-support') {
    return <EnvelopeIcon className={className} />
  }

  return null
}

function BuyerProtectionListingCard({ compact = false }) {
  const [modalOpen, setModalOpen] = useState(false)
  const { title, subtitle, benefits, ctaLabel } = LISTING_BUYER_PROTECTION_CARD

  return (
    <>
      <aside
        className={`buyer-protection-listing-card${
          compact ? ' buyer-protection-listing-card--compact' : ''
        }`}
        aria-label={title}
      >
        <header className="buyer-protection-listing-card__header">
          <ShieldIcon className="buyer-protection-listing-card__shield" />
          <div className="buyer-protection-listing-card__heading">
            <h2 className="buyer-protection-listing-card__title">{title}</h2>
            <p className="buyer-protection-listing-card__subtitle">{subtitle}</p>
          </div>
        </header>

        <ul className="buyer-protection-listing-card__benefits">
          {benefits.map((benefit) => (
            <li key={benefit.id} className="buyer-protection-listing-card__benefit">
              <span className="buyer-protection-listing-card__benefit-icon-wrap" aria-hidden="true">
                <BenefitIcon benefitId={benefit.id} />
              </span>
              <div className="buyer-protection-listing-card__benefit-copy">
                <p className="buyer-protection-listing-card__benefit-title">{benefit.title}</p>
                <p className="buyer-protection-listing-card__benefit-description">
                  {benefit.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <footer className="buyer-protection-listing-card__footer">
          <button
            type="button"
            className="buyer-protection-listing-card__cta"
            onClick={() => setModalOpen(true)}
          >
            {ctaLabel}
            <span className="buyer-protection-listing-card__cta-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </footer>
      </aside>

      <BuyerProtectionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}

export default BuyerProtectionListingCard
