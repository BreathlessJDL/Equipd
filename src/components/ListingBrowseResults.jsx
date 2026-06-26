import ListingCard from './ListingCard'

function ListingBrowseResults({
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  error,
  listings,
  hasFilters,
  emptyMessage,
  emptyFilteredMessage,
  variant = 'home',
  sectionTitle = 'Available equipment',
  showSectionHeader = true,
}) {
  if (loading && listings.length === 0) {
    return (
      <p className="listing-browse__message listing-browse__message--empty">Loading listings…</p>
    )
  }

  if (error && listings.length === 0) {
    return (
      <p className="listing-browse__message listing-browse__message--error" role="alert">
        {error}
      </p>
    )
  }

  if (listings.length === 0) {
    return (
      <p className="listing-browse__message listing-browse__message--empty">
        {hasFilters ? emptyFilteredMessage : emptyMessage}
      </p>
    )
  }

  const loadMoreFooter =
    hasMore || loadingMore ? (
      <div className="listing-browse__load-more">
        {error ? (
          <p className="listing-browse__message listing-browse__message--error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="listing-browse__button listing-browse__button--secondary listing-browse__load-more-button"
          onClick={onLoadMore}
          disabled={loadingMore || !hasMore}
          aria-busy={loadingMore}
        >
          {loadingMore ? 'Loading more…' : 'Load more'}
        </button>
      </div>
    ) : null

  if (variant !== 'row') {
    return (
      <div className="listing-browse__results">
        {showSectionHeader ? (
          <header className="listing-browse__results-header">
            <h2 className="listing-browse__results-title">{sectionTitle}</h2>
          </header>
        ) : null}
        <div className="listing-browse__grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} variant="home" />
          ))}
        </div>
        {loadMoreFooter}
      </div>
    )
  }

  return (
    <div className="listing-browse__results">
      {showSectionHeader ? (
        <header className="listing-browse__results-header">
          <h2 className="listing-browse__results-title">{sectionTitle}</h2>
        </header>
      ) : null}
      <div className="listing-browse__list">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} variant="row" />
        ))}
      </div>
      {loadMoreFooter}
    </div>
  )
}

export default ListingBrowseResults
