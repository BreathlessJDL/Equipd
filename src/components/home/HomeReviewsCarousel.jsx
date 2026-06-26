import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  formatReviewDateShort,
  getReviewListingTitle,
  getReviewText,
  getReviewVerifierLabel,
  renderStarRating,
} from '../../lib/reviews'

const CAROUSEL_REVIEW_THRESHOLD = 4
const AUTO_PLAY_MS = 6500
const TRANSITION_MS = 600

function HomeReviewCard({ review }) {
  const reviewText = getReviewText(review)
  const listingTitle = getReviewListingTitle(review)
  const verifierLabel = getReviewVerifierLabel(review)

  return (
    <article className="home-review-card">
      <p className="home-review-card__stars" aria-label={`${review.rating} out of 5 stars`}>
        {renderStarRating(review.rating)}
      </p>
      {reviewText ? (
        <p className="home-review-card__comment">{reviewText}</p>
      ) : (
        <p className="home-review-card__comment home-review-card__comment--muted">
          A {review.rating}-star review from a completed order.
        </p>
      )}
      <div className="home-review-card__meta">
        <p className="home-review-card__verified">{verifierLabel}</p>
        <p className="home-review-card__listing-title" title={listingTitle}>
          {listingTitle}
        </p>
        <time className="home-review-card__date" dateTime={review.created_at}>
          {formatReviewDateShort(review.created_at)}
        </time>
      </div>
    </article>
  )
}

function CarouselArrow({ direction, onClick }) {
  const label = direction === 'prev' ? 'Show previous reviews' : 'Show more reviews'

  return (
    <button
      type="button"
      className={`home-reviews-carousel__arrow home-reviews-carousel__arrow--${direction}`}
      onClick={onClick}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === 'prev' ? 'M15 6.5 8.5 12 15 17.5' : 'M9 6.5 15.5 12 9 17.5'}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function HomeReviewsInteractiveCarousel({ reviews }) {
  const reviewCount = reviews.length
  const loopedReviews = useMemo(() => [...reviews, ...reviews], [reviews])

  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const indexRef = useRef(0)
  const isJumpingRef = useRef(false)

  const [index, setIndex] = useState(0)
  const [stridePx, setStridePx] = useState(0)
  const [animate, setAnimate] = useState(true)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  indexRef.current = index

  const measureStride = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    const firstSlide = track?.firstElementChild

    if (!viewport || !firstSlide) return

    const slideWidth = firstSlide.getBoundingClientRect().width
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap) || 0

    if (slideWidth > 0) {
      setStridePx(slideWidth + gap)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReduceMotion(media.matches)
    updateMotion()
    media.addEventListener('change', updateMotion)
    return () => media.removeEventListener('change', updateMotion)
  }, [])

  useEffect(() => {
    measureStride()

    const viewport = viewportRef.current
    if (!viewport) return undefined

    const observer = new ResizeObserver(() => {
      measureStride()
    })

    observer.observe(viewport)
    window.addEventListener('resize', measureStride)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measureStride)
    }
  }, [measureStride, reviewCount])

  const jumpWithoutAnimation = useCallback((nextIndex) => {
    isJumpingRef.current = true
    setAnimate(false)
    setIndex(nextIndex)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isJumpingRef.current = false
        setAnimate(true)
      })
    })
  }, [])

  const goNext = useCallback(() => {
    if (isJumpingRef.current) return

    setIndex((current) => {
      if (current + 1 >= reviewCount) {
        return reviewCount
      }
      return current + 1
    })
  }, [reviewCount])

  const goPrev = useCallback(() => {
    if (isJumpingRef.current) return

    if (indexRef.current === 0) {
      isJumpingRef.current = true
      setAnimate(false)
      setIndex(reviewCount)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true)
          setIndex(reviewCount - 1)
          isJumpingRef.current = false
        })
      })
      return
    }

    setIndex((current) => current - 1)
  }, [reviewCount])

  const goTo = useCallback(
    (targetIndex) => {
      if (isJumpingRef.current) return
      setIndex(Math.max(0, Math.min(targetIndex, reviewCount - 1)))
    },
    [reviewCount],
  )

  useEffect(() => {
    if (index !== reviewCount || !animate) return undefined

    const timeoutId = window.setTimeout(() => {
      jumpWithoutAnimation(0)
    }, TRANSITION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [animate, index, jumpWithoutAnimation, reviewCount])

  useEffect(() => {
    if (paused || reduceMotion || reviewCount <= CAROUSEL_REVIEW_THRESHOLD) return undefined

    const intervalId = window.setInterval(() => {
      goNext()
    }, AUTO_PLAY_MS)

    return () => window.clearInterval(intervalId)
  }, [goNext, paused, reduceMotion, reviewCount])

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goNext()
    }
  }

  const activeDot = index >= reviewCount ? 0 : index
  const offsetPx = stridePx > 0 ? index * stridePx : 0

  return (
    <div
      className="home-reviews-carousel home-reviews-carousel--interactive"
      data-home-reviews-carousel
      data-carousel-mode="interactive"
      role="region"
      aria-roledescription="carousel"
      aria-label="Customer reviews"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false)
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="home-reviews-carousel__controls">
        <CarouselArrow direction="prev" onClick={goPrev} />

        <div className="home-reviews-carousel__viewport" ref={viewportRef}>
          <div
            className="home-reviews-carousel__track"
            ref={trackRef}
            style={{
              transform: `translate3d(-${offsetPx}px, 0, 0)`,
              transition: animate ? `transform ${TRANSITION_MS}ms ease` : 'none',
            }}
          >
            {loopedReviews.map((review, slideIndex) => (
              <div
                key={`${review.id}-${slideIndex}`}
                className="home-reviews-carousel__slide"
                aria-hidden={slideIndex >= reviewCount && index < reviewCount - 1 ? true : undefined}
              >
                <HomeReviewCard review={review} />
              </div>
            ))}
          </div>
        </div>

        <CarouselArrow direction="next" onClick={goNext} />
      </div>

      <div className="home-reviews-carousel__dots" role="tablist" aria-label="Choose a review">
        {reviews.map((review, dotIndex) => (
          <button
            key={review.id}
            type="button"
            role="tab"
            className="home-reviews-carousel__dot"
            aria-label={`Show review ${dotIndex + 1} of ${reviewCount}`}
            aria-selected={dotIndex === activeDot}
            onClick={() => goTo(dotIndex)}
          />
        ))}
      </div>
    </div>
  )
}

function HomeReviewsStaticCarousel({ reviews }) {
  return (
    <div
      className="home-reviews-carousel"
      data-home-reviews-carousel
      data-carousel-mode="static"
    >
      <div className="home-reviews-carousel__viewport">
        <div className="home-reviews-carousel__track">
          {reviews.map((review) => (
            <div key={review.id} className="home-reviews-carousel__slide">
              <HomeReviewCard review={review} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HomeReviewsCarousel({ reviews }) {
  if (reviews.length > CAROUSEL_REVIEW_THRESHOLD) {
    return <HomeReviewsInteractiveCarousel reviews={reviews} />
  }

  return <HomeReviewsStaticCarousel reviews={reviews} />
}

export default HomeReviewsCarousel
