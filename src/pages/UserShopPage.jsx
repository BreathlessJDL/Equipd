import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import SellerReviewsSummary from '../components/SellerReviewsSummary'
import UserAvatar from '../components/UserAvatar'
import '../components/ListingBrowse.css'
import '../components/Reviews.css'
import './UserShop.css'
import { useAuth } from '../hooks/useAuth'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { usePageMeta } from '../hooks/usePageMeta'
import JsonLd from '../components/JsonLd'
import ReportTrigger from '../components/ReportTrigger'
import { canReportUser, REPORT_TYPES } from '../lib/reports'
import {
  fetchSellerActiveListings,
  getListingErrorMessage,
} from '../lib/listings'
import { MARKETPLACE_MESSAGE_SAFETY_NOTE } from '../lib/marketplaceMessageValidation'
import { getMessageErrorMessage, resolveMessageThreadNavigation } from '../lib/messages'
import { fetchPublicProfileByShopParam } from '../lib/sellerShopResolve'
import { getSellerShopPath, isProfileUuid } from '../lib/sellerShopUrls'
import {
  buildSellerShopPageSeo,
  buildSellerShopStructuredData,
} from '../lib/sellerShopSeo'
import {
  formatLastActiveLabel,
  formatProfileJoinDate,
  buildAvatarProfile,
  getProfileDisplayName,
  getProfileErrorMessage,
  PROFILE_UPDATED_EVENT,
} from '../lib/profiles'
import {
  fetchReviewsForUser,
  fetchUserCompletedSalesCount,
  fetchUserReviewSummary,
  formatReviewRating,
  formatReviewSummary,
  getReviewErrorMessage,
  renderStarRating,
} from '../lib/reviews'
import { TRUST_LINKS } from '../lib/trustMessaging'

