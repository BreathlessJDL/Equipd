import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAuthModal } from '../../hooks/useAuthModal'
import {
  getSavedListingErrorMessage,
  isListingSaved,
  saveListing,
  unsaveListing,
} from '../../lib/savedListings'
import { isListingOwner } from '../../lib/listings'

function ListingDetailSaveButton({ listing, className = '', onSavedChange }) {
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

  if (!listing?.id || isOwner || listing.status !== 'active') {
    return null
  }

  async function handleClick() {
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
      className={`listing-detail__button listing-detail__button--secondary listing-detail-save-button${
        saved ? ' listing-detail-save-button--saved' : ''
      }${className ? ` ${className}` : ''}`}
      aria-pressed={saved}
      disabled={loading || checking}
      onClick={handleClick}
    >
      {loading ? (saved ? 'Removing…' : 'Saving…') : saved ? 'Saved' : 'Add to saved'}
    </button>
  )
}

export default ListingDetailSaveButton
