import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubOfferList, HubSection } from '../components/HubSections'
import ListingCard from '../components/ListingCard'
import '../components/Hub.css'
import '../components/ListingBrowse.css'
import { useAuth } from '../hooks/useAuth'
import { fetchMyListings, getListingErrorMessage } from '../lib/listings'
import {
  fetchBuyerOffers,
  fetchSellerOffers,
  getOfferErrorMessage,
} from '../lib/offers'

function HubPage() {
  const { user } = useAuth()
  const [myListings, setMyListings] = useState([])
  const [pendingOffersMade, setPendingOffersMade] = useState([])
  const [acceptedOffersMade, setAcceptedOffersMade] = useState([])
  const [offersReceived, setOffersReceived] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function loadHubData() {
      setLoading(true)
      setError('')

      const [
        listingsResult,
        pendingMadeResult,
        acceptedMadeResult,
        receivedResult,
      ] = await Promise.all([
        fetchMyListings(user.id),
        fetchBuyerOffers(user.id, 'pending'),
        fetchBuyerOffers(user.id, 'accepted'),
        fetchSellerOffers(user.id, 'pending'),
      ])

      if (!active) return

      const firstError =
        listingsResult.error ??
        pendingMadeResult.error ??
        acceptedMadeResult.error ??
        receivedResult.error

      if (firstError) {
        setError(getListingErrorMessage(firstError) || getOfferErrorMessage(firstError))
        setMyListings([])
        setPendingOffersMade([])
        setAcceptedOffersMade([])
        setOffersReceived([])
        setLoading(false)
        return
      }

      setMyListings(listingsResult.data ?? [])
      setPendingOffersMade(pendingMadeResult.data ?? [])
      setAcceptedOffersMade(acceptedMadeResult.data ?? [])
      setOffersReceived(receivedResult.data ?? [])
      setLoading(false)
    }

    loadHubData()

    return () => {
      active = false
    }
  }, [user?.id])

  const soldListings = useMemo(
    () => myListings.filter((listing) => listing.status === 'sold'),
    [myListings],
  )

  if (loading) {
    return (
      <section className="hub-page">
        <header className="hub-page__header">
          <h2 className="hub-page__title">Hub</h2>
          <p className="hub-page__lead">Loading your buyer and seller activity…</p>
        </header>
      </section>
    )
  }

  return (
    <section className="hub-page">
      <header className="hub-page__header">
        <h2 className="hub-page__title">Hub</h2>
        <p className="hub-page__lead">
          Your listings, offers, and completed sales in one place.
        </p>
        <p className="hub-page__quick-links">
          <Link to="/saved-listings">Saved listings</Link>
        </p>
      </header>

      {error ? (
        <p className="hub-page__message hub-page__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {!error ? (
        <div className="hub-page__sections">
          <HubSection
            title="My listings"
            lead="Everything you are selling on Equipd."
            linkTo="/my-listings"
            linkLabel="Manage all"
          >
            {myListings.length === 0 ? (
              <p className="hub-section__empty">
                You have not created any listings yet.{' '}
                <Link to="/listings/new">List your equipment</Link>
              </p>
            ) : (
              <div className="listing-browse__grid">
                {myListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} showStatus />
                ))}
              </div>
            )}
          </HubSection>

          <HubSection
            title="Pending offers I made"
            lead="Offers you have submitted that are still awaiting a response."
          >
            <HubOfferList
              offers={pendingOffersMade}
              emptyMessage="You do not have any pending offers."
            />
          </HubSection>

          <HubSection
            title="Accepted offers I made"
            lead="Offers you made that sellers have accepted."
          >
            <HubOfferList
              offers={acceptedOffersMade}
              showPaymentNotice
              emptyMessage="You do not have any accepted offers yet."
            />
          </HubSection>

          <HubSection
            title="Offers received on my listings"
            lead="Pending offers from buyers on your active listings."
          >
            <HubOfferList
              offers={offersReceived}
              emptyMessage="You have not received any pending offers."
            />
          </HubSection>

          <HubSection title="Sold items" lead="Listings you have marked as sold.">
            {soldListings.length === 0 ? (
              <p className="hub-section__empty">You have not sold any listings yet.</p>
            ) : (
              <div className="listing-browse__grid">
                {soldListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} showStatus />
                ))}
              </div>
            )}
          </HubSection>

          <HubSection
            title="Purchased items"
            lead="Accepted offers where you are the buyer."
          >
            <HubOfferList
              offers={acceptedOffersMade}
              showPaymentNotice
              emptyMessage="You have not purchased anything through an accepted offer yet."
            />
          </HubSection>
        </div>
      ) : null}
    </section>
  )
}

export default HubPage
