import { useEffect, useState } from 'react'
import {
  getResendConfirmationErrorMessage,
  resendSignupConfirmationEmail,
  SIGNUP_CONFIRMATION_RESEND_COOLDOWN_SECONDS,
} from '../../lib/auth'

function SignupEmailConfirmation({
  email,
  idPrefix = 'signup-confirmation',
  onOpenLogin,
  onClose,
}) {
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState('')
  const [resendError, setResendError] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined

    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  async function handleResend() {
    if (!email?.trim() || resending || cooldownSeconds > 0) return

    setResending(true)
    setResendSuccess('')
    setResendError('')

    const { error } = await resendSignupConfirmationEmail(email)

    setResending(false)

    if (error) {
      setResendError(getResendConfirmationErrorMessage(error))
      return
    }

    setResendSuccess('Confirmation email resent. Please check your inbox and junk folder.')
    setCooldownSeconds(SIGNUP_CONFIRMATION_RESEND_COOLDOWN_SECONDS)
  }

  const resendDisabled = resending || cooldownSeconds > 0 || !email?.trim()
  const resendLabel = resending
    ? 'Sending…'
    : cooldownSeconds > 0
      ? `Resend email (${cooldownSeconds}s)`
      : 'Resend email'

  return (
    <div className="signup-email-confirmation">
      <h2 className="auth-form__heading" id={`${idPrefix}-heading`}>
        Check your email
      </h2>

      <div className="signup-email-confirmation__body">
        <p>
          Your Equipd account has been created. We&apos;ve sent a confirmation link to:{' '}
          {email ? (
            <strong className="signup-email-confirmation__email">{email}</strong>
          ) : (
            'your email address'
          )}
        </p>
        <p>
          Please open the email and click the confirmation link to activate your account. Once
          confirmed, you can log in.
        </p>
      </div>

      {resendSuccess ? (
        <p className="auth-form__message auth-form__message--success" role="status">
          {resendSuccess}
        </p>
      ) : null}

      {resendError ? (
        <p className="auth-form__message auth-form__message--error" role="alert">
          {resendError}
        </p>
      ) : null}

      <div className="signup-email-confirmation__actions">
        <button type="button" className="auth-form__button" onClick={onOpenLogin}>
          Open login
        </button>
        <button
          type="button"
          className="auth-form__button auth-form__button--secondary"
          disabled={resendDisabled}
          onClick={handleResend}
        >
          {resendLabel}
        </button>
        <button
          type="button"
          className="auth-form__button auth-form__button--secondary"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <p className="signup-email-confirmation__hint">
        Didn&apos;t receive it? Check your junk/spam folder or resend the email.
      </p>
    </div>
  )
}

export default SignupEmailConfirmation
