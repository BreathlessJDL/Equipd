import ListingCard from './ListingCard'

function ListingBrowseResults({
  loading,
  error,
  listings,
  hasFilters,
  emptyMessage,
  emptyFilteredMessage,
}) {
  if (loading) {
    return (
      <p className="listing-browse__message listing-browse__message--empty">Loading listings…</p>
    )
  }

  if (error) {
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

  return (
    <div className="listing-browse__grid">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}

export default ListingBrowseResults
