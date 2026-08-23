import MessageAttachmentLightbox from '../messages/MessageAttachmentLightbox'
import MessageBubbleRow from '../messages/MessageBubbleRow'
import UserAvatar from '../UserAvatar'
import AdminConversationOfferCard from './AdminConversationOfferCard'
import { formatAdminConversationParticipantName, formatAdminConversationTime } from '../../lib/adminConversations'
import { useState } from 'react'
import './AdminConversationThread.css'

function sameSender(left, right) {
  return Boolean(left?.senderId) && left.senderId === right?.senderId
}

function AdminConversationThread({ conversation, messages }) {
  const [lightbox, setLightbox] = useState(null)
  const buyerId = conversation?.buyer?.id
  const sellerId = conversation?.seller?.id

  return (
    <>
      <div className="admin-conversation-thread">
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const isSystem = message.messageType === 'system'
          const isOffer = message.messageType === 'offer'
          const isSeller = message.senderId && message.senderId === sellerId
          const isBuyer = message.senderId && message.senderId === buyerId
          const participant = isSeller ? conversation.seller : isBuyer ? conversation.buyer : null
          const showAvatar = !isSystem && !sameSender(previous, message)

          if (isSystem) {
            return (
              <p key={message.id} className="admin-conversation-thread__system">
                {message.body || 'System update'}
                <time dateTime={message.createdAt}>{formatAdminConversationTime(message.createdAt)}</time>
              </p>
            )
          }

          if (isOffer) {
            return (
              <div
                key={message.id}
                className={`admin-conversation-thread__offer${isSeller ? ' admin-conversation-thread__offer--seller' : ''}`}
              >
                <span className="admin-conversation-thread__role">
                  {isSeller ? 'Seller' : isBuyer ? 'Buyer' : 'Participant'}
                  {' · '}
                  {formatAdminConversationParticipantName(participant)}
                </span>
                <AdminConversationOfferCard message={message} />
              </div>
            )
          }

          const bubbleMessage = {
            ...message,
            created_at: message.createdAt,
            sender_id: message.senderId,
          }

          return (
            <div key={message.id} className="admin-conversation-thread__row-wrap">
              {showAvatar ? (
                <div className={`admin-conversation-thread__meta${isSeller ? ' admin-conversation-thread__meta--seller' : ''}`}>
                  <UserAvatar profile={{ avatar_url: participant?.avatarUrl, display_name: formatAdminConversationParticipantName(participant) }} size="sm" />
                  <span>
                    {isSeller ? 'Seller' : isBuyer ? 'Buyer' : 'Participant'}
                    {' · '}
                    {formatAdminConversationParticipantName(participant)}
                  </span>
                </div>
              ) : null}
              <MessageBubbleRow
                message={bubbleMessage}
                isMine={isSeller}
                showAvatar={false}
                onOpenAttachment={setLightbox}
              />
            </div>
          )
        })}
      </div>
      {lightbox ? (
        <MessageAttachmentLightbox
          images={lightbox.images}
          activeIndex={lightbox.activeIndex}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  )
}

export default AdminConversationThread
