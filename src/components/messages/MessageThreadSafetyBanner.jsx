import { useState } from 'react'
import { ModalCloseIcon } from '../icons/ModalCloseIcon'
import {
  dismissConversationSafetyBanner,
  isConversationSafetyBannerDismissed,
} from '../../lib/conversationSafetyBannerPreference'
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

function MessageThreadSafetyBanner({ conversationId = null, userId = null, onDismissed }) {
  const [dismissed, setDismissed] = useState(() =>
    isConversationSafetyBannerDismissed(userId, conversationId),
  )

  if (!conversationId || dismissed) {
    return null
  }

  function handleDismiss() {
    dismissConversationSafetyBanner(userId, conversationId)
    setDismissed(true)
    onDismissed?.()
  }

  return (
    <div className="message-thread-safety-banner" role="note">
      <SafetyShieldIcon />
      <div className="message-thread-safety-banner__copy">
        <p className="message-thread-safety-banner__title">Keep payments on Equipd</p>
        <p className="message-thread-safety-banner__text">{MARKETPLACE_MESSAGE_SAFETY_NOTE}</p>
      </div>
      <button
        type="button"
        className="message-thread-safety-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss safety reminder for this conversation"
      >
        <ModalCloseIcon size={14} />
      </button>
    </div>
  )
}

export default MessageThreadSafetyBanner
