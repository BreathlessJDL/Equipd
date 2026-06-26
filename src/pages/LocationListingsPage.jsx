import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BrowseActiveFilterChips from '../components/browse/BrowseActiveFilterChips'
import LocationBrowseSidebar from '../components/browse/LocationBrowseSidebar'
import LocationListingsResults from '../components/browse/LocationListingsResults'
import LocationPageHero from '../components/browse/LocationPageHero'
import LocationSellerSection from '../components/browse/LocationSellerSection'
import MarketplaceBrowseShell from '../components/browse/MarketplaceBrowseShell'
import ListingBrowseFilters from '../components/ListingBrowseFilters'
import '../components/ListingBrowse.css'
import '../components/browse/BrowseActiveFilterChips.css'
import '../components/browse/LocationPage.css'
import { useBrowseFilters } from '../hooks/useBrowseFilters'
import { useBrowseListings } from '../hooks/useBrowseListings'
import { useProfileBrowseLocation } from '../hooks/useProfileBrowseLocation'
import { useRegisterSiteHeader } from '../hooks/useRegisterSiteHeader'
import { fetchCategories } from '../lib/listings'
import {
  getLocationPage,
  LOCATION_AREA_PARAM,
  parseLocationAreaParam,
  resolveLocationView,
} from '../lib/locations'

function LocationListingsPage({ locationSlug }) {
  const region = getLocationPage(locationSlug)
  const [searchParams, setSearchParams] = useSearchParams()
  const resultsRef = useRef(null)
  const previousAreaRef = useRef(undefined)
  const [categories, setCategories] = useState([])
  const [categoriesReady, setCategoriesReady] = useState(false)

  const selectedArea = useMemo(
    () => (region ? parseLocationAreaParam(searchParams, region) : null),
    [region, searchParams],
  )

  const locationView = useMemo(
    () => (region ? resolveLocationView(region, selectedArea) : null),
    [region, selectedArea],
  )

  const profileLocation = useProfileBrowseLocation()

  const profileCoordinates = useMemo(
    () =>
      profileLocation.hasCoordinates
        ? { latitude: profileLocation.latitude, longitude: profileLocation.longitude }
        : null,
    [profileLocation.hasCoordinates, profileLocation.latitude, profileLocation.longitude],
  )

  const browse = useBrowseFilters(searchParams, setSearchParams, {
    categories,
    categoriesReady,
    locationAreas: locationView?.filterAreas ?? [],
    profileCoordinates,
  })

  const { listings, loading, error } = useBrowseListings(browse.queryOptions, {
    sort: browse.queryOptions.sort,
    search: browse.queryOptions.search,
    hasLocationSearch: browse.hasLocationForSort,
  })

  useEffect(() => {
    let active = true

    async function loadCategories() {
      const { data, categoriesError } = await fetchCategories()

      if (!active) return

      if (!categoriesError) {
        setCategories(data ?? [])
      }

      setCategoriesReady(true)
    }

    loadCategories()

    return () => {
      active = false
    }
  }, [])

  const scrollToResults = useCallback(() => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToPageTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const currentArea = searchParams.get(LOCATION_AREA_PARAM) ?? ''
    if (previousAreaRef.current !== undefined && previousAreaRef.current !== currentArea) {
      scrollToPageTop()
    }
    previousAreaRef.current = currentArea
  }, [searchParams, scrollToPageTop])

  const handleResetFilters = useCallback(() => {
    const area = searchParams.get(LOCATION_AREA_PARAM)
    browse.resetFilters()
    if (area) {
      setSearchParams(new URLSearchParams({ [LOCATION_AREA_PARAM]: area }))
    }
  }, [browse, searchParams, setSearchParams])

  const handleNavSelect = useCallback(
    ({ categoryId, rating, search }) => {
      browse.applyNavSelection({ categoryId, rating, search })
      scrollToResults()
    },
    [browse, scrollToResults],
  )

  const siteHeaderConfig = useMemo(
    () => ({
      search: browse.search,
      onSearchChange: browse.setSearch,
      onSearchSubmit: scrollToResults,
      categories,
      activeCategoryId: browse.categoryId,
      activeRating: browse.rating,
      activeSearch: browse.search,
      onNavSelect: handleNavSelect,
      linkMode: false,
      categoryNavClassName: '',
    }),
    [browse.search, browse.categoryId, browse.rating, browse.setSearch, categories, scrollToResults, handleNavSelect],
  )

  useRegisterSiteHeader(siteHeaderConfig)

  if (!region || !locationView) {
    return (
      <section className="listing-browse">
        <div className="listing-browse__shell">
          <header className="listing-browse__header">
            <h2 className="listing-browse__title">Location not found</h2>
            <p className="listing-browse__lead">
              <Link to="/browse">Back to browse</Link>
            </p>
          </header>
        </div>
      </section>
    )
  }

  return (
    <MarketplaceBrowseShell>
      <div className="location-page">
        <LocationPageHero
          locationView={locationView}
          listingCount={listings.length}
          loading={loading}
        />

        <div className="location-page__shell">
          <div className="location-page__layout">
            <div className="location-page__main">
              <ListingBrowseFilters
                idPrefix={`location-${region.slug}`}
                categories={categories}
                categoryId={browse.categoryId}
                categoryIds={browse.categoryIds}
                onCategoryChange={browse.setCategoryId}
                onToggleCategoryId={browse.toggleCategoryId}
                onClearCategories={browse.clearCategories}
                condition={browse.condition}
                conditions={browse.conditions}
                onConditionChange={browse.setCondition}
                onToggleCondition={browse.toggleCondition}
                onClearConditions={browse.clearConditions}
                brand={browse.brand}
                brands={browse.brands}
                onBrandChange={browse.setBrand}
                onToggleBrand={browse.toggleBrand}
                onClearBrands={browse.clearBrands}
                sort={browse.sort}
                onSortChange={browse.handleSortChange}
                minPrice={browse.minPrice}
                onMinPriceChange={browse.setMinPrice}
                maxPrice={browse.maxPrice}
                onMaxPriceChange={browse.setMaxPrice}
                panelFilterCount={browse.panelFilterCount}
                sortNotice={browse.sortNotice}
                onApply={scrollToResults}
                onReset={handleResetFilters}
              />

              <BrowseActiveFilterChips
                chips={browse.activeChips}
                onRemove={browse.removeFilterChip}
                onReset={handleResetFilters}
                showReset
              />

              <div ref={resultsRef}>
                <LocationListingsResults
                  locationView={locationView}
                  listings={listings}
                  loading={loading}
                  error={error}
                  hasFilters={browse.hasFilters}
                  emptyMessage={`No active listings in ${locationView.name} yet.`}
                />
              </div>
            </div>

            <LocationBrowseSidebar locationView={locationView} />
          </div>

          <LocationSellerSection locationView={locationView} />
        </div>
      </div>
    </MarketplaceBrowseShell>
  )
}

export default LocationListingsPage
