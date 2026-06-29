import { useCallback, useEffect } from 'react'
import { mapGooglePlaceToListingLocation } from '../../lib/listingLocation'
import { useGooglePlacesAutocomplete } from '../../hooks/useGooglePlacesAutocomplete'
import './ListingLocationAutocomplete.css'

function ListingLocationAutocomplete({
  inputId,
  value,
  selectedPlace,
  disabled = false,
  validationAttempted = false,
  onSearchChange,
  onPlaceSelected,
  inputClassName = 'listing-form__input listing-form__input--underline',
  placeholder = 'Search town, city, postcode or area',
}) {
  const createAutocomplete = useCallback(
    (google, input) =>
      new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'gb' },
        fields: ['address_components', 'geometry', 'formatted_address', 'name'],
        types: ['geocode'],
      }),
    [],
  )

  const handlePlaceChanged = useCallback(
    (place, { input, setLoadError, hideDropdown }) => {
      if (!place?.geometry?.location) {
        setLoadError('Select a location from the suggestions.')
        return
      }

      const mapped = mapGooglePlaceToListingLocation(place)
      if (input) {
        input.value = mapped.displayLabel
      }
      onPlaceSelected(mapped)
      onSearchChange(mapped.displayLabel)
      hideDropdown()
      setLoadError('')
    },
    [onPlaceSelected, onSearchChange],
  )

  const {
    inputRef,
    loadError,
    setLoadError,
    placesStatus,
    handleInputFocus,
    handleInputBlur,
    syncInputValue,
    handleInputChange,
    ensureAutocompleteReady,
  } = useGooglePlacesAutocomplete({
    disabled,
    createAutocomplete,
    onPlaceChanged: handlePlaceChanged,
  })

  useEffect(() => {
    syncInputValue(value)
  }, [value, syncInputValue])

  useEffect(() => {
    if (!validationAttempted || !inputRef.current) return

    ensureAutocompleteReady()
  }, [validationAttempted, ensureAutocompleteReady, inputRef])

  function handleChange(event) {
    handleInputChange(event, (nextValue) => {
      onSearchChange(nextValue)

      if (selectedPlace) {
        onPlaceSelected(null)
      }
    })
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
        onChange={handleChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        aria-describedby={selectedPlace?.displayLabel ? `${inputId}-location-status` : undefined}
        aria-invalid={validationAttempted && !selectedPlace ? true : undefined}
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
