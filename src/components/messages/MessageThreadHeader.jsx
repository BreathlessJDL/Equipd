import { useEffect, useId, useRef, useState } from 'react'
import ProfileAvatarLink from './ProfileAvatarLink'
import UserAvatar from '../UserAvatar'
import ReportTrigger from '../ReportTrigger'
import {
  getConversationListingImageUrl,
  getConversationOtherPartyAvatarProfile,
  getConversationOtherPartyName,
} from '../../lib/messages'
import './MessageThreadHeader.css'

function MessageThreadHeader({ conversation, userId, onBack, reportProps = null }) {
  const participantName = getConversationOtherPartyName(conversation, userId)
  const participantProfile = getConversationOtherPartyAvatarProfile(conversation, userId)
  const listingTitle = conversation?.listing?.title?.trim() || ''
  const listingImageUrl = getConversationListingImageUrl(conversation)
  const primaryTitle = participantName || listingTitle || 'Conversation'
  const secondaryTitle = participantName && listingTitle ? listingTitle : ''
  const menuId = useId()
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuConversationId, setMenuConversationId] = useState(conversation?.id)

  if (conversation?.id !== menuConversationId) {
    setMenuConversationId(conversation?.id)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) return undefined

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="message-thread-header">
      <div className="message-thread-header__main">
        <button
          type="button"
          className="message-thread-header__back"
          onClick={onBack}
          aria-label="Back to inbox"
        >
          <span aria-hidden="true">←</span>
        </button>

        {listingImageUrl ? (
          <div className="message-thread-header__thumb" aria-hidden="true">
            <img
              className="message-thread-header__thumb-image"
              src={listingImageUrl}
              alt=""
            />
          </div>
        ) : participantProfile ? (
          participantProfile.id ? (
            <ProfileAvatarLink
              profile={participantProfile}
              size="sm"
              className="message-thread-header__avatar"
            />
          ) : (
            <UserAvatar
              profile={participantProfile}
              size="sm"
              className="message-thread-header__avatar"
            />
          )
        ) : null}

        <div className="message-thread-header__info">
          <h2 className="message-thread-header__participant">{primaryTitle}</h2>
          {secondaryTitle ? (
            <p className="message-thread-header__listing">{secondaryTitle}</p>
          ) : null}
        </div>

        {reportProps ? (
          <div className="message-thread-header__actions" ref={menuRef}>
            <button
              type="button"
              className="message-thread-header__menu-toggle"
              aria-label="Conversation options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">•••</span>
            </button>

            <div
              id={menuId}
              className={`message-thread-header__report-panel${
                menuOpen ? ' message-thread-header__report-panel--open' : ''
              }`}
              role="menu"
            >
              <div className="message-thread-header__menu-item" role="menuitem">
                <ReportTrigger
                  {...reportProps}
                  className="report-trigger message-thread-header__report-trigger"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default MessageThreadHeader
