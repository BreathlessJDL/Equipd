function LocationTrustIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 6 9.5 16.5 4 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const LOCATION_TRUST_BENEFITS = [
  'Inspect before collection',
  'Secure Stripe checkout',
  'Buyer Protection included',
  'QR handover confirmation',
]

function LocationBrowseSidebar({ locationView }) {
  const scopeCopy = locationView.selectedArea
    ? `${locationView.selectedArea} and nearby ${locationView.regionName} towns`
    : `${locationView.regionName} and nearby towns`

  return (
    <aside
      className="location-page__sidebar"
      aria-label={`Buying gym equipment near ${locationView.name}`}
    >
      <div className="location-page__sidebar-card">
        <h2 className="location-page__sidebar-title">
          Buying used gym equipment near {locationView.name}
        </h2>
        <p className="location-page__sidebar-lead">
          Equipd connects you with local sellers across {scopeCopy}. Many listings offer
          collection, seller delivery within their radius, or buyer-arranged courier once payment
          is complete.
        </p>
        <ul className="location-page__trust-list">
          {LOCATION_TRUST_BENEFITS.map((benefit) => (
            <li key={benefit}>
              <LocationTrustIcon />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

export default LocationBrowseSidebar
