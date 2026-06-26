import { useEffect, useState } from 'react'
import { MARKETPLACE_MESSAGE_SAFETY_NOTE } from '../../lib/marketplaceMessageValidation'
import './MessageThreadSafetyBanner.css'

function getDismissStorageKey(conversationId) {
  return `equipd:message-safety-dismissed:${conversationId}`
}

function readDismissed(conversationId) {
  if (!conversationId || typeof window === 'undefined') return false

  try {
    return window.sessionStorage.getItem(getDismissStorageKey(conversationId)) === '1'
  } catch {
    return false
  }
}

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

function MessageThreadSafetyBanner({ conversationId }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(conversationId))

  useEffect(() => {
    setDismissed(readDismissed(conversationId))
  }, [conversationId])

  if (!conversationId || dismissed) {
    return null
  }

  function handleDismiss() {
    try {
      window.sessionStorage.setItem(getDismissStorageKey(conversationId), '1')
    } catch {
      // Ignore storage errors; still hide for this render.
    }

    setDismissed(true)
  }

  return (
    <div className="message-thread-safety-banner" role="note">
      <SafetyShieldIcon />
      <p className="message-thread-safety-banner__text">{MARKETPLACE_MESSAGE_SAFETY_NOTE}</p>
      <button
        type="button"
        className="message-thread-safety-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss safety notice"
      >
        ×
      </button>
    </div>
  )
}

export default MessageThreadSafetyBanner
