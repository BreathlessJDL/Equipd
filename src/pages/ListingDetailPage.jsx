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
import { clampOfferQuantity, fetchOffersForListing, hasPendingOffer } from '../lib/offers'
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
import ListingEquipmentIntelligence from '../components/listing/ListingEquipmentIntelligence'
import MakeOfferModal from '../components/listing/MakeOfferModal'
import OfferSentConfirmationModal from '../components/listing/OfferSentConfirmationModal'
import ListingSaveButton from '../components/ListingSaveButton'
import ReportTrigger from '../components/ReportTrigger'
import PageBreadcrumbs from '../components/PageBreadcrumbs'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import ProductSchema from '../components/seo/ProductSchema'
import { ErrorState, LoadingState } from '../components/ui/UiState'
import { canBuyerConfirmOrder, isOrderBuyerConfirmed, isOrderCompleted } from '../lib/orders'
import { useListingRecommendations } from '../hooks/useListingRecommendations'
import { usePageMeta } from '../hooks/usePageMeta'
import { buildListingBreadcrumbSchema, buildListingBreadcrumbItems } from '../lib/breadcrumbStructuredData'
import { buildListingPageSeo } from '../lib/listingPageSeo'
import { buildListingProductSchema } from '../lib/listingPageStructuredData'
import { getListingValuationHref, resolveListingProductMapping } from '../lib/listingDiscovery'
import { isSoldListingStatus } from '../lib/listingSoldLifecycle'
import { fetchApprovedEquipmentProductForListing } from '../lib/equipmentProducts'
import { fetchPublicProfile } from '../lib/profiles'
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
  const [selectedOfferQuantity, setSelectedOfferQuantity] = useState(1)
  const [quantityValidationError, setQuantityValidationError] = useState('')
  const [submittedConversationId, setSubmittedConversationId] = useState(null)
  const [submittedOfferQuantity, setSubmittedOfferQuantity] = useState(1)
  const [savedCount, setSavedCount] = useState(0)
  const [sellerPublicProfile, setSellerPublicProfile] = useState(null)
  const [equipmentProduct, setEquipmentProduct] = useState(null)
  const incrementedSlugRef = useRef(null)

  const listingSeo = useMemo(
    () => buildListingPageSeo({ listing: listing || null, equipmentProduct }),
    [listing, equipmentProduct],
  )

  usePageMeta({
    title: listing
      ? listingSeo.titleForHook
      : (loading ? null : 'Listing Not Found'),
    description: listing
      ? listingSeo.description
      : (loading
        ? null
        : 'This listing could not be found on Equipd.'),
    canonicalPath: listing ? listingSeo.canonicalPath : null,
    noIndex: loading || !listing || listingSeo.noIndex,
    robotsContent: listing ? listingSeo.robotsContent : (loading ? null : 'noindex, follow'),
    openGraph: listing ? listingSeo.openGraph : null,
  })

  const breadcrumbSchema = useMemo(
    () => (listing ? buildListingBreadcrumbSchema(listing) : null),
    [listing],
  )

  const breadcrumbItems = useMemo(() => {
    if (!listing) return []
    const items = buildListingBreadcrumbItems(listing)
    return items.map((item, index) => ({
      label: item.name,
      to: index < items.length - 1 ? item.path : undefined,
    }))
  }, [listing])

  const productSchema = useMemo(
    () => (
      listing
        ? buildListingProductSchema({
          listing,
          equipmentProduct,
          canonicalUrl: listingSeo.canonicalUrl,
          sellerProfile: sellerPublicProfile,
        })
        : null
    ),
    [listing, equipmentProduct, listingSeo.canonicalUrl, sellerPublicProfile],
  )

  useEffect(() => {
    if (!listing?.seller_id) {
      setSellerPublicProfile(null)
      return undefined
    }

    let active = true
    setSellerPublicProfile(null)

    async function loadSellerProfile() {
      const { data } = await fetchPublicProfile(listing.seller_id)
      if (!active) return
      setSellerPublicProfile(data || null)
    }

    loadSellerProfile()

    return () => {
      active = false
    }
  }, [listing?.seller_id])

  useEffect(() => {
    if (!listing) {
      setEquipmentProduct(null)
      return undefined
    }

    const mapping = resolveListingProductMapping(listing)
    if (!mapping.hasMapping) {
      setEquipmentProduct(null)
      return undefined
    }

    let active = true
    setEquipmentProduct(null)

    async function loadEquipmentProduct() {
      const { product } = await fetchApprovedEquipmentProductForListing(listing)
      if (!active) return
      setEquipmentProduct(product || null)
    }

    loadEquipmentProduct()

    return () => {
      active = false
    }
  }, [listing?.id, listing?.equipment_product_id, listing?.canonical_product_key])

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
    if (!listing?.id) return undefined

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
  }, [slug, loading, listing])

  useEffect(() => {
    if (!listing?.id || !user?.id) return undefined

    const isOwner = listing.seller_id === user.id
    const canViewOffers = isOwner || listing.status === 'active' || listing.status === 'reserved' || listing.status === 'in_progress'

    if (!canViewOffers) return undefined

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
  }, [offers, user])

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
  }, [offers, user])

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
  }, [offers, user])

  const { recommendations, loading: loadingRecommendations } = useListingRecommendations(
    listing,
    equipmentProduct,
  )

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
  const isSoldListing = isSoldListingStatus(listing)
  const canContactSeller = isActiveListing && !isOwner
  const valuationHref = getListingValuationHref(listing, equipmentProduct)
  const buyerHasPendingOffer = user ? hasPendingOffer(offers, user.id) : false
  const selectedQuantity = clampOfferQuantity(
    selectedOfferQuantity,
    listing.quantity_available ?? 1,
  )

  function handleSavedChange(saved) {
    setSavedCount((current) => (saved ? current + 1 : Math.max(0, current - 1)))
  }

  function handleOfferSubmitted(result) {
    setOfferModalOpen(false)
    setOffers((current) => [result.offer, ...current])
    setSubmittedConversationId(result.conversation?.id ?? null)
    setSubmittedOfferQuantity(result.offer?.quantity ?? 1)
    setSelectedOfferQuantity(1)
    setOfferConfirmationOpen(true)
  }

  const summaryActions = (
    <>
      {isSoldListing ? (
        <>
          <a
            href="#listing-similar-listings"
            className="listing-detail__button listing-detail__button--primary"
          >
            View Similar Listings
          </a>
          <Link
            to={valuationHref}
            className="listing-detail__button listing-detail__button--secondary"
          >
            Value This Equipment
          </Link>
        </>
      ) : null}

      {!isSoldListing && isOwner ? (
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

      {quantityValidationError ? (
        <p className="listing-detail__message listing-detail__message--error" role="alert">
          {quantityValidationError}
        </p>
      ) : null}
    </>
  )

  return (
    <article className="listing-detail">
      <ProductSchema schema={productSchema} />
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <PageBreadcrumbs items={breadcrumbItems} className="listing-detail__breadcrumbs" />
      <div className="listing-detail__hero">
        <div className="listing-detail__primary">
          <div className="listing-detail__media">
            <ListingImageGallery
              images={listing.listing_images ?? []}
              title={listingSeo.imageAlt || listing.title}
              imageAlt={listingSeo.imageAlt || listing.title}
              savedCountOverlay={
                isSoldListing ? null : <ListingSavedCountOverlay count={savedCount} />
              }
              saveButton={
                !isSoldListing && !isOwner && listing.status === 'active' ? (
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
                <span>
                  {isSoldListing
                    ? 'Photos shown are of the item that was sold on Equipd.'
                    : 'Photos shown are of the actual item being sold by the seller.'}
                </span>
              </p>
            ) : null}
          </div>

          <ListingSellerDescription listing={listing} />
          <ListingEquipmentIntelligence
            listing={listing}
            equipmentProduct={equipmentProduct}
          />
        </div>

        <ListingItemSummary
          listing={listing}
          equipmentProduct={equipmentProduct}
          buyerProfile={buyerProfile}
          viewerUserId={user?.id ?? null}
          isOwner={isOwner}
          selectedQuantity={selectedQuantity}
          onSelectedQuantityChange={
            canContactSeller
              ? (quantity) => {
                  setQuantityValidationError('')
                  setSelectedOfferQuantity(
                    clampOfferQuantity(quantity, listing.quantity_available ?? 1),
                  )
                }
              : null
          }
          onQuantityValidationError={setQuantityValidationError}
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
        showWhenEmpty={isSoldListing}
      />

      <ListingRecommendations
        recommendations={recommendations}
        loading={loadingRecommendations}
        placement="mobile"
        showWhenEmpty={isSoldListing}
      />

      <MakeOfferModal
        open={offerModalOpen}
        listing={listing}
        user={user}
        buyerHasPendingOffer={buyerHasPendingOffer}
        quantity={selectedQuantity}
        onQuantityChange={(quantity) => {
          setQuantityValidationError('')
          setSelectedOfferQuantity(
            clampOfferQuantity(quantity, listing.quantity_available ?? 1),
          )
        }}
        onAvailabilityChanged={(availableQuantity) => {
          setListing((current) =>
            current ? { ...current, quantity_available: availableQuantity } : current,
          )
          setSelectedOfferQuantity((current) =>
            clampOfferQuantity(current, availableQuantity),
          )
        }}
        onClose={() => setOfferModalOpen(false)}
        onSubmitted={handleOfferSubmitted}
      />

      <OfferSentConfirmationModal
        open={offerConfirmationOpen}
        conversationId={submittedConversationId}
        quantity={submittedOfferQuantity}
        onClose={() => {
          setOfferConfirmationOpen(false)
          setSubmittedConversationId(null)
          setSubmittedOfferQuantity(1)
        }}
      />
    </article>
  )
}

export default ListingDetailPage
