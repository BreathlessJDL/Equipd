import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../AuthForm.css'
import { requestPasswordReset } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'

const PASSWORD_RESET_CONFIRMATION =
  'If an account exists for that email address, we have sent password reset instructions. Check your inbox and spam folder.'

function ForgotPasswordForm({
  idPrefix = 'forgot-password',
  onBackToLogin,
  showBackLink = true,
  compact = false,
}) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your keys to .env.local and restart the dev server.')
      return
    }

    setSubmitting(true)

    const { error: resetError } = await requestPasswordReset(email)

    setSubmitting(false)
    setSubmitted(true)

    if (resetError) {
      console.error('[auth] password reset request failed:', resetError.message)
    }
  }

  return (
    <>
      {!compact ? (
        <>
          <h2 className="auth-form__heading" id={`${idPrefix}-heading`}>
            Reset your password
          </h2>
          <p className="auth-form__lead">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
        </>
      ) : null}

      {submitted ? (
        <p className="auth-form__message auth-form__message--success" role="status">
          {PASSWORD_RESET_CONFIRMATION}
        </p>
      ) : (
        <form
          className="auth-form auth-form--modal"
          onSubmit={handleSubmit}
          aria-labelledby={`${idPrefix}-heading`}
        >
          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor={`${idPrefix}-email`}>
              Email
            </label>
            <input
              id={`${idPrefix}-email`}
              className="auth-form__input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {error ? (
            <p className="auth-form__message auth-form__message--error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-form__button" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      {showBackLink ? (
        <p className="auth-form__footer">
          {onBackToLogin ? (
            <button type="button" className="auth-form__switch-link" onClick={onBackToLogin}>
              Back to log in
            </button>
          ) : (
            <Link to="/login">Back to log in</Link>
          )}
        </p>
      ) : null}
    </>
  )
}

export { PASSWORD_RESET_CONFIRMATION }
export default ForgotPasswordForm
