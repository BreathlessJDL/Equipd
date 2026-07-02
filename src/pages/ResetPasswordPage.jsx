import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PasswordField from '../components/auth/PasswordField'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { getAuthErrorMessage, updatePasswordAfterReset } from '../lib/auth'
import {
  isPasswordPolicyValid,
  validatePassword,
  validatePasswordWithServer,
} from '../lib/passwordPolicy'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'

function ResetPasswordPage() {
  usePageTitle('Reset Password')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionInvalid, setSessionInvalid] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSessionInvalid(true)
      return undefined
    }

    let active = true

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!active) return

      if (session) {
        setSessionReady(true)
        return
      }

      setSessionInvalid(true)
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(true)
        setSessionInvalid(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const clientValidation = validatePassword(password)
    if (!clientValidation.valid) {
      setError(clientValidation.error)
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured.')
      return
    }

    setSubmitting(true)

    const serverValidation = await validatePasswordWithServer(supabase, password)
    if (!serverValidation.valid) {
      setSubmitting(false)
      setError(serverValidation.error)
      return
    }

    const { error: updateError } = await updatePasswordAfterReset(password)

    setSubmitting(false)

    if (updateError) {
      setError(getAuthErrorMessage(updateError))
      return
    }

    setSuccess(true)
  }

  if (sessionInvalid && !sessionReady) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Reset link invalid or expired</h2>
        <p className="page-stub__lead">
          Request a new password reset link and try again.
        </p>
        <p className="page-stub__lead">
          <Link to="/forgot-password">Request reset link</Link>
          {' · '}
          <Link to="/login">Log in</Link>
        </p>
      </section>
    )
  }

  if (!sessionReady) {
    return (
      <section className="page-stub">
        <p className="page-stub__lead">Preparing password reset…</p>
      </section>
    )
  }

  if (success) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Password updated</h2>
        <p className="auth-form__message auth-form__message--success" role="status">
          Your password has been updated. You can now log in with your new password.
        </p>
        <p className="page-stub__lead">
          <Link to="/login">Log in</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="page-stub">
      <h2 className="auth-form__heading" id="reset-password-heading">
        Choose a new password
      </h2>
      <p className="auth-form__lead">Enter and confirm your new password below.</p>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        aria-labelledby="reset-password-heading"
      >
        <PasswordField
          id="reset-password"
          label="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
        />

        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="reset-password-confirm">
            Confirm new password
          </label>
          <input
            id="reset-password-confirm"
            className="auth-form__input"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            disabled={submitting}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p className="auth-form__message auth-form__message--error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="auth-form__button"
          type="submit"
          disabled={submitting || !isPasswordPolicyValid(password) || !confirmPassword}
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <p className="auth-form__footer">
        <Link to="/login">Back to log in</Link>
      </p>
    </section>
  )
}

export default ResetPasswordPage
