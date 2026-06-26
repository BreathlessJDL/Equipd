import { useEffect, useState } from 'react'
import { fetchRecommendedListings } from '../lib/listings'

export function useListingRecommendations(listing) {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!listing?.id) {
      setRecommendations([])
      setLoading(false)
      return undefined
    }

    let active = true

    async function loadRecommendations() {
      setLoading(true)

      const { data } = await fetchRecommendedListings({
        listingId: listing.id,
        categoryId: listing.category_id ?? listing.category?.id,
        brand: listing.brand,
      })

      if (!active) return

      setRecommendations(data ?? [])
      setLoading(false)
    }

    loadRecommendations()

    return () => {
      active = false
    }
  }, [listing?.id, listing?.category_id, listing?.category?.id, listing?.brand])

  return { recommendations, loading }
}
