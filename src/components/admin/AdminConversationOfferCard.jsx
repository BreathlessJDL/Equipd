import { formatPricePence } from '../../lib/listings'
import { formatAdminConversationTime } from '../../lib/adminConversations'
import './AdminConversationOfferCard.css'

function AdminConversationOfferCard({ message }) {
  const offer = message?.offer
  if (!offer) {
    return (
      <article className="admin-conversation-offer">
        <p className="admin-conversation-offer__title">Offer update</p>
        {message?.body ? <p className="admin-conversation-offer__body">{message.body}</p> : null}
      </article>
    )
  }

  const quantity = offer.quantity ?? 1

  return (
    <article className="admin-conversation-offer">
      <p className="admin-conversation-offer__kicker">Offer · {offer.status || 'unknown'}</p>
      <p className="admin-conversation-offer__amount">{formatPricePence(offer.amountPence)}</p>
      {quantity > 1 ? (
        <p className="admin-conversation-offer__meta">
          {quantity} items
        </p>
      ) : null}
      {message?.body ? <p className="admin-conversation-offer__body">{message.body}</p> : null}
      <time className="admin-conversation-offer__time" dateTime={message.createdAt}>
        {formatAdminConversationTime(message.createdAt)}
      </time>
    </article>
  )
}

export default AdminConversationOfferCard
