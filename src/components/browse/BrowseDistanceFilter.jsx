import { useEffect, useState } from 'react'
import BrowseLocationSearchField from './BrowseLocationSearchField'
import { BROWSE_LOCATION_PROMPT_COPY } from '../../lib/browseGeolocation'
import {
  BROWSE_CURRENT_LOCATION_LABEL,
  BROWSE_RADIUS_SLIDER_MAX,
  BROWSE_RADIUS_SLIDER_MIN,
  BROWSE_RADIUS_SLIDER_PREVIEW_MILES,
  BROWSE_RADIUS_SLIDER_STEP,
  BROWSE_RADIUS_UK_WIDE,
  getBrowseRadiusSliderDisplayMiles,
  getBrowseRadiusSliderProgress,
  getEditableBrowseLocationInputValue,
  isPrivateBrowserOrigin,
  isValidCoordinate,
  snapBrowseRadiusMiles,
} from '../../lib/listingDistance'
import './BrowseDistanceFilter.css'

function LocationPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10.8" r="2.2" fill="currentColor" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function BrowseDistanceFilter({
  inputId = 'browse-distance',
  locationSearch = '',
  locationPlace = null,
  onLocationSearchChange,
  onLocationPlaceSelected,
  radiusMiles = BROWSE_RADIUS_UK_WIDE,
  onRadiusChange,
  geolocationMessage = '',
  locatingCurrent = false,
  onRequestCurrentLocation,
  compact = false,
}) {
  const [showTownSearch, setShowTownSearch] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [inputValue, setInputValue] = useState(() =>
    getEditableBrowseLocationInputValue(locationPlace, locationSearch),
  )
  const [previewMiles, setPreviewMiles] = useState(() =>
    getBrowseRadiusSliderDisplayMiles(radiusMiles),
  )
  const hasExplicitOrigin =
    isValidCoordinate(locationPlace?.latitude) && isValidCoordinate(locationPlace?.longitude)
  const selectedLabel = isPrivateBrowserOrigin(locationPlace, locationSearch)
    ? BROWSE_CURRENT_LOCATION_LABEL
    : locationPlace?.displayLabel || locationSearch?.trim() || ''
  const showLocationChoices = !hasExplicitOrigin || editingLocation
  const sliderEnabled = hasExplicitOrigin
  const sliderProgress = getBrowseRadiusSliderProgress(previewMiles)

  useEffect(() => {
    setPreviewMiles(getBrowseRadiusSliderDisplayMiles(radiusMiles))
  }, [radiusMiles])

  function beginTownSearch() {
    setInputValue(getEditableBrowseLocationInputValue(locationPlace, locationSearch))
    setShowTownSearch(true)
  }

  function handleLocationInputChange(nextValue) {
    setInputValue(nextValue)
    const hasCommittedSelection =
      hasExplicitOrigin || Boolean(locationPlace) || Boolean(locationSearch?.trim())
    if (hasCommittedSelection) {
      onLocationSearchChange?.('')
    }
  }

  function commitSliderMiles(rawValue) {
    const next = snapBrowseRadiusMiles(rawValue) ?? BROWSE_RADIUS_SLIDER_PREVIEW_MILES
    setPreviewMiles(next)
    if (!hasExplicitOrigin) return
    onRadiusChange?.(String(next))
  }

  function handlePlaceSelected(place) {
    if (!place) return
    setInputValue(place.displayLabel || '')
    setShowTownSearch(false)
    setEditingLocation(false)
    onLocationPlaceSelected?.(place)
  }

  return (
    <div className={`browse-distance-filter${compact ? ' browse-distance-filter--compact' : ''}`}>
      <section className="browse-distance-filter__section" aria-labelledby={`${inputId}-location-heading`}>
        <h3 id={`${inputId}-location-heading`} className="browse-distance-filter__heading">
          {showLocationChoices ? 'Choose your location' : 'Location'}
        </h3>
        {showLocationChoices ? (
          <p className="browse-distance-filter__copy">{BROWSE_LOCATION_PROMPT_COPY}</p>
        ) : null}

        {hasExplicitOrigin && !editingLocation ? (
          <div className="browse-distance-filter__selected">
            <span className="browse-distance-filter__selected-icon" aria-hidden="true">
              <LocationPinIcon />
            </span>
            <div className="browse-distance-filter__selected-copy">
              <p className="browse-distance-filter__selected-name">{selectedLabel}</p>
            </div>
            <button
              type="button"
              className="browse-distance-filter__change"
              onClick={() => {
                setEditingLocation(true)
                setShowTownSearch(false)
              }}
            >
              Change location
            </button>
          </div>
        ) : null}

        {showLocationChoices ? (
          <div className="browse-distance-filter__location-actions">
            <button
              type="button"
              className="listing-browse__button listing-browse__button--primary browse-distance-filter__choice browse-distance-filter__choice--current"
              onClick={onRequestCurrentLocation}
              disabled={locatingCurrent}
            >
              <span className="browse-distance-filter__choice-icon">
                <CrosshairIcon />
              </span>
              {locatingCurrent ? 'Finding location…' : 'Use my current location'}
            </button>
            {showTownSearch ? (
              <div className="browse-distance-filter__town-field">
                <span className="browse-distance-filter__town-icon" aria-hidden="true">
                  <SearchIcon />
                </span>
                <BrowseLocationSearchField
                  inputId={`${inputId}-location`}
                  value={inputValue}
                  selectedPlace={locationPlace}
                  onSearchChange={handleLocationInputChange}
                  onPlaceSelected={handlePlaceSelected}
                  geolocationMessage=""
                  placeholder="Enter a town or postcode"
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                className="listing-browse__button listing-browse__button--secondary browse-distance-filter__choice browse-distance-filter__choice--town"
                onClick={beginTownSearch}
              >
                <span className="browse-distance-filter__choice-icon">
                  <SearchIcon />
                </span>
                Enter a town or postcode
              </button>
            )}
            {geolocationMessage ? (
              <p className="browse-distance-filter__status" role="status">
                {geolocationMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        className={`browse-distance-filter__section browse-distance-filter__section--slider${
          sliderEnabled ? '' : ' browse-distance-filter__section--slider-disabled'
        }`}
        aria-labelledby={`${inputId}-distance-heading`}
      >
        <div className="browse-distance-filter__slider-head">
          <h3 id={`${inputId}-distance-heading`} className="browse-distance-filter__heading">
            Search distance
          </h3>
          <p className="browse-distance-filter__slider-value" aria-live="polite">
            <span className="browse-distance-filter__slider-prefix">Within</span>
            <span className="browse-distance-filter__slider-amount">
              <strong>{previewMiles}</strong> miles
            </span>
          </p>
        </div>

        <label className="visually-hidden" htmlFor={`${inputId}-radius`}>
          Search radius in miles
        </label>
        <input
          id={`${inputId}-radius`}
          className="browse-distance-filter__slider"
          type="range"
          min={BROWSE_RADIUS_SLIDER_MIN}
          max={BROWSE_RADIUS_SLIDER_MAX}
          step={BROWSE_RADIUS_SLIDER_STEP}
          value={previewMiles}
          disabled={!sliderEnabled}
          aria-valuemin={BROWSE_RADIUS_SLIDER_MIN}
          aria-valuemax={BROWSE_RADIUS_SLIDER_MAX}
          aria-valuenow={previewMiles}
          aria-valuetext={`${previewMiles} miles`}
          style={{ '--slider-progress': `${sliderProgress}%` }}
          onInput={(event) => commitSliderMiles(event.currentTarget.value)}
          onChange={(event) => commitSliderMiles(event.currentTarget.value)}
        />
        <div className="browse-distance-filter__slider-ticks" aria-hidden="true">
          <span>5 mi</span>
          <span>100 mi</span>
          <span>200 mi</span>
        </div>
        {!sliderEnabled ? (
          <p className="browse-distance-filter__status">Select a location to search within a distance.</p>
        ) : null}
      </section>
    </div>
  )
}

export default BrowseDistanceFilter
