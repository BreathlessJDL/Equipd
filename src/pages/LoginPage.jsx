import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { getAuthErrorMessage } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const redirectTo = location.state?.from ?? '/'

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

    setSuccess('Signed in successfully. Redirecting…')
    navigate(redirectTo, { replace: true })
  }

  return (
    <section className="page-stub">
      <h2 className="page-stub__title">Log in</h2>
      <p className="page-stub__lead">Sign in with your Equipd account.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="auth-form__input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="auth-form__input"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
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

      <p className="auth-form__footer">
        No account yet? <Link to="/signup">Sign up</Link>
      </p>
    </section>
  )
}

export default LoginPage
