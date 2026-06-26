import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchProfile, buildAvatarProfile, PROFILE_UPDATED_EVENT } from '../lib/profiles'
import UserAvatar from './UserAvatar'
import './AccountDropdown.css'

function AccountDropdown({ onNavigate, className = '' }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState(null)

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      return
    }

    const { data } = await fetchProfile(user.id, { email: user.email })
    setProfile(data)
  }, [user?.email, user?.id])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    function handleProfileUpdated(event) {
      const updatedUserId = event.detail?.userId
      if (updatedUserId && updatedUserId !== user?.id) return
      loadProfile()
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [loadProfile, user?.id])

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    function handlePointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  function closeMenu() {
    setOpen(false)
  }

  function toggleMenu() {
    setOpen((current) => !current)
  }

  function handleNavigate(path) {
    closeMenu()
    onNavigate?.()
    navigate(path)
  }

  async function handleSignOut() {
    closeMenu()
    onNavigate?.()
    const { error } = await signOut()

    if (error) {
      console.error('Sign out failed:', error.message)
    }
  }

  if (!user) return null

  const avatarProfile = buildAvatarProfile(profile, user)

  return (
    <div className={`account-dropdown${className ? ` ${className}` : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`account-dropdown__trigger${open ? ' account-dropdown__trigger--open' : ''}`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="account-dropdown-menu"
        onClick={toggleMenu}
      >
        <UserAvatar profile={avatarProfile} user={user} size="md" />
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="account-dropdown__chevron"
        >
          <path
            d="m4 6 4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id="account-dropdown-menu"
          className="account-dropdown__menu"
          role="menu"
          aria-label="Account"
        >
          <button
            type="button"
            className="account-dropdown__item"
            role="menuitem"
            onClick={() => handleNavigate(`/shop/${user.id}`)}
          >
            Profile
          </button>
          <button
            type="button"
            className="account-dropdown__item"
            role="menuitem"
            onClick={() => handleNavigate('/settings')}
          >
            Settings
          </button>
          <button
            type="button"
            className="account-dropdown__item"
            role="menuitem"
            onClick={() => handleNavigate('/hub')}
          >
            My Hub
          </button>
          <button
            type="button"
            className="account-dropdown__item account-dropdown__item--logout"
            role="menuitem"
            onClick={handleSignOut}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default AccountDropdown
