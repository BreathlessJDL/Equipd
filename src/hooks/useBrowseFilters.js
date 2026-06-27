import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyBrowseFiltersToSearchParams,
  buildBrowseActiveFilterChips,
  buildBrowseQueryOptions,
  countBrowsePanelFilters,
  hasActiveBrowseFilters,
  hasBrowseLocationForSort,
  parseBrowseFiltersFromSearchParams,
  removeBrowseFilterKey,
} from '../lib/browseFilters'
import {
  BROWSE_GEO_STATUS,
  buildCurrentLocationPlace,
  setBrowseGeolocationStatus,
  shouldAutoPromptBrowseGeolocation,
} from '../lib/browseGeolocation'
import { BROWSE_RADIUS_UK_WIDE, parseBrowseRadiusMiles } from '../lib/listingDistance'
import { DEFAULT_LISTING_SORT } from '../lib/listingSort'

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((value, index) => value === rightSorted[index])
}

function filtersEqual(left, right) {
  if (!left || !right) return false

  return (
    left.search === right.search &&
    arraysEqual(left.brands ?? [], right.brands ?? []) &&
    left.brand === right.brand &&
    arraysEqual(left.conditions ?? [], right.conditions ?? []) &&
    left.condition === right.condition &&
    left.rating === right.rating &&
    left.minPrice === right.minPrice &&
    left.maxPrice === right.maxPrice &&
    arraysEqual(left.categoryIds ?? [], right.categoryIds ?? []) &&
    left.categoryId === right.categoryId &&
    left.categorySlug === right.categorySlug &&
    left.sort === right.sort &&
    left.locationSearch === right.locationSearch &&
    left.radiusMiles === right.radiusMiles &&
    left.buyerLatitude === right.buyerLatitude &&
    left.buyerLongitude === right.buyerLongitude
  )
}

