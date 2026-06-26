import { useEffect, useRef, useState } from 'react'
import {
  hideGooglePlacesAutocompleteDropdown,
  isGoogleMapsConfigured,
  loadGoogleMapsPlaces,
  mapGooglePlaceToListingLocation,
  resetGooglePlacesAutocompleteDropdownVisibility,
} from '../../lib/listingLocation'
import './ListingLocationAutocomplete.css'

function ListingLocationAutocomplete({
  inputId,
  value,
  selectedPlace,
  disabled = false,
  onSearchChange,
  onPlaceSelected,
  inputClassName = 'listing-form__input listing-form__input--underline',
  placeholder = 'Search town, city, postcode or area',
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
      setLoadError('Location search is unavailable until VITE_GOOGLE_MAPS_API_KEY is configured.')
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
          onSearchChangeRef.current(mapped.displayLabel)
          hideGooglePlacesAutocompleteDropdown()
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
    resetGooglePlacesAutocompleteDropdownVisibility()
    onSearchChangeRef.current(event.target.value)

    if (selectedPlace) {
      onPlaceSelected(null)
    }

    if (placesStatus === 'ready') {
      setLoadError('')
    }
  }

  function handleInputFocus() {
    isFocusedRef.current = true
    resetGooglePlacesAutocompleteDropdownVisibility()
  }

  function handleInputBlur() {
    isFocusedRef.current = false
  }

  return (
    <div className="listing-location-autocomplete">
      <input
        ref={inputRef}
        id={inputId}
        className={inputClassName}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        defaultValue={value ?? ''}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        aria-describedby={selectedPlace?.displayLabel ? `${inputId}-location-status` : undefined}
      />

      {selectedPlace?.displayLabel ? (
        <span id={`${inputId}-location-status`} className="visually-hidden">
          Selected: {selectedPlace.displayLabel}
        </span>
      ) : null}

      {placesStatus === 'loading' ? (
        <p className="listing-location-autocomplete__hint">Loading location search…</p>
      ) : null}

      {placesStatus === 'failed' && loadError ? (
        <>
          <p className="listing-location-autocomplete__error" role="alert">
            {loadError}
          </p>
          <p className="listing-location-autocomplete__hint">
            You can still type a location manually, but structured search is unavailable.
          </p>
        </>
      ) : null}

      {placesStatus === 'ready' && loadError ? (
        <p className="listing-location-autocomplete__error" role="alert">
          {loadError}
        </p>
      ) : null}

      {placesStatus === 'unconfigured' ? (
        <p className="listing-location-autocomplete__hint">
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable Google Places search.
        </p>
      ) : null}
    </div>
  )
}

export default ListingLocationAutocomplete
