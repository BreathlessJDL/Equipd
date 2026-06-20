import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { getAuthErrorMessage } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function SignupPage() {
  const navigate = useNavigate()
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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    setSubmitting(false)

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError))
      return
    }

    if (data.session) {
      setSuccess('Account created. Redirecting…')
      navigate('/profile', { replace: true })
      return
    }

    setSuccess('Account created. Check your email to confirm your address, then log in.')
  }

  return (
    <section className="page-stub">
      <h2 className="page-stub__title">Sign up</h2>
      <p className="page-stub__lead">Create an Equipd account to sell and manage listings.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            className="auth-form__input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className="auth-form__input"
            type="password"
            autoComplete="new-password"
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
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="auth-form__footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  )
}

export default SignupPage
