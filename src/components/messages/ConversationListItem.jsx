import { Link } from 'react-router-dom'
import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import ProfileAvatarLink from './ProfileAvatarLink'
import UserAvatar from '../UserAvatar'
import {
  formatConversationListTime,
  getConversationListingImageUrl,
  getConversationMessagePreview,
  getConversationOtherPartyAvatarProfile,
  getConversationParticipantLine,
  getConversationUnreadCount,
} from '../../lib/messages'
import './ConversationListItem.css'

function ConversationListItem({ conversation, userId, isActive = false }) {
  const unreadCount = getConversationUnreadCount(conversation)
  const isUnread = unreadCount > 0
  const listingTitle = conversation.listing?.title?.trim() || 'Listing'
  const imageUrl = getConversationListingImageUrl(conversation)
  const participantLine = getConversationParticipantLine(conversation, userId)
  const participantProfile = getConversationOtherPartyAvatarProfile(conversation, userId)
  const preview = getConversationMessagePreview(conversation.last_message)
  const updatedAt = conversation.last_message?.created_at ?? conversation.updated_at
  const timeLabel = formatConversationListTime(updatedAt)

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
          aria-label={`Open conversation about ${listingTitle}`}
        />

        <div className="conversation-card__thumb" aria-hidden="true">
          {imageUrl ? (
            <img className="conversation-card__thumb-image" src={imageUrl} alt="" loading="lazy" />
          ) : (
            <EquipdTypeIcon
              variant={EQUIPD_ICON_VARIANT.MESSAGES}
              className="conversation-card__thumb-icon"
            />
          )}
        </div>

        <div className="conversation-card__content">
          <div className="conversation-card__header">
            <h4 className="conversation-card__title">{listingTitle}</h4>
            {timeLabel ? (
              <time className="conversation-card__time" dateTime={updatedAt}>
                {timeLabel}
              </time>
            ) : null}
          </div>

          {participantLine ? (
            <p className="conversation-card__participant">
              {participantProfile ? (
                participantProfile.id ? (
                  <ProfileAvatarLink
                    profile={participantProfile}
                    size="sm"
                    className="conversation-card__participant-avatar"
                  />
                ) : (
                  <UserAvatar
                    profile={participantProfile}
                    size="sm"
                    className="conversation-card__participant-avatar"
                  />
                )
              ) : null}
              <span>{participantLine}</span>
            </p>
          ) : null}

          {preview ? (
            <p className="conversation-card__preview">{preview}</p>
          ) : (
            <p className="conversation-card__preview conversation-card__preview--empty">
              No messages yet
            </p>
          )}
        </div>

        <div className="conversation-card__aside" aria-hidden={!isUnread}>
          {isUnread ? (
            unreadCount > 1 ? (
              <span className="conversation-card__badge">{unreadCount}</span>
            ) : (
              <span className="conversation-card__unread-dot" />
            )
          ) : null}
        </div>
      </div>
    </li>
  )
}

export default ConversationListItem
