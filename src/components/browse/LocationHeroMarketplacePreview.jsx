/**
 * Decorative location motif for local hub heroes.
 * One pin + one abstract route + floating city/count card. No listings or maps.
 */
function LocationHeroMarketplacePreview({ cityName, listingCountLabel }) {
  const label = cityName?.trim() || 'Local'
  const countText = listingCountLabel?.trim() || 'Listings nearby'

  return (
    <div className="location-page__preview" aria-hidden="true">
      <div className="location-page__preview-glow" />
      <svg
        className="location-page__preview-art"
        viewBox="0 0 320 260"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <path
          className="location-page__preview-route"
          d="M28 198 C 78 168, 118 214, 156 176 S 228 118, 268 148"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="10 12"
        />
        <g className="location-page__preview-pin" transform="translate(148 42)">
          <path
            d="M36 8 C18 8 4 22 4 40 C4 66 36 104 36 104 S68 66 68 40 C68 22 54 8 36 8 Z"
            fill="currentColor"
          />
          <circle cx="36" cy="40" r="14" fill="#fff" />
          <circle cx="36" cy="40" r="6.5" fill="currentColor" opacity="0.9" />
        </g>
      </svg>
      <div className="location-page__preview-card">
        <span className="location-page__preview-card-pin" />
        <div className="location-page__preview-card-copy">
          <span className="location-page__preview-card-city">{label}</span>
          <span className="location-page__preview-card-count">{countText}</span>
        </div>
      </div>
    </div>
  )
}

export default LocationHeroMarketplacePreview
