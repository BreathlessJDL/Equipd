import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import '../components/ListingDetail.css'
import '../components/PageStub.css'
import {
  fetchListingBySlug,
  getListingErrorMessage,
  incrementListingViews,
  isListingOwner,
} from '../lib/listings'
import {
  getMessageErrorMessage,
  resolveMessageThreadNavigation,
} from '../lib/messages'
import { fetchOffersForListing, hasPendingOffer } from '../lib/offers'
import { useAuth } from '../hooks/useAuth'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { useProfileBrowseLocation } from '../hooks/useProfileBrowseLocation'
import BuyerOrderConfirmation from '../components/BuyerOrderConfirmation'
import ListingImageGallery from '../components/listing/ListingImageGallery'
import ListingItemSummary from '../components/listing/ListingItemSummary'
import ListingDetailSaveButton from '../components/listing/ListingDetailSaveButton'
import ListingRecommendations from '../components/listing/ListingRecommendations'
import ListingSavedCountOverlay from '../components/listing/ListingSavedCountOverlay'
import ListingSellerDescription from '../components/listing/ListingSellerDescription'
import MakeOfferModal from '../components/listing/MakeOfferModal'
import OfferSentConfirmationModal from '../components/listing/OfferSentConfirmationModal'
import ListingSaveButton from '../components/ListingSaveButton'
import ReportTrigger from '../components/ReportTrigger'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import { ErrorState, LoadingState } from '../components/ui/UiState'
import { canBuyerConfirmOrder, isOrderBuyerConfirmed, isOrderCompleted } from '../lib/orders'
import { useListingRecommendations } from '../hooks/useListingRecommendations'
import { usePageTitle } from '../hooks/usePageTitle'
import { buildListingBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import { fetchListingSavedCount } from '../lib/savedListings'
import { canReportListing, REPORT_TYPES } from '../lib/reports'

function ListingDetailPage() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const { user } = useAuth()
  const { requireAuth } = useRequireAuth()
  const profileLocation = useProfileBrowseLocation()
  const buyerProfile = {
    latitude: profileLocation.latitude,
    longitude: profileLocation.longitude,
  }
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [startingConversation, setStartingConversation] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [offers, setOffers] = useState([])
  const [offerModalOpen, setOfferModalOpen] = useState(false)
  const [offerConfirmationOpen, setOfferConfirmationOpen] = useState(false)
  const [submittedConversationId, setSubmittedConversationId] = useState(null)
  const [savedCount, setSavedCount] = useState(0)
  const incrementedSlugRef = useRef(null)

  usePageTitle(listing?.title ?? (loading ? null : 'Listing Not Found'))

  const breadcrumbSchema = useMemo(
    () => (listing ? buildListingBreadcrumbSchema(listing) : null),
    [listing],
  )

  useEffect(() => {
    if (!slug) return undefined

    let active = true

    async function loadListing() {
      setLoading(true)
      setLoadError('')

      const { data, error } = await fetchListingBySlug(slug)

      if (!active) return

      if (error) {
        setLoadError(getListingErrorMessage(error))
        setListing(null)
        setLoading(false)
        return
      }

      if (!data) {
        setLoadError('Listing not found.')
        setListing(null)
        setLoading(false)
        return
      }

      setListing(data)
      setLoading(false)
    }

    loadListing()

    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    if (!listing?.id) {
      setSavedCount(0)
      return undefined
    }

    let active = true

    async function loadSavedCount() {
      const initialCount =
        typeof listing.saved_count === 'number' ? Math.max(0, listing.saved_count) : null

      if (initialCount != null) {
        setSavedCount(initialCount)
      }

      const { count, error } = await fetchListingSavedCount(listing.id)

      if (!active) return

      if (!error) {
        setSavedCount(count)
      } else if (initialCount == null) {
        setSavedCount(0)
      }
    }

    loadSavedCount()

    return () => {
      active = false
    }
  }, [listing?.id, listing?.saved_count])

  useEffect(() => {
    if (loading || !slug || !listing || listing.status !== 'active') return undefined
    if (incrementedSlugRef.current === slug) return undefined

    incrementedSlugRef.current = slug
    let active = true

    async function recordView() {
      const { error } = await incrementListingViews(slug)

      if (!active) return

      if (error) {
        incrementedSlugRef.current = null
        return
      }

      setListing((current) =>
        current && current.slug === slug
          ? { ...current, views_count: (current.views_count ?? 0) + 1 }
          : current,
      )
    }

    recordView()

    return () => {
      active = false
    }
  }, [slug, loading, listing?.id, listing?.status])

  useEffect(() => {
    if (!listing?.id || !user?.id) {
      setOffers([])
      return undefined
    }

    const isOwner = listing.seller_id === user.id
    const canViewOffers = isOwner || listing.status === 'active' || listing.status === 'reserved' || listing.status === 'in_progress'

    if (!canViewOffers) {
      setOffers([])
      return undefined
    }

    let active = true

    async function loadOffers() {
      const { data, error } = await fetchOffersForListing(listing.id)

      if (!active) return

      if (error) {
        setOffers([])
        return
      }

      setOffers(data ?? [])
    }

    loadOffers()

    return () => {
      active = false
    }
  }, [listing?.id, listing?.seller_id, listing?.status, user?.id])

  async function handleMessageSeller() {
    if (!listing) return
    if (!requireAuth(`/listings/${listing.slug}`)) return
    if (!user?.id) return

    setStartingConversation(true)
    setMessageError('')

    const { path, error } = await resolveMessageThreadNavigation({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
    })

    setStartingConversation(false)

    if (error) {
      setMessageError(getMessageErrorMessage(error))
      return
    }

    navigate(path)
  }

  async function reloadOffers() {
    if (!listing?.id || !slug) return

    const [offersResult, listingResult] = await Promise.all([
      fetchOffersForListing(listing.id),
      fetchListingBySlug(slug),
    ])

    if (!offersResult.error) {
      setOffers(offersResult.data ?? [])
    }

    if (!listingResult.error && listingResult.data) {
      setListing(listingResult.data)
    }
  }

  const buyerConfirmableOffer = useMemo(() => {
    if (!user?.id) return null

    return (
      offers.find(
        (offer) =>
          offer.buyer_id === user.id &&
          offer.status === 'accepted' &&
          canBuyerConfirmOrder(offer.order, offer.payment),
      ) ?? null
    )
  }, [offers, user?.id])

  const buyerConfirmedOffer = useMemo(() => {
    if (!user?.id) return null

    return (
      offers.find(
        (offer) =>
          offer.buyer_id === user.id &&
          offer.status === 'accepted' &&
          isOrderBuyerConfirmed(offer.order) &&
          !isOrderCompleted(offer.order),
      ) ?? null
    )
  }, [offers, user?.id])

  const buyerCompletedOffer = useMemo(() => {
    if (!user?.id) return null

    return (
      offers.find(
        (offer) =>
          offer.buyer_id === user.id &&
          offer.status === 'accepted' &&
          isOrderCompleted(offer.order),
      ) ?? null
    )
  }, [offers, user?.id])

  const { recommendations, loading: loadingRecommendations } = useListingRecommendations(listing)

  if (loading) {
    return (
      <section className="page-stub">
        <LoadingState>Loading listing…</LoadingState>
      </section>
    )
  }

  if (loadError || !listing) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Listing not found</h2>
        <ErrorState>{loadError || 'This listing could not be found.'}</ErrorState>
        <p className="page-stub__lead">
          <Link to="/">Back to browse</Link>
        </p>
      </section>
    )
  }

  const isOwner = isListingOwner(listing, user?.id)
  const isActiveListing = listing.status === 'active'
  const canContactSeller = isActiveListing && !isOwner
  const buyerHasPendingOffer = user ? hasPendingOffer(offers, user.id) : false

  function handleSavedChange(saved) {
    setSavedCount((current) => (saved ? current + 1 : Math.max(0, current - 1)))
  }

  function handleOfferSubmitted(result) {
    setOfferModalOpen(false)
    setOffers((current) => [result.offer, ...current])
    setSubmittedConversationId(result.conversation?.id ?? null)
    setOfferConfirmationOpen(true)
  }

  const summaryActions = (
    <>
      {isOwner ? (
        <Link
          to={`/listings/${listing.slug}/edit`}
          className="listing-detail__button listing-detail__button--primary"
        >
          Edit listing
        </Link>
      ) : null}

      {canContactSeller ? (
        <button
          type="button"
          className="listing-detail__button listing-detail__button--primary"
          disabled={startingConversation}
          onClick={handleMessageSeller}
        >
          {startingConversation ? 'Opening conversation…' : 'Message seller'}
        </button>
      ) : null}

      {canContactSeller ? (
        <button
          type="button"
          className="listing-detail__button listing-detail__button--secondary"
          onClick={() => {
            if (!requireAuth(`/listings/${listing.slug}`)) return
            setOfferModalOpen(true)
          }}
        >
          Make an offer
        </button>
      ) : null}

      {canContactSeller ? (
        <ListingDetailSaveButton listing={listing} onSavedChange={handleSavedChange} />
      ) : null}

      {messageError ? (
        <p className="listing-detail__message listing-detail__message--error" role="alert">
          {messageError}
        </p>
      ) : null}
    </>
  )

  return (
    <article className="listing-detail">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <div className="listing-detail__hero">
        <div className="listing-detail__primary">
          <div className="listing-detail__media">
            <ListingImageGallery
              images={listing.listing_images ?? []}
              title={listing.title}
              savedCountOverlay={<ListingSavedCountOverlay count={savedCount} />}
              saveButton={
                !isOwner && listing.status === 'active' ? (
                  <ListingSaveButton
                    listing={listing}
                    className="listing-save-button--detail"
                    onSavedChange={handleSavedChange}
                  />
                ) : null
              }
            />
            {(listing.listing_images?.length ?? 0) > 0 ? (
              <p className="listing-detail__image-note" role="note">
                <svg
                  className="listing-detail__image-note-icon"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
                  <path
                    d="M8 7.25v4M8 5.25h.01"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                  />
                </svg>
                <span>Photos shown are of the actual item being sold by the seller.</span>
              </p>
            ) : null}
          </div>

          <ListingSellerDescription listing={listing} />
        </div>

        <ListingItemSummary
          listing={listing}
          buyerProfile={buyerProfile}
          viewerUserId={user?.id ?? null}
          isOwner={isOwner}
          actions={summaryActions}
          reportListing={
            canReportListing(listing, user?.id) ? (
              <ReportTrigger
                reportType={REPORT_TYPES.LISTING}
                listingId={listing.id}
                label="Report listing"
                className="report-trigger listing-summary__report"
              />
            ) : null
          }
        />
      </div>

      {!isOwner && buyerConfirmableOffer?.order?.id ? (
        <section className="listing-detail__section listing-detail__panel">
          <h2 className="listing-detail__section-title">Your order</h2>
          <p className="listing-detail__message listing-detail__message--success" role="status">
            Paid — awaiting collection/delivery confirmation
          </p>
          <BuyerOrderConfirmation
            orderId={buyerConfirmableOffer.order.id}
            onConfirmed={reloadOffers}
          />
        </section>
      ) : null}

      {!isOwner && !buyerConfirmableOffer && buyerConfirmedOffer ? (
        <section className="listing-detail__section">
          <p className="listing-detail__message listing-detail__message--success" role="status">
            You confirmed receipt — payout pending
          </p>
        </section>
      ) : null}

      {!isOwner && buyerCompletedOffer ? (
        <section className="listing-detail__section">
          <p className="listing-detail__message listing-detail__message--success" role="status">
            Purchase completed
          </p>
        </section>
      ) : null}

      <ListingRecommendations
        recommendations={recommendations}
        loading={loadingRecommendations}
        placement="desktop"
      />

      <ListingRecommendations
        recommendations={recommendations}
        loading={loadingRecommendations}
        placement="mobile"
      />

      <MakeOfferModal
        open={offerModalOpen}
        listing={listing}
        user={user}
        buyerHasPendingOffer={buyerHasPendingOffer}
        onClose={() => setOfferModalOpen(false)}
        onSubmitted={handleOfferSubmitted}
      />

      <OfferSentConfirmationModal
        open={offerConfirmationOpen}
        conversationId={submittedConversationId}
        onClose={() => {
          setOfferConfirmationOpen(false)
          setSubmittedConversationId(null)
        }}
      />
    </article>
  )
}

export default ListingDetailPage
