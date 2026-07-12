import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BrowseActiveFilterChips from '../components/browse/BrowseActiveFilterChips'
import ListingBrowseFilters from '../components/ListingBrowseFilters'
import ListingBrowseResults from '../components/ListingBrowseResults'
import HomeHero from '../components/home/HomeHero'
import HomeEquipmentValuator from '../components/home/HomeEquipmentValuator'
import HomeDiscoverySection from '../components/home/HomeDiscoverySection'
import HomeRecentListings from '../components/home/HomeRecentListings'
import HomeReviewsSection from '../components/home/HomeReviewsSection'
import '../components/home/HomePage.css'
import '../components/ListingBrowse.css'
import '../components/browse/BrowseActiveFilterChips.css'
import { useBrowseFilters } from '../hooks/useBrowseFilters'
import { useBrowseListings } from '../hooks/useBrowseListings'
import { useBrowseScrollAfterFilterChange } from '../hooks/useBrowseScrollAfterFilterChange'
import { useHomeRecentListings } from '../hooks/useHomeRecentListings'
import { useProfileBrowseLocation } from '../hooks/useProfileBrowseLocation'
import { useRegisterSiteHeader } from '../hooks/useRegisterSiteHeader'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import { BROWSE_FILTER_EMPTY_MESSAGE } from '../lib/browseFilters'
import { buildBrowseSearchPath } from '../lib/browseSearchNavigation'
import { fetchCategories } from '../lib/listings'
import { fetchRecentReviews, getReviewErrorMessage } from '../lib/reviews'

function HomePage() {
  usePageTitle()
  const { user } = useAuth()
  const isLoggedIn = Boolean(user)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [recentReviews, setRecentReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState('')

  const profileLocation = useProfileBrowseLocation()

  const profileCoordinates = useMemo(
    () =>
      profileLocation.hasCoordinates
        ? { latitude: profileLocation.latitude, longitude: profileLocation.longitude }
        : null,
    [profileLocation.hasCoordinates, profileLocation.latitude, profileLocation.longitude],
  )

  const [categories, setCategories] = useState([])
  const [categoriesReady, setCategoriesReady] = useState(false)

  const browse = useBrowseFilters(searchParams, setSearchParams, {
    categories,
    categoriesReady,
    profileCoordinates,
  })

  const { requestBrowseScroll, cancelBrowseScrollRequest } =
    useBrowseScrollAfterFilterChange(searchParams.toString())

  const {
    listings: recentListings,
    loading: recentLoading,
    error: recentError,
  } = useHomeRecentListings({ enabled: !isLoggedIn })

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

  useEffect(() => {
    if (isLoggedIn) {
      setReviewsLoading(false)
      return undefined
    }

    let active = true

    async function loadReviews() {
      const { data, error: reviewsResultError } = await fetchRecentReviews({
        limit: 12,
        includeOrderListing: true,
      })

      if (!active) return

      if (reviewsResultError) {
        setReviewsError(getReviewErrorMessage(reviewsResultError))
        setRecentReviews([])
      } else {
        setRecentReviews(data ?? [])
      }

      setReviewsLoading(false)
    }

    loadReviews()

    return () => {
      active = false
    }
  }, [isLoggedIn])

  const handleSearchSubmit = useCallback(() => {
    navigate(buildBrowseSearchPath(browse.search))
  }, [browse.search, navigate])

  const handleRemoveFilterChip = useCallback(
    (removeKey, removeValue) => {
      browse.removeFilterChip(removeKey, removeValue)
      requestBrowseScroll()
    },
    [browse, requestBrowseScroll],
  )

  const handleHomeBrandClick = useCallback(
    (event) => {
      if (pathname !== '/') return

      event.preventDefault()
      cancelBrowseScrollRequest()

      if (browse.hasFilters) {
        browse.resetFilters()
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    },
    [browse, cancelBrowseScrollRequest, pathname],
  )

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
      onHomeBrandClick: handleHomeBrandClick,
      linkMode: true,
      categoryNavClassName: 'home-category-text-nav',
    }),
    [
      browse.search,
      browse.categoryId,
      browse.rating,
      browse.setSearch,
      categories,
      handleHomeBrandClick,
      handleSearchSubmit,
    ],
  )

  useRegisterSiteHeader(siteHeaderConfig)

  return (
    <div className={`home-page${isLoggedIn ? ' home-page--feed' : ''}`}>
      {!isLoggedIn ? <HomeHero /> : null}

      {!isLoggedIn ? <HomeEquipmentValuator /> : null}

      {!isLoggedIn ? (
        <HomeRecentListings
          listings={recentListings}
          loading={recentLoading}
          error={recentError}
        />
      ) : null}

      <section id="browse" className={`home-browse${isLoggedIn ? ' home-browse--feed' : ''}`}>
        <div className="home-section__inner">
          {!isLoggedIn ? (
            <header className="home-browse__header">
              <h2 className="home-browse__title">Browse by category</h2>
              <p className="home-browse__lead">
                Explore and search for new and used gym equipment from sellers across the UK.
              </p>
            </header>
          ) : null}

          <ListingBrowseFilters
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
            idPrefix="home-browse"
            onApply={requestBrowseScroll}
            onReset={browse.resetFilters}
          />

          <BrowseActiveFilterChips
            chips={browse.activeChips}
            onRemove={handleRemoveFilterChip}
            onReset={browse.resetFilters}
            showReset
          />

          <div id="browse-results">
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
              showSectionHeader={false}
            />
          </div>
        </div>
      </section>

      <HomeDiscoverySection />

      {!isLoggedIn ? (
        <HomeReviewsSection
          reviews={recentReviews}
          loading={reviewsLoading}
          error={reviewsError}
        />
      ) : null}
    </div>
  )
}

export default HomePage
