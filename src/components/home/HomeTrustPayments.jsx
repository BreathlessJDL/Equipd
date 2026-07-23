import { Link } from 'react-router-dom'
import { TRUST_LINKS } from '../../lib/trustMessaging'
import './HomeTrustPayments.css'

const TRUST_POINTS = [
  {
    icon: 'shield',
    title: 'Secure payments with Stripe',
    body: 'Funds are held securely until the order is completed.',
  },
  {
    icon: 'prohibited',
    title: 'No cash or bank transfers',
    body: 'All payments are handled safely through Equipd.',
  },
  {
    icon: 'padlock',
    title: 'Released on collection or delivery',
    body: 'Funds are released once the order is confirmed complete.',
  },
]

function TrustIcon({ type }) {
  if (type === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="home-trust-payments__icon">
        <path
          d="M12 3 5 6v6c0 4.2 3 7.9 7 9 4-1.1 7-4.8 7-9V6l-7-3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="m9.5 12 1.8 1.8L15 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'prohibited') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="home-trust-payments__icon">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7.5 7.5l9 9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="home-trust-payments__icon">
      <path
        d="M8 11V8a4 4 0 1 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M7 11h10v8H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HomeTrustPayments() {
  return (
    <section className="home-trust-payments" aria-label="Why buy on Equipd">
      <div className="home-trust-payments__inner">
        <div className="home-trust-payments__grid">
          {TRUST_POINTS.map((point) => (
            <article key={point.title} className="home-trust-payments__card">
              <TrustIcon type={point.icon} />
              <h2 className="home-trust-payments__card-title">{point.title}</h2>
              <p className="home-trust-payments__card-body">{point.body}</p>
            </article>
          ))}
        </div>

        <p className="home-trust-payments__links">
          <Link to="/buy-used-gym-equipment">Buy used gym equipment</Link>
          <span aria-hidden="true"> · </span>
          <Link to={TRUST_LINKS.buyerProtection}>Buyer protection</Link>
        </p>
      </div>
    </section>
  )
}

export default HomeTrustPayments
