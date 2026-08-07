import './HomeRecentListingsSkeleton.css'

const SKELETON_COUNT = 4

/**
 * Mirrors the real card grid while listings load so the strip does not grow
 * and push the rest of the homepage down.
 */
function HomeRecentListingsSkeleton() {
  return (
    <div className="home-listing-grid" aria-hidden="true">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <article key={index} className="listing-card listing-card--grid listing-card-skeleton">
          <div className="listing-card__media">
            <div className="listing-card__image listing-card__image--placeholder" />
          </div>
          <div className="listing-card__body">
            <span className="listing-card-skeleton__bar listing-card-skeleton__bar--pill" />
            <span className="listing-card-skeleton__bar listing-card-skeleton__bar--title" />
            <span className="listing-card-skeleton__bar listing-card-skeleton__bar--price" />
            <span className="listing-card-skeleton__bar listing-card-skeleton__bar--meta" />
          </div>
        </article>
      ))}
    </div>
  )
}

export default HomeRecentListingsSkeleton