function UserShopPage({ shopParam }) {
  const { user } = useAuth()
  const { requireAuth } = useRequireAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const sellerId = profile?.id ?? (isProfileUuid(shopParam) ? shopParam : null)
  const shopPath = profile ? getSellerShopPath(profile) : getSellerShopPath(shopParam)
  const [listings, setListings] = useState([])
  const [reviewSummary, setReviewSummary] = useState({ averageRating: null, reviewCount: 0 })
  const [reviews, setReviews] = useState([])
  const [completedSalesCount, setCompletedSalesCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewsError, setReviewsError] = useState('')
  const [startingConversation, setStartingConversation] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [profileRefreshNonce, setProfileRefreshNonce] = useState(0)

  const shopSeo = profile
    ? buildSellerShopPageSeo(profile, {
        listingCount: listings.length,
        reviewSummary,
      })
    : null
  const shopStructuredData = profile
    ? buildSellerShopStructuredData(profile, {
        reviewSummary,
        completedSalesCount,
      })
    : null

  usePageMeta(
    shopSeo
      ? {
          title: shopSeo.titleForHook,
          description: shopSeo.description,
          canonicalPath: shopSeo.canonicalPath,
          openGraph: shopSeo.openGraph,
        }
      : {
          title: null,
          description: null,
          canonicalPath: null,
          openGraph: null,
        },
  )

  useEffect(() => {
    function handleProfileUpdated(event) {
      const updatedUserId = event.detail?.userId
      if (updatedUserId && sellerId && updatedUserId !== sellerId) return
      setProfileRefreshNonce((current) => current + 1)
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [sellerId])

  useEffect(() => {
    if (!shopParam) return undefined

    let active = true

    async function loadShop() {
      setLoading(true)
      setError('')
      setReviewsError('')

      const profileResult = await fetchPublicProfileByShopParam(shopParam)

      if (!active) return

      if (profileResult.error || !profileResult.data) {
        setError(getProfileErrorMessage(profileResult.error ?? new Error('Profile not found.')))
        setProfile(null)
        setListings([])
        setReviewSummary({ averageRating: null, reviewCount: 0 })
        setReviews([])
        setCompletedSalesCount(null)
        setLoading(false)
        return
      }

      const resolvedProfile = profileResult.data

      if (resolvedProfile.username && isProfileUuid(shopParam)) {
        navigate(getSellerShopPath(resolvedProfile), { replace: true })
        return
      }

      const resolvedSellerId = resolvedProfile.id

      const [
        listingsResult,
        reviewsSummaryResult,
        reviewsResult,
        soldCountResult,
      ] = await Promise.all([
        fetchSellerActiveListings(resolvedSellerId),
        fetchUserReviewSummary(resolvedSellerId),
        fetchReviewsForUser(resolvedSellerId, { limit: 6 }),
        fetchUserCompletedSalesCount(resolvedSellerId),
      ])

      if (!active) return

      if (listingsResult.error) {
        setError(getListingErrorMessage(listingsResult.error))
      }

      if (reviewsSummaryResult.error || reviewsResult.error) {
        setReviewsError(
          getReviewErrorMessage(reviewsSummaryResult.error ?? reviewsResult.error),
        )
      }

      setProfile(resolvedProfile)
      setListings(listingsResult.error ? [] : (listingsResult.data ?? []))
      setReviewSummary(reviewsSummaryResult.data ?? { averageRating: null, reviewCount: 0 })
      setReviews(reviewsResult.error ? [] : (reviewsResult.data ?? []))
      setCompletedSalesCount(soldCountResult.error ? null : (soldCountResult.data ?? 0))
      setLoading(false)
    }

    loadShop()

    return () => {
      active = false
    }
  }, [shopParam, profileRefreshNonce, navigate])

  async function handleMessageSeller() {
    const firstListing = listings[0]
    if (!firstListing) return
    if (!requireAuth(shopPath)) return
    if (!user?.id || !sellerId) return

    setStartingConversation(true)
    setMessageError('')

    const { path, error: conversationError } = await resolveMessageThreadNavigation({
      listingId: firstListing.id,
      buyerId: user.id,
      sellerId,
    })

    setStartingConversation(false)

    if (conversationError) {
      setMessageError(getMessageErrorMessage(conversationError))
      return
    }

    navigate(path)
  }

  const isOwnShop = Boolean(user?.id && sellerId && user.id === sellerId)
  const displayName = getProfileDisplayName(profile)
  const joinDate = formatProfileJoinDate(profile?.created_at)
  const avatarProfile = buildAvatarProfile(profile, isOwnShop ? user : null)
  const hasReviews = reviewSummary.reviewCount > 0 && reviewSummary.averageRating != null
  const canMessageSeller = !isOwnShop && listings.length > 0
  const activeListingCount = listings.length
  const profileSubline = [
    profile?.location?.trim(),
    joinDate ? `Joined ${joinDate}` : null,
  ].filter(Boolean).join(' · ')
  const lastActiveLabel = formatLastActiveLabel(profile?.last_active_at)

  if (loading) {
    return (
      <section className="user-shop">
        <p className="user-shop__message">Loading profile…</p>
      </section>
    )
  }

  if (error && !profile) {
    return (
      <section className="user-shop">
        <p className="user-shop__message user-shop__message--error" role="alert">
          {error}
        </p>
      </section>
    )
  }

  return (
    <section className="user-shop">
      {shopStructuredData ? <JsonLd data={shopStructuredData} /> : null}
      <div className="user-shop__profile-card">
        <header className="user-shop__header">
          <div className="user-shop__identity">
            <UserAvatar profile={avatarProfile} user={user} size="lg" className="user-shop__avatar" />
            <div className="user-shop__meta">
              <h1 className="user-shop__name">{displayName}</h1>
              <p className="user-shop__reviews">
                {hasReviews ? (
                  <>
                    <span className="user-shop__stars" aria-hidden="true">
                      {renderStarRating(reviewSummary.averageRating)}
                    </span>
                    <span className="user-shop__reviews-text">
                      {formatReviewRating(reviewSummary.averageRating)}
                      {' · '}
                      {reviewSummary.reviewCount} review{reviewSummary.reviewCount === 1 ? '' : 's'}
                    </span>
                  </>
                ) : (
                  <span className="user-shop__reviews-text">No reviews yet</span>
                )}
              </p>
              {profileSubline ? (
                <p className="user-shop__subline">{profileSubline}</p>
              ) : null}
              {lastActiveLabel ? (
                <p className="user-shop__last-active">{lastActiveLabel}</p>
              ) : null}
            </div>
          </div>

          <div className="user-shop__actions">
            {isOwnShop ? (
              <Link to="/settings" className="user-shop__button user-shop__button--secondary">
                Edit settings
              </Link>
            ) : (
              <>
                {canMessageSeller ? (
                  <button
                    type="button"
                    className="user-shop__button user-shop__button--primary"
                    disabled={startingConversation}
                    onClick={handleMessageSeller}
                  >
                    {startingConversation ? 'Opening conversation…' : 'Message seller'}
                  </button>
                ) : null}

                {sellerId && canReportUser(sellerId, user?.id) ? (
                  <ReportTrigger
                    reportType={REPORT_TYPES.USER}
                    reportedUserId={sellerId}
                    label="Report user"
                    className="report-trigger user-shop__report"
                  />
                ) : null}
              </>
            )}
          </div>
        </header>

        <dl className="user-shop__stats">
          <div className="user-shop__stat">
            <dt className="user-shop__stat-label">Active listings</dt>
            <dd className="user-shop__stat-value">{activeListingCount}</dd>
          </div>

          {completedSalesCount != null ? (
            <div className="user-shop__stat">
              <dt className="user-shop__stat-label">Completed sales</dt>
              <dd className="user-shop__stat-value">{completedSalesCount}</dd>
            </div>
          ) : null}

          <div className="user-shop__stat">
            <dt className="user-shop__stat-label">Rating</dt>
            <dd className="user-shop__stat-value">
              {hasReviews ? (
                <>
                  <span className="user-shop__stat-stars" aria-hidden="true">
                    {renderStarRating(reviewSummary.averageRating)}
                  </span>
                  <span className="user-shop__stat-rating">
                    {formatReviewRating(reviewSummary.averageRating)}
                  </span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>

          <div className="user-shop__stat">
            <dt className="user-shop__stat-label">Reviews</dt>
            <dd className="user-shop__stat-value">{reviewSummary.reviewCount}</dd>
          </div>
        </dl>

        <p className="user-shop__trust">
          {MARKETPLACE_MESSAGE_SAFETY_NOTE}{' '}
          <Link to={TRUST_LINKS.buyerProtection}>Buyer protection</Link>
        </p>
      </div>

      {error ? (
        <p className="user-shop__message user-shop__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {messageError ? (
        <p className="user-shop__message user-shop__message--error" role="alert">
          {messageError}
        </p>
      ) : null}

      <div className="user-shop__listings">
        <header className="user-shop__listings-header">
          <h2 className="user-shop__section-title">
            {isOwnShop ? 'Your listings' : 'Listings'}
          </h2>
          {listings.length > 0 ? (
            <p className="user-shop__listings-count">
              {listings.length} item{listings.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </header>

        {listings.length === 0 ? (
          <p className="user-shop__message">
            {isOwnShop
              ? 'You have no active listings yet.'
              : 'This seller has no active listings right now.'}
          </p>
        ) : (
          <div className="listing-browse__grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} variant="home" />
            ))}
          </div>
        )}
      </div>

      <SellerReviewsSummary
        className="reviews--shop"
        title={isOwnShop ? 'Your reviews' : 'Reviews'}
        summary={reviewSummary}
        reviews={reviews}
        error={reviewsError}
      />
    </section>
  )
}

export default UserShopPage
