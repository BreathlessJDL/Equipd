import { Link } from 'react-router-dom'
import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import { OfficialEquipdName } from '../OfficialEquipdBadge'
import {
  formatConversationListTime,
  getConversationListingImageUrl,
  getConversationMessagePreview,
  getConversationOtherPartyAvatarProfile,
  getConversationParticipantLine,
  getConversationUnreadCount,
} from '../../lib/messages'
import ListingPhoto from '../ListingPhoto'
import './ConversationListItem.css'

function ConversationListItem({ conversation, userId, isActive = false }) {
  const unreadCount = getConversationUnreadCount(conversation)
  const isUnread = unreadCount > 0
  const listingTitle = conversation.listing?.title?.trim() || 'Listing'
  const imageUrl = getConversationListingImageUrl(conversation)
  const participantName = getConversationParticipantLine(conversation, userId)
  const participantProfile = getConversationOtherPartyAvatarProfile(conversation, userId)
  const isOfficial = participantProfile?.is_official_equipd === true
  const preview = getConversationMessagePreview(conversation.last_message)
  const updatedAt = conversation.last_message?.created_at ?? conversation.updated_at
  const timeLabel = formatConversationListTime(updatedAt)
  const conversationName = participantName || listingTitle

  return (
    <li className="conversation-list-item">
      <div
        className={`conversation-card${
          isActive ? ' conversation-card--active' : ''
        }${isUnread ? ' conversation-card--unread' : ''}`}
      >
        <Link
          to={`/messages/${conversation.id}`}
          className="conversation-card__overlay-link"
          aria-current={isActive ? 'true' : undefined}
          aria-label={`Open conversation with ${conversationName} about ${listingTitle}`}
        />

        <div className="conversation-card__media" aria-hidden="true">
          <div className="conversation-card__thumb">
            {imageUrl ? (
              <ListingPhoto className="conversation-card__thumb-image" url={imageUrl} alt="" />
            ) : (
              <EquipdTypeIcon
                variant={EQUIPD_ICON_VARIANT.MESSAGES}
                className="conversation-card__thumb-icon"
              />
            )}
          </div>
        </div>

        <div className="conversation-card__content">
          <div className="conversation-card__header">
            <h4 className="conversation-card__title">
              <OfficialEquipdName name={conversationName} isOfficial={isOfficial} />
            </h4>
            {timeLabel ? (
              <time className="conversation-card__time" dateTime={updatedAt}>
                {timeLabel}
              </time>
            ) : null}
          </div>

          <p className="conversation-card__listing">{listingTitle}</p>

          {preview ? (
            <p className="conversation-card__preview">{preview}</p>
          ) : (
            <p className="conversation-card__preview conversation-card__preview--empty">
              No messages yet
            </p>
          )}
        </div>

        {isUnread ? (
          unreadCount > 1 ? (
            <span className="conversation-card__badge">{unreadCount}</span>
          ) : (
            <span className="conversation-card__unread-dot" aria-hidden="true" />
          )
        ) : null}
      </div>
    </li>
  )
}

export default ConversationListItem
