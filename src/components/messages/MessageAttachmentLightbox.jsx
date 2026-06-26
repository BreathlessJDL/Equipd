import { useEffect } from 'react'
import './MessageAttachmentLightbox.css'

function MessageAttachmentLightbox({ images = [], activeIndex = 0, onClose }) {
  const activeImage = images[activeIndex] ?? null
  const isOpen = Boolean(activeImage?.url)

  useEffect(() => {
    if (!isOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="message-attachment-lightbox" role="presentation">
      <button
        type="button"
        className="message-attachment-lightbox__backdrop"
        aria-label="Close image preview"
        onClick={onClose}
      />

      <div
        className="message-attachment-lightbox__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Message image preview"
      >
        <button
          type="button"
          className="message-attachment-lightbox__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <img
          className="message-attachment-lightbox__image"
          src={activeImage.url}
          alt=""
          loading="eager"
        />
      </div>
    </div>
  )
}

export default MessageAttachmentLightbox
