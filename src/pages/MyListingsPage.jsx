import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import '../components/ListingBrowse.css'
import { useAuth } from '../hooks/useAuth'
import { fetchMyListings, getListingErrorMessage } from '../lib/listings'

function MyListingsPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function loadListings() {
      setLoading(true)
      setError('')

      const { data, error: listingsError } = await fetchMyListings(user.id)

      if (!active) return

      if (listingsError) {
        setError(getListingErrorMessage(listingsError))
        setListings([])
        setLoading(false)
        return
      }

      setListings(data ?? [])
      setLoading(false)
    }

    loadListings()

    return () => {
      active = false
    }
  }, [user?.id])

  return (
    <section className="listing-browse">
      <header className="listing-browse__header">
        <h2 className="listing-browse__title">My listings</h2>
        <p className="listing-browse__lead">Manage your draft, active, reserved, sold, and archived listings.</p>
      </header>

      {loading ? (
        <p className="listing-browse__message listing-browse__message--empty">Loading your listings…</p>
      ) : null}

      {!loading && error ? (
        <p className="listing-browse__message listing-browse__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && listings.length === 0 ? (
        <p className="listing-browse__message listing-browse__message--empty">
          You have not created any listings yet.{' '}
          <Link to="/listings/new" className="listing-browse__empty-link">
            List your equipment
          </Link>
        </p>
      ) : null}

      {!loading && !error && listings.length > 0 ? (
        <div className="listing-browse__grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} showStatus />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default MyListingsPage
