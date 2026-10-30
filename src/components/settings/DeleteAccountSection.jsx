import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalCloseIcon } from '../icons/ModalCloseIcon'
import {
  ACCOUNT_DELETION_CONFIRMATION_TEXT,
  evaluateAccountDeletion,
  getAccountDeletionErrorMessage,
  requestAccountDeletion,
} from '../../lib/accountDeletion'
import { PRIVACY_POLICY_PATH } from '../../lib/cookieConsent'
import '../auth/AuthModal.css'
import './DeleteAccountSection.css'

function DeleteAccountSection({
  blockedByImpersonation = false,
  passwordAuthAvailable = true,
  onDeleted,
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmationText, setConfirmationText] = useState('')
  const [loadingEval, setLoadingEval] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [evaluation, setEvaluation] = useState(null)

  useEffect(() => {
    if (!modalOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitting) {
        setModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalOpen, submitting])

  useEffect(() => {
    if (!modalOpen) return undefined

    let active = true

    evaluateAccountDeletion().then(({ data, error: evalError }) => {
      if (!active) return
      setLoadingEval(false)
      if (evalError) {
        setError(getAccountDeletionErrorMessage(evalError))
        return
      }
      setEvaluation(data)
    })

    return () => {
      active = false
    }
  }, [modalOpen])

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setPassword('')
    setConfirmationText('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || !passwordAuthAvailable) return

    setSubmitting(true)
    setError('')

    const { error: deleteError } = await requestAccountDeletion({
      password,
      confirmationText,
      passwordRequired: true,
    })

    setSubmitting(false)

    if (deleteError) {
      setError(getAccountDeletionErrorMessage(deleteError))
      return
    }

    await onDeleted?.()
  }

  const blockers = evaluation?.blockers ?? []
  const deletionBlocked = evaluation && evaluation.allowed === false
  const canSelfDelete = passwordAuthAvailable && !deletionBlocked && !loadingEval

  return (
    <section className="settings-card settings-danger-zone">
      <h2 className="settings-card__title settings-danger-zone__title">Account</h2>
      <p className="settings-card__lead">
        Deleting your account is permanent. Listings are removed from public search. Orders,
        payouts and legal records are kept as required. Read the{' '}
        <Link to={PRIVACY_POLICY_PATH}>Privacy Policy</Link> or{' '}
        <Link to="/help">Help Centre</Link> for more detail.
      </p>

      {blockedByImpersonation ? (
        <p className="settings-card__lead" role="status">
          Unavailable while logged in as another user.
        </p>
      ) : (
        <button
          type="button"
          className="settings-danger-zone__button"
          onClick={() => {
            setError('')
            setEvaluation(null)
            setPassword('')
            setConfirmationText('')
            setLoadingEval(true)
            setModalOpen(true)
          }}
        >
          Delete account
        </button>
      )}

      {modalOpen ? (
        <div className="auth-modal" role="presentation">
          <button
            type="button"
            className="auth-modal__backdrop"
            aria-label="Close"
            onClick={closeModal}
          />
          <div
            className="auth-modal__dialog settings-danger-zone__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <button
              type="button"
              className="auth-modal__close"
              onClick={closeModal}
              aria-label="Close"
            >
              <ModalCloseIcon size={18} />
            </button>

            <h2 id="delete-account-title" className="settings-danger-zone__modal-title">
              Delete your account?
            </h2>
            <p className="settings-danger-zone__modal-lead">
              This cannot be undone. We remove personal profile details and hide your listings.
              Financial, fraud-prevention and legal records are retained. Contact details in
              completed orders stay with those orders.
            </p>

            {loadingEval ? <p className="settings-form__hint">Checking whether deletion is available…</p> : null}

            {deletionBlocked ? (
              <div className="settings-danger-zone__blockers" role="alert">
                <p>Your account cannot be deleted yet:</p>
                <ul>
                  {blockers.map((blocker) => (
                    <li key={blocker.code || blocker.message}>{blocker.message}</li>
                  ))}
                </ul>
                <p>
                  Finish those items, or contact <Link to="/support">Equipd support</Link>.
                </p>
              </div>
            ) : null}

            {!passwordAuthAvailable ? (
              <div className="settings-danger-zone__support" role="status">
                <p>
                  This account uses Google or Apple sign-in, so Equipd cannot confirm deletion with
                  a password. For safety, social-only accounts are closed by Equipd support after
                  identity checks.
                </p>
                <p>
                  Contact <Link to="/support">Equipd support</Link> and ask to delete this account.
                  Keep using this signed-in Google or Apple login until support confirms it is
                  closed.
                </p>
              </div>
            ) : (
              <form className="settings-danger-zone__form" onSubmit={handleSubmit}>
                <div className="settings-form__field">
                  <label className="settings-form__label" htmlFor="delete-account-password">
                    Current password
                  </label>
                  <input
                    id="delete-account-password"
                    className="settings-form__input"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={submitting || !canSelfDelete}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>

                <div className="settings-form__field">
                  <label className="settings-form__label" htmlFor="delete-account-confirm">
                    Type {ACCOUNT_DELETION_CONFIRMATION_TEXT} to confirm
                  </label>
                  <input
                    id="delete-account-confirm"
                    className="settings-form__input"
                    type="text"
                    autoComplete="off"
                    value={confirmationText}
                    disabled={submitting || !canSelfDelete}
                    onChange={(event) => setConfirmationText(event.target.value)}
                  />
                </div>

                {error ? (
                  <p className="settings-form__message settings-form__message--error" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="settings-danger-zone__actions">
                  <button
                    type="button"
                    className="settings-danger-zone__cancel"
                    onClick={closeModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="settings-danger-zone__button"
                    disabled={
                      submitting ||
                      !canSelfDelete ||
                      !password ||
                      confirmationText.trim() !== ACCOUNT_DELETION_CONFIRMATION_TEXT
                    }
                  >
                    {submitting ? 'Deleting…' : 'Delete account permanently'}
                  </button>
                </div>
              </form>
            )}

            {!passwordAuthAvailable ? (
              <>
                {error ? (
                  <p className="settings-form__message settings-form__message--error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="settings-danger-zone__actions">
                  <button
                    type="button"
                    className="settings-danger-zone__cancel"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                  <Link className="settings-danger-zone__button settings-danger-zone__button-link" to="/support">
                    Contact Equipd support
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default DeleteAccountSection
