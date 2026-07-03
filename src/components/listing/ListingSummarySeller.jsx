import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { fetchPublicProfile, formatLastActiveLabel, getProfileDisplayName, buildAvatarProfile } from '../../lib/profiles'
import { getSellerShopPath } from '../../lib/sellerShopUrls'
import {
  fetchUserCompletedSalesCount,
  fetchUserReviewSummary,
  formatReviewCompact,
  renderStarRating,
} from '../../lib/reviews'

function ChevronIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6.5 15.5 12 9 17.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatCompletedSales(count) {
  if (count == null) return null
  return `${count} completed sale${count === 1 ? '' : 's'}`
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
  const lastActiveLabel = formatLastActiveLabel(profile?.last_active_at)
  const avatarProfile = buildAvatarProfile(profile) ?? { initial: '?' }

  let secondaryLine = null

  if (hasReviews) {
    secondaryLine = (
      <>
        <span className="listing-summary__seller-rating">
          <span className="listing-summary__seller-stars" aria-hidden="true">
            {renderStarRating(reviewSummary.averageRating)}
          </span>
          <span>{compactRating}</span>
        </span>
        {salesLabel ? (
          <span className="listing-summary__seller-sales">{salesLabel}</span>
        ) : null}
      </>
    )
  } else {
    const statusLabel =
      completedSalesCount === 0 ? 'New seller' : 'No reviews yet'
    const metaParts = [statusLabel, salesLabel].filter(Boolean)

    secondaryLine = (
      <span className="listing-summary__seller-meta-line">{metaParts.join(' • ')}</span>
    )
  }

  return (
    <section
      className="listing-summary__block listing-summary__block--seller"
      aria-labelledby="listing-summary-seller"
    >
      <h2 id="listing-summary-seller" className="listing-summary__block-title">
        Seller
      </h2>

      {loading ? (
        <p className="listing-summary__seller-loading">Loading seller…</p>
      ) : (
        <Link to={getSellerShopPath(profile ?? { id: sellerId })} className="listing-summary__seller-row">
          <UserAvatar profile={avatarProfile} size="sm" className="listing-summary__seller-avatar" />
          <span className="listing-summary__seller-body">
            <span className="listing-summary__seller-name-row">
              <span className="listing-summary__seller-name">{displayName}</span>
              <ChevronIcon className="listing-summary__seller-chevron" />
            </span>
            <span className="listing-summary__seller-meta">{secondaryLine}</span>
            {lastActiveLabel ? (
              <span className="listing-summary__seller-last-active">{lastActiveLabel}</span>
            ) : null}
          </span>
        </Link>
      )}
    </section>
  )
}

export default ListingSummarySeller
