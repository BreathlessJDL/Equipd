import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import '../components/ListingDetail.css'
import '../components/PageStub.css'
import { LISTING_STATUSES } from '../lib/constants'
import {
  fetchListingBySlug,
  formatDeliveryOptionsLabel,
  formatListingStatus,
  formatPricePence,
  getConditionLabel,
  getListingErrorMessage,
  incrementListingViews,
  isListingOwner,
  updateListing,
  validateListingForPublish,
} from '../lib/listings'
import {
  getMessageErrorMessage,
  startConversationForListing,
} from '../lib/messages'
import { fetchOffersForListing, getOfferErrorMessage } from '../lib/offers'
import {
  getSavedListingErrorMessage,
  isListingSaved,
  saveListing,
  unsaveListing,
} from '../lib/savedListings'
import { useAuth } from '../hooks/useAuth'
import ListingOffersSection from '../components/ListingOffersSection'

function ListingDetailPage() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const { user } = useAuth()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [statusSuccess, setStatusSuccess] = useState('')
  const [startingConversation, setStartingConversation] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [offersError, setOffersError] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [loadingSavedState, setLoadingSavedState] = useState(false)
  const [savingListing, setSavingListing] = useState(false)
  const [saveError, setSaveError] = useState('')
  const incrementedSlugRef = useRef(null)

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
      setIsSaved(false)
      setLoadingSavedState(false)
      return undefined
    }

    if (isListingOwner(listing, user.id)) {
      setIsSaved(false)
      setLoadingSavedState(false)
      return undefined
    }

    let active = true

    async function loadSavedState() {
      setLoadingSavedState(true)
      setSaveError('')

      const { saved, error } = await isListingSaved(user.id, listing.id)

      if (!active) return

      if (error) {
        setSaveError(getSavedListingErrorMessage(error))
        setIsSaved(false)
        setLoadingSavedState(false)
        return
      }

      setIsSaved(saved)
      setLoadingSavedState(false)
    }

    loadSavedState()

    return () => {
      active = false
    }
  }, [listing?.id, listing?.seller_id, user?.id])

  useEffect(() => {
    if (!listing?.id || !user?.id) {
      setOffers([])
      return undefined
    }

    const isOwner = listing.seller_id === user.id
    const canViewOffers = isOwner || listing.status === 'active'

    if (!canViewOffers) {
      setOffers([])
      return undefined
    }

    let active = true

    async function loadOffers() {
      setLoadingOffers(true)
      setOffersError('')

      const { data, error } = await fetchOffersForListing(listing.id)

      if (!active) return

      if (error) {
        setOffersError(getOfferErrorMessage(error))
        setOffers([])
        setLoadingOffers(false)
        return
      }

      setOffers(data ?? [])
      setLoadingOffers(false)
    }

    loadOffers()

    return () => {
      active = false
    }
  }, [listing?.id, listing?.seller_id, listing?.status, user?.id])

  async function handleStatusChange(nextStatus) {
    if (!listing || listing.status === nextStatus) return

    setStatusUpdating(true)
    setStatusError('')
    setStatusSuccess('')

    if (nextStatus === 'active') {
      const validationErrors = validateListingForPublish({
        title: listing.title,
        categoryId: listing.category_id,
        pricePence: listing.price_pence,
        condition: listing.condition,
        location: listing.location,
      })

      if (validationErrors.length > 0) {
        setStatusUpdating(false)
        setStatusError(validationErrors.join(' '))
        return
      }
    }

    const { error } = await updateListing(listing.id, { status: nextStatus })

    if (error) {
      setStatusUpdating(false)
      setStatusError(getListingErrorMessage(error))
      return
    }

    const { data: refreshed, error: refreshError } = await fetchListingBySlug(slug)

    setStatusUpdating(false)

    if (refreshError || !refreshed) {
      setStatusError(getListingErrorMessage(refreshError ?? new Error('Failed to refresh listing.')))
      return
    }

    setListing(refreshed)
    setStatusSuccess(`Status updated to ${formatListingStatus(nextStatus)}.`)
  }

  async function handleMessageSeller() {
    if (!listing || !user?.id) return

    setStartingConversation(true)
    setMessageError('')

    const { data, error } = await startConversationForListing({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
    })

    setStartingConversation(false)

    if (error) {
      setMessageError(getMessageErrorMessage(error))
      return
    }

    navigate(`/messages/${data.id}`)
  }

  async function handleToggleSavedListing() {
    if (!listing || !user?.id || isListingOwner(listing, user.id) || savingListing) return

    setSavingListing(true)
    setSaveError('')

    if (isSaved) {
      const { error } = await unsaveListing(user.id, listing.id)

      setSavingListing(false)

      if (error) {
        setSaveError(getSavedListingErrorMessage(error))
        return
      }

      setIsSaved(false)
      return
    }

    const { error } = await saveListing(user.id, listing.id)

    setSavingListing(false)

    if (error) {
      setSaveError(getSavedListingErrorMessage(error))
      return
    }

    setIsSaved(true)
  }

  if (loading) {
    return (
      <section className="page-stub">
        <p className="page-stub__lead">Loading listing…</p>
      </section>
    )
  }

  if (loadError || !listing) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Listing not found</h2>
        <p className="listing-detail__message listing-detail__message--error" role="alert">
          {loadError || 'This listing could not be found.'}
        </p>
        <p className="page-stub__lead">
          <Link to="/">Back to browse</Link>
        </p>
      </section>
    )
  }

  const isOwner = isListingOwner(listing, user?.id)
  const canMessageSeller = Boolean(user && !isOwner && listing.status === 'active')
  const canSaveListing = Boolean(user && !isOwner && listing.status === 'active')

  return (
    <article className="listing-detail">
      {listing.listing_images?.length > 0 ? (
        <section className="listing-detail__gallery" aria-label="Listing photos">
          <img
            src={listing.primary_image_url}
            alt={listing.title}
            className="listing-detail__gallery-main"
          />
          {listing.listing_images.length > 1 ? (
            <div className="listing-detail__gallery-grid">
              {listing.listing_images.map((image) => (
                <img
                  key={image.id}
                  src={image.url}
                  alt=""
                  className="listing-detail__gallery-thumb"
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="listing-detail__header">
        <div>
          <span className="listing-detail__status">{formatListingStatus(listing.status)}</span>
          <h1 className="listing-detail__title">{listing.title}</h1>
          <p className="listing-detail__price">{formatPricePence(listing.price_pence)}</p>
        </div>
      </div>

      <dl className="listing-detail__meta">
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Brand</dt>
          <dd className="listing-detail__value">{listing.brand || '—'}</dd>
        </div>
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Model</dt>
          <dd className="listing-detail__value">{listing.model || '—'}</dd>
        </div>
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Category</dt>
          <dd className="listing-detail__value">{listing.category?.name || '—'}</dd>
        </div>
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Condition</dt>
          <dd className="listing-detail__value">{getConditionLabel(listing.condition)}</dd>
        </div>
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Location</dt>
          <dd className="listing-detail__value">{listing.location || '—'}</dd>
        </div>
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Collection &amp; delivery</dt>
          <dd className="listing-detail__value">{formatDeliveryOptionsLabel(listing)}</dd>
        </div>
        {listing.delivery_notes ? (
          <div className="listing-detail__row">
            <dt className="listing-detail__label">Delivery notes</dt>
            <dd className="listing-detail__value listing-detail__description">
              {listing.delivery_notes}
            </dd>
          </div>
        ) : null}
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Description</dt>
          <dd className="listing-detail__value listing-detail__description">
            {listing.description || '—'}
          </dd>
        </div>
        <div className="listing-detail__row">
          <dt className="listing-detail__label">Status</dt>
          <dd className="listing-detail__value">{formatListingStatus(listing.status)}</dd>
        </div>
        {isOwner ? (
          <div className="listing-detail__row">
            <dt className="listing-detail__label">Views</dt>
            <dd className="listing-detail__value">{listing.views_count ?? 0}</dd>
          </div>
        ) : null}
      </dl>

      {isOwner ? (
        <div className="listing-detail__owner-actions">
          <Link
            to={`/listings/${listing.slug}/edit`}
            className="listing-detail__button listing-detail__button--primary"
          >
            Edit listing
          </Link>

          <div>
            <p className="listing-detail__label">Change status</p>
            <div className="listing-detail__status-controls">
              {LISTING_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`listing-detail__button listing-detail__button--secondary${
                    listing.status === status ? ' listing-detail__button--active' : ''
                  }`}
                  disabled={statusUpdating || listing.status === status}
                  onClick={() => handleStatusChange(status)}
                >
                  {formatListingStatus(status)}
                </button>
              ))}
            </div>
          </div>

          {statusError ? (
            <p className="listing-detail__message listing-detail__message--error" role="alert">
              {statusError}
            </p>
          ) : null}

          {statusSuccess ? (
            <p className="listing-detail__message listing-detail__message--success" role="status">
              {statusSuccess}
            </p>
          ) : null}
        </div>
      ) : null}

      {canMessageSeller ? (
        <div className="listing-detail__owner-actions">
          <button
            type="button"
            className="listing-detail__button listing-detail__button--primary"
            disabled={startingConversation}
            onClick={handleMessageSeller}
          >
            {startingConversation ? 'Opening conversation…' : 'Message seller'}
          </button>

          {messageError ? (
            <p className="listing-detail__message listing-detail__message--error" role="alert">
              {messageError}
            </p>
          ) : null}
        </div>
      ) : null}

      {canSaveListing ? (
        <div className="listing-detail__owner-actions">
          <button
            type="button"
            className={`listing-detail__button listing-detail__button--secondary${
              isSaved ? ' listing-detail__button--active' : ''
            }`}
            disabled={loadingSavedState || savingListing}
            onClick={handleToggleSavedListing}
          >
            {savingListing
              ? isSaved
                ? 'Removing…'
                : 'Saving…'
              : isSaved
                ? 'Saved'
                : 'Save listing'}
          </button>

          {saveError ? (
            <p className="listing-detail__message listing-detail__message--error" role="alert">
              {saveError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!user && listing.status === 'active' ? (
        <div className="listing-detail__owner-actions">
          <Link
            to="/login"
            state={{ from: `/listings/${listing.slug}` }}
            className="listing-detail__button listing-detail__button--primary"
          >
            Log in to message seller
          </Link>
        </div>
      ) : null}

      <ListingOffersSection
        listing={listing}
        user={user}
        isOwner={isOwner}
        offers={offers}
        loadingOffers={loadingOffers}
        offersError={offersError}
        onOffersChange={setOffers}
        onOfferAccepted={async () => {
          const { data } = await fetchListingBySlug(slug)
          if (data) {
            setListing(data)
          }
        }}
      />
    </article>
  )
}

export default ListingDetailPage
