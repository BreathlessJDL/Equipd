import { useMemo } from 'react'
import { HOME_RECENT_LISTINGS_PAGE_SIZE } from '../lib/constants'
import { useBrowseListings } from './useBrowseListings'

const RECENT_LISTINGS_QUERY_OPTIONS = {
  search: '',
  categoryIds: [],
  categoryId: '',
  conditions: [],
  condition: '',
  brands: [],
  brand: '',
  rating: '',
  minPricePence: null,
  maxPricePence: null,
  locationAreas: [],
  buyerLatitude: null,
  buyerLongitude: null,
  radiusMiles: null,
  sort: 'newest',
}

/** Public newest listings for the logged-out home “Recently Added” section. */
export function useHomeRecentListings({ enabled = true } = {}) {
  const queryOptions = useMemo(() => RECENT_LISTINGS_QUERY_OPTIONS, [])

  return useBrowseListings(queryOptions, {
    sort: 'newest',
    search: '',
    hasLocationSearch: false,
    paginate: false,
    pageSize: HOME_RECENT_LISTINGS_PAGE_SIZE,
    enabled,
  })
}
