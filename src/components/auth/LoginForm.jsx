import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../AuthForm.css'
import { getAuthErrorMessage } from '../../lib/auth'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import GoogleAuthButton from './GoogleAuthButton'

function LoginForm({
  idPrefix = 'login',
  redirectTo = '/',
  onSuccess,
  onSwitchToSignup,
  showSwitchLink = true,
  compact = false,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured. Add your keys to .env.local and restart the dev server.')
      return
    }

    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setSubmitting(false)

    if (signInError) {
      setError(getAuthErrorMessage(signInError))
      return
    }

    setSuccess('Signed in successfully.')
    onSuccess?.({ redirectTo })
  }

  return (
    <>
      {!compact ? (
        <>
          <h2 className="auth-form__heading" id={`${idPrefix}-heading`}>
            Log in
          </h2>
          <p className="auth-form__lead">Sign in with your Equipd account.</p>
        </>
      ) : null}

      <GoogleAuthButton postAuthRedirect={redirectTo} disabled={submitting} />
      <div className="auth-form__divider" aria-hidden="true">
        or
      </div>

      <form className="auth-form auth-form--modal" onSubmit={handleSubmit} aria-labelledby={`${idPrefix}-heading`}>
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

        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor={`${idPrefix}-password`}>
            Password
          </label>
          <input
            id={`${idPrefix}-password`}
            className="auth-form__input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p className="auth-form__message auth-form__message--error" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="auth-form__message auth-form__message--success" role="status">
            {success}
          </p>
        ) : null}

        <button className="auth-form__button" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      {showSwitchLink ? (
        <p className="auth-form__footer">
          Don&apos;t have an account?{' '}
          {onSwitchToSignup ? (
            <button type="button" className="auth-form__switch-link" onClick={onSwitchToSignup}>
              Sign up
            </button>
          ) : (
            <Link to="/signup">Sign up</Link>
          )}
        </p>
      ) : null}
    </>
  )
}

export default LoginForm
