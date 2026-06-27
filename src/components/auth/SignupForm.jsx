import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../AuthForm.css'
import { getAuthErrorMessage, getEmailAuthRedirectUrl } from '../../lib/auth'
import {
  getProfileErrorMessage,
  isUsernameAvailable,
  updateProfile,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '../../lib/profiles'
import { validatePassword, validatePasswordWithServer } from '../../lib/passwordPolicy'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import GoogleAuthButton from './GoogleAuthButton'
import PasswordField from './PasswordField'
import './PasswordField.css'

function SignupForm({
  idPrefix = 'signup',
  redirectTo = '/settings',
  onSuccess,
  onSwitchToLogin,
  showSwitchLink = true,
  compact = false,
}) {
  const [username, setUsername] = useState('')
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

    const validation = validateUsername(username)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setSubmitting(true)

    const availability = await isUsernameAvailable(validation.username)
    if (!availability.available) {
      setSubmitting(false)
      setError(getProfileErrorMessage(availability.error))
      return
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      setSubmitting(false)
      setError(passwordValidation.error)
      return
    }

    const serverPasswordValidation = await validatePasswordWithServer(supabase, password)
    if (!serverPasswordValidation.valid) {
      setSubmitting(false)
      setError(serverPasswordValidation.error)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getEmailAuthRedirectUrl(),
        data: {
          username: validation.username,
        },
      },
    })

    if (signUpError) {
      setSubmitting(false)
      setError(getAuthErrorMessage(signUpError))
      return
    }

    if (data.user?.id && data.session) {
      const { error: profileError } = await updateProfile(data.user.id, {
        username: validation.username,
      })

      if (profileError) {
        setSubmitting(false)
        setError(getProfileErrorMessage(profileError))
        return
      }
    }

    setSubmitting(false)

    if (data.session) {
      setSuccess('Account created.')
      onSuccess?.({ redirectTo })
      return
    }

    setSuccess('Account created. Check your email to confirm your address, then log in.')
  }

  return (
    <>
      {!compact ? (
        <>
          <h2 className="auth-form__heading" id={`${idPrefix}-heading`}>
            Sign up
          </h2>
          <p className="auth-form__lead">Create an Equipd account to sell and manage listings.</p>
        </>
      ) : null}

      <GoogleAuthButton postAuthRedirect={redirectTo} disabled={submitting} />
      <div className="auth-form__divider" aria-hidden="true">
        or
      </div>

      <form className="auth-form auth-form--modal" onSubmit={handleSubmit} aria-labelledby={`${idPrefix}-heading`}>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor={`${idPrefix}-username`}>
            Username
          </label>
          <input
            id={`${idPrefix}-username`}
            className="auth-form__input"
            type="text"
            autoComplete="username"
            required
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            pattern="[A-Za-z0-9_-]+"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setError('')
            }}
          />
          <p className="auth-form__hint">
            {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters. Letters, numbers, underscores, and
            hyphens only.
          </p>
        </div>

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
          <PasswordField
            id={`${idPrefix}-password`}
            value={password}
            disabled={submitting}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
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
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      {showSwitchLink ? (
        <p className="auth-form__footer">
          Already have an account?{' '}
          {onSwitchToLogin ? (
            <button type="button" className="auth-form__switch-link" onClick={onSwitchToLogin}>
              Log in
            </button>
          ) : (
            <Link to="/login" state={redirectTo !== '/settings' ? { from: redirectTo } : undefined}>
              Log in
            </Link>
          )}
        </p>
      ) : null}
    </>
  )
}

export default SignupForm
