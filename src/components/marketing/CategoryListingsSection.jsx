import { useRef } from 'react'
import { Link } from 'react-router-dom'
import ListingCard from '../ListingCard'
import { EmptyState, ErrorState, LoadingState } from '../ui/UiState'
import { useOneRowListingCapacity } from '../../hooks/useOneRowListingCapacity'

/**
 * Shared category-page “Live marketplace” listings strip:
 * intro → one row of cards → centred Browse CTA.
 */
function CategoryListingsSection({
  headingId,
  note,
  heading,
  lead,
  browsePath,
  ctaLabel,
  listings = [],
  loading = false,
  error = '',
  emptyMessage,
  loadingLabel = 'Loading listings…',
}) {
  const gridRef = useRef(null)
  const hasListings = listings.length > 0
  const capacity = useOneRowListingCapacity(gridRef, { enabled: true })
  const visibleListings = hasListings ? listings.slice(0, capacity) : []

  return (
    <div className="buy-page__visual-rail">
      <div className="commercial-page__listings-header">
        <header className="buy-page__intro">
          {note ? <span className="buy-page__handwritten-note">{note}</span> : null}
          <h2 id={headingId} className="buy-page__h2">
            {heading}
          </h2>
          {lead}
        </header>
      </div>

      {loading && !hasListings ? <LoadingState compact>{loadingLabel}</LoadingState> : null}

      {!loading && error && !hasListings ? <ErrorState compact>{error}</ErrorState> : null}

      {!loading && !error && !hasListings ? (
        <EmptyState compact>
          <p className="commercial-page__listings-empty">{emptyMessage}</p>
        </EmptyState>
      ) : null}

      {/* Always mount the measure/grid node so capacity tracks the rail width. */}
      <div
        ref={gridRef}
        className={
          hasListings
            ? 'listing-card-grid commercial-page__listing-grid commercial-page__listing-grid--one-row'
            : 'commercial-page__listing-grid-measure'
        }
        aria-hidden={hasListings ? undefined : true}
      >
        {visibleListings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            variant="home"
            showNewBadge
          />
        ))}
      </div>

      {hasListings && browsePath && ctaLabel ? (
        <div className="commercial-page__listings-footer">
          <Link to={browsePath} className="buy-page__btn buy-page__btn--primary">
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default CategoryListingsSection
