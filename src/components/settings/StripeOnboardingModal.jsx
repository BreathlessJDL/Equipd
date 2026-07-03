import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../auth/AuthModal.css'
import './StripeOnboardingModal.css'

const STRIPE_ONBOARDING_POINTS = [
  'Stripe verifies sellers so Equipd can send payouts securely.',
  'Select Individual unless you are selling as a registered business.',
  'For industry, choose the closest Retail / Other Retail option.',
  'Your Equipd shop URL is provided as your website where possible.',
  'VAT and business registration can usually be left blank for individual sellers.',
]

function StripeOnboardingModal({ open, loading, error, onClose, onContinue }) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, loading, onClose])

  if (!open) return null

  return createPortal(
    <div className="auth-modal stripe-onboarding-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close Stripe onboarding information"
        onClick={onClose}
        disabled={loading}
      />

      <div
        className="auth-modal__dialog stripe-onboarding-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stripe-onboarding-modal-title"
      >
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Close"
          onClick={onClose}
          disabled={loading}
        >
          ×
        </button>

        <header className="stripe-onboarding-modal__header">
          <h2 id="stripe-onboarding-modal-title" className="stripe-onboarding-modal__title">
            Set up payouts with Stripe
          </h2>
          <p className="stripe-onboarding-modal__lead">
            Equipd uses Stripe to securely verify sellers and send payouts directly to your bank
            account. This usually only takes a few minutes.
          </p>
        </header>

        <ul className="stripe-onboarding-modal__points">
          {STRIPE_ONBOARDING_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        {error ? (
          <p className="stripe-onboarding-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="stripe-onboarding-modal__actions">
          <button
            type="button"
            className="stripe-onboarding-modal__button stripe-onboarding-modal__button--primary"
            onClick={onContinue}
            disabled={loading}
          >
            {loading ? 'Opening Stripe…' : 'Continue to Stripe'}
          </button>
          <button
            type="button"
            className="stripe-onboarding-modal__button stripe-onboarding-modal__button--secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default StripeOnboardingModal
