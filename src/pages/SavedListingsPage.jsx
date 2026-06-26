import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import '../components/ListingBrowse.css'
import { useAuth } from '../hooks/useAuth'
import {
  fetchSavedListings,
  getSavedListingErrorMessage,
  partitionSavedListings,
  unsaveListing,
} from '../lib/savedListings'

function SavedListingsPage() {
  const { user } = useAuth()
  const [activeListings, setActiveListings] = useState([])
  const [unavailableSaved, setUnavailableSaved] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingListingId, setRemovingListingId] = useState(null)

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function loadSavedListings() {
      setLoading(true)
      setError('')

      const { data, error: savedError } = await fetchSavedListings(user.id)

      if (!active) return

      if (savedError) {
        setError(getSavedListingErrorMessage(savedError))
        setActiveListings([])
        setUnavailableSaved([])
        setLoading(false)
        return
      }

      const partitioned = partitionSavedListings(data ?? [])
      setActiveListings(partitioned.activeListings)
      setUnavailableSaved(partitioned.unavailableSaved)
      setLoading(false)
    }

    loadSavedListings()

    return () => {
      active = false
    }
  }, [user?.id])

  async function handleRemoveUnavailable(listingId) {
    if (!user?.id || removingListingId) return

    setRemovingListingId(listingId)
    setError('')

    const { error: removeError } = await unsaveListing(user.id, listingId)

    setRemovingListingId(null)

    if (removeError) {
      setError(getSavedListingErrorMessage(removeError))
      return
    }

    setUnavailableSaved((current) =>
      current.filter((saved) => saved.listing_id !== listingId),
    )
  }

  const hasAnySaved = activeListings.length > 0 || unavailableSaved.length > 0

  return (
    <section className="listing-browse">
      <header className="listing-browse__header">
        <h2 className="listing-browse__title">Saved listings</h2>
        <p className="listing-browse__lead">
          Active listings you have saved. Unavailable saved items are listed separately below.
        </p>
      </header>

      {loading ? (
        <p className="listing-browse__message listing-browse__message--empty">Loading saved listings…</p>
      ) : null}

      {!loading && error ? (
        <p className="listing-browse__message listing-browse__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasAnySaved ? (
        <p className="listing-browse__message listing-browse__message--empty">
          You have not saved any listings yet.{' '}
          <Link to="/" className="listing-browse__empty-link">
            Browse listings
          </Link>
        </p>
      ) : null}

      {!loading && !error && activeListings.length > 0 ? (
        <div className="listing-browse__grid">
          {activeListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} variant="home" />
          ))}
        </div>
      ) : null}

      {!loading && !error && activeListings.length === 0 && unavailableSaved.length > 0 ? (
        <p className="listing-browse__message listing-browse__message--empty">
          None of your saved listings are currently active.
        </p>
      ) : null}

      {!loading && !error && unavailableSaved.length > 0 ? (
        <section className="listing-browse__unavailable">
          <h3 className="listing-browse__unavailable-title">No longer available</h3>
          <p className="listing-browse__unavailable-lead">
            These saved listings are sold, archived, or no longer visible.
          </p>
          <ul className="listing-browse__unavailable-list">
            {unavailableSaved.map((saved) => (
              <li key={saved.id} className="listing-browse__unavailable-item">
                <div>
                  <p className="listing-browse__unavailable-label">
                    {saved.listing?.title ?? 'Listing no longer available'}
                  </p>
                  <p className="listing-browse__unavailable-meta">
                    Saved{' '}
                    {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(
                      new Date(saved.created_at),
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="listing-browse__unavailable-remove"
                  disabled={removingListingId === saved.listing_id}
                  onClick={() => handleRemoveUnavailable(saved.listing_id)}
                >
                  {removingListingId === saved.listing_id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}

export default SavedListingsPage
