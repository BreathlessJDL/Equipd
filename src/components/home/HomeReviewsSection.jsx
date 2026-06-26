import { EmptyState, ErrorState, LoadingState } from '../ui/UiState'
import HomeReviewsCarousel from './HomeReviewsCarousel'

function HomeReviewsSection({ reviews, loading, error }) {
  return (
    <section className="home-reviews" aria-labelledby="home-reviews-title">
      <div className="home-section__inner home-reviews__inner">
        <header className="home-reviews__header">
          <h2 id="home-reviews-title" className="home-reviews__title">
            Verified reviews from completed orders
          </h2>
          <p className="home-reviews__subtitle">
            Every review comes from a completed Equipd purchase.
          </p>
        </header>

        {loading ? <LoadingState compact>Loading reviews…</LoadingState> : null}

        {!loading && error ? <ErrorState compact>{error}</ErrorState> : null}

        {!loading && !error && reviews.length === 0 ? (
          <EmptyState compact>
            Reviews will appear here after buyers and sellers complete orders.
          </EmptyState>
        ) : null}

        {!loading && !error && reviews.length > 0 ? (
          <HomeReviewsCarousel reviews={reviews} />
        ) : null}
      </div>
    </section>
  )
}

export default HomeReviewsSection
