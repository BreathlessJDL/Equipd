import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ProfileImageUpload from '../components/settings/ProfileImageUpload'
import UserAvatar from '../components/UserAvatar'
import ListingLocationAutocomplete from '../components/listing/ListingLocationAutocomplete'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { usePageTitle } from '../hooks/usePageTitle'
import '../components/AuthForm.css'
import '../components/listing/ListingLocationAutocomplete.css'
import { useAuth } from '../hooks/useAuth'
import { buildProfileLocationPayload } from '../lib/listingLocation'
import {
  getProfileImageErrorMessage,
  uploadProfileImage,
} from '../lib/profileImages'
import {
  fetchProfile,
  getProfileDisplayName,
  getProfileErrorMessage,
  getProfileLocationPlace,
  getUsernameChangeEligibility,
  hasUsernameChanged,
  isUsernameAvailable,
  notifyProfileLocationUpdated,
  notifyProfileUpdated,
  supportsUsername,
  updateProfile,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '../lib/profiles'
import { getAuthErrorMessage, updateUserEmailWithPassword } from '../lib/auth'
import {
  getStripeApiErrorMessage,
  syncStripeConnectStatus,
} from '../lib/stripe-api'
import { useStripeConnectOnboarding } from '../hooks/useStripeConnectOnboarding'
import { STRIPE_SETUP_QUERY_PARAM } from '../lib/stripeConnectOnboarding'
import { getSellerShopPath } from '../lib/sellerShopUrls'
import {
  COOKIE_POLICY_PATH,
  PRIVACY_POLICY_PATH,
  TERMS_PATH,
} from '../lib/cookieConsent'
import './SettingsPage.css'

function SettingsPage() {
  usePageTitle('Settings')
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { openCookieSettings } = useCookieConsent()
  const [searchParams, setSearchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationPlace, setLocationPlace] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null)
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState('')
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState('')
  const [profileData, setProfileData] = useState(null)
  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [stripeSyncing, setStripeSyncing] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [stripeNotice, setStripeNotice] = useState('')
  const { openOnboarding, loading: stripeOnboardingLoading } = useStripeConnectOnboarding()
  const [usernameSupported, setUsernameSupported] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  const usernameRequired = searchParams.get('username') === 'required'
  const postAuthRedirect = location.state?.postAuthRedirect

  function clearPendingAvatar() {
    if (pendingAvatarPreview) {
      URL.revokeObjectURL(pendingAvatarPreview)
    }
    setPendingAvatarFile(null)
    setPendingAvatarPreview('')
  }

  function applyProfileToForm(data) {
    const place = getProfileLocationPlace(data)
    clearPendingAvatar()
    setRemoveAvatar(false)
    setAvatarUploadError('')
    setProfileData(data)
    setUsername(data?.username ?? '')
    setLocationSearch(place?.displayLabel || data?.location?.trim() || '')
    setLocationPlace(place)
    setAvatarUrl(data?.avatar_url ?? '')
    setStripeOnboardingComplete(data?.stripe_onboarding_complete ?? false)
  }

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

    applyProfileToForm(data)
    setLoading(false)
  }

  useEffect(() => {
    if (searchParams.get('cookies') === '1') {
      openCookieSettings()
      const next = new URLSearchParams(searchParams)
      next.delete('cookies')
      setSearchParams(next, { replace: true })
    }
  }, [openCookieSettings, searchParams, setSearchParams])

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
    return () => {
      if (pendingAvatarPreview) {
        URL.revokeObjectURL(pendingAvatarPreview)
      }
    }
  }, [pendingAvatarPreview])

  useEffect(() => {
    let active = true

    supportsUsername().then((supported) => {
      if (active) setUsernameSupported(supported)
    })

    return () => {
      active = false
    }
  }, [])

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
        if (data?.stripe_account_reset) {
          setStripeNotice(
            'Your previous Stripe test account is no longer valid in live mode. Complete live Stripe setup to receive payouts.',
          )
        } else {
          setStripeNotice(
            data?.stripe_onboarding_complete
              ? 'Payout setup complete. Buyers can now pay for accepted offers.'
              : 'Stripe setup is not complete yet. Continue setup to receive payments.',
          )
        }
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

  useEffect(() => {
    if (loading || !user?.id) return undefined
    if (searchParams.get('stripe')) return undefined
    if (!stripeOnboardingComplete) return undefined

    let active = true

    async function validateStripeConnectAccount() {
      setStripeSyncing(true)
      setStripeError('')

      const { data, error } = await syncStripeConnectStatus()

      if (!active) return

      setStripeSyncing(false)

      if (error) {
        setStripeError(getStripeApiErrorMessage(error))
        return
      }

      setStripeOnboardingComplete(data?.stripe_onboarding_complete ?? false)

      if (data?.stripe_account_reset) {
        setStripeNotice(
          'Your previous Stripe test account is no longer valid in live mode. Complete live Stripe setup to receive payouts.',
        )
      }
    }

    validateStripeConnectAccount()

    return () => {
      active = false
    }
  }, [loading, searchParams, stripeOnboardingComplete, user?.id])

  useEffect(() => {
    if (loading || stripeOnboardingComplete) return undefined
    if (searchParams.get(STRIPE_SETUP_QUERY_PARAM) !== '1') return undefined

    openOnboarding({
      onError: setStripeError,
    })

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete(STRIPE_SETUP_QUERY_PARAM)
    setSearchParams(nextParams, { replace: true })

    return undefined
  }, [loading, openOnboarding, searchParams, setSearchParams, stripeOnboardingComplete])

  function handleAvatarFileSelected(file, validationError) {
    setSaveSuccess('')
    setAvatarUploadError(validationError)

    if (!file) return

    clearPendingAvatar()
    setRemoveAvatar(false)
    setPendingAvatarFile(file)
    setPendingAvatarPreview(URL.createObjectURL(file))
  }

  function handleRemoveAvatar() {
    setSaveSuccess('')
    setAvatarUploadError('')
    clearPendingAvatar()
    setRemoveAvatar(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!user?.id) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')
    setAvatarUploadError('')

    const normalizedUsername = username.trim()
    if (usernameSupported) {
      const validation = validateUsername(normalizedUsername, {
        required: usernameRequired,
      })
      if (!validation.valid) {
        setSaving(false)
        setSaveError(validation.error)
        return
      }

      if (normalizedUsername) {
        const usernameChange = getUsernameChangeEligibility(profileData, normalizedUsername)
        if (!usernameChange.allowed) {
          setSaving(false)
          setSaveError(usernameChange.error)
          return
        }

        if (hasUsernameChanged(normalizedUsername, profileData?.username)) {
          const availability = await isUsernameAvailable(validation.username, {
            excludeUserId: user.id,
          })

          if (!availability.available) {
            setSaving(false)
            setSaveError(getProfileErrorMessage(availability.error))
            return
          }
        }
      }
    }

    const locationPayload = buildProfileLocationPayload({
      locationPlace,
      locationText: locationSearch,
    })

    const profilePatch = {
      location: locationPayload.location,
      city: locationPayload.city,
      county: locationPayload.county,
      postcode: locationPayload.postcode,
      latitude: locationPayload.latitude,
      longitude: locationPayload.longitude,
    }

    if (usernameSupported) {
      profilePatch.username = normalizedUsername || null
    }

    if (removeAvatar) {
      profilePatch.avatar_url = ''
    }

    const { data: savedProfile, error: profileError } = await updateProfile(user.id, profilePatch)

    if (profileError) {
      setSaving(false)
      setSaveError(getProfileErrorMessage(profileError))
      return
    }

    let latestProfile = savedProfile

    if (pendingAvatarFile) {
      const { data: uploadedImage, error: uploadError } = await uploadProfileImage({
        userId: user.id,
        file: pendingAvatarFile,
      })

      if (uploadError) {
        const uploadMessage = getProfileImageErrorMessage(uploadError)
        applyProfileToForm(savedProfile)
        notifyProfileUpdated(user.id)
        notifyProfileLocationUpdated()
        setSaving(false)
        setAvatarUploadError(uploadMessage)
        setSaveError(
          `Your username and location were saved, but the profile picture could not be uploaded. ${uploadMessage}`,
        )
        return
      }

      const { data: avatarSavedProfile, error: avatarSaveError } = await updateProfile(user.id, {
        avatar_url: uploadedImage.publicUrl,
      })

      if (avatarSaveError) {
        const saveMessage = getProfileErrorMessage(avatarSaveError)
        applyProfileToForm(savedProfile)
        notifyProfileUpdated(user.id)
        notifyProfileLocationUpdated()
        setSaving(false)
        setAvatarUploadError(saveMessage)
        setSaveError(
          `Your username and location were saved, but the profile picture URL could not be saved. ${saveMessage}`,
        )
        return
      }

      latestProfile = avatarSavedProfile
    }

    applyProfileToForm(latestProfile)
    notifyProfileUpdated(user.id)
    notifyProfileLocationUpdated()
    setSaving(false)
    setSaveSuccess('Settings saved.')

    if (usernameRequired && normalizedUsername) {
      if (postAuthRedirect) {
        navigate(postAuthRedirect, { replace: true })
        return
      }

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('username')
      setSearchParams(nextParams, { replace: true })
    }
  }

  function handleStripeSetup() {
    setStripeError('')
    setStripeNotice('')
    openOnboarding({
      onError: setStripeError,
    })
  }

  async function handleEmailChangeSubmit(event) {
    event.preventDefault()
    if (!user?.email || emailSaving) return

    setEmailSaving(true)
    setEmailError('')
    setEmailSuccess('')

    const { error, email } = await updateUserEmailWithPassword({
      currentEmail: user.email,
      currentPassword: emailPassword,
      newEmail,
    })

    setEmailSaving(false)

    if (error) {
      setEmailError(getAuthErrorMessage(error))
      return
    }

    setNewEmail('')
    setEmailPassword('')
    setEmailSuccess(
      `We sent a confirmation link to ${email}. Your login email will update after you verify the new address.`,
    )
  }

  const usernameChangeEligibility = useMemo(
    () => getUsernameChangeEligibility(profileData, username),
    [profileData, username],
  )

  const previewProfile = useMemo(
    () => ({
      ...(profileData ?? {}),
      username,
      avatar_url: removeAvatar ? '' : pendingAvatarPreview || avatarUrl,
    }),
    [profileData, username, removeAvatar, pendingAvatarPreview, avatarUrl],
  )

  const displayName = getProfileDisplayName(previewProfile, { email: user?.email })
  const trimmedUsername = username.trim()
  const showUsernamePreviewMeta = Boolean(
    trimmedUsername && trimmedUsername.toLowerCase() !== displayName.toLowerCase(),
  )
  const hasSavedCoordinates =
    locationPlace?.latitude != null && locationPlace?.longitude != null
  const hasPhoto = Boolean(
    !removeAvatar && (pendingAvatarPreview || avatarUrl?.trim()),
  )

  if (loading) {
    return (
      <section className="settings-page">
        <header className="settings-page__header">
          <h1 className="settings-page__title">Account settings</h1>
          <p className="settings-page__lead">Loading your account settings…</p>
        </header>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="settings-page">
        <header className="settings-page__header">
          <h1 className="settings-page__title">Account settings</h1>
          <p className="settings-form__message settings-form__message--error" role="alert">
            {loadError}
          </p>
        </header>
      </section>
    )
  }

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">Account settings</h1>
        <p className="settings-page__lead">
          Manage your public profile, default location, and seller payout details.
        </p>
        {usernameRequired ? (
          <p className="settings-form__message settings-form__message--info" role="status">
            Choose a username to finish setting up your account. This appears on your shop page and
            listings.
          </p>
        ) : null}
      </header>

      <div className="settings-page__layout">
        <div className="settings-page__main">
          <form className="settings-card settings-form" onSubmit={handleSubmit}>
            <div className="settings-card__section">
              <h2 className="settings-card__title">Public profile</h2>
              <p className="settings-card__lead">
                This information appears on your shop page and listings.
              </p>

              <div className="settings-form__field">
                <span className="settings-form__label">Profile picture</span>
                <ProfileImageUpload
                  profile={previewProfile}
                  user={user}
                  previewUrl={removeAvatar ? '' : pendingAvatarPreview || avatarUrl}
                  onFileSelected={handleAvatarFileSelected}
                  onRemovePhoto={handleRemoveAvatar}
                  hasPhoto={hasPhoto}
                  disabled={saving}
                  error={avatarUploadError}
                />
              </div>

              <div className="settings-form__field">
                <label className="settings-form__label" htmlFor="settings-username">
                  Username
                </label>
                <input
                  id="settings-username"
                  className="settings-form__input"
                  type="text"
                  autoComplete="username"
                  required={usernameRequired}
                  minLength={USERNAME_MIN_LENGTH}
                  maxLength={USERNAME_MAX_LENGTH}
                  pattern="[A-Za-z0-9_-]*"
                  placeholder="Choose a username"
                  value={username}
                  disabled={!usernameSupported || saving}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setSaveSuccess('')
                  }}
                />
                <p className="settings-form__hint">
                  {usernameSupported ? (
                    usernameRequired ? (
                      <>
                        Required to complete sign-up. {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH}{' '}
                        characters. Letters, numbers, underscores, and hyphens only.
                      </>
                    ) : (
                      <>
                        Optional for existing accounts. {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH}{' '}
                        characters. Letters, numbers, underscores, and hyphens only.
                      </>
                    )
                  ) : (
                    'Usernames are not enabled on this database yet. Run supabase/profile-username.sql in the Supabase SQL Editor, then refresh.'
                  )}
                </p>
                {!usernameChangeEligibility.allowed ? (
                  <p className="settings-form__message settings-form__message--error" role="alert">
                    {usernameChangeEligibility.error}
                  </p>
                ) : profileData?.username_last_changed_at ? (
                  <p className="settings-form__hint">
                    Usernames can be changed once every {USERNAME_CHANGE_COOLDOWN_DAYS} days.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="settings-card__section settings-location">
              <h2 className="settings-card__title">Default location</h2>
              <p className="settings-form__hint">Used to show nearest listings.</p>

              <div className="settings-form__field">
                <label className="visually-hidden" htmlFor="settings-location">
                  Default location
                </label>
                <ListingLocationAutocomplete
                  inputId="settings-location"
                  value={locationSearch}
                  selectedPlace={locationPlace}
                  onSearchChange={(value) => {
                    setLocationSearch(value)
                    setSaveSuccess('')
                  }}
                  onPlaceSelected={(place) => {
                    setLocationPlace(place)
                    setSaveSuccess('')
                  }}
                  inputClassName="settings-form__input"
                  placeholder="Search town, city or postcode"
                />
                {import.meta.env.DEV && hasSavedCoordinates ? (
                  <p className="settings-form__hint settings-form__hint--dev">
                    {locationPlace.latitude.toFixed(4)}, {locationPlace.longitude.toFixed(4)}
                  </p>
                ) : locationSearch.trim() && !hasSavedCoordinates ? (
                  <p className="settings-form__hint">
                    Select a location from the suggestions to save map coordinates for nearest
                    listings.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="settings-form__actions">
              {saveError ? (
                <p className="settings-form__message settings-form__message--error" role="alert">
                  {saveError}
                </p>
              ) : null}

              {saveSuccess ? (
                <p className="settings-form__message settings-form__message--success" role="status">
                  {saveSuccess}
                </p>
              ) : null}

              <button className="settings-form__button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>

          <form className="settings-card settings-form" onSubmit={handleEmailChangeSubmit}>
            <div className="settings-card__section">
              <h2 className="settings-card__title">Login email</h2>
              <p className="settings-card__lead">
                Change the email address you use to sign in. You must confirm the new address
                before it takes effect.
              </p>

              <div className="settings-form__field">
                <label className="settings-form__label" htmlFor="settings-current-email">
                  Current email
                </label>
                <input
                  id="settings-current-email"
                  className="settings-form__input settings-form__input--readonly"
                  type="email"
                  value={user?.email ?? ''}
                  readOnly
                />
              </div>

              <div className="settings-form__field">
                <label className="settings-form__label" htmlFor="settings-new-email">
                  New email
                </label>
                <input
                  id="settings-new-email"
                  className="settings-form__input"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  disabled={emailSaving}
                  onChange={(event) => {
                    setNewEmail(event.target.value)
                    setEmailSuccess('')
                    setEmailError('')
                  }}
                />
              </div>

              <div className="settings-form__field">
                <label className="settings-form__label" htmlFor="settings-email-password">
                  Current password
                </label>
                <input
                  id="settings-email-password"
                  className="settings-form__input"
                  type="password"
                  autoComplete="current-password"
                  value={emailPassword}
                  disabled={emailSaving}
                  onChange={(event) => {
                    setEmailPassword(event.target.value)
                    setEmailSuccess('')
                    setEmailError('')
                  }}
                />
                <p className="settings-form__hint">
                  Re-enter your current password to change your email.
                </p>
              </div>

              <div className="settings-form__actions">
                {emailError ? (
                  <p className="settings-form__message settings-form__message--error" role="alert">
                    {emailError}
                  </p>
                ) : null}

                {emailSuccess ? (
                  <p className="settings-form__message settings-form__message--success" role="status">
                    {emailSuccess}
                  </p>
                ) : null}

                <button
                  className="settings-form__button"
                  type="submit"
                  disabled={emailSaving || !newEmail.trim() || !emailPassword}
                >
                  {emailSaving ? 'Sending confirmation…' : 'Change email'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <aside className="settings-page__sidebar">
          <div className="settings-card settings-payout">
            <h2 className="settings-card__title">Payout setup</h2>
            <p className="settings-card__lead">
              Connect a UK bank account via Stripe so buyers can pay for accepted offers.
            </p>

            {stripeOnboardingComplete ? (
              <p
                className="settings-payout__status settings-payout__status--enabled"
                role="status"
              >
                Payouts enabled
              </p>
            ) : (
              <p className="settings-payout__status settings-payout__status--required">
                Payout setup required
              </p>
            )}

            {stripeSyncing ? (
              <p className="settings-form__hint">Checking Stripe setup…</p>
            ) : null}

            {stripeNotice ? (
              <p className="settings-form__message settings-form__message--success" role="status">
                {stripeNotice}
              </p>
            ) : null}

            {stripeError ? (
              <p className="settings-form__message settings-form__message--error" role="alert">
                {stripeError}
              </p>
            ) : null}

            {!stripeOnboardingComplete ? (
              <button
                type="button"
                className="settings-payout__button"
                disabled={stripeOnboardingLoading || stripeSyncing}
                onClick={handleStripeSetup}
              >
                Complete Stripe setup
              </button>
            ) : null}
          </div>

          <div className="settings-card settings-preview">
            <h2 className="settings-card__title">Public profile</h2>
            <div className="settings-preview__identity">
              <UserAvatar profile={previewProfile} user={user} size="xl" />
              <p className="settings-preview__name">{displayName}</p>
              {showUsernamePreviewMeta ? (
                <p className="settings-preview__meta">@{trimmedUsername}</p>
              ) : !trimmedUsername ? (
                <p className="settings-preview__meta">No username set</p>
              ) : null}
            </div>
            <Link
              className="settings-preview__link"
              to={getSellerShopPath({ id: user.id, username: trimmedUsername || profileData?.username })}
            >
              View public profile
            </Link>
          </div>

          <div className="settings-card settings-privacy">
            <h2 className="settings-card__title">Privacy &amp; cookies</h2>
            <p className="settings-card__lead">
              Manage optional cookies and read Equipd legal policies.
            </p>
            <div className="settings-privacy__actions">
              <button
                type="button"
                className="settings-privacy__button settings-privacy__button--primary"
                onClick={openCookieSettings}
              >
                Cookie settings
              </button>
              <Link className="settings-privacy__link" to={COOKIE_POLICY_PATH}>
                Cookie Policy
              </Link>
              <Link className="settings-privacy__link" to={PRIVACY_POLICY_PATH}>
                Privacy Policy
              </Link>
              <Link className="settings-privacy__link" to={TERMS_PATH}>
                Terms &amp; Conditions
              </Link>
            </div>
          </div>
        </aside>
      </div>
      </section>
  )
}

export default SettingsPage
