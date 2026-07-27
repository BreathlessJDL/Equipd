import { Link } from 'react-router-dom'
import { BUYER_PROTECTION_HELP_PATH } from '../../lib/trustMessaging'

function LocationBrowseSidebar({ locationView }) {
  return (
    <aside
      className="location-page__sidebar"
      aria-labelledby="location-guide-heading"
    >
      <div className="location-page__sidebar-card">
        <h2 id="location-guide-heading" className="location-page__sidebar-title">
          {locationView.guideHeading}
        </h2>
        <ol className="location-page__guide-list">
          {(locationView.guideItems ?? []).map((item, index) => (
            <li key={item.title} className="location-page__guide-item">
              <span className="location-page__guide-mark" aria-hidden="true">
                {index + 1}
              </span>
              <div className="location-page__guide-copy">
                <h3 className="location-page__guide-item-title">{item.title}</h3>
                <p className="location-page__guide-item-body">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link to={BUYER_PROTECTION_HELP_PATH} className="location-page__guide-link">
          Learn more about Buyer Protection
        </Link>
      </div>
    </aside>
  )
}

export default LocationBrowseSidebar
