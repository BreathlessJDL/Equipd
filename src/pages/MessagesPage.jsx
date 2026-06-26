import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../components/Messages.css'
import '../components/messages/MessageOfferCard.css'
import ConversationListItem from '../components/messages/ConversationListItem'
import MessageOfferCard from '../components/messages/MessageOfferCard'
import MessageAttachmentLightbox from '../components/messages/MessageAttachmentLightbox'
import MessageBubbleRow from '../components/messages/MessageBubbleRow'
import MessageThreadComposer from '../components/messages/MessageThreadComposer'
import MakeOfferModal from '../components/listing/MakeOfferModal'
import MessageThreadListingSummary from '../components/messages/MessageThreadListingSummary'
import MessageThreadSafetyBanner from '../components/messages/MessageThreadSafetyBanner'
import MessageThreadHeader from '../components/messages/MessageThreadHeader'
import ReportTrigger from '../components/ReportTrigger'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { notifyUnreadMessagesChanged } from '../hooks/useUnreadMessageCount'
import { useAuth } from '../hooks/useAuth'
import {
  cleanupMessageAttachmentStorage,
  getMessageAttachmentErrorMessage,
  uploadMessageAttachmentImages,
  sendMessageWithAttachments,
} from '../lib/messageAttachments'
import {
  MARKETPLACE_MESSAGE_BLOCK_MESSAGE,
  validateMarketplaceMessageWithContext,
} from '../lib/marketplaceMessageValidation'
import {
  ensureConversationForListing,
  fetchConversationById,
  fetchConversationMessages,
  fetchDraftConversationContext,
  fetchMyConversations,
  getConversationOtherPartyAvatarProfile,
  getMessageErrorMessage,
  isConversationParticipant,
  isOfferMessage,
  isSystemMessage,
  markConversationRead,
  normalizeConversationDetail,
  sendMessage,
  withConversationReadCleared,
} from '../lib/messages'
import { canReportConversation, REPORT_TYPES } from '../lib/reports'
import { fetchOffersForListing, hasPendingOffer } from '../lib/offers'

const THREAD_NEAR_BOTTOM_THRESHOLD_PX = 80

function revokePendingImagePreviews(images = []) {
  for (const image of images) {
    if (image?.previewUrl) {
      URL.revokeObjectURL(image.previewUrl)
    }
  }
}

function buildConversationLastMessage(message, senderId) {
  return {
    body: message.body,
    message_type: message.message_type ?? 'text',
    sender_id: senderId,
    created_at: message.created_at,
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
    })),
  }
}

function shouldGroupMessageWithPrevious(previousMessage, message) {
  if (!previousMessage || !message) return false
  if (isSystemMessage(previousMessage) || isSystemMessage(message)) return false
  if (isOfferMessage(previousMessage) || isOfferMessage(message)) return false
  return previousMessage.sender_id === message.sender_id
}

