import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import AdminConversationThread from '../components/admin/AdminConversationThread'
import UserAvatar from '../components/UserAvatar'
import { getAdminErrorMessage } from '../lib/admin'
import {
  ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE,
  fetchAdminConversation,
  formatAdminConversationParticipantName,
  getAdminListingImageUrl,
  getAdminListingPublicPath,
} from '../lib/adminConversations'
import { formatPricePence } from '../lib/listings'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminMessages.css'

function ParticipantCard({ role, participant }) {
  const name = formatAdminConversationParticipantName(participant)
  return (
    <div className="admin-messages__card">
      <p className="admin-messages__card-label">{role}</p>
      <div className="admin-messages__card-person">
        <UserAvatar
          profile={{
            avatar_url: participant?.avatarUrl,
            display_name: name,
            username: participant?.username,
          }}
          size="md"
        />
        <div>
          <strong>{name}</strong>
        </div>
      </div>
    </div>
  )
}

function AdminConversationPage() {
  const { conversationId } = useParams()
  usePageTitle('Admin conversation')
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      const { data, error: fetchError } = await fetchAdminConversation(conversationId, {
        limit: ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE,
      })
      if (!active) return
      if (fetchError) {
        setError(getAdminErrorMessage(fetchError))
        setConversation(null)
        setMessages([])
        setHasMore(false)
      } else {
        setConversation(data.conversation)
        setMessages(data.messages)
        setHasMore(data.hasMore)
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [conversationId])

  async function loadOlder() {
    const oldest = messages[0]
    if (!oldest?.createdAt) return
    setLoadingOlder(true)
    const { data, error: fetchError } = await fetchAdminConversation(conversationId, {
      before: oldest.createdAt,
      limit: ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE,
    })
    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
    } else {
      setMessages((current) => [...data.messages, ...current])
      setHasMore(data.hasMore)
    }
    setLoadingOlder(false)
  }

  const listing = conversation?.listing
  const listingPath = getAdminListingPublicPath(listing)
  const listingImage = getAdminListingImageUrl(listing)
  const listingTitle = listing?.title?.trim() || 'Listing no longer available'

  return (
    <section className="admin-intelligence admin-messages">
      <p className="admin-messages__back">
        <Link to="/admin/messages">← All conversations</Link>
      </p>

      {loading ? <LoadingState compact>Loading conversation…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}
      {!loading && !error && !conversation ? (
        <EmptyState compact>This conversation could not be found.</EmptyState>
      ) : null}

      {conversation ? (
        <>
          <header className="admin-intelligence__header">
            <h1 className="admin-intelligence__title">Conversation</h1>
            <p className="admin-messages__notice">
              Read-only inspection. Opening this conversation does not mark messages as read or notify users.
            </p>
          </header>

          <div className="admin-messages__meta-grid">
            <ParticipantCard role="Buyer" participant={conversation.buyer} />
            <ParticipantCard role="Seller" participant={conversation.seller} />
            <div className="admin-messages__card admin-messages__card--listing">
              <p className="admin-messages__card-label">Listing</p>
              <div className="admin-messages__listing-block">
                <div className="admin-messages__listing-thumb" aria-hidden="true">
                  {listingImage ? <img src={listingImage} alt="" /> : null}
                </div>
                <div>
                  {listingPath ? (
                    <Link to={listingPath}>{listingTitle}</Link>
                  ) : (
                    <strong>{listingTitle}</strong>
                  )}
                  {listing?.pricePence != null ? (
                    <p>{formatPricePence(listing.pricePence)}</p>
                  ) : null}
                  {!listingPath ? (
                    <p className="admin-messages__unavailable">Listing no longer available</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {hasMore ? (
            <div className="admin-messages__more">
              <button type="button" className="admin-messages__more-button" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </button>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <EmptyState compact>No messages in this conversation.</EmptyState>
          ) : (
            <AdminConversationThread conversation={conversation} messages={messages} />
          )}
        </>
      ) : null}
    </section>
  )
}

export default AdminConversationPage
