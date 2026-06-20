import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { useAuth } from '../hooks/useAuth'
import { fetchProfile, getProfileErrorMessage, updateProfile } from '../lib/profiles'
import {
  getStripeApiErrorMessage,
  startStripeConnectOnboarding,
  syncStripeConnectStatus,
} from '../lib/stripe-api'

function ProfilePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [displayName, setDisplayName] = useState('')
  const [location, setLocation] = useState('')
  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeSyncing, setStripeSyncing] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [stripeNotice, setStripeNotice] = useState('')

  async function loadProfileData() {
    if (!user?.id) return

    setLoading(true)
    setLoadError('')

    const { data, error } = await fetchProfile(user.id, { email: user.email })

    if (error) {
      setLoadError(getProfileErrorMessage(error))
      setLoading(false)
      return
    }

    setDisplayName(data.display_name ?? '')
    setLocation(data.location ?? '')
    setStripeOnboardingComplete(data.stripe_onboarding_complete ?? false)
    setLoading(false)
  }

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function load() {
      await loadProfileData()
      if (!active) return
    }

    load()

    return () => {
      active = false
    }
  }, [user?.email, user?.id])

  useEffect(() => {
    const stripeReturn = searchParams.get('stripe')

    if (!stripeReturn || !user?.id) {
      return undefined
    }

    let active = true

    async function handleStripeReturn() {
      setStripeSyncing(true)
      setStripeError('')

      const { data, error } = await syncStripeConnectStatus()

      if (!active) return

      setStripeSyncing(false)

      if (error) {
        setStripeError(getStripeApiErrorMessage(error))
      } else {
        setStripeOnboardingComplete(data?.stripe_onboarding_complete ?? false)
        setStripeNotice(
          data?.stripe_onboarding_complete
            ? 'Payout setup complete. Buyers can now pay for accepted offers.'
            : 'Stripe setup is not complete yet. Continue setup to receive payments.',
        )
      }

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('stripe')
      setSearchParams(nextParams, { replace: true })
    }

    handleStripeReturn()

    return () => {
      active = false
    }
  }, [searchParams, setSearchParams, user?.id])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!user?.id) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const { data, error } = await updateProfile(user.id, {
      display_name: displayName,
      location,
    })

    setSaving(false)

    if (error) {
      setSaveError(getProfileErrorMessage(error))
      return
    }

    setDisplayName(data.display_name ?? '')
    setLocation(data.location ?? '')
    setSaveSuccess('Profile saved.')
  }

  async function handleStripeSetup() {
    setStripeLoading(true)
    setStripeError('')
    setStripeNotice('')

    const { url, error } = await startStripeConnectOnboarding()

    if (error) {
      setStripeLoading(false)
      setStripeError(getStripeApiErrorMessage(error))
      return
    }

    globalThis.location.assign(url)
  }

  if (loading) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Your profile</h2>
        <p className="page-stub__lead">Loading your profile…</p>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Your profile</h2>
        <p className="auth-form__message auth-form__message--error" role="alert">
          {loadError}
        </p>
      </section>
    )
  }

  return (
    <section className="page-stub">
      <h2 className="page-stub__title">Your profile</h2>
      <p className="page-stub__lead">Update how you appear to other Equipd users.</p>

      <div className="auth-form profile-payout">
        <h3 className="profile-payout__title">Payout setup</h3>
        <p className="profile-payout__lead">
          Connect a UK bank account via Stripe so buyers can pay for accepted offers. You can
          complete this after accepting an offer.
        </p>

        {stripeOnboardingComplete ? (
          <p className="auth-form__message auth-form__message--success" role="status">
            Payouts enabled
          </p>
        ) : (
          <p className="profile-payout__status">Payout setup required</p>
        )}

        {stripeSyncing ? (
          <p className="profile-payout__status">Checking Stripe setup…</p>
        ) : null}

        {stripeNotice ? (
          <p className="auth-form__message auth-form__message--success" role="status">
            {stripeNotice}
          </p>
        ) : null}

        {stripeError ? (
          <p className="auth-form__message auth-form__message--error" role="alert">
            {stripeError}
          </p>
        ) : null}

        {!stripeOnboardingComplete ? (
          <button
            type="button"
            className="auth-form__button"
            disabled={stripeLoading || stripeSyncing}
            onClick={handleStripeSetup}
          >
            {stripeLoading ? 'Opening Stripe…' : 'Set up payouts'}
          </button>
        ) : null}
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="profile-email">
            Email
          </label>
          <input
            id="profile-email"
            className="auth-form__input auth-form__input--readonly"
            type="email"
            value={user?.email ?? ''}
            readOnly
          />
        </div>

        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="profile-display-name">
            Display name
          </label>
          <input
            id="profile-display-name"
            className="auth-form__input"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
              setSaveSuccess('')
            }}
          />
        </div>

        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="profile-location">
            Location
          </label>
          <input
            id="profile-location"
            className="auth-form__input"
            type="text"
            autoComplete="address-level2"
            placeholder="e.g. Manchester, UK"
            value={location}
            onChange={(event) => {
              setLocation(event.target.value)
              setSaveSuccess('')
            }}
          />
        </div>

        {saveError ? (
          <p className="auth-form__message auth-form__message--error" role="alert">
            {saveError}
          </p>
        ) : null}

        {saveSuccess ? (
          <p className="auth-form__message auth-form__message--success" role="status">
            {saveSuccess}
          </p>
        ) : null}

        <button className="auth-form__button" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </section>
  )
}

export default ProfilePage
