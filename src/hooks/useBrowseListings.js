import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { serializeBrowseQueryOptions } from '../lib/browseFilters'
import { DEFAULT_LISTINGS_PAGE_SIZE } from '../lib/constants'
import { normalizeBuyerCoordinates } from '../lib/listingDistance'
import { fetchActiveListings, getListingErrorMessage } from '../lib/listings'
import { applyListingSort, getEffectiveListingSort, getFetchListingSort } from '../lib/listingSort'

function mergeBrowseListings(existing, incoming) {
  if (!incoming?.length) return existing ?? []

  const seen = new Set((existing ?? []).map((listing) => listing.id))
  const merged = [...(existing ?? [])]

  for (const listing of incoming) {
    if (!listing?.id || seen.has(listing.id)) continue
    seen.add(listing.id)
    merged.push(listing)
  }

  return merged
}

export function useBrowseListings(
  queryOptions,
  {
    sort,
    search,
    hasLocationSearch,
    paginate = false,
    pageSize = DEFAULT_LISTINGS_PAGE_SIZE,
    enabled = true,
  } = {},
) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const queryKey = useMemo(() => serializeBrowseQueryOptions(queryOptions), [queryOptions])
  const effectiveSort = useMemo(
    () => getEffectiveListingSort(sort, { hasLocationSearch }),
    [sort, hasLocationSearch],
  )
  const fetchSort = useMemo(
    () => getFetchListingSort(sort, { hasLocationSearch }),
    [sort, hasLocationSearch],
  )
  const buyerCoordinates = useMemo(() => {
    if (!hasLocationSearch) return null

    return normalizeBuyerCoordinates({
      latitude: queryOptions.buyerLatitude,
      longitude: queryOptions.buyerLongitude,
    })
  }, [hasLocationSearch, queryOptions.buyerLatitude, queryOptions.buyerLongitude])
  const fatalQueryKeyRef = useRef('')
  const hasLoadedRef = useRef(false)
  const listingsRef = useRef([])

  useEffect(() => {
    listingsRef.current = listings
  }, [listings])

  const sortListings = useCallback(
    (rows) =>
      applyListingSort(rows ?? [], effectiveSort, search, {
        hasLocationSearch,
        buyerCoordinates,
      }),
    [effectiveSort, search, hasLocationSearch, buyerCoordinates],
  )

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setLoadingMore(false)
      setHasMore(false)
      setError('')
      setListings([])
      hasLoadedRef.current = false
      return undefined
    }

    let active = true

    if (fatalQueryKeyRef.current && fatalQueryKeyRef.current === queryKey) {
      setLoading(false)
      setLoadingMore(false)
      return undefined
    }

    async function loadListings() {
      if (!hasLoadedRef.current) {
        setLoading(true)
      }
      setLoadingMore(false)
      setError('')

      try {
        const { data, error: listingsError } = await fetchActiveListings({
          ...queryOptions,
          sort: fetchSort,
          offset: 0,
          limit: pageSize,
        })

        if (!active) return

        if (listingsError) {
          fatalQueryKeyRef.current = queryKey
          setError(getListingErrorMessage(listingsError))
          setListings([])
          setHasMore(false)
          setLoading(false)
          hasLoadedRef.current = true
          return
        }

        fatalQueryKeyRef.current = ''
        const sorted = sortListings(data ?? [])
        setListings(sorted)
        setHasMore(paginate && sorted.length === pageSize)
        setLoading(false)
        hasLoadedRef.current = true
      } catch (loadError) {
        if (!active) return

        console.warn('[browse] Listing load failed unexpectedly; keeping previous results if any.', loadError)
        fatalQueryKeyRef.current = ''
        setError('Something went wrong loading listings. Please try again.')
        setLoading(false)
        hasLoadedRef.current = true
      }
    }

    loadListings()

    return () => {
      active = false
    }
  }, [queryKey, fetchSort, sortListings, paginate, pageSize, enabled])

  const loadMore = useCallback(async () => {
    if (!paginate || loading || loadingMore || !hasMore) return

    setLoadingMore(true)
    setError('')

    try {
      const offset = listingsRef.current.length
      const { data, error: listingsError } = await fetchActiveListings({
        ...queryOptions,
        sort: fetchSort,
        offset,
        limit: pageSize,
      })

      if (listingsError) {
        setError(getListingErrorMessage(listingsError))
        setLoadingMore(false)
        return
      }

      const incoming = data ?? []
      setListings((current) => sortListings(mergeBrowseListings(current, incoming)))
      setHasMore(incoming.length === pageSize)
      setLoadingMore(false)
    } catch (loadError) {
      console.warn('[browse] Load more failed unexpectedly.', loadError)
      setError('Something went wrong loading more listings. Please try again.')
      setLoadingMore(false)
    }
  }, [paginate, loading, loadingMore, hasMore, queryOptions, fetchSort, sortListings, pageSize])

  return {
    listings,
    loading,
    loadingMore,
    hasMore: paginate && hasMore,
    loadMore,
    error,
  }
}
