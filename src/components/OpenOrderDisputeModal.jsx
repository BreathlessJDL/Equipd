import { useState } from 'react'
import './OrderDisputeSection.css'

const MAX_FILES = 8

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function OpenOrderDisputeModal({
  orderType,
  reasonOptions,
  singleReasonNote,
  submitting,
  error,
  onClose,
  onSubmit,
}) {
  const [reason, setReason] = useState(reasonOptions[0]?.value ?? '')
  const [description, setDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const singleReasonOnly = reasonOptions.length <= 1

  function handleFileChange(event) {
    const selected = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!selected.length) return
    setEvidenceFiles((current) => [...current, ...selected].slice(0, MAX_FILES))
  }

  function removeFile(index) {
    setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (submitting) return

    onSubmit({
      reason,
      description,
      evidenceFiles,
    })
  }

  return (
    <div className="auth-modal order-dispute-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close report problem dialog"
        onClick={onClose}
      />
      <div
        className="auth-modal__dialog order-dispute-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-dispute-modal-title"
      >
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Close"
          disabled={submitting}
          onClick={onClose}
        >
          ×
        </button>

        <h2 id="order-dispute-modal-title" className="order-dispute-modal__title">
          Report a problem
        </h2>
        <p className="order-dispute-modal__lead">
          Describe the issue and upload evidence. Opening a dispute pauses seller payout
          while Equipd reviews your case.
        </p>

        <form className="order-dispute-modal__form" onSubmit={handleSubmit}>
          <label className="order-dispute-modal__field">
            <span className="order-dispute-modal__label">Reason</span>
            <select
              value={reason}
              disabled={submitting || singleReasonOnly}
              onChange={(event) => setReason(event.target.value)}
            >
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {singleReasonOnly && singleReasonNote ? (
              <span className="order-dispute-modal__hint">{singleReasonNote}</span>
            ) : null}
          </label>

          <label className="order-dispute-modal__field">
            <span className="order-dispute-modal__label">Description</span>
            <textarea
              value={description}
              disabled={submitting}
              rows={5}
              required
              placeholder="Explain what went wrong and how the item differs from the listing."
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="order-dispute-modal__field">
            <span className="order-dispute-modal__label">Evidence files</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf"
              multiple
              disabled={submitting || evidenceFiles.length >= MAX_FILES}
              onChange={handleFileChange}
            />
            <span className="order-dispute-modal__hint">
              At least one file required. Up to {MAX_FILES} files. Images, videos, or PDFs. Max 25 MB
              each.
            </span>
            {evidenceFiles.length > 0 ? (
              <ul className="order-dispute-modal__file-list">
                {evidenceFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`}>
                    <span>
                      {file.name} ({formatFileSize(file.size)})
                    </span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => removeFile(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>

          {error ? (
            <p className="order-dispute-modal__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="order-dispute-modal__actions">
            <button
              type="button"
              className="listing-detail__button listing-detail__button--secondary"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="listing-detail__button listing-detail__button--primary"
              disabled={submitting || !description.trim() || evidenceFiles.length === 0}
            >
              {submitting ? 'Submitting…' : 'Submit dispute'}
            </button>
          </div>
        </form>

        {orderType && !singleReasonOnly ? (
          <p className="order-dispute-modal__footnote">
            Available reasons depend on how this order is fulfilled.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default OpenOrderDisputeModal
