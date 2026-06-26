import ProfileAvatarLink from './ProfileAvatarLink'
import UserAvatar from '../UserAvatar'
import MessageBubble from './MessageBubble'
import './MessageBubbleRow.css'

function MessageBubbleRow({
  message,
  isMine = false,
  showAvatar = false,
  otherPartyProfile = null,
  onOpenAttachment,
}) {
  if (isMine) {
    return (
      <div className="message-bubble-row message-bubble-row--mine">
        <MessageBubble
          message={message}
          isMine
          onOpenAttachment={onOpenAttachment}
        />
      </div>
    )
  }

  return (
    <div
      className={`message-bubble-row message-bubble-row--theirs${
        showAvatar ? '' : ' message-bubble-row--continued'
      }`}
    >
      <div className="message-bubble-row__avatar">
        {showAvatar ? (
          otherPartyProfile?.id ? (
            <ProfileAvatarLink profile={otherPartyProfile} size="sm" />
          ) : (
            <UserAvatar profile={otherPartyProfile} size="sm" />
          )
        ) : null}
      </div>
      <MessageBubble message={message} onOpenAttachment={onOpenAttachment} />
    </div>
  )
}

export default MessageBubbleRow
