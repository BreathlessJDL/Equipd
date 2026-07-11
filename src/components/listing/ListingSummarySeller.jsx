import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { fetchPublicProfile, getProfileDisplayName, buildAvatarProfile } from '../../lib/profiles'
import { getSellerShopPath } from '../../lib/sellerShopUrls'
import {
  fetchUserCompletedSalesCount,
  fetchUserReviewSummary,
  formatReviewCompact,
  renderStarRating,
} from '../../lib/reviews'

function formatCompletedSales(count) {
  if (count == null) return null
  return `${count} completed sale${count === 1 ? '' : 's'}`
}

function formatMemberSince(createdAt) {
  if (!createdAt) return null
  const year = new Date(createdAt).getFullYear()
  if (!Number.isFinite(year)) return null
  return `Member since ${year}`
}

function ListingSummarySeller({ sellerId }) {
  const [profile, setProfile] = useState(null)
  const [reviewSummary, setReviewSummary] = useState({ averageRating: null, reviewCount: 0 })
  const [completedSalesCount, setCompletedSalesCount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) return undefined

    let active = true

    async function loadSeller() {
      setLoading(true)

      const [profileResult, summaryResult, salesResult] = await Promise.all([
        fetchPublicProfile(sellerId),
        fetchUserReviewSummary(sellerId),
        fetchUserCompletedSalesCount(sellerId),
      ])

      if (!active) return

      setProfile(profileResult.data ?? null)
      setReviewSummary(summaryResult.data ?? { averageRating: null, reviewCount: 0 })
      setCompletedSalesCount(salesResult.error ? null : (salesResult.data ?? 0))
      setLoading(false)
    }

    loadSeller()

    return () => {
      active = false
    }
  }, [sellerId])

  if (!sellerId) return null

  const displayName = getProfileDisplayName(profile)
  const hasReviews = reviewSummary.reviewCount > 0 && reviewSummary.averageRating != null
  const compactRating = formatReviewCompact(reviewSummary.averageRating, reviewSummary.reviewCount)
  const salesLabel = formatCompletedSales(completedSalesCount)
  const memberSinceLabel = formatMemberSince(profile?.created_at)
  const avatarProfile = buildAvatarProfile(profile) ?? { initial: '?' }
  const shopPath = getSellerShopPath(profile ?? { id: sellerId })
  const statsLine = [salesLabel, memberSinceLabel].filter(Boolean).join(' • ')

  return (
    <section
      className="listing-summary__section listing-summary__section--seller"
      aria-labelledby="listing-summary-seller"
    >
      <h2 id="listing-summary-seller" className="listing-summary__section-title">
        Seller
      </h2>

      {loading ? (
        <p className="listing-summary__seller-loading">Loading seller…</p>
      ) : (
        <div className="listing-summary__seller-card">
          <UserAvatar profile={avatarProfile} size="md" className="listing-summary__seller-avatar" />
          <div className="listing-summary__seller-body">
            <p className="listing-summary__seller-name">{displayName}</p>
            {hasReviews ? (
              <p className="listing-summary__seller-rating">
                <span className="listing-summary__seller-stars" aria-hidden="true">
                  {renderStarRating(reviewSummary.averageRating)}
                </span>
                <span>{compactRating}</span>
              </p>
            ) : (
              <p className="listing-summary__seller-meta-line">
                {completedSalesCount === 0 ? 'New seller' : 'No reviews yet'}
              </p>
            )}
            {statsLine ? (
              <p className="listing-summary__seller-stats">{statsLine}</p>
            ) : null}
            <Link to={shopPath} className="listing-summary__seller-profile-link">
              View seller profile
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

export default ListingSummarySeller
