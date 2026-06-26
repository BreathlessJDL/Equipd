import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import SellerReviewsSummary from '../components/SellerReviewsSummary'
import UserAvatar from '../components/UserAvatar'
import '../components/ListingBrowse.css'
import '../components/Reviews.css'
import './UserShop.css'
import { useAuth } from '../hooks/useAuth'
import ReportTrigger from '../components/ReportTrigger'
import { canReportUser, REPORT_TYPES } from '../lib/reports'
import {
  fetchSellerActiveListings,
  getListingErrorMessage,
} from '../lib/listings'
import { MARKETPLACE_MESSAGE_SAFETY_NOTE } from '../lib/marketplaceMessageValidation'
import { getMessageErrorMessage, resolveMessageThreadNavigation } from '../lib/messages'
import {
  fetchPublicProfile,
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

function UserShopPage({ userId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
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

  useEffect(() => {
    function handleProfileUpdated(event) {
      const updatedUserId = event.detail?.userId
      if (updatedUserId && updatedUserId !== userId) return
      setProfileRefreshNonce((current) => current + 1)
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    let active = true

    async function loadShop() {
      setLoading(true)
      setError('')
      setReviewsError('')

      const [
        profileResult,
        listingsResult,
        reviewsSummaryResult,
        reviewsResult,
        soldCountResult,
      ] = await Promise.all([
        fetchPublicProfile(userId),
        fetchSellerActiveListings(userId),
        fetchUserReviewSummary(userId),
        fetchReviewsForUser(userId, { limit: 6 }),
        fetchUserCompletedSalesCount(userId),
      ])

      if (!active) return

      if (profileResult.error) {
        setError(getProfileErrorMessage(profileResult.error))
        setProfile(null)
        setListings([])
        setReviewSummary({ averageRating: null, reviewCount: 0 })
        setReviews([])
        setCompletedSalesCount(null)
        setLoading(false)
        return
      }

      if (listingsResult.error) {
        setError(getListingErrorMessage(listingsResult.error))
      }

      if (reviewsSummaryResult.error || reviewsResult.error) {
        setReviewsError(
          getReviewErrorMessage(reviewsSummaryResult.error ?? reviewsResult.error),
        )
      }

      setProfile(profileResult.data)
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
  }, [userId, profileRefreshNonce])

  async function handleMessageSeller() {
    const firstListing = listings[0]
    if (!firstListing || !user?.id) return

    setStartingConversation(true)
    setMessageError('')

    const { path, error: conversationError } = await resolveMessageThreadNavigation({
      listingId: firstListing.id,
      buyerId: user.id,
      sellerId: userId,
    })

    setStartingConversation(false)

    if (conversationError) {
      setMessageError(getMessageErrorMessage(conversationError))
      return
    }

    navigate(path)
  }

  const isOwnShop = Boolean(user?.id && user.id === userId)
  const displayName = getProfileDisplayName(profile)
  const joinDate = formatProfileJoinDate(profile?.created_at)
  const avatarProfile = buildAvatarProfile(profile, isOwnShop ? user : null)
  const hasReviews = reviewSummary.reviewCount > 0 && reviewSummary.averageRating != null
  const canMessageSeller = !isOwnShop && listings.length > 0
  const activeListingCount = listings.length
  const username = profile?.username?.trim()
  const displayNameField = profile?.display_name?.trim()
  const showDisplayNameSubtitle = Boolean(
    username
    && displayNameField
    && displayNameField.toLowerCase() !== username.toLowerCase(),
  )
  const profileSubline = [
    profile?.location?.trim(),
    joinDate ? `Joined ${joinDate}` : null,
  ].filter(Boolean).join(' · ')

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
      <div className="user-shop__profile-card">
        <header className="user-shop__header">
          <div className="user-shop__identity">
            <UserAvatar profile={avatarProfile} user={user} size="lg" className="user-shop__avatar" />
            <div className="user-shop__meta">
              <h1 className="user-shop__name">{displayName}</h1>
              {showDisplayNameSubtitle ? (
                <p className="user-shop__display-name">{displayNameField}</p>
              ) : null}
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
            </div>
          </div>

          <div className="user-shop__actions">
            {isOwnShop ? (
              <Link to="/settings" className="user-shop__button user-shop__button--secondary">
                Edit settings
              </Link>
            ) : (
              <>
                {canMessageSeller && user ? (
                  <button
                    type="button"
                    className="user-shop__button user-shop__button--primary"
                    disabled={startingConversation}
                    onClick={handleMessageSeller}
                  >
                    {startingConversation ? 'Opening conversation…' : 'Message seller'}
                  </button>
                ) : null}

                {!user && listings.length > 0 ? (
                  <Link
                    to="/login"
                    state={{ from: `/shop/${userId}` }}
                    className="user-shop__button user-shop__button--primary"
                  >
                    Log in to message seller
                  </Link>
                ) : null}

                {canReportUser(userId, user?.id) ? (
                  <ReportTrigger
                    reportType={REPORT_TYPES.USER}
                    reportedUserId={userId}
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
