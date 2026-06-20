import { useEffect, useState } from 'react'
import '../components/AuthForm.css'
import '../components/PageStub.css'
import { useAuth } from '../hooks/useAuth'
import { fetchProfile, getProfileErrorMessage, updateProfile } from '../lib/profiles'

function ProfilePage() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function loadProfile() {
      setLoading(true)
      setLoadError('')

      const { data, error } = await fetchProfile(user.id, { email: user.email })

      if (!active) return

      if (error) {
        setLoadError(getProfileErrorMessage(error))
        setLoading(false)
        return
      }

      setDisplayName(data.display_name ?? '')
      setLocation(data.location ?? '')
      setLoading(false)
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [user?.id, user?.email])

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
