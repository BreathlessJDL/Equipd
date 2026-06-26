import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import {
  getSavedListingErrorMessage,
  isListingSaved,
  saveListing,
  unsaveListing,
} from '../lib/savedListings'
import { HeartIcon } from './icons/NavIcons'
import { isListingOwner } from '../lib/listings'
import './ListingCard.css'

function ListingSaveButton({ listing, className = '', onSavedChange }) {
  const location = useLocation()
  const { openLoginModal } = useAuthModal()
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(Boolean(user?.id && listing?.id))

  const isOwner = isListingOwner(listing, user?.id)

  useEffect(() => {
    if (!user?.id || !listing?.id || isOwner) {
      setSaved(false)
      setChecking(false)
      return undefined
    }

    let active = true

    async function loadSavedState() {
      setChecking(true)
      const { saved: isSaved } = await isListingSaved(user.id, listing.id)

      if (active) {
        setSaved(isSaved)
        setChecking(false)
      }
    }

    loadSavedState()

    return () => {
      active = false
    }
  }, [user?.id, listing?.id, isOwner])

  if (!listing?.id || isOwner) {
    return null
  }

  async function handleClick(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!user?.id) {
      openLoginModal({
        redirectTo: `${location.pathname}${location.search}${location.hash}`,
      })
      return
    }

    if (loading || checking) return

    setLoading(true)

    if (saved) {
      const { error } = await unsaveListing(user.id, listing.id)
      setLoading(false)

      if (!error) {
        setSaved(false)
        onSavedChange?.(false)
      }

      return
    }

    const { error } = await saveListing(user.id, listing.id)
    setLoading(false)

    if (error) {
      window.alert(getSavedListingErrorMessage(error))
      return
    }

    setSaved(true)
    onSavedChange?.(true)
  }

  return (
    <button
      type="button"
      className={`listing-save-button${saved ? ' listing-save-button--saved' : ''}${className ? ` ${className}` : ''}`}
      aria-label={saved ? 'Remove from saved listings' : 'Save listing'}
      aria-pressed={saved}
      disabled={loading || checking}
      onClick={handleClick}
    >
      <HeartIcon className="listing-save-button__icon" />
    </button>
  )
}

export default ListingSaveButton
