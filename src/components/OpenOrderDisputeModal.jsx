import { useState } from 'react'
import './OrderDisputeSection.css'

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
    const files = [...(event.target.files ?? [])]
    setEvidenceFiles(files)
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
          Describe the issue and upload at least one photo. Opening a dispute pauses seller payout
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
            <span className="order-dispute-modal__label">Evidence photos</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={submitting}
              required={evidenceFiles.length === 0}
              onChange={handleFileChange}
            />
            <span className="order-dispute-modal__hint">
              Upload at least one JPEG, PNG, or WebP photo (max 5 MB each).
            </span>
            {evidenceFiles.length > 0 ? (
              <span className="order-dispute-modal__file-count" role="status">
                {evidenceFiles.length} photo{evidenceFiles.length === 1 ? '' : 's'} selected
              </span>
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
