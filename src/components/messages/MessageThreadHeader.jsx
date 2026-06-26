import ProfileAvatarLink from './ProfileAvatarLink'
import UserAvatar from '../UserAvatar'
import {
  getConversationOtherPartyAvatarProfile,
  getConversationOtherPartyName,
} from '../../lib/messages'
import './MessageThreadHeader.css'

function MessageThreadHeader({ conversation, userId, onBack, report = null }) {
  const participantName = getConversationOtherPartyName(conversation, userId)
  const participantProfile = getConversationOtherPartyAvatarProfile(conversation, userId)

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

        {participantProfile ? (
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
          <h2 className="message-thread-header__participant">
            {participantName || 'Conversation'}
          </h2>
        </div>

        {report ? <div className="message-thread-header__report">{report}</div> : null}
      </div>
    </header>
  )
}

export default MessageThreadHeader
