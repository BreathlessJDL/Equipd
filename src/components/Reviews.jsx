import { useEffect, useMemo, useRef, useState } from 'react'
import '../components/auth/AuthModal.css'
import {
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  buildLeaveReviewModalContext,
  canUserReviewOrder,
  fetchRevieweeProfileForOrder,
  formatReviewTimestamp,
  getReviewErrorMessage,
  getRevieweeLabel,
  getReviewText,
  getReviewVerifierLabel,
  getUserReviewForOrder,
  isDuplicateReviewError,
  isOrderReviewable,
  renderStarRating,
  submitReview,
} from '../lib/reviews'
import './Reviews.css'

function StarRatingInput({ value, onChange, disabled = false }) {
  return (
    <div className="reviews__stars-input" role="radiogroup" aria-label="Rating">
      {Array.from({ length: REVIEW_MAX_RATING }, (_, index) => {
        const rating = index + 1

        return (
          <button
            key={rating}
            type="button"
            className={`reviews__star-button${
              rating <= value ? ' reviews__star-button--active' : ''
            }`}
            disabled={disabled}
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
            aria-pressed={rating === value}
            onClick={() => onChange(rating)}
          >
            {rating <= value ? '★' : '☆'}
          </button>
        )
      })}
    </div>
  )
}

function ReviewCard({ review }) {
  const reviewText = getReviewText(review)

  return (
    <article className="reviews__card">
      <div className="reviews__card-header">
        <p className="reviews__card-title">
          {renderStarRating(review.rating)}
        </p>
        <p className="reviews__card-meta">
          {getReviewVerifierLabel(review)} · {formatReviewTimestamp(review.created_at)}
        </p>
      </div>
      {reviewText ? <p className="reviews__card-comment">{reviewText}</p> : null}
    </article>
  )
}

function LeaveReviewOrderSummary({
  imageUrl,
  listingTitle,
  orderReference,
  revieweeName,
  roleLabel,
}) {
  return (
    <div className="reviews-modal__summary">
      <div className="reviews-modal__summary-media" aria-hidden="true">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="reviews-modal__summary-image" />
        ) : (
          <div className="reviews-modal__summary-image reviews-modal__summary-image--placeholder">
            No photo
          </div>
        )}
      </div>

      <div className="reviews-modal__summary-body">
        {roleLabel ? (
          <p className="reviews-modal__summary-role">{roleLabel}</p>
        ) : null}
        <h3 className="reviews-modal__summary-title">{listingTitle}</h3>
        <dl className="reviews-modal__summary-meta">
          {orderReference ? (
            <div className="reviews-modal__summary-meta-row">
              <dt className="reviews-modal__summary-meta-label">Order</dt>
              <dd className="reviews-modal__summary-meta-value">#{orderReference}</dd>
            </div>
          ) : null}
          {revieweeName ? (
            <div className="reviews-modal__summary-meta-row">
              <dt className="reviews-modal__summary-meta-label">Member</dt>
              <dd className="reviews-modal__summary-meta-value">{revieweeName}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  )
}

