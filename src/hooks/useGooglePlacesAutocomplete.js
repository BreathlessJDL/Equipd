import { useCallback, useEffect, useRef, useState } from 'react'
import {
  destroyPlacesAutocompleteForInput,
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
  reinitializeOnFocus = false,
}) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const onPlaceChangedRef = useRef(onPlaceChanged)
  const isFocusedRef = useRef(false)
  const placeChangedListenerRef = useRef(null)
  const needsReinitRef = useRef(false)
  const [loadError, setLoadError] = useState('')
  const [placesStatus, setPlacesStatus] = useState(() =>
    isGoogleMapsConfigured() ? 'loading' : 'unconfigured',
  )

  useEffect(() => {
    onPlaceChangedRef.current = onPlaceChanged
  }, [onPlaceChanged])

  useEffect(() => {
    needsReinitRef.current = Boolean(reinitializeOnFocus)
  }, [reinitializeOnFocus])

  const attachPlaceChangedListener = useCallback((autocomplete) => {
    if (placeChangedListenerRef.current && window.google?.maps?.event) {
      window.google.maps.event.removeListener(placeChangedListenerRef.current)
    }

    placeChangedListenerRef.current = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      onPlaceChangedRef.current(place, {
        autocomplete,
        input: inputRef.current,
        setLoadError,
        hideDropdown: () => hideGooglePlacesAutocompleteDropdown(inputRef.current),
      })
    })
  }, [])

  const bindAutocomplete = useCallback(
    async ({ forceRecreate = false } = {}) => {
      if (!isGoogleMapsConfigured() || disabled || !inputRef.current) {
        return null
      }

      const google = await loadGoogleMapsPlaces()
      if (!inputRef.current || disabled) return null

      if (forceRecreate) {
        destroyPlacesAutocompleteForInput(inputRef.current)
      }

      let autocomplete = inputRef.current._equipdPlacesAutocomplete

      if (!autocomplete) {
        autocomplete = createAutocomplete(google, inputRef.current)
        inputRef.current._equipdPlacesAutocomplete = autocomplete
        attachPlaceChangedListener(autocomplete)
      }

      autocompleteRef.current = autocomplete
      resetGooglePlacesAutocompleteDropdownVisibility(inputRef.current)
      return autocomplete
    },
    [attachPlaceChangedListener, createAutocomplete, disabled],
  )

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

    async function initAutocomplete() {
      setPlacesStatus('loading')
      setLoadError('')

      try {
        const autocomplete = await bindAutocomplete()
        if (cancelled || !autocomplete) return

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

      if (placeChangedListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(placeChangedListenerRef.current)
      }

      placeChangedListenerRef.current = null
      autocompleteRef.current = null
    }
  }, [bindAutocomplete, disabled])

  const ensureAutocompleteReady = useCallback(
    async ({ forceRecreate = false } = {}) => {
      if (disabled || !inputRef.current) return

      try {
        await bindAutocomplete({ forceRecreate })
        setPlacesStatus('ready')
        setLoadError('')
      } catch (error) {
        setPlacesStatus('failed')
        setLoadError(error.message || 'Location search failed to load.')
      }
    },
    [bindAutocomplete, disabled],
  )

  const handleInputFocus = useCallback(async () => {
    isFocusedRef.current = true

    if (inputRef.current) {
      inputRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    const forceRecreate = needsReinitRef.current
    if (forceRecreate) {
      needsReinitRef.current = false
    }

    findPacContainerForInput(inputRef.current)
    await ensureAutocompleteReady({ forceRecreate })
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
