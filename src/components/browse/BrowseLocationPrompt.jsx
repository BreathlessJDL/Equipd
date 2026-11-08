import { createPortal } from 'react-dom'
import BrowseLocationSearchField from './BrowseLocationSearchField'
import { BROWSE_LOCATION_PROMPT_COPY } from '../../lib/browseGeolocation'
import './BrowseLocationPrompt.css'

function BrowseLocationPrompt({
  open,
  inputId = 'browse-location-prompt',
  locationSearch = '',
  locationPlace = null,
  onLocationSearchChange,
  onLocationPlaceSelected,
  geolocationMessage = '',
  locatingCurrent = false,
  onRequestCurrentLocation,
  onCancel,
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="browse-location-prompt" role="presentation">
      <button
        type="button"
        className="browse-location-prompt__backdrop"
        aria-label="Keep nationwide search"
        onClick={onCancel}
      />
      <div
        className="browse-location-prompt__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        aria-describedby={`${inputId}-copy`}
      >
        <h2 id={`${inputId}-title`} className="browse-location-prompt__title">
          Choose a search location
        </h2>
        <p id={`${inputId}-copy`} className="browse-location-prompt__copy">
          {BROWSE_LOCATION_PROMPT_COPY}
        </p>

        <BrowseLocationSearchField
          inputId={`${inputId}-field`}
          value={locationSearch}
          selectedPlace={locationPlace}
          onSearchChange={onLocationSearchChange}
          onPlaceSelected={onLocationPlaceSelected}
          geolocationMessage={geolocationMessage}
        />

        <div className="browse-location-prompt__actions">
          <button
            type="button"
            className="listing-browse__button listing-browse__button--primary"
            onClick={onRequestCurrentLocation}
            disabled={locatingCurrent}
          >
            {locatingCurrent ? 'Finding location…' : 'Use my current location'}
          </button>
          <button
            type="button"
            className="listing-browse__button listing-browse__button--secondary"
            onClick={onCancel}
          >
            Keep nationwide search
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default BrowseLocationPrompt