function LeaveReviewModal({
  open,
  order,
  userId = null,
  listing = null,
  revieweeProfile = null,
  submitting,
  error,
  onClose,
  onSubmit,
}) {
  const [rating, setRating] = useState(REVIEW_MIN_RATING)
  const [reviewText, setReviewText] = useState('')
  const [resolvedRevieweeProfile, setResolvedRevieweeProfile] = useState(revieweeProfile)
  const [profileLoading, setProfileLoading] = useState(false)
  const submitLockRef = useRef(false)

  useEffect(() => {
    if (!open) return undefined

    setRating(REVIEW_MIN_RATING)
    setReviewText('')
    submitLockRef.current = false
    setResolvedRevieweeProfile(revieweeProfile)
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape' && !submitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, submitting, onClose, revieweeProfile])

  useEffect(() => {
    if (!open || !order?.id || !userId) return undefined

    if (revieweeProfile) {
      setResolvedRevieweeProfile(revieweeProfile)
      return undefined
    }

    let active = true
    setProfileLoading(true)

    fetchRevieweeProfileForOrder(order, userId).then((profile) => {
      if (!active) return
      setResolvedRevieweeProfile(profile)
      setProfileLoading(false)
    })

    return () => {
      active = false
    }
  }, [open, order, userId, revieweeProfile])

  const summary = useMemo(
    () =>
      buildLeaveReviewModalContext({
        order,
        userId,
        listing,
        revieweeProfile: resolvedRevieweeProfile,
      }),
    [listing, order, resolvedRevieweeProfile, userId],
  )

  const revieweeName = profileLoading
    ? 'Loading member…'
    : summary.revieweeName

  if (!open) return null

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitting || submitLockRef.current || !order?.id) return

    submitLockRef.current = true

    try {
      await onSubmit({ rating, reviewText })
    } finally {
      submitLockRef.current = false
    }
  }

  return (
    <div className="auth-modal reviews-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close leave review dialog"
        disabled={submitting}
        onClick={onClose}
      />
      <div
        className="auth-modal__dialog reviews-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-review-title"
      >
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Close"
          disabled={submitting}
          onClick={onClose}
        >
          ×
        </button>

        <form className="reviews-modal__form" onSubmit={handleSubmit}>
          <h2 id="leave-review-title" className="reviews-modal__title">
            Leave review
          </h2>

          <LeaveReviewOrderSummary
            imageUrl={summary.imageUrl}
            listingTitle={summary.listingTitle}
            orderReference={summary.orderReference}
            revieweeName={revieweeName}
            roleLabel={summary.roleLabel}
          />

          <p className="reviews-modal__lead">
            Share your experience with {getRevieweeLabel(order, userId)}.
          </p>

          <hr className="reviews-modal__form-divider" aria-hidden="true" />

          <div className="reviews__field">
            <span className="reviews__label">Rating</span>
            <StarRatingInput value={rating} disabled={submitting} onChange={setRating} />
          </div>

          <label className="reviews__field">
            <span className="reviews__label">Review text (optional)</span>
            <textarea
              className="reviews__textarea"
              rows={4}
              maxLength={500}
              value={reviewText}
              disabled={submitting}
              placeholder="How did this transaction go?"
              onChange={(event) => setReviewText(event.target.value)}
            />
          </label>

          {error ? (
            <p className="reviews__error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="reviews__button" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  )
}

function OrderReviewSection({ order, reviews, userId, onSubmitted }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitNotice, setSubmitNotice] = useState('')
  const submitLockRef = useRef(false)

  const userReview = getUserReviewForOrder(reviews, userId)
  const canReview = canUserReviewOrder(order, reviews, userId)

  if (!isOrderReviewable(order)) return null

  async function handleSubmit({ rating, reviewText }) {
    if (!order?.id || submitting || submitLockRef.current) return

    submitLockRef.current = true
    setSubmitting(true)
    setError('')
    setSubmitNotice('')

    const { error: submitError } = await submitReview({
      orderId: order.id,
      rating,
      reviewText,
    })

    if (submitError) {
      if (isDuplicateReviewError(submitError)) {
        await onSubmitted?.()
        setModalOpen(false)
        setSubmitNotice(getReviewErrorMessage(submitError))
      } else {
        setError(getReviewErrorMessage(submitError))
      }

      setSubmitting(false)
      submitLockRef.current = false
      return
    }

    await onSubmitted?.()
    setModalOpen(false)
    setSubmitting(false)
    submitLockRef.current = false
  }

  function handleOpenModal() {
    setError('')
    setSubmitNotice('')
    setModalOpen(true)
  }

  function handleCloseModal() {
    if (submitting) return
    setModalOpen(false)
    setError('')
  }

  return (
    <section className="reviews reviews--order">
      <h2 className="reviews__title">Reviews</h2>

      {reviews.length > 0 ? (
        <ul className="reviews__list">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="reviews__empty">No reviews have been left for this order yet.</p>
      )}

      {userReview ? (
        <p className="reviews__notice" role="status">
          Review submitted — you left a {userReview.rating}-star review on this order.
        </p>
      ) : null}

      {submitNotice && !userReview ? (
        <p className="reviews__notice" role="status">
          {submitNotice}
        </p>
      ) : null}

      {canReview ? (
        <button type="button" className="reviews__button" onClick={handleOpenModal}>
          Leave Review
        </button>
      ) : null}

      <LeaveReviewModal
        open={modalOpen}
        order={order}
        userId={userId}
        listing={order?.listing ?? null}
        submitting={submitting}
        error={error}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />
    </section>
  )
}

export { LeaveReviewModal, LeaveReviewOrderSummary, OrderReviewSection, ReviewCard, StarRatingInput }