function MessagesPage() {
  const { conversationId, draftListingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isThreadOpen = Boolean(conversationId || draftListingId)
  const threadRouteKey = conversationId ?? draftListingId ?? ''
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageBody, setMessageBody] = useState('')
  const [pendingImages, setPendingImages] = useState([])
  const [selectionError, setSelectionError] = useState('')
  const [attachmentLightbox, setAttachmentLightbox] = useState(null)
  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [listingOffers, setListingOffers] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [listError, setListError] = useState('')
  const [threadError, setThreadError] = useState('')
  const [sendError, setSendError] = useState('')
  const threadBodyRef = useRef(null)
  const messagesEndRef = useRef(null)
  const isNearBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)

  const scrollThreadToBottom = useCallback((behavior = 'auto') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior })
    })
  }, [])

  const updateNearBottomState = useCallback(() => {
    const container = threadBodyRef.current

    if (!container) {
      isNearBottomRef.current = true
      return
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight

    isNearBottomRef.current = distanceFromBottom <= THREAD_NEAR_BOTTOM_THRESHOLD_PX
  }, [])

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

  async function reloadThread(activeConversationId = conversationId) {
    if (!activeConversationId || !user?.id) return

    const conversationResult = await fetchConversationById(activeConversationId)

    if (conversationResult.error || !conversationResult.data) {
      setThreadError(getMessageErrorMessage(conversationResult.error ?? new Error('Conversation not found.')))
      return
    }

    if (!isConversationParticipant(conversationResult.data, user.id)) {
      setThreadError('You do not have access to this conversation.')
      return
    }

    const messagesResult = await fetchConversationMessages(activeConversationId, {
      conversation: conversationResult.data,
    })

    if (messagesResult.error) {
      setThreadError(getMessageErrorMessage(messagesResult.error))
      setSelectedConversation(conversationResult.data)
      setMessages([])
      return
    }

    setSelectedConversation(conversationResult.data)
    setMessages(messagesResult.data ?? [])
    setConversations((current) =>
      [...current]
        .map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, updated_at: conversationResult.data.updated_at }
            : conversation,
        )
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    )
  }

  useEffect(() => {
    initialScrollDoneRef.current = false
    isNearBottomRef.current = true
    setPendingImages((current) => {
      revokePendingImagePreviews(current)
      return []
    })
    setSelectionError('')
    setAttachmentLightbox(null)
    setOfferModalOpen(false)
  }, [threadRouteKey])

  useLayoutEffect(() => {
    if (loadingThread || threadError || !selectedConversation) return

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true
      scrollThreadToBottom('auto')
      return
    }

    if (isNearBottomRef.current) {
      scrollThreadToBottom('smooth')
    }
  }, [
    loadingThread,
    threadError,
    selectedConversation,
    messages,
    scrollThreadToBottom,
  ])

  useEffect(() => {
    if (!conversationId || !user?.id) {
      if (!draftListingId) {
        setSelectedConversation(null)
        setMessages([])
      }
      return undefined
    }

    let active = true

    async function loadThread() {
      setLoadingThread(true)
      setThreadError('')
      setSendError('')

      const conversationResult = await fetchConversationById(conversationId)

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

      const messagesResult = await fetchConversationMessages(conversationId, {
        conversation: conversationResult.data,
      })

      if (!active) return

      if (messagesResult.error) {
        setThreadError(getMessageErrorMessage(messagesResult.error))
        setSelectedConversation(conversationResult.data)
        setMessages([])
        setLoadingThread(false)
        return
      }

      const { data: readState, error: readError } = await markConversationRead(conversationId)

      if (!active) return

      const readAt = readState?.last_read_at ?? new Date().toISOString()
      const conversationWithReadState = readError
        ? conversationResult.data
        : withConversationReadCleared(conversationResult.data, readAt)

      setSelectedConversation(conversationWithReadState)
      setMessages(messagesResult.data ?? [])
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? withConversationReadCleared(conversation, readAt)
            : conversation,
        ),
      )
      setLoadingThread(false)

      if (!readError) {
        notifyUnreadMessagesChanged()
      }
    }

    loadThread()

    return () => {
      active = false
    }
  }, [conversationId, draftListingId, user?.id])

  useEffect(() => {
    if (!draftListingId || !user?.id) {
      return undefined
    }

    let active = true

    async function loadDraftThread() {
      setLoadingThread(true)
      setThreadError('')
      setSendError('')

      const { data, error } = await fetchDraftConversationContext({
        listingId: draftListingId,
        buyerId: user.id,
      })

      if (!active) return

      if (error || !data) {
        setThreadError(getMessageErrorMessage(error ?? new Error('Listing not found.')))
        setSelectedConversation(null)
        setMessages([])
        setLoadingThread(false)
        return
      }

      if (!isConversationParticipant(data, user.id)) {
        setThreadError('You do not have access to this conversation.')
        setSelectedConversation(null)
        setMessages([])
        setLoadingThread(false)
        return
      }

      setSelectedConversation(data)
      setMessages([])
      setLoadingThread(false)
    }

    loadDraftThread()

    return () => {
      active = false
    }
  }, [draftListingId, user?.id])

  useEffect(() => {
    const listingId = selectedConversation?.listing?.id

    if (!listingId || !user?.id) {
      setListingOffers([])
      return undefined
    }

    let active = true

    async function loadListingOffers() {
      const { data, error } = await fetchOffersForListing(listingId)

      if (!active) return

      if (error) {
        setListingOffers([])
        return
      }

      setListingOffers(data ?? [])
    }

    loadListingOffers()

    return () => {
      active = false
    }
  }, [selectedConversation?.listing?.id, user?.id])

  async function handleOfferSubmitted(submitData) {
    setOfferModalOpen(false)

    const activeConversationId = submitData?.conversation?.id ?? selectedConversation?.id

    if (activeConversationId && draftListingId) {
      const { data: refreshedConversations } = await fetchMyConversations(user.id)
      if (refreshedConversations) {
        setConversations(refreshedConversations)
      }
      navigate(`/messages/${activeConversationId}`, { replace: true })
      return
    }

    await reloadThread(activeConversationId)
    if (selectedConversation?.listing?.id) {
      const { data } = await fetchOffersForListing(selectedConversation.listing.id)
      setListingOffers(data ?? [])
    }
  }

  const buyerHasPendingOffer = hasPendingOffer(listingOffers, user?.id)
  const otherPartyProfile = useMemo(
    () => getConversationOtherPartyAvatarProfile(selectedConversation, user?.id),
    [selectedConversation, user?.id],
  )
  const offerListing =
    selectedConversation?.listing && selectedConversation?.seller_id
      ? {
          ...selectedConversation.listing,
          seller_id: selectedConversation.seller_id,
        }
      : null

  const safetyBannerKey =
    selectedConversation?.id ?? (draftListingId ? `draft:${draftListingId}` : null)

  async function ensureActiveConversation() {
    if (selectedConversation?.id) {
      return {
        conversation: selectedConversation,
        conversationId: selectedConversation.id,
        error: null,
      }
    }

    if (!selectedConversation?.listing_id || !user?.id) {
      return {
        conversation: null,
        conversationId: null,
        error: new Error('Conversation not ready.'),
      }
    }

    const { data, error } = await ensureConversationForListing({
      listingId: selectedConversation.listing_id,
      buyerId: selectedConversation.buyer_id,
      sellerId: selectedConversation.seller_id,
    })

    if (error || !data) {
      return { conversation: null, conversationId: null, error }
    }

    const normalized = normalizeConversationDetail(data)
    setSelectedConversation(normalized)

    return {
      conversation: normalized,
      conversationId: data.id,
      error: null,
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    if (!selectedConversation || !user?.id || sending) return

    const trimmedBody = messageBody.trim()
    const imageFiles = pendingImages.map((image) => image.file)
    const hasImages = imageFiles.length > 0

    if (!trimmedBody && !hasImages) return

    const {
      conversation: activeConversation,
      conversationId: activeConversationId,
      error: ensureError,
    } = await ensureActiveConversation()

    if (ensureError || !activeConversationId) {
      setSendError(getMessageErrorMessage(ensureError ?? new Error('Conversation not ready.')))
      return
    }

    if (!hasImages) {
      const validation = validateMarketplaceMessageWithContext(messageBody, messages, {
        senderId: user.id,
      })

      if (!validation.allowed) {
        setSendError(validation.error ?? MARKETPLACE_MESSAGE_BLOCK_MESSAGE)
        return
      }

      setSending(true)
      setSendError('')

      const { data, error } = await sendMessage({
        conversationId: activeConversationId,
        senderId: user.id,
        body: messageBody,
      })

      setSending(false)

      if (error) {
        setSendError(getMessageErrorMessage(error))
        return
      }

      applySentMessage(data, activeConversation, activeConversationId)
      return
    }

    if (trimmedBody) {
      const validation = validateMarketplaceMessageWithContext(messageBody, messages, {
        senderId: user.id,
      })

      if (!validation.allowed) {
        setSendError(validation.error ?? MARKETPLACE_MESSAGE_BLOCK_MESSAGE)
        return
      }
    }

    setSending(true)
    setSendError('')
    setSelectionError('')

    const recentTextMessages = messages.filter(
      (message) => message.message_type === 'text' || !message.message_type,
    )

    const { data: uploadedAttachments, error: uploadError } =
      await uploadMessageAttachmentImages({
        conversationId: activeConversationId,
        userId: user.id,
        files: imageFiles,
      })

    if (uploadError) {
      setSending(false)
      setSendError(getMessageAttachmentErrorMessage(uploadError))
      return
    }

    const { data, error } = await sendMessageWithAttachments({
      conversationId: activeConversationId,
      senderId: user.id,
      body: messageBody,
      attachments: uploadedAttachments,
      recentMessages: recentTextMessages,
    })

    if (error) {
      await cleanupMessageAttachmentStorage(
        uploadedAttachments.map((attachment) => attachment.storage_path),
      )
      setSending(false)
      setSendError(getMessageAttachmentErrorMessage(error))
      return
    }

    revokePendingImagePreviews(pendingImages)
    setPendingImages([])
    setSending(false)
    applySentMessage(data, activeConversation, activeConversationId)
  }

  function applySentMessage(data, activeConversation, activeConversationId) {
    isNearBottomRef.current = true
    setMessages((current) => [...current, data])
    setMessageBody('')
    setConversations((current) => {
      const nextConversation = withConversationReadCleared(
        {
          ...activeConversation,
          id: activeConversationId,
          updated_at: data.created_at,
          last_message: buildConversationLastMessage(data, user.id),
        },
        data.created_at,
      )
      const existingIndex = current.findIndex(
        (conversation) => conversation.id === activeConversationId,
      )

      if (existingIndex >= 0) {
        return [...current]
          .map((conversation) =>
            conversation.id === activeConversationId ? nextConversation : conversation,
          )
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      }

      return [nextConversation, ...current].sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
      )
    })
    notifyUnreadMessagesChanged()

    if (draftListingId) {
      navigate(`/messages/${activeConversationId}`, { replace: true })
    }
  }

  function handlePendingImagesChange(nextImages, nextSelectionError = '') {
    setPendingImages(nextImages)
    setSelectionError(nextSelectionError)
    if (nextSelectionError) {
      setSendError('')
    }
  }

  function handleMessageBodyChange(nextBody) {
    setMessageBody(nextBody)
    setSendError('')
  }

  function renderConversationList() {
    if (loadingConversations) {
      return <LoadingState compact>Loading conversations…</LoadingState>
    }

    if (listError) {
      return <ErrorState compact>{listError}</ErrorState>
    }

    if (conversations.length === 0) {
      return (
        <EmptyState compact>
          No conversations yet. Message a seller from a listing page to start.
        </EmptyState>
      )
    }

    return (
      <ul className="messages-page__conversation-list">
        {conversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            userId={user?.id}
            isActive={conversationId === conversation.id}
          />
        ))}
      </ul>
    )
  }

  function renderMessage(message, index) {
    if (isSystemMessage(message)) {
      return (
        <div key={message.id} className="messages-page__system-message" role="status">
          {message.body}
        </div>
      )
    }

    if (isOfferMessage(message)) {
      return (
        <MessageOfferCard
          key={message.id}
          message={message}
          conversation={selectedConversation}
          user={user}
          onOfferUpdated={() => reloadThread(selectedConversation.id)}
        />
      )
    }

    const isMine = message.sender_id === user?.id
    const previousMessage = messages[index - 1]
    const showAvatar =
      !isMine && !shouldGroupMessageWithPrevious(previousMessage, message)

    return (
      <MessageBubbleRow
        key={message.id}
        message={message}
        isMine={isMine}
        showAvatar={showAvatar}
        otherPartyProfile={otherPartyProfile}
        onOpenAttachment={setAttachmentLightbox}
      />
    )
  }

  return (
    <section
      className={`messages-page${
        isThreadOpen ? ' messages-page--thread-open' : ' messages-page--list-only'
      }`}
    >
      <header className="messages-page__header">
        <h2 className="messages-page__title">Messages</h2>
        <p className="messages-page__lead">Your conversations about listings.</p>
      </header>

      <div
        className={`messages-page__layout${
          isThreadOpen ? ' messages-page__layout--thread-open' : ''
        }`}
      >
        <aside className="messages-page__panel messages-page__sidebar">
          <h3 className="messages-page__panel-title">Conversations</h3>
          {renderConversationList()}
        </aside>

        <section className="messages-page__panel messages-page__thread">
          {!isThreadOpen ? (
            <div className="messages-page__thread-body">
              <EmptyState compact>Select a conversation to view messages.</EmptyState>
            </div>
          ) : null}

          {isThreadOpen && loadingThread ? (
            <div className="messages-page__thread-body">
              <LoadingState compact>Loading conversation…</LoadingState>
            </div>
          ) : null}

          {isThreadOpen && !loadingThread && threadError ? (
            <div className="messages-page__thread-body">
              <ErrorState compact>{threadError}</ErrorState>
            </div>
          ) : null}

          {isThreadOpen && !loadingThread && selectedConversation && !threadError ? (
            <>
              <MessageThreadHeader
                conversation={selectedConversation}
                userId={user?.id}
                onBack={() => navigate('/messages')}
                report={
                  selectedConversation.id && canReportConversation(selectedConversation, user?.id) ? (
                    <ReportTrigger
                      reportType={REPORT_TYPES.CONVERSATION}
                      conversationId={selectedConversation.id}
                      label="Report conversation"
                      className="report-trigger"
                    />
                  ) : null
                }
              />

              <MessageThreadListingSummary
                conversation={selectedConversation}
                userId={user?.id}
                buyerHasPendingOffer={buyerHasPendingOffer}
                onMakeOffer={() => setOfferModalOpen(true)}
              />

              <div
                className="messages-page__thread-body"
                ref={threadBodyRef}
                onScroll={updateNearBottomState}
              >
                {messages.length === 0 ? (
                  <EmptyState compact>No messages yet. Send the first one below.</EmptyState>
                ) : (
                  <>
                    {messages.map((message, index) => renderMessage(message, index))}
                    <div ref={messagesEndRef} className="messages-page__thread-end" aria-hidden="true" />
                  </>
                )}
              </div>

              <MessageThreadSafetyBanner conversationId={safetyBannerKey} />

              <MessageThreadComposer
                messageBody={messageBody}
                onMessageBodyChange={handleMessageBodyChange}
                pendingImages={pendingImages}
                onPendingImagesChange={handlePendingImagesChange}
                onSubmit={handleSendMessage}
                sending={sending}
                sendError={sendError}
                selectionError={selectionError}
              />

              <MakeOfferModal
                open={offerModalOpen}
                listing={offerListing}
                user={user}
                buyerHasPendingOffer={buyerHasPendingOffer}
                onClose={() => setOfferModalOpen(false)}
                onSubmitted={handleOfferSubmitted}
              />

              <MessageAttachmentLightbox
                images={attachmentLightbox?.images ?? []}
                activeIndex={attachmentLightbox?.activeIndex ?? 0}
                onClose={() => setAttachmentLightbox(null)}
              />
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}

export default MessagesPage
