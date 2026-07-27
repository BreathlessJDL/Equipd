/**
 * Decorative marketplace browser preview for local hub heroes.
 * Pure HTML/CSS — no live listings, prices, or product copy.
 */
const PREVIEW_CHIPS = ['Cardio', 'Weights', 'Racks', 'Bikes']

function EquipmentSilhouette({ variant }) {
  if (variant === 1) {
    return (
      <svg viewBox="0 0 64 40" aria-hidden="true" className="location-page__preview-silhouette">
        <rect x="8" y="28" width="48" height="4" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="18" y="10" width="28" height="18" rx="2" fill="currentColor" opacity="0.22" />
        <circle cx="22" cy="30" r="5" fill="currentColor" opacity="0.28" />
        <circle cx="42" cy="30" r="5" fill="currentColor" opacity="0.28" />
      </svg>
    )
  }
  if (variant === 2) {
    return (
      <svg viewBox="0 0 64 40" aria-hidden="true" className="location-page__preview-silhouette">
        <rect x="28" y="6" width="8" height="28" rx="2" fill="currentColor" opacity="0.28" />
        <rect x="12" y="16" width="40" height="6" rx="2" fill="currentColor" opacity="0.22" />
        <circle cx="14" cy="19" r="6" fill="currentColor" opacity="0.3" />
        <circle cx="50" cy="19" r="6" fill="currentColor" opacity="0.3" />
      </svg>
    )
  }
  if (variant === 3) {
    return (
      <svg viewBox="0 0 64 40" aria-hidden="true" className="location-page__preview-silhouette">
        <path
          d="M12 30h40M18 30V14c0-2 2-4 6-4h16c4 0 6 2 6 4v16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.3"
        />
        <circle cx="20" cy="32" r="4" fill="currentColor" opacity="0.28" />
        <circle cx="44" cy="32" r="4" fill="currentColor" opacity="0.28" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" className="location-page__preview-silhouette">
      <rect x="14" y="8" width="36" height="24" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="20" y="14" width="10" height="14" rx="1.5" fill="currentColor" opacity="0.28" />
      <rect x="34" y="14" width="10" height="14" rx="1.5" fill="currentColor" opacity="0.28" />
    </svg>
  )
}

function PreviewCard({ variant, hideOnNarrow }) {
  return (
    <div
      className={`location-page__preview-card${hideOnNarrow ? ' location-page__preview-card--hide-narrow' : ''}`}
    >
      <div className="location-page__preview-card-media">
        <EquipmentSilhouette variant={variant} />
        <span className="location-page__preview-save" aria-hidden="true" />
      </div>
      <div className="location-page__preview-card-lines">
        <span className="location-page__preview-line location-page__preview-line--wide" />
        <span className="location-page__preview-line location-page__preview-line--narrow" />
      </div>
    </div>
  )
}

function LocationHeroMarketplacePreview({ cityName }) {
  const label = cityName?.trim() || 'Local'

  return (
    <div className="location-page__preview" aria-hidden="true">
      <div className="location-page__preview-glow" />
      <div className="location-page__preview-browser">
        <div className="location-page__preview-chrome">
          <span className="location-page__preview-dot" />
          <span className="location-page__preview-dot" />
          <span className="location-page__preview-dot" />
          <span className="location-page__preview-url" />
        </div>
        <div className="location-page__preview-body">
          <div className="location-page__preview-search">
            <span className="location-page__preview-search-icon" />
            <span className="location-page__preview-search-bar" />
          </div>
          <div className="location-page__preview-chips">
            {PREVIEW_CHIPS.map((chip) => (
              <span key={chip} className="location-page__preview-chip">
                {chip}
              </span>
            ))}
          </div>
          <div className="location-page__preview-grid">
            <PreviewCard variant={1} />
            <PreviewCard variant={2} />
            <PreviewCard variant={3} hideOnNarrow />
            <PreviewCard variant={4} hideOnNarrow />
          </div>
          <div className="location-page__preview-location">
            <span className="location-page__preview-pin" />
            <span className="location-page__preview-location-label">{label}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocationHeroMarketplacePreview
