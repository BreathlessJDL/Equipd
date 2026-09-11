import ProfileAvatarLink from './ProfileAvatarLink'
import UserAvatar from '../UserAvatar'
import MessageBubble from './MessageBubble'
import ReportTrigger from '../ReportTrigger'
import { canReportMessage, REPORT_TYPES } from '../../lib/reports'
import './MessageBubbleRow.css'

function MessageBubbleRow({
  message,
  isMine = false,
  showAvatar = false,
  otherPartyProfile = null,
  conversation = null,
  currentUserId = null,
  onOpenAttachment,
}) {
  const reportNode =
    !isMine && canReportMessage(message, conversation, currentUserId) ? (
      <ReportTrigger
        reportType={REPORT_TYPES.MESSAGE}
        messageId={message.id}
        conversationId={conversation?.id ?? null}
        reportedUserId={message.sender_id}
        listingId={conversation?.listing_id ?? null}
        label="Report"
        className="report-trigger message-bubble-row__report"
      />
    ) : null

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
      <div className="message-bubble-row__content">
        <MessageBubble message={message} onOpenAttachment={onOpenAttachment} />
        {reportNode}
      </div>
    </div>
  )
}

export default MessageBubbleRow
