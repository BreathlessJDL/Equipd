import { useEffect, useState } from 'react'
import { fetchRecommendedListings } from '../lib/listings'

export function useListingRecommendations(listing, equipmentProduct = null) {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  const listingId = listing?.id
  const categoryId = listing?.category_id ?? listing?.category?.id
  const brand = listing?.brand
  const equipmentProductId = listing?.equipment_product_id || equipmentProduct?.id || null
  const productFamily = equipmentProduct?.product_family || null

  useEffect(() => {
    if (!listingId) {
      setRecommendations([])
      setLoading(false)
      return undefined
    }

    let active = true

    async function loadRecommendations() {
      setLoading(true)

      const { data } = await fetchRecommendedListings({
        listingId,
        categoryId,
        brand,
        equipmentProductId,
        productFamily,
      })

      if (!active) return

      setRecommendations(data ?? [])
      setLoading(false)
    }

    loadRecommendations()

    return () => {
      active = false
    }
  }, [listingId, categoryId, brand, equipmentProductId, productFamily])

  return { recommendations, loading }
}
