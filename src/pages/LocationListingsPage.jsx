import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ListingBrowseFilters from '../components/ListingBrowseFilters'
import ListingBrowseResults from '../components/ListingBrowseResults'
import '../components/ListingBrowse.css'
import { fetchActiveListings, fetchCategories, getListingErrorMessage, parsePriceToPence } from '../lib/listings'
import { formatLocationAreas, getLocationPage } from '../lib/locations'

function LocationListingsPage({ locationSlug }) {
  const location = getLocationPage(locationSlug)
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedBrand, setDebouncedBrand] = useState('')
  const [debouncedMinPrice, setDebouncedMinPrice] = useState('')
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search)
      setDebouncedBrand(brand)
      setDebouncedMinPrice(minPrice)
      setDebouncedMaxPrice(maxPrice)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [search, brand, minPrice, maxPrice])

  useEffect(() => {
    let active = true

    async function loadCategories() {
      const { data, error: categoriesError } = await fetchCategories()

      if (!active || categoriesError) return

      setCategories(data ?? [])
    }

    loadCategories()

    return () => {
      active = false
    }
  }, [])

  const queryOptions = useMemo(() => {
    const minPricePence = parsePriceToPence(debouncedMinPrice)
    const maxPricePence = parsePriceToPence(debouncedMaxPrice)

    return {
      search: debouncedSearch,
      categoryId,
      condition,
      brand: debouncedBrand,
      minPricePence,
      maxPricePence,
      locationAreas: location?.areas ?? [],
    }
  }, [
    debouncedSearch,
    debouncedBrand,
    debouncedMinPrice,
    debouncedMaxPrice,
    categoryId,
    condition,
    location?.areas,
  ])

  useEffect(() => {
    if (!location) return undefined

    let active = true

    async function loadListings() {
      setLoading(true)
      setError('')

      const { data, error: listingsError } = await fetchActiveListings(queryOptions)

      if (!active) return

      if (listingsError) {
        setError(getListingErrorMessage(listingsError))
        setListings([])
        setLoading(false)
        return
      }

      setListings(data ?? [])
      setLoading(false)
    }

    loadListings()

    return () => {
      active = false
    }
  }, [location, queryOptions])

  if (!location) {
    return (
      <section className="listing-browse">
        <header className="listing-browse__header">
          <h2 className="listing-browse__title">Location not found</h2>
          <p className="listing-browse__lead">
            <Link to="/">Back to browse</Link>
          </p>
        </header>
      </section>
    )
  }

  const hasFilters = Boolean(
    debouncedSearch.trim() ||
      categoryId ||
      condition ||
      debouncedBrand.trim() ||
      debouncedMinPrice.trim() ||
      debouncedMaxPrice.trim(),
  )

  return (
    <section className="listing-browse">
      <header className="listing-browse__header">
        <h1 className="listing-browse__title">{location.heading}</h1>
        <p className="listing-browse__lead">{location.intro}</p>
        <p className="listing-browse__location-note">
          Showing listings in {formatLocationAreas(location.areas)}.
        </p>
      </header>

      <ListingBrowseFilters
        idPrefix={`location-${location.slug}`}
        categories={categories}
        search={search}
        onSearchChange={setSearch}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        condition={condition}
        onConditionChange={setCondition}
        brand={brand}
        onBrandChange={setBrand}
        minPrice={minPrice}
        onMinPriceChange={setMinPrice}
        maxPrice={maxPrice}
        onMaxPriceChange={setMaxPrice}
      />

      <ListingBrowseResults
        loading={loading}
        error={error}
        listings={listings}
        hasFilters={hasFilters}
        emptyMessage={`No active listings in ${location.name} and nearby areas yet.`}
        emptyFilteredMessage="No listings match your filters in this area. Try adjusting your search."
      />
    </section>
  )
}

export default LocationListingsPage
