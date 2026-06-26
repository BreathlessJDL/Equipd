import { Link } from 'react-router-dom'
import ListingCard from '../ListingCard'
import { EmptyState, ErrorState, LoadingState } from '../ui/UiState'

function HomeRecentListings({ listings, loading, error }) {
  return (
    <section className="home-recent" aria-labelledby="home-recent-title">
      <div className="home-section__inner">
        <div className="home-section__header home-section__header--row">
          <div>
            <h2 id="home-recent-title" className="home-section__title">
              Recently Added
            </h2>
          </div>
          <Link to="/browse" className="home-section__link">
            View all &gt;
          </Link>
        </div>

        {loading && listings.length === 0 ? (
          <LoadingState compact>Loading recent listings…</LoadingState>
        ) : null}

        {!loading && error && listings.length === 0 ? (
          <ErrorState compact>{error}</ErrorState>
        ) : null}

        {!loading && !error && listings.length === 0 ? (
          <EmptyState compact>
            No listings yet. Check back soon or list your own equipment.
          </EmptyState>
        ) : null}

        {listings.length > 0 ? (
          <div className="home-listing-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} variant="home" showNewBadge />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default HomeRecentListings
