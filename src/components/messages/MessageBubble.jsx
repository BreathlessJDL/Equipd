import { useEffect, useMemo, useState } from 'react'
import { formatMessageTimestamp } from '../../lib/messages'
import {
  getMessageAttachmentSignedUrls,
  sortMessageAttachments,
} from '../../lib/messageAttachments'
import './MessageBubble.css'

function MessageBubble({ message, isMine = false, onOpenAttachment }) {
  const attachments = useMemo(
    () => sortMessageAttachments(message?.attachments ?? []),
    [message?.attachments],
  )
  const hasAttachments = attachments.length > 0
  const body = message?.body?.trim() ?? ''
  const [signedUrls, setSignedUrls] = useState({})
  const [loadingUrls, setLoadingUrls] = useState(false)

  useEffect(() => {
    if (!hasAttachments) {
      setSignedUrls({})
      setLoadingUrls(false)
      return undefined
    }

    let active = true
    setLoadingUrls(true)

    async function loadUrls() {
      const paths = attachments.map((attachment) => attachment.storage_path)
      const results = await getMessageAttachmentSignedUrls(paths)

      if (!active) return

      const nextUrls = {}

      for (const attachment of attachments) {
        const result = results[attachment.storage_path]
        if (result?.url) {
          nextUrls[attachment.storage_path] = result.url
        }
      }

      setSignedUrls(nextUrls)
      setLoadingUrls(false)
    }

    loadUrls()

    return () => {
      active = false
    }
  }, [attachments, hasAttachments])

  const gridModifier =
    attachments.length === 1
      ? 'message-bubble__attachments--count-1'
      : attachments.length === 2
        ? 'message-bubble__attachments--count-2'
        : 'message-bubble__attachments--count-many'

  function handleAttachmentClick(index) {
    const items = attachments
      .map((attachment) => ({
        storagePath: attachment.storage_path,
        url: signedUrls[attachment.storage_path] ?? null,
      }))
      .filter((item) => item.url)

    if (!items.length) return

    onOpenAttachment?.({
      images: items,
      activeIndex: Math.min(index, items.length - 1),
    })
  }

  return (
    <div
      className={`message-bubble${isMine ? ' message-bubble--mine' : ''}${
        hasAttachments && !body ? ' message-bubble--attachments-only' : ''
      }`}
    >
      {hasAttachments ? (
        <div className={`message-bubble__attachments ${gridModifier}`}>
          {attachments.map((attachment, index) => {
            const url = signedUrls[attachment.storage_path]

            return (
              <button
                key={attachment.id ?? `${attachment.storage_path}-${index}`}
                type="button"
                className="message-bubble__attachment-button"
                onClick={() => handleAttachmentClick(index)}
                disabled={!url}
                aria-label={`View image ${index + 1} of ${attachments.length}`}
              >
                {url ? (
                  <img
                    className="message-bubble__attachment-image"
                    src={url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="message-bubble__attachment-placeholder">
                    {loadingUrls ? 'Loading…' : 'Unavailable'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : null}

      {body ? <p className="message-bubble__body">{message.body}</p> : null}

      <time className="message-bubble__time" dateTime={message.created_at}>
        {formatMessageTimestamp(message.created_at)}
      </time>
    </div>
  )
}

export default MessageBubble
