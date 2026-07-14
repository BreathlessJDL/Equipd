import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MarketplaceBrowseShell from '../components/browse/MarketplaceBrowseShell'
import BrowseActiveFilterChips from '../components/browse/BrowseActiveFilterChips'
import HomeDiscoverySection from '../components/home/HomeDiscoverySection'
import ListingBrowseFilters from '../components/ListingBrowseFilters'
import ListingBrowseResults from '../components/ListingBrowseResults'
import '../components/home/HomePage.css'
import '../components/ListingBrowse.css'
import '../components/browse/BrowseActiveFilterChips.css'
import { useBrowseFilters } from '../hooks/useBrowseFilters'
import { useBrowseListings } from '../hooks/useBrowseListings'
import { useBrowseScrollAfterFilterChange } from '../hooks/useBrowseScrollAfterFilterChange'
import { useProfileBrowseLocation } from '../hooks/useProfileBrowseLocation'
import { useRegisterSiteHeader } from '../hooks/useRegisterSiteHeader'
import { usePageMeta } from '../hooks/usePageMeta'
import { BROWSE_FILTER_EMPTY_MESSAGE } from '../lib/browseFilters'
import { DEFAULT_PAGE_DESCRIPTION } from '../lib/pageTitles'
import { fetchCategories } from '../lib/listings'

function BrowsePage() {
  usePageMeta({
    title: 'Browse Used Gym Equipment for Sale',
    description:
      'Browse used gym equipment listed for sale across the UK on Equipd. Filter by brand, location and category to find home and commercial kit.',
    canonicalPath: '/browse',
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const resultsRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [categoriesReady, setCategoriesReady] = useState(false)

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
    profileCoordinates,
  })

  const { requestBrowseScroll } = useBrowseScrollAfterFilterChange(searchParams.toString())

  const {
    listings,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
  } = useBrowseListings(browse.queryOptions, {
    sort: browse.queryOptions.sort,
    search: browse.queryOptions.search,
    hasLocationSearch: browse.hasLocationForSort,
    paginate: true,
  })

  useEffect(() => {
    let active = true

    async function loadCategories() {
      const { data, error: categoriesError } = await fetchCategories()

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

  const handleRemoveFilterChip = useCallback(
    (removeKey, removeValue) => {
      browse.removeFilterChip(removeKey, removeValue)
      requestBrowseScroll()
    },
    [browse, requestBrowseScroll],
  )

  const handleNavSelect = useCallback(
    ({ categoryId, rating, search }) => {
      browse.applyNavSelection({ categoryId, rating, search })
      requestBrowseScroll()
    },
    [browse, requestBrowseScroll],
  )

  const handleSearchSubmit = useCallback(() => {
    browse.flushFilters()
    requestBrowseScroll()
  }, [browse, requestBrowseScroll])

  const siteHeaderConfig = useMemo(
    () => ({
      search: browse.search,
      onSearchChange: browse.setSearch,
      onSearchSubmit: handleSearchSubmit,
      categories,
      activeCategoryId: browse.categoryId,
      activeRating: browse.rating,
      activeSearch: browse.search,
      onNavSelect: handleNavSelect,
      linkMode: false,
      categoryNavClassName: '',
    }),
    [browse.search, browse.categoryId, browse.rating, browse.setSearch, categories, handleSearchSubmit, handleNavSelect],
  )

  useRegisterSiteHeader(siteHeaderConfig)

  return (
    <MarketplaceBrowseShell>
      <section className="listing-browse">
        <div className="listing-browse__shell">
          <h1 className="visually-hidden">Browse gym equipment</h1>

          <ListingBrowseFilters
            idPrefix="browse"
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
            onApply={requestBrowseScroll}
            onReset={browse.resetFilters}
          />

          <BrowseActiveFilterChips
            chips={browse.activeChips}
            onRemove={handleRemoveFilterChip}
            onReset={browse.resetFilters}
            showReset
          />

          <div ref={resultsRef}>
            <ListingBrowseResults
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              error={error}
              listings={listings}
              hasFilters={browse.hasFilters}
              emptyMessage="No active listings yet. Check back soon or list your own equipment."
              emptyFilteredMessage={BROWSE_FILTER_EMPTY_MESSAGE}
              variant="home"
            />
          </div>

          <div className="listing-browse__location-discovery">
            <HomeDiscoverySection />
          </div>
        </div>
      </section>
    </MarketplaceBrowseShell>
  )
}

export default BrowsePage
