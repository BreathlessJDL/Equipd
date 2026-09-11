import { MARKETPLACE_MESSAGE_SAFETY_NOTE } from '../../lib/marketplaceMessageValidation'
import './MessageThreadSafetyBanner.css'

function SafetyShieldIcon() {
  return (
    <svg className="message-thread-safety-banner__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5 3.25 3.5v4.25c0 3.45 2.05 6.65 4.75 7.75 2.7-1.1 4.75-4.3 4.75-7.75V3.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 8 7.25 9.5 10.25 6.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MessageThreadSafetyBanner() {
  return (
    <div className="message-thread-safety-banner" role="note">
      <SafetyShieldIcon />
      <div className="message-thread-safety-banner__copy">
        <p className="message-thread-safety-banner__title">Stay safe on Equipd</p>
        <p className="message-thread-safety-banner__text">{MARKETPLACE_MESSAGE_SAFETY_NOTE}</p>
      </div>
    </div>
  )
}

export default MessageThreadSafetyBanner
