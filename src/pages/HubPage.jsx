import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { isPaymentComplete } from '../lib/payments'
import {
  canBuyerConfirmOrder,
  isOrderAwaitingConfirmation,
  isOrderBuyerConfirmed,
  isOrderCompleted,
} from '../lib/orders'
import { fetchProfile } from '../lib/profiles'
import { createCheckoutSession, getStripeApiErrorMessage } from '../lib/stripe-api'

function HubPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [myListings, setMyListings] = useState([])
  const [pendingOffersMade, setPendingOffersMade] = useState([])
  const [acceptedOffersMade, setAcceptedOffersMade] = useState([])
  const [offersReceived, setOffersReceived] = useState([])
  const [acceptedOffersReceived, setAcceptedOffersReceived] = useState([])
  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingPaymentId, setPayingPaymentId] = useState(null)
  const [payError, setPayError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')
  const handledPaymentParamRef = useRef(false)

  const loadHubData = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    const [
      listingsResult,
      pendingMadeResult,
      acceptedMadeResult,
      receivedResult,
      acceptedReceivedResult,
      profileResult,
    ] = await Promise.all([
      fetchMyListings(user.id),
      fetchBuyerOffers(user.id, 'pending'),
      fetchBuyerOffers(user.id, 'accepted'),
      fetchSellerOffers(user.id, 'pending'),
      fetchSellerOffers(user.id, 'accepted'),
      fetchProfile(user.id, { email: user.email }),
    ])

    const firstError =
      listingsResult.error ??
      pendingMadeResult.error ??
      acceptedMadeResult.error ??
      receivedResult.error ??
      acceptedReceivedResult.error ??
      profileResult.error

    if (firstError) {
      setError(getListingErrorMessage(firstError) || getOfferErrorMessage(firstError))
      setMyListings([])
      setPendingOffersMade([])
      setAcceptedOffersMade([])
      setOffersReceived([])
      setAcceptedOffersReceived([])
      setStripeOnboardingComplete(false)
      setLoading(false)
      return
    }

    setMyListings(listingsResult.data ?? [])
    setPendingOffersMade(pendingMadeResult.data ?? [])
    setAcceptedOffersMade(acceptedMadeResult.data ?? [])
    setOffersReceived(receivedResult.data ?? [])
    setAcceptedOffersReceived(acceptedReceivedResult.data ?? [])
    setStripeOnboardingComplete(profileResult.data?.stripe_onboarding_complete ?? false)
    setLoading(false)

    if (!handledPaymentParamRef.current) {
      const paymentResult = searchParams.get('payment')

      if (paymentResult === 'success') {
        handledPaymentParamRef.current = true
        setPaymentNotice(
          'Payment received. Your order will appear below once Stripe confirms payment.',
        )
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('payment')
        nextParams.delete('session_id')
        setSearchParams(nextParams, { replace: true })
      } else if (paymentResult === 'cancelled') {
        handledPaymentParamRef.current = true
        setPaymentNotice('Checkout was cancelled. You can pay any time before the deadline.')
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('payment')
        setSearchParams(nextParams, { replace: true })
      }
    }
  }, [searchParams, setSearchParams, user])

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function load() {
      await loadHubData()
      if (!active) return
    }

    load()

    return () => {
      active = false
    }
  }, [loadHubData, user?.id])

  const soldListings = useMemo(
    () => myListings.filter((listing) => listing.status === 'sold'),
    [myListings],
  )

  const acceptedUnpaidOffers = useMemo(
    () => acceptedOffersMade.filter((offer) => !isPaymentComplete(offer.payment)),
    [acceptedOffersMade],
  )

  const activeBuyerOrders = useMemo(
    () =>
      acceptedOffersMade.filter((offer) => canBuyerConfirmOrder(offer.order, offer.payment)),
    [acceptedOffersMade],
  )

  const confirmedBuyerOrders = useMemo(
    () =>
      acceptedOffersMade.filter(
        (offer) =>
          isPaymentComplete(offer.payment) &&
          isOrderBuyerConfirmed(offer.order) &&
          !isOrderCompleted(offer.order),
      ),
    [acceptedOffersMade],
  )

  const completedBuyerOrders = useMemo(
    () =>
      acceptedOffersMade.filter(
        (offer) =>
          isPaymentComplete(offer.payment) && isOrderCompleted(offer.order),
      ),
    [acceptedOffersMade],
  )

  const activeSellerSales = useMemo(
    () =>
      acceptedOffersReceived.filter((offer) => {
        if (!isPaymentComplete(offer.payment) || isOrderCompleted(offer.order)) {
          return false
        }

        return (
          isOrderAwaitingConfirmation(offer.order, offer.payment) ||
          isOrderBuyerConfirmed(offer.order)
        )
      }),
    [acceptedOffersReceived],
  )

  const showPayoutSetupBanner = useMemo(
    () =>
      !stripeOnboardingComplete &&
      myListings.some((listing) => listing.status === 'reserved'),
    [myListings, stripeOnboardingComplete],
  )

  async function handlePayNow(paymentId) {
    setPayingPaymentId(paymentId)
    setPayError('')

    const { url, error: checkoutError } = await createCheckoutSession(paymentId)

    if (checkoutError) {
      setPayingPaymentId(null)
      setPayError(getStripeApiErrorMessage(checkoutError))
      return
    }

    globalThis.location.assign(url)
  }

  async function handleConfirmOrder() {
    await loadHubData()
  }

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
          Your listings, offers, and orders in one place.
        </p>
        <p className="hub-page__quick-links">
          <Link to="/saved-listings">Saved listings</Link>
        </p>
      </header>

      {paymentNotice ? (
        <p className="hub-page__message hub-page__message--success" role="status">
          {paymentNotice}
        </p>
      ) : null}

      {showPayoutSetupBanner ? (
        <p className="hub-page__message hub-page__message--notice" role="status">
          A buyer is waiting to pay on a reserved listing.{' '}
          <Link to="/profile">Complete payout setup</Link> so checkout can begin.
        </p>
      ) : null}

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
            lead="Accepted offers awaiting payment. Pay before the deadline shown."
          >
            <HubOfferList
              offers={acceptedUnpaidOffers}
              showPaymentStatus
              onPayNow={handlePayNow}
              payingPaymentId={payingPaymentId}
              payError={payError}
              emptyMessage="You do not have any accepted offers awaiting payment."
            />
          </HubSection>

          <HubSection
            title="Orders"
            lead="Paid purchases. Confirm once you have collected or received your item."
          >
            {activeBuyerOrders.length > 0 ? (
              <>
                <h4 className="hub-section__subtitle">Awaiting your confirmation</h4>
                <HubOfferList
                  offers={activeBuyerOrders}
                  orderStatusRole="buyer"
                  showBuyerConfirm
                  onConfirmOrder={handleConfirmOrder}
                  emptyMessage=""
                />
              </>
            ) : null}
            {confirmedBuyerOrders.length > 0 ? (
              <>
                <h4 className="hub-section__subtitle">Confirmed</h4>
                <HubOfferList
                  offers={confirmedBuyerOrders}
                  orderStatusRole="buyer"
                  emptyMessage=""
                />
              </>
            ) : null}
            {activeBuyerOrders.length === 0 && confirmedBuyerOrders.length === 0 ? (
              <p className="hub-section__empty">You do not have any orders yet.</p>
            ) : null}
            {completedBuyerOrders.length > 0 ? (
              <>
                <h4 className="hub-section__subtitle">Completed purchases</h4>
                <HubOfferList
                  offers={completedBuyerOrders}
                  orderStatusRole="buyer"
                  emptyMessage=""
                />
              </>
            ) : null}
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

          <HubSection
            title="Active sales"
            lead="Paid sales awaiting buyer confirmation or seller payout setup."
          >
            <HubOfferList
              offers={activeSellerSales}
              orderStatusRole="seller"
              emptyMessage="You do not have any active sales awaiting confirmation."
            />
          </HubSection>

          <HubSection
            title="Sold items"
            lead="Listings fully completed after buyer confirmation and payout."
          >
            {soldListings.length === 0 ? (
              <p className="hub-section__empty">You have not fully completed any sales yet.</p>
            ) : (
              <div className="listing-browse__grid">
                {soldListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} showStatus />
                ))}
              </div>
            )}
          </HubSection>
        </div>
      ) : null}
    </section>
  )
}

export default HubPage
