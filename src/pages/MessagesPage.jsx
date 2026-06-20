import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../components/Messages.css'
import { useAuth } from '../hooks/useAuth'
import {
  fetchConversationById,
  fetchConversationMessages,
  fetchMyConversations,
  formatMessageTimestamp,
  getMessageErrorMessage,
  isConversationParticipant,
  sendMessage,
} from '../lib/messages'

function MessagesPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageBody, setMessageBody] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [listError, setListError] = useState('')
  const [threadError, setThreadError] = useState('')
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function loadConversations() {
      setLoadingConversations(true)
      setListError('')

      const { data, error } = await fetchMyConversations(user.id)

      if (!active) return

      if (error) {
        setListError(getMessageErrorMessage(error))
        setConversations([])
        setLoadingConversations(false)
        return
      }

      setConversations(data ?? [])
      setLoadingConversations(false)
    }

    loadConversations()

    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!conversationId || !user?.id) {
      setSelectedConversation(null)
      setMessages([])
      return undefined
    }

    let active = true

    async function loadThread() {
      setLoadingThread(true)
      setThreadError('')
      setSendError('')

      const [conversationResult, messagesResult] = await Promise.all([
        fetchConversationById(conversationId),
        fetchConversationMessages(conversationId),
      ])

      if (!active) return

      if (conversationResult.error) {
        setThreadError(getMessageErrorMessage(conversationResult.error))
        setSelectedConversation(null)
        setMessages([])
        setLoadingThread(false)
        return
      }

      if (!conversationResult.data) {
        setThreadError('Conversation not found.')
        setSelectedConversation(null)
        setMessages([])
        setLoadingThread(false)
        return
      }

      if (!isConversationParticipant(conversationResult.data, user.id)) {
        setThreadError('You do not have access to this conversation.')
        setSelectedConversation(null)
        setMessages([])
        setLoadingThread(false)
        return
      }

      if (messagesResult.error) {
        setThreadError(getMessageErrorMessage(messagesResult.error))
        setSelectedConversation(conversationResult.data)
        setMessages([])
        setLoadingThread(false)
        return
      }

      setSelectedConversation(conversationResult.data)
      setMessages(messagesResult.data ?? [])
      setLoadingThread(false)
    }

    loadThread()

    return () => {
      active = false
    }
  }, [conversationId, user?.id])

  async function handleSendMessage(event) {
    event.preventDefault()

    if (!selectedConversation || !user?.id || !messageBody.trim()) return

    setSending(true)
    setSendError('')

    const { data, error } = await sendMessage({
      conversationId: selectedConversation.id,
      senderId: user.id,
      body: messageBody,
    })

    setSending(false)

    if (error) {
      setSendError(getMessageErrorMessage(error))
      return
    }

    setMessages((current) => [...current, data])
    setMessageBody('')
    setConversations((current) =>
      [...current]
        .map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, updated_at: data.created_at }
            : conversation,
        )
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    )
  }

  function getConversationLabel(conversation) {
    const role = conversation.buyer_id === user?.id ? 'Seller conversation' : 'Buyer enquiry'
    return `${role} · ${conversation.listing?.title ?? 'Listing'}`
  }

  return (
    <section className="messages-page">
      <header className="messages-page__header">
        <h2 className="messages-page__title">Messages</h2>
        <p className="messages-page__lead">Chat with buyers and sellers about listings.</p>
      </header>

      <div className="messages-page__layout">
        <aside className="messages-page__panel">
          <h3 className="messages-page__panel-title">Conversations</h3>

          {loadingConversations ? (
            <p className="messages-page__message messages-page__message--empty">Loading…</p>
          ) : null}

          {!loadingConversations && listError ? (
            <p className="messages-page__message messages-page__message--error" role="alert">
              {listError}
            </p>
          ) : null}

          {!loadingConversations && !listError && conversations.length === 0 ? (
            <p className="messages-page__message messages-page__message--empty">
              No conversations yet. Message a seller from a listing page to start.
            </p>
          ) : null}

          {!loadingConversations && !listError && conversations.length > 0 ? (
            <ul className="messages-page__conversation-list">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="messages-page__conversation-item">
                  <Link
                    to={`/messages/${conversation.id}`}
                    className={`messages-page__conversation-link${
                      conversationId === conversation.id ? ' messages-page__conversation-link--active' : ''
                    }`}
                  >
                    <p className="messages-page__conversation-title">
                      {conversation.listing?.title ?? 'Listing'}
                    </p>
                    <p className="messages-page__conversation-meta">
                      {getConversationLabel(conversation)}
                      <br />
                      Updated {formatMessageTimestamp(conversation.updated_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>

        <section className="messages-page__panel messages-page__thread">
          {!conversationId ? (
            <div className="messages-page__thread-body">
              <p className="messages-page__empty-thread">Select a conversation to view messages.</p>
            </div>
          ) : null}

          {conversationId && loadingThread ? (
            <div className="messages-page__thread-body">
              <p className="messages-page__empty-thread">Loading conversation…</p>
            </div>
          ) : null}

          {conversationId && !loadingThread && threadError ? (
            <div className="messages-page__thread-body">
              <p className="messages-page__message messages-page__message--error" role="alert">
                {threadError}
              </p>
            </div>
          ) : null}

          {conversationId && !loadingThread && selectedConversation && !threadError ? (
            <>
              <div className="messages-page__thread-header">
                <h3 className="messages-page__thread-title">
                  {selectedConversation.listing?.title ?? 'Listing'}
                </h3>
                <p className="messages-page__thread-meta">
                  {selectedConversation.listing?.slug ? (
                    <>
                      <Link to={`/listings/${selectedConversation.listing.slug}`}>View listing</Link>
                      {' · '}
                    </>
                  ) : null}
                  You are messaging as {selectedConversation.buyer_id === user?.id ? 'buyer' : 'seller'}
                </p>
              </div>

              <div className="messages-page__thread-body">
                {messages.length === 0 ? (
                  <p className="messages-page__empty-thread">No messages yet. Send the first one below.</p>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === user?.id

                    return (
                      <div
                        key={message.id}
                        className={`messages-page__bubble${isMine ? ' messages-page__bubble--mine' : ''}`}
                      >
                        <p className="messages-page__bubble-body">{message.body}</p>
                        <time className="messages-page__bubble-time" dateTime={message.created_at}>
                          {formatMessageTimestamp(message.created_at)}
                        </time>
                      </div>
                    )
                  })
                )}
              </div>

              <form className="messages-page__composer" onSubmit={handleSendMessage}>
                <label className="messages-page__panel-title" htmlFor="message-body">
                  Write a message
                </label>
                <textarea
                  id="message-body"
                  className="messages-page__textarea"
                  value={messageBody}
                  onChange={(event) => {
                    setMessageBody(event.target.value)
                    setSendError('')
                  }}
                  placeholder="Ask about condition, collection, or availability"
                />

                {sendError ? (
                  <p className="messages-page__message messages-page__message--error" role="alert">
                    {sendError}
                  </p>
                ) : null}

                <button type="submit" className="messages-page__send" disabled={sending || !messageBody.trim()}>
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}

export default MessagesPage
