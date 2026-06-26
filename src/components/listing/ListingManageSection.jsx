import { useState } from 'react'
import {
  deleteListing,
  formatListingStatus,
  getListingErrorMessage,
  isListingOwner,
  updateListing,
} from '../../lib/listings'

function ListingManageSection({ listing, userId, onListingChange, onDeleted }) {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!listing || !isListingOwner(listing, userId)) {
    return null
  }

  const canMarkReserved = listing.status === 'active' || listing.status === 'draft'
  const canMarkSold = listing.status !== 'sold' && listing.status !== 'archived'

  async function handleMarkReserved() {
    if (!canMarkReserved || updating) return

    setUpdating(true)
    setError('')
    setSuccess('')

    const { data, error: updateError } = await updateListing(listing.id, { status: 'reserved' })

    setUpdating(false)

    if (updateError) {
      setError(getListingErrorMessage(updateError))
      return
    }

    const nextListing = data ?? { ...listing, status: 'reserved' }
    onListingChange?.(nextListing)
    setSuccess(`Listing marked as ${formatListingStatus('reserved').toLowerCase()}.`)
  }

  async function handleMarkSold() {
    if (!canMarkSold || updating) return

    const confirmed = globalThis.confirm(
      'Mark this listing as sold? It will no longer appear for sale.',
    )

    if (!confirmed) return

    setUpdating(true)
    setError('')
    setSuccess('')

    const { data, error: updateError } = await updateListing(listing.id, { status: 'sold' })

    setUpdating(false)

    if (updateError) {
      setError(getListingErrorMessage(updateError))
      return
    }

    const nextListing = data ?? { ...listing, status: 'sold' }
    onListingChange?.(nextListing)
    setSuccess(`Listing marked as ${formatListingStatus('sold').toLowerCase()}.`)
  }

  async function handleDelete() {
    if (updating) return

    const confirmed = globalThis.confirm(
      'Permanently delete this listing? This cannot be undone.',
    )

    if (!confirmed) return

    setUpdating(true)
    setError('')
    setSuccess('')

    const { error: deleteError } = await deleteListing(listing.id)

    setUpdating(false)

    if (deleteError) {
      setError(getListingErrorMessage(deleteError))
      return
    }

    onDeleted?.()
  }

  return (
    <section className="listing-manage" aria-labelledby="listing-manage-title">
      <h2 id="listing-manage-title" className="listing-manage__title">
        Manage listing
      </h2>

      <div className="listing-manage__card">
        <div className="listing-manage__action">
          <button
            type="button"
            className="listing-manage__button listing-manage__button--secondary"
            disabled={updating || !canMarkReserved}
            onClick={handleMarkReserved}
          >
            {updating ? 'Updating…' : 'Mark as reserved'}
          </button>
          <p className="listing-manage__hint">
            Use when you have agreed a sale but payment has not completed through Equipd.
          </p>
        </div>

        <div className="listing-manage__action">
          <button
            type="button"
            className="listing-manage__button listing-manage__button--secondary"
            disabled={updating || !canMarkSold}
            onClick={handleMarkSold}
          >
            {updating ? 'Updating…' : 'Mark as sold'}
          </button>
          <p className="listing-manage__hint">
            Use only if this listing has been sold and should no longer appear for sale.
          </p>
        </div>

        <div className="listing-manage__danger">
          <h3 className="listing-manage__danger-title">Danger zone</h3>
          <button
            type="button"
            className="listing-manage__button listing-manage__button--danger"
            disabled={updating}
            onClick={handleDelete}
          >
            {updating ? 'Deleting…' : 'Delete listing'}
          </button>
          <p className="listing-manage__hint">Permanently remove this listing.</p>
        </div>
      </div>

      {error ? (
        <p className="listing-manage__message listing-manage__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="listing-manage__message listing-manage__message--success" role="status">
          {success}
        </p>
      ) : null}
    </section>
  )
}

export default ListingManageSection
