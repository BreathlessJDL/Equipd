import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BUYER_PROTECTION_MODAL_CONTENT } from '../lib/trustMessaging'
import { EnvelopeIcon } from './icons/NavIcons'
import { ModalCloseIcon } from './icons/ModalCloseIcon'
import '../components/auth/AuthModal.css'
import './BuyerProtectionModal.css'

function ShieldIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
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

function SectionIcon({ sectionId }) {
  const className = 'buyer-protection-modal__section-icon'

  if (sectionId === 'refunds') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }

  if (sectionId === 'secure') {
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

  if (sectionId === 'support') {
    return <EnvelopeIcon className={className} />
  }

  return null
}

function BuyerProtectionModal({ open, onClose }) {
  const { title, buttonLabel, sections } = BUYER_PROTECTION_MODAL_CONTENT

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="auth-modal buyer-protection-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close Buyer Protection information"
        onClick={onClose}
      />

      <div
        className="auth-modal__dialog buyer-protection-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buyer-protection-modal-title"
      >
        <button
          type="button"
          className="auth-modal__close buyer-protection-modal__close"
          aria-label="Close Buyer Protection"
          onClick={onClose}
        >
          <ModalCloseIcon />
        </button>

        <header className="buyer-protection-modal__header">
          <ShieldIcon className="buyer-protection-modal__shield" />
          <h2 id="buyer-protection-modal-title" className="buyer-protection-modal__title">
            {title}
          </h2>
        </header>

        <div className="buyer-protection-modal__body">
          {sections.map((section) => (
            <section key={section.id} className="buyer-protection-modal__section">
              <div className="buyer-protection-modal__section-heading">
                <SectionIcon sectionId={section.id} />
                <h3 className="buyer-protection-modal__section-title">{section.title}</h3>
              </div>

              {section.intro ? (
                <p className="buyer-protection-modal__text">{section.intro}</p>
              ) : null}

              {section.bullets?.length ? (
                <ul className="buyer-protection-modal__list">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              {section.footnotes?.map((note) => (
                <p key={note} className="buyer-protection-modal__text">
                  {note}
                </p>
              ))}

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="buyer-protection-modal__text">
                  {paragraph}
                </p>
              ))}

              {section.policyLink ? (
                <p className="buyer-protection-modal__policy-link">
                  <Link to={section.policyLink.to} onClick={onClose}>
                    {section.policyLink.label}
                  </Link>
                </p>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="buyer-protection-modal__footer">
          <button
            type="button"
            className="buyer-protection-modal__button"
            onClick={onClose}
          >
            {buttonLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

export default BuyerProtectionModal
