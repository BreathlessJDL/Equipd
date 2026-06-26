import { useLayoutEffect, useRef } from 'react'
import { ErrorState } from '../ui/UiState'
import {
  MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE,
  validateMessageAttachmentFile,
} from '../../lib/messageAttachments'
import './MessageThreadComposer.css'

const TEXTAREA_MIN_HEIGHT_PX = 44
const TEXTAREA_MAX_HEIGHT_PX = 140

function resizeComposerTextarea(textarea) {
  if (!textarea) return

  textarea.style.height = 'auto'
  const scrollHeight = textarea.scrollHeight
  const nextHeight = Math.max(
    TEXTAREA_MIN_HEIGHT_PX,
    Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT_PX),
  )
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT_PX ? 'auto' : 'hidden'
}

function ImageAddIcon() {
  return (
    <svg
      className="message-thread-composer__image-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 16H5V5h14v14Zm-5.5-4.5 2.5 3.01L17.5 14l3 4H5l4.5-6 2.5 3.01Z"
      />
    </svg>
  )
}

function MessageThreadComposer({
  messageBody,
  onMessageBodyChange,
  pendingImages = [],
  onPendingImagesChange,
  onSubmit,
  sending = false,
  sendError = '',
  selectionError = '',
}) {
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const canAddImages = pendingImages.length < MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE
  const canSend = Boolean(messageBody.trim() || pendingImages.length > 0)

  useLayoutEffect(() => {
    resizeComposerTextarea(textareaRef.current)
  }, [messageBody])

  function handleTextareaChange(event) {
    onMessageBodyChange(event.target.value)
  }

  function handleFileChange(event) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (!selectedFiles.length) return

    const nextImages = [...pendingImages]
    const errors = []

    for (const file of selectedFiles) {
      if (nextImages.length >= MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE) {
        errors.push(`You can attach up to ${MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE} images per message.`)
        break
      }

      const validationError = validateMessageAttachmentFile(file)

      if (validationError) {
        errors.push(validationError)
        continue
      }

      nextImages.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    onPendingImagesChange(nextImages, errors.join(' '))
  }

  function handleRemoveImage(imageId) {
    const target = pendingImages.find((image) => image.id === imageId)

    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl)
    }

    onPendingImagesChange(
      pendingImages.filter((image) => image.id !== imageId),
      '',
    )
  }

  return (
    <form className="message-thread-composer messages-page__composer" onSubmit={onSubmit}>
      {pendingImages.length > 0 ? (
        <div className="message-thread-composer__previews" aria-label="Selected images">
          {pendingImages.map((image, index) => (
            <div key={image.id} className="message-thread-composer__preview">
              <span className="message-thread-composer__preview-order" aria-hidden="true">
                {index + 1}
              </span>
              <img
                className="message-thread-composer__preview-image"
                src={image.previewUrl}
                alt=""
              />
              <button
                type="button"
                className="message-thread-composer__preview-remove"
                onClick={() => handleRemoveImage(image.id)}
                disabled={sending}
                aria-label={`Remove image ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="messages-page__composer-row message-thread-composer__controls">
        <input
          ref={fileInputRef}
          type="file"
          className="message-thread-composer__file-input"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          tabIndex={-1}
          aria-hidden="true"
        />

        <button
          type="button"
          className="message-thread-composer__image-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || !canAddImages}
          aria-label={
            canAddImages
              ? 'Add images'
              : `Maximum ${MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE} images selected`
          }
        >
          <ImageAddIcon />
        </button>

        <textarea
          ref={textareaRef}
          id="message-body"
          className="messages-page__textarea message-thread-composer__textarea"
          value={messageBody}
          onChange={handleTextareaChange}
          placeholder="Message..."
          rows={1}
          disabled={sending}
          aria-label="Message"
        />

        <button
          type="submit"
          className="messages-page__send message-thread-composer__send"
          disabled={sending || !canSend}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>

      {selectionError ? <ErrorState compact>{selectionError}</ErrorState> : null}
      {sendError ? <ErrorState compact>{sendError}</ErrorState> : null}
    </form>
  )
}

export default MessageThreadComposer