export function useBrowseFilters(
  searchParams,
  setSearchParams,
  {
    categories = [],
    locationAreas = [],
    categoriesReady = true,
    profileCoordinates = null,
  } = {},
) {
  const searchParamsKey = searchParams.toString()
  const urlSyncGenerationRef = useRef(0)

  const urlFilters = useMemo(
    () => parseBrowseFiltersFromSearchParams(searchParams, categories),
    [searchParams, categories],
  )

  const [draft, setDraft] = useState(urlFilters)
  const [debouncedDraft, setDebouncedDraft] = useState(urlFilters)
  const [geolocationMessage, setGeolocationMessage] = useState('')
  const geolocationPromptStartedRef = useRef(false)

  useEffect(() => {
    if (!categoriesReady) return

    urlSyncGenerationRef.current += 1
    const parsed = parseBrowseFiltersFromSearchParams(searchParams, categories)

    setDraft((current) => (filtersEqual(parsed, current) ? current : parsed))
    setDebouncedDraft((current) => (filtersEqual(parsed, current) ? current : parsed))
  }, [searchParamsKey, categoriesReady, categories, searchParams])

  useEffect(() => {
    const syncGeneration = urlSyncGenerationRef.current

    const timeoutId = window.setTimeout(() => {
      if (syncGeneration !== urlSyncGenerationRef.current) return
      setDebouncedDraft(draft)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [draft])

  const urlDraft = useMemo(
    () => ({
      ...debouncedDraft,
      locationSearch: draft.locationSearch,
      locationPlace: draft.locationPlace,
      buyerLatitude: draft.buyerLatitude,
      buyerLongitude: draft.buyerLongitude,
      radiusMiles: draft.radiusMiles,
      radiusMilesValue:
        draft.radiusMilesValue ?? parseBrowseRadiusMiles(draft.radiusMiles),
    }),
    [
      debouncedDraft,
      draft.buyerLatitude,
      draft.buyerLongitude,
      draft.locationPlace,
      draft.locationSearch,
      draft.radiusMiles,
      draft.radiusMilesValue,
    ],
  )

  useEffect(() => {
    if (!categoriesReady) return
    if (filtersEqual(urlDraft, urlFilters)) return

    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        applyBrowseFiltersToSearchParams(next, urlDraft, categories, { profileCoordinates })
        return next
      },
      { preventScrollReset: true },
    )
  }, [urlDraft, categories, categoriesReady, setSearchParams, urlFilters, profileCoordinates])

  const syncDraft = useCallback((updater) => {
    setDraft((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
      return next
    })
  }, [])

  const applyCurrentLocation = useCallback(
    (latitude, longitude) => {
      syncDraft((current) => {
        const useDefaultRadius = current.radiusMiles === BROWSE_RADIUS_UK_WIDE
        const nextRadiusMiles = useDefaultRadius ? '25' : current.radiusMiles

        return {
          ...current,
          locationSearch: 'Current location',
          locationPlace: buildCurrentLocationPlace(latitude, longitude),
          buyerLatitude: latitude,
          buyerLongitude: longitude,
          radiusMiles: nextRadiusMiles,
          radiusMilesValue: parseBrowseRadiusMiles(nextRadiusMiles),
        }
      })
    },
    [syncDraft],
  )

  useEffect(() => {
    if (!categoriesReady) return
    if (geolocationPromptStartedRef.current) return
    if (!shouldAutoPromptBrowseGeolocation(searchParams)) return
    if (!navigator.geolocation) return

    geolocationPromptStartedRef.current = true
    setBrowseGeolocationStatus(BROWSE_GEO_STATUS.PROMPTED)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowseGeolocationStatus(BROWSE_GEO_STATUS.GRANTED)
        setGeolocationMessage('')
        applyCurrentLocation(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setBrowseGeolocationStatus(BROWSE_GEO_STATUS.DENIED)
        setGeolocationMessage(
          'Location access was denied. You can search by town or postcode instead.',
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }, [applyCurrentLocation, categoriesReady, searchParams])

  const updateField = useCallback(
    (field, value) => {
      syncDraft({ [field]: value })
    },
    [syncDraft],
  )

  const handleLocationSearchChange = useCallback(
    (value) => {
      setGeolocationMessage('')
      syncDraft((current) => ({
        ...current,
        locationSearch: value,
        locationPlace: null,
        buyerLatitude: null,
        buyerLongitude: null,
        radiusMiles: BROWSE_RADIUS_UK_WIDE,
        radiusMilesValue: null,
      }))
    },
    [syncDraft],
  )

  const handleLocationPlaceSelected = useCallback(
    (place) => {
      setGeolocationMessage('')
      syncDraft((current) => ({
        ...current,
        locationPlace: place,
        locationSearch: place?.displayLabel ?? current.locationSearch,
        buyerLatitude: place?.latitude ?? null,
        buyerLongitude: place?.longitude ?? null,
        radiusMilesValue: parseBrowseRadiusMiles(current.radiusMiles),
      }))
    },
    [syncDraft],
  )

  const handleRadiusChange = useCallback(
    (value) => {
      syncDraft({
        radiusMiles: value,
        radiusMilesValue: parseBrowseRadiusMiles(value),
      })
    },
    [syncDraft],
  )

  const handleSortChange = useCallback(
    (nextSort) => {
      syncDraft({ sort: nextSort ?? DEFAULT_LISTING_SORT })
    },
    [syncDraft],
  )

  const resetFilters = useCallback(() => {
    const cleared = parseBrowseFiltersFromSearchParams(new URLSearchParams(), categories)
    setDraft(cleared)
    setDebouncedDraft(cleared)
    setSearchParams(new URLSearchParams(), { preventScrollReset: true })
  }, [categories, setSearchParams])

  const flushDraftUpdate = useCallback((updater) => {
    setDraft((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
      setDebouncedDraft(next)
      return next
    })
  }, [])

  const setCategoryId = useCallback(
    (value) => {
      syncDraft((current) => {
        const category = categories.find((entry) => entry.id === value)
        const categoryIds = value ? [value] : []
        return {
          ...current,
          categoryIds,
          categoryId: categoryIds[0] ?? '',
          categorySlug: category?.slug ?? '',
          categorySlugs: category?.slug ? [category.slug] : [],
        }
      })
    },
    [categories, syncDraft],
  )

  const setCategoryIds = useCallback(
    (value) => {
      const nextIds = Array.isArray(value) ? value.filter(Boolean) : []
      syncDraft((current) => {
        const categorySlugs = nextIds
          .map((id) => categories.find((entry) => entry.id === id)?.slug)
          .filter(Boolean)
        return {
          ...current,
          categoryIds: nextIds,
          categoryId: nextIds[0] ?? '',
          categorySlug: categorySlugs[0] ?? '',
          categorySlugs,
        }
      })
    },
    [categories, syncDraft],
  )

  const toggleCategoryId = useCallback(
    (value) => {
      if (!value) {
        setCategoryIds([])
        return
      }

      syncDraft((current) => {
        const currentIds = current.categoryIds ?? []
        const nextIds = currentIds.includes(value)
          ? currentIds.filter((id) => id !== value)
          : [...currentIds, value]
        const categorySlugs = nextIds
          .map((id) => categories.find((entry) => entry.id === id)?.slug)
          .filter(Boolean)
        return {
          ...current,
          categoryIds: nextIds,
          categoryId: nextIds[0] ?? '',
          categorySlug: categorySlugs[0] ?? '',
          categorySlugs,
        }
      })
    },
    [categories, syncDraft, setCategoryIds],
  )

  const setBrand = useCallback(
    (value) => {
      const trimmed = value?.trim() ?? ''
      syncDraft({
        brands: trimmed ? [trimmed] : [],
        brand: trimmed,
      })
    },
    [syncDraft],
  )

  const setBrands = useCallback(
    (value) => {
      const nextBrands = Array.isArray(value)
        ? [...new Set(value.map((entry) => entry.trim()).filter(Boolean))]
        : []
      syncDraft({
        brands: nextBrands,
        brand: nextBrands[0] ?? '',
      })
    },
    [syncDraft],
  )

  const toggleBrand = useCallback(
    (value) => {
      if (!value) {
        setBrands([])
        return
      }

      syncDraft((current) => {
        const currentBrands = current.brands ?? []
        const nextBrands = currentBrands.includes(value)
          ? currentBrands.filter((brand) => brand !== value)
          : [...currentBrands, value]
        return {
          ...current,
          brands: nextBrands,
          brand: nextBrands[0] ?? '',
        }
      })
    },
    [syncDraft, setBrands],
  )

  const setCondition = useCallback(
    (value) => {
      syncDraft({
        conditions: value ? [value] : [],
        condition: value ?? '',
      })
    },
    [syncDraft],
  )

  const setConditions = useCallback(
    (value) => {
      const nextConditions = Array.isArray(value) ? value.filter(Boolean) : []
      syncDraft({
        conditions: nextConditions,
        condition: nextConditions[0] ?? '',
      })
    },
    [syncDraft],
  )

  const toggleCondition = useCallback(
    (value) => {
      if (!value) {
        setConditions([])
        return
      }

      syncDraft((current) => {
        const currentConditions = current.conditions ?? []
        const nextConditions = currentConditions.includes(value)
          ? currentConditions.filter((condition) => condition !== value)
          : [...currentConditions, value]
        return {
          ...current,
          conditions: nextConditions,
          condition: nextConditions[0] ?? '',
        }
      })
    },
    [syncDraft, setConditions],
  )

  const clearCategories = useCallback(() => setCategoryIds([]), [setCategoryIds])
  const clearBrands = useCallback(() => setBrands([]), [setBrands])
  const clearConditions = useCallback(() => setConditions([]), [setConditions])

  const removeFilterChip = useCallback(
    (removeKey, removeValue) => {
      flushDraftUpdate((current) => removeBrowseFilterKey(current, removeKey, removeValue))
    },
    [flushDraftUpdate],
  )

  const applyNavSelection = useCallback(
    ({ categoryId, rating, search }) => {
      syncDraft((current) => {
        const category = categories.find((entry) => entry.id === categoryId)
        const categoryIds = categoryId ? [categoryId] : []
        return {
          ...current,
          categoryIds,
          categoryId: categoryIds[0] ?? '',
          categorySlug: category?.slug ?? '',
          categorySlugs: category?.slug ? [category.slug] : [],
          rating: rating ?? '',
          search: search ?? '',
        }
      })
    },
    [categories, syncDraft],
  )

  const queryOptions = useMemo(
    () => buildBrowseQueryOptions(urlDraft, { locationAreas, profileCoordinates }),
    [urlDraft, locationAreas, profileCoordinates],
  )

  const activeChips = useMemo(
    () => buildBrowseActiveFilterChips(urlFilters, categories),
    [urlFilters, categories],
  )

  const hasLocationForSort = useMemo(
    () => hasBrowseLocationForSort(urlDraft, profileCoordinates),
    [urlDraft, profileCoordinates],
  )

  const hasBrowseLocation = hasLocationForSort
  const sortNotice =
    draft.sort === 'nearest' && !hasLocationForSort
      ? 'Add your location in settings to sort by nearest listings.'
      : ''
  const hasFilters = hasActiveBrowseFilters(urlFilters)
  const panelFilterCount = countBrowsePanelFilters(urlFilters)

  return {
    filters: draft,
    committedFilters: urlFilters,
    queryOptions,
    activeChips,
    hasFilters,
    hasBrowseLocation,
    hasLocationForSort,
    sortNotice,
    panelFilterCount,
    geolocationMessage,
    updateField,
    handleLocationSearchChange,
    handleLocationPlaceSelected,
    handleRadiusChange,
    handleSortChange,
    resetFilters,
    removeFilterChip,
    applyNavSelection,
    flushFilters: flushDraftUpdate,
    setSearch: (value) => updateField('search', value),
    setBrand,
    setBrands,
    toggleBrand,
    clearBrands,
    setMinPrice: (value) => updateField('minPrice', value),
    setMaxPrice: (value) => updateField('maxPrice', value),
    setCategoryId,
    setCategoryIds,
    toggleCategoryId,
    clearCategories,
    setCondition,
    setConditions,
    toggleCondition,
    clearConditions,
    setRating: (value) => updateField('rating', value),
    sort: draft.sort ?? DEFAULT_LISTING_SORT,
    search: draft.search ?? '',
    brand: draft.brand ?? '',
    brands: draft.brands ?? [],
    minPrice: draft.minPrice ?? '',
    maxPrice: draft.maxPrice ?? '',
    categoryId: draft.categoryId ?? '',
    categoryIds: draft.categoryIds ?? [],
    condition: draft.condition ?? '',
    conditions: draft.conditions ?? [],
    rating: draft.rating ?? '',
    locationSearch: draft.locationSearch ?? '',
    locationPlace: draft.locationPlace ?? null,
    radiusMiles: draft.radiusMiles ?? BROWSE_RADIUS_UK_WIDE,
  }
}
