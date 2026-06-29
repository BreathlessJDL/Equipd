import { useCallback, useEffect, useRef, useState } from 'react'
import {
  findPacContainerForInput,
  hideGooglePlacesAutocompleteDropdown,
  isGoogleMapsConfigured,
  loadGoogleMapsPlaces,
  resetGooglePlacesAutocompleteDropdownVisibility,
} from '../lib/listingLocation'

/**
 * Shared Google Places Autocomplete binding for a single text input.
 * Keeps pac-container visibility scoped per input so multiple autocompletes
 * on one page (e.g. listing location + collection address) do not break.
 */
export function useGooglePlacesAutocomplete({
  disabled = false,
  createAutocomplete,
  onPlaceChanged,
}) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const onPlaceChangedRef = useRef(onPlaceChanged)
  const isFocusedRef = useRef(false)
  const [loadError, setLoadError] = useState('')
  const [placesStatus, setPlacesStatus] = useState(() =>
    isGoogleMapsConfigured() ? 'loading' : 'unconfigured',
  )

  useEffect(() => {
    onPlaceChangedRef.current = onPlaceChanged
  }, [onPlaceChanged])

  const bindAutocomplete = useCallback(async () => {
    if (!isGoogleMapsConfigured() || disabled || !inputRef.current) {
      return null
    }

    const google = await loadGoogleMapsPlaces()
    if (!inputRef.current || disabled) return null

    let autocomplete = inputRef.current._equipdPlacesAutocomplete

    if (!autocomplete) {
      autocomplete = createAutocomplete(google, inputRef.current)
      inputRef.current._equipdPlacesAutocomplete = autocomplete
    }

    autocompleteRef.current = autocomplete
    findPacContainerForInput(inputRef.current)
    resetGooglePlacesAutocompleteDropdownVisibility(inputRef.current)
    return autocomplete
  }, [createAutocomplete, disabled])

  useEffect(() => {
    if (disabled) {
      return undefined
    }

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
        const autocomplete = await bindAutocomplete()
        if (cancelled || !autocomplete) return

        if (placeChangedListener && window.google?.maps?.event) {
          window.google.maps.event.removeListener(placeChangedListener)
        }

        placeChangedListener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          onPlaceChangedRef.current(place, {
            autocomplete,
            input: inputRef.current,
            setLoadError,
            hideDropdown: () => hideGooglePlacesAutocompleteDropdown(inputRef.current),
          })
        })

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
  }, [bindAutocomplete, disabled])

  const ensureAutocompleteReady = useCallback(async () => {
    if (disabled || !inputRef.current) return

    try {
      await bindAutocomplete()
      if (placesStatus !== 'ready') {
        setPlacesStatus('ready')
      }
      setLoadError('')
    } catch (error) {
      setPlacesStatus('failed')
      setLoadError(error.message || 'Location search failed to load.')
    }
  }, [bindAutocomplete, disabled, placesStatus])

  const handleInputFocus = useCallback(() => {
    isFocusedRef.current = true
    resetGooglePlacesAutocompleteDropdownVisibility(inputRef.current)
    findPacContainerForInput(inputRef.current)
    ensureAutocompleteReady()
  }, [ensureAutocompleteReady])

  const handleInputBlur = useCallback(() => {
    isFocusedRef.current = false
  }, [])

  const syncInputValue = useCallback((value) => {
    if (!inputRef.current || isFocusedRef.current) return

    const nextValue = value ?? ''
    if (inputRef.current.value !== nextValue) {
      inputRef.current.value = nextValue
    }
  }, [])

  const handleInputChange = useCallback(
    (event, onTextChange) => {
      resetGooglePlacesAutocompleteDropdownVisibility(inputRef.current)
      findPacContainerForInput(inputRef.current)
      onTextChange(event.target.value)

      if (placesStatus === 'ready') {
        setLoadError('')
      }
    },
    [placesStatus],
  )

  return {
    inputRef,
    isFocusedRef,
    loadError,
    setLoadError,
    placesStatus,
    handleInputFocus,
    handleInputBlur,
    syncInputValue,
    handleInputChange,
    ensureAutocompleteReady,
  }
}
