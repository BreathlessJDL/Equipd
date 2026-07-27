import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import BrowseActiveFilterChips from '../components/browse/BrowseActiveFilterChips'
import LocationBrowseSidebar from '../components/browse/LocationBrowseSidebar'
import LocationListingsResults from '../components/browse/LocationListingsResults'
import LocationNearbySection from '../components/browse/LocationNearbySection'
import LocationPageHero from '../components/browse/LocationPageHero'
import LocationSellerSection from '../components/browse/LocationSellerSection'
import MarketplaceBrowseShell from '../components/browse/MarketplaceBrowseShell'
import ListingBrowseFilters from '../components/ListingBrowseFilters'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import '../components/ListingBrowse.css'
import '../components/browse/BrowseActiveFilterChips.css'
import '../components/browse/LocationPage.css'
import { useBrowseFilters } from '../hooks/useBrowseFilters'
import { useBrowseListings } from '../hooks/useBrowseListings'
import { useBrowseScrollAfterFilterChange } from '../hooks/useBrowseScrollAfterFilterChange'
import { useRegisterSiteHeader } from '../hooks/useRegisterSiteHeader'
import { usePageMeta } from '../hooks/usePageMeta'
import { buildBrowseSearchPath } from '../lib/browseSearchNavigation'
import { buildLocationPageBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import { fetchCategories } from '../lib/listings'
import {
  buildLocationPageMeta,
  getLocationHubSearch,
  getLocationPage,
  LOCATION_AREA_PARAM,
  parseLocationAreaParam,
  resolveLocationView,
} from '../lib/locations'

function LocationListingsPage({ locationSlug }) {
  const region = getLocationPage(locationSlug)
  const navigate = useNavigate()
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

  const hubSearch = useMemo(() => (region ? getLocationHubSearch(region) : null), [region])

  const pageMeta = useMemo(
    () => (region ? buildLocationPageMeta(region, selectedArea) : null),
    [region, selectedArea],
  )

  usePageMeta({
    title: pageMeta?.title,
    description: pageMeta?.description,
    canonicalPath: pageMeta?.canonicalPath,
    robotsContent: pageMeta?.robotsContent,
  })

  const breadcrumbSchema = useMemo(
    () => (region ? buildLocationPageBreadcrumbSchema(region) : null),
    [region],
  )

  // Location hubs use configured city-centre coordinates for the 40-mile radius.
  // Do not let the signed-in profile location override hub search geometry.
  const browse = useBrowseFilters(searchParams, setSearchParams, {
    categories,
    categoriesReady,
    locationAreas: locationView?.filterAreas ?? [],
    hubSearch,
    profileCoordinates: null,
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
    // Local hubs are radius-scoped; fetch a larger first page so the hero
    // count badge and grid reflect the full eligible set in typical markets.
    pageSize: 100,
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
      setSearchParams(new URLSearchParams({ [LOCATION_AREA_PARAM]: area }), {
        preventScrollReset: true,
      })
    }
  }, [browse, searchParams, setSearchParams])

  const handleRemoveFilterChip = useCallback(
    (removeKey, removeValue) => {
      browse.removeFilterChip(removeKey, removeValue)
      requestBrowseScroll()
    },
    [browse, requestBrowseScroll],
  )

  const handleSearchSubmit = useCallback(() => {
    navigate(buildBrowseSearchPath(browse.search))
  }, [browse.search, navigate])

  const siteHeaderConfig = useMemo(
    () => ({
      search: browse.search,
      onSearchChange: browse.setSearch,
      onSearchSubmit: handleSearchSubmit,
      categories,
      activeCategoryId: browse.categoryId,
      activeRating: browse.rating,
      activeSearch: browse.search,
      onNavSelect: null,
      linkMode: true,
      categoryNavClassName: '',
    }),
    [browse.search, browse.categoryId, browse.rating, browse.setSearch, categories, handleSearchSubmit],
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
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <div className="location-page">
        <LocationPageHero
          locationView={locationView}
          listingCount={listings.length}
          loading={loading}
        />

        <div className="location-page__shell">
          <div className="location-page__layout">
            <div className="location-page__main" id="location-listings">
              <div className="location-page__toolbar">
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
                  onApply={requestBrowseScroll}
                  onReset={handleResetFilters}
                />

                <BrowseActiveFilterChips
                  chips={browse.activeChips}
                  onRemove={handleRemoveFilterChip}
                  onReset={handleResetFilters}
                  showReset
                />
              </div>

              <div ref={resultsRef}>
                <LocationListingsResults
                  locationView={locationView}
                  listings={listings}
                  loading={loading}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  error={error}
                  hasFilters={browse.hasFilters}
                  emptyMessage={`No active listings in ${locationView.name} yet.`}
                />
              </div>
            </div>

            <LocationBrowseSidebar locationView={locationView} />
          </div>

          <LocationNearbySection locationView={locationView} />
          <LocationSellerSection locationView={locationView} />
        </div>
      </div>
    </MarketplaceBrowseShell>
  )
}

export default LocationListingsPage
