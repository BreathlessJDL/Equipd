import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { trackViewItemList } from '../../lib/buyerConversionAnalytics'

const ListingAnalyticsListContext = createContext(null)

export function useListingAnalyticsList() {
  return useContext(ListingAnalyticsListContext)
}

function ListingAnalyticsList({
  itemListId,
  itemListName,
  listings = [],
  enabled = true,
  children,
}) {
  const signatureRef = useRef('')

  useEffect(() => {
    if (!enabled) return
    const rows = Array.isArray(listings) ? listings.filter((listing) => listing?.id) : []
    if (!rows.length) return
    const signature = `${itemListId}:${rows.map((listing) => listing.id).join(',')}`
    if (signatureRef.current === signature) return
    signatureRef.current = signature
    trackViewItemList({ listings: rows, itemListId, itemListName })
  }, [enabled, itemListId, itemListName, listings])

  const value = useMemo(
    () => (enabled ? { itemListId, itemListName } : null),
    [enabled, itemListId, itemListName],
  )

  return (
    <ListingAnalyticsListContext.Provider value={value}>
      {children}
    </ListingAnalyticsListContext.Provider>
  )
}

export default ListingAnalyticsList
