import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import UserAvatar from '../components/UserAvatar'
import { getAdminErrorMessage } from '../lib/admin'
import {
  ADMIN_CONVERSATION_PAGE_SIZE,
  fetchAdminConversations,
  formatAdminConversationParticipantName,
  formatAdminConversationPreview,
  formatAdminConversationTime,
  getAdminListingImageUrl,
} from '../lib/adminConversations'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminMessages.css'

function ParticipantChip({ participant, role }) {
  const name = formatAdminConversationParticipantName(participant)
  return (
    <span className="admin-messages__person">
      <UserAvatar
        profile={{
          avatar_url: participant?.avatarUrl,
          display_name: name,
          username: participant?.username,
        }}
        size="sm"
      />
      <span>
        <span className="admin-messages__role">{role}</span>
        <span className="admin-messages__name">{name}</span>
      </span>
    </span>
  )
}

function AdminMessagesPage() {
  usePageTitle('Admin messages')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(queryInput.trim())
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [queryInput])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      const { data, error: fetchError } = await fetchAdminConversations({
        query,
        limit: ADMIN_CONVERSATION_PAGE_SIZE,
        offset: 0,
      })
      if (!active) return
      if (fetchError) {
        setError(getAdminErrorMessage(fetchError))
        setItems([])
        setTotal(0)
      } else {
        setItems(data.items)
        setTotal(data.total)
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [query])

  async function loadMore() {
    setLoadingMore(true)
    const { data, error: fetchError } = await fetchAdminConversations({
      query,
      limit: ADMIN_CONVERSATION_PAGE_SIZE,
      offset: items.length,
    })
    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
    } else {
      setItems((current) => [...current, ...data.items])
      setTotal(data.total)
    }
    setLoadingMore(false)
  }

  const hasMore = items.length < total
  const resultLabel = useMemo(() => {
    if (loading) return 'Loading conversations…'
    if (total === 1) return '1 conversation'
    return `${total} conversations`
  }, [loading, total])

  return (
    <section className="admin-intelligence admin-messages">
      <header className="admin-intelligence__header">
        <h1 className="admin-intelligence__title">Messages</h1>
        <p className="admin-intelligence__lead">
          Review marketplace conversations for support, disputes and safety.
        </p>
        <p className="admin-messages__notice">
          Conversation access is provided for support, dispute resolution and marketplace safety.
          Admin access should only be used where reasonably necessary.
        </p>
      </header>

      <div className="admin-messages__toolbar">
        <label className="admin-messages__search">
          <span>Search</span>
          <input
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Username, email, listing title or conversation ID"
          />
        </label>
        <p className="admin-messages__count">{resultLabel}</p>
      </div>

      {loading ? <LoadingState compact>Loading conversations…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState compact>No conversations match this search.</EmptyState>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="admin-messages__list">
          {items.map((conversation) => {
            const listingTitle = conversation.listing?.title?.trim() || 'Listing no longer available'
            const imageUrl = getAdminListingImageUrl(conversation.listing)
            return (
              <li key={conversation.id}>
                <Link to={`/admin/messages/${conversation.id}`} className="admin-messages__row">
                  <div className="admin-messages__listing-thumb" aria-hidden="true">
                    {imageUrl ? <img src={imageUrl} alt="" /> : null}
                  </div>
                  <div className="admin-messages__row-body">
                    <div className="admin-messages__row-top">
                      <h2 className="admin-messages__listing">{listingTitle}</h2>
                      <time dateTime={conversation.updatedAt}>
                        {formatAdminConversationTime(conversation.updatedAt)}
                      </time>
                    </div>
                    <div className="admin-messages__people">
                      <ParticipantChip participant={conversation.buyer} role="Buyer" />
                      <ParticipantChip participant={conversation.seller} role="Seller" />
                    </div>
                    <p className="admin-messages__preview">
                      {formatAdminConversationPreview(conversation.lastMessage)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}

      {hasMore && !loading ? (
        <div className="admin-messages__more">
          <button type="button" className="admin-messages__more-button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default AdminMessagesPage
