import ListingCard from '../ListingCard'

function ListingRecommendations({
  recommendations = [],
  loading = false,
  placement = 'desktop',
  showWhenEmpty = false,
  emptyMessage = 'No similar active listings are available right now.',
}) {
  const isEmpty = !loading && recommendations.length === 0
  if (isEmpty && !showWhenEmpty) {
    return null
  }

  return (
    <section
      id={placement === 'desktop' ? 'listing-similar-listings' : undefined}
      className={`listing-detail__recommendations listing-detail__recommendations--${placement}`}
      aria-labelledby={`listing-recommendations-title-${placement}`}
    >
      <h2
        id={`listing-recommendations-title-${placement}`}
        className="listing-detail__recommendations-title"
      >
        You might also like
      </h2>
      {loading ? (
        <p className="listing-detail__recommendations-empty">Loading similar listings…</p>
      ) : isEmpty ? (
        <p className="listing-detail__recommendations-empty">{emptyMessage}</p>
      ) : (
        <div className="listing-detail__recommendations-track">
          {recommendations.map((item) => (
            <ListingCard key={item.id} listing={item} variant="grid" showNewBadge />
          ))}
        </div>
      )}
    </section>
  )
}

export default ListingRecommendations
