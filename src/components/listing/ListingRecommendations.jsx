import ListingCard from '../ListingCard'

function ListingRecommendations({
  recommendations = [],
  loading = false,
  placement = 'desktop',
}) {
  if (loading || recommendations.length === 0) {
    return null
  }

  return (
    <section
      className={`listing-detail__recommendations listing-detail__recommendations--${placement}`}
      aria-labelledby={`listing-recommendations-title-${placement}`}
    >
      <h2
        id={`listing-recommendations-title-${placement}`}
        className="listing-detail__recommendations-title"
      >
        You might also like
      </h2>
      <div className="listing-detail__recommendations-track">
        {recommendations.map((item) => (
          <ListingCard key={item.id} listing={item} variant="grid" showNewBadge />
        ))}
      </div>
    </section>
  )
}

export default ListingRecommendations
