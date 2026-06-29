import { useEffect, useRef, useState } from 'react'
import {
  findPacContainerForInput,
  hideGooglePlacesAutocompleteDropdown,
  isGoogleMapsConfigured,
  loadGoogleMapsPlaces,
  mapGooglePlaceToListingLocation,
  resetGooglePlacesAutocompleteDropdownVisibility,
} from '../../lib/listingLocation'
import './BrowseLocationSearchField.css'

function BrowseLocationSearchField({
  inputId,
  value,
  selectedPlace,
  disabled = false,
  onSearchChange,
  onPlaceSelected,
  geolocationMessage = '',
}) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const onPlaceSelectedRef = useRef(onPlaceSelected)
  const onSearchChangeRef = useRef(onSearchChange)
  const isFocusedRef = useRef(false)
  const [loadError, setLoadError] = useState('')
  const [placesStatus, setPlacesStatus] = useState(() =>
    isGoogleMapsConfigured() ? 'loading' : 'unconfigured',
  )

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected
    onSearchChangeRef.current = onSearchChange
  }, [onPlaceSelected, onSearchChange])

  useEffect(() => {
    if (!inputRef.current || isFocusedRef.current) return

    const nextValue = value ?? ''
    if (inputRef.current.value !== nextValue) {
      inputRef.current.value = nextValue
    }
  }, [value])

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setPlacesStatus('unconfigured')
      return undefined
    }

    let cancelled = false
    let placeChangedListener = null

    async function initAutocomplete() {
      setPlacesStatus('loading')
      setLoadError('')

      try {
        const google = await loadGoogleMapsPlaces()
        if (cancelled || !inputRef.current) return

        let autocomplete = inputRef.current._equipdPlacesAutocomplete

        if (!autocomplete) {
          autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: 'gb' },
            fields: ['address_components', 'geometry', 'formatted_address', 'name'],
            types: ['geocode'],
          })
          inputRef.current._equipdPlacesAutocomplete = autocomplete
        }

        if (placeChangedListener && window.google?.maps?.event) {
          window.google.maps.event.removeListener(placeChangedListener)
        }

        placeChangedListener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place?.geometry?.location) {
            setLoadError('Select a location from the suggestions.')
            return
          }

          const mapped = mapGooglePlaceToListingLocation(place)
          if (inputRef.current) {
            inputRef.current.value = mapped.displayLabel
          }
          onPlaceSelectedRef.current(mapped)
          hideGooglePlacesAutocompleteDropdown(inputRef.current)
          setLoadError('')
        })

        autocompleteRef.current = autocomplete
        setPlacesStatus('ready')
        setLoadError('')
      } catch (error) {
        if (cancelled) return
        setPlacesStatus('failed')
        setLoadError(error.message || 'Location search failed to load.')
      }
    }

    initAutocomplete()

    return () => {
      cancelled = true

      if (placeChangedListener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(placeChangedListener)
      }

      autocompleteRef.current = null
    }
  }, [])

  function handleInputChange(event) {
    resetGooglePlacesAutocompleteDropdownVisibility(inputRef.current)
    findPacContainerForInput(inputRef.current)
    onSearchChangeRef.current(event.target.value)

    if (selectedPlace) {
      onPlaceSelectedRef.current(null)
    }

    if (placesStatus === 'ready') {
      setLoadError('')
    }
  }

  function handleInputFocus() {
    isFocusedRef.current = true
    resetGooglePlacesAutocompleteDropdownVisibility(inputRef.current)
    findPacContainerForInput(inputRef.current)
  }

  function handleInputBlur() {
    isFocusedRef.current = false
  }

  const showLoadingHint = placesStatus === 'loading'

  return (
    <div className="browse-location-search">
      <input
        ref={inputRef}
        id={inputId}
        className="listing-browse__input browse-location-search__input"
        type="text"
        autoComplete="off"
        placeholder="Search town, city or postcode"
        defaultValue={value ?? ''}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        aria-describedby={
          [selectedPlace?.displayLabel ? `${inputId}-location-selected` : null, geolocationMessage ? `${inputId}-geo-status` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />

      {selectedPlace?.displayLabel ? (
        <span id={`${inputId}-location-selected`} className="visually-hidden">
          Searching near {selectedPlace.displayLabel}
        </span>
      ) : null}

      {geolocationMessage ? (
        <p className="browse-location-search__hint" id={`${inputId}-geo-status`} role="status">
          {geolocationMessage}
        </p>
      ) : null}

      {showLoadingHint ? (
        <p className="browse-location-search__hint">Loading location search…</p>
      ) : null}

      {placesStatus === 'failed' && loadError ? (
        <>
          <p className="browse-location-search__error" role="alert">
            {loadError}
          </p>
          <p className="browse-location-search__hint">
            You can still type a location manually, but autocomplete is unavailable.
          </p>
        </>
      ) : null}

      {placesStatus === 'ready' && loadError ? (
        <p className="browse-location-search__error" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
  )
}

export default BrowseLocationSearchField
