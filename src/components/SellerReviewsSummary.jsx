import {
  formatReviewSummary,
  formatReviewTimestamp,
  getReviewListingTitle,
  getReviewText,
  getReviewVerifierLabel,
  renderStarRating,
} from '../lib/reviews'
import './Reviews.css'

function SellerReviewsSummary({
  summary = { averageRating: null, reviewCount: 0 },
  reviews = [],
  loading = false,
  error = '',
  title = 'Reviews',
  className = '',
}) {
  if (loading) {
    return (
      <section className={`reviews reviews--seller${className ? ` ${className}` : ''}`}>
        <h2 className="reviews__title">{title}</h2>
        <p className="reviews__empty">Loading reviews…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className={`reviews reviews--seller${className ? ` ${className}` : ''}`}>
        <h2 className="reviews__title">{title}</h2>
        <p className="reviews__error" role="alert">
          {error}
        </p>
      </section>
    )
  }

  const hasReviews = summary.reviewCount > 0 && summary.averageRating != null

  return (
    <section className={`reviews reviews--seller${className ? ` ${className}` : ''}`}>
      <h2 className="reviews__title">{title}</h2>

      {hasReviews ? (
        <>
          <p className="reviews__summary">
            <span className="reviews__summary-stars">{renderStarRating(summary.averageRating)}</span>
            {' · '}
            {formatReviewSummary(summary.averageRating, summary.reviewCount)}
          </p>

          {reviews.length > 0 ? (
            <ul className="reviews__list">
              {reviews.map((review) => {
                const listingTitle = getReviewListingTitle(review)

                return (
                <li key={review.id}>
                  <article className="reviews__card">
                    <div className="reviews__card-header">
                      <p className="reviews__card-title">
                        {renderStarRating(review.rating)}
                      </p>
                      <p className="reviews__card-meta">
                        {getReviewVerifierLabel(review)} · {formatReviewTimestamp(review.created_at)}
                        {listingTitle ? ` · ${listingTitle}` : ''}
                      </p>
                    </div>
                    {getReviewText(review) ? (
                      <p className="reviews__card-comment">{getReviewText(review)}</p>
                    ) : null}
                  </article>
                </li>
                )
              })}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="reviews__empty">No reviews yet</p>
      )}
    </section>
  )
}

export default SellerReviewsSummary
