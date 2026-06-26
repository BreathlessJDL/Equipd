import { useEffect } from 'react'
import '../auth/AuthModal.css'
import './LeaveListingDraftModal.css'

function LeaveListingDraftModal({
  open,
  saving = false,
  error = '',
  onSaveDraftAndLeave,
  onLeaveWithoutSaving,
  onStay,
}) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) {
        onStay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onStay, saving])

  if (!open) return null

  return (
    <div className="auth-modal leave-listing-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Stay on page"
        disabled={saving}
        onClick={onStay}
      />

      <div
        className="auth-modal__dialog leave-listing-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-listing-modal-title"
        aria-describedby="leave-listing-modal-body"
      >
        <h2 id="leave-listing-modal-title" className="leave-listing-modal__title">
          Save this listing as a draft?
        </h2>
        <p id="leave-listing-modal-body" className="leave-listing-modal__body">
          You&apos;ve started creating a listing. Would you like to save it as a draft before leaving?
        </p>

        {error ? (
          <p className="leave-listing-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="leave-listing-modal__actions">
          <button
            type="button"
            className="listing-form__button listing-form__button--primary leave-listing-modal__button"
            disabled={saving}
            onClick={onSaveDraftAndLeave}
          >
            {saving ? 'Saving…' : 'Save draft and leave'}
          </button>
          <button
            type="button"
            className="listing-form__button listing-form__button--secondary leave-listing-modal__button"
            disabled={saving}
            onClick={onLeaveWithoutSaving}
          >
            Leave without saving
          </button>
          <button
            type="button"
            className="leave-listing-modal__stay"
            disabled={saving}
            onClick={onStay}
          >
            Stay on page
          </button>
        </div>
      </div>
    </div>
  )
}

export default LeaveListingDraftModal
