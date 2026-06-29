import { useCallback, useEffect } from 'react'
import {
  mapGooglePlaceToFormattedAddress,
  mapGooglePlaceToListingLocation,
} from '../../lib/listingLocation'
import { useGooglePlacesAutocomplete } from '../../hooks/useGooglePlacesAutocomplete'
import './ListingLocationAutocomplete.css'

function CollectionAddressAutocomplete({
  inputId,
  value,
  disabled = false,
  onChange,
  onPlaceSelected,
  inputClassName = 'listing-form__input listing-form__input--underline',
  placeholder = 'Start typing your collection address',
}) {
  const createAutocomplete = useCallback(
    (google, input) =>
      new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'gb' },
        fields: ['formatted_address', 'address_components', 'geometry', 'name'],
        types: ['address'],
      }),
    [],
  )

  const handlePlaceChanged = useCallback(
    (place, { input, setLoadError, hideDropdown }) => {
      const formattedAddress = mapGooglePlaceToFormattedAddress(place)

      if (!formattedAddress) {
        setLoadError('Select an address from the suggestions.')
        return
      }

      const publicLocation = mapGooglePlaceToListingLocation(place)

      if (input) {
        input.value = formattedAddress
      }

      onChange(formattedAddress)
      onPlaceSelected?.({
        formattedAddress,
        publicLocation,
      })
      hideDropdown()
      setLoadError('')
    },
    [onChange, onPlaceSelected],
  )

  const {
    inputRef,
    loadError,
    placesStatus,
    handleInputFocus,
    handleInputBlur,
    syncInputValue,
    handleInputChange,
  } = useGooglePlacesAutocomplete({
    disabled,
    createAutocomplete,
    onPlaceChanged: handlePlaceChanged,
  })

  useEffect(() => {
    syncInputValue(value)
  }, [value, syncInputValue])

  function handleChange(event) {
    handleInputChange(event, onChange)
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
      />

      {placesStatus === 'loading' ? (
        <p className="listing-location-autocomplete__hint">Loading address search…</p>
      ) : null}

      {placesStatus === 'failed' && loadError ? (
        <>
          <p className="listing-location-autocomplete__error" role="alert">
            {loadError}
          </p>
          <p className="listing-location-autocomplete__hint">
            You can still type an address manually, but autocomplete is unavailable.
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
          You can type your collection address manually. Add <code>VITE_GOOGLE_MAPS_API_KEY</code>{' '}
          to enable address autocomplete.
        </p>
      ) : null}
    </div>
  )
}

export default CollectionAddressAutocomplete
