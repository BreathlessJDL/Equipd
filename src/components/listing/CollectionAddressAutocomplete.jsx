import { useEffect, useRef, useState } from 'react'
import {
  hideGooglePlacesAutocompleteDropdown,
  isGoogleMapsConfigured,
  loadGoogleMapsPlaces,
  mapGooglePlaceToFormattedAddress,
  resetGooglePlacesAutocompleteDropdownVisibility,
} from '../../lib/listingLocation'
import './ListingLocationAutocomplete.css'

function CollectionAddressAutocomplete({
  inputId,
  value,
  disabled = false,
  onChange,
  inputClassName = 'listing-form__input listing-form__input--underline',
  placeholder = 'Start typing your collection address',
}) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const isFocusedRef = useRef(false)
  const [loadError, setLoadError] = useState('')
  const [placesStatus, setPlacesStatus] = useState(() =>
    isGoogleMapsConfigured() ? 'loading' : 'unconfigured',
  )

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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
      setLoadError('')
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
            fields: ['formatted_address', 'address_components', 'geometry'],
            types: ['address'],
          })
          inputRef.current._equipdPlacesAutocomplete = autocomplete
        }

        if (placeChangedListener && window.google?.maps?.event) {
          window.google.maps.event.removeListener(placeChangedListener)
        }

        placeChangedListener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const formattedAddress = mapGooglePlaceToFormattedAddress(place)

          if (!formattedAddress) {
            setLoadError('Select an address from the suggestions.')
            return
          }

          if (inputRef.current) {
            inputRef.current.value = formattedAddress
          }

          onChangeRef.current(formattedAddress)
          hideGooglePlacesAutocompleteDropdown()
          setLoadError('')
        })

        autocompleteRef.current = autocomplete
        setPlacesStatus('ready')
        setLoadError('')
      } catch (error) {
        if (cancelled) return
        setPlacesStatus('failed')
        setLoadError(error.message || 'Address search failed to load.')
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
    onChangeRef.current(event.target.value)

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
