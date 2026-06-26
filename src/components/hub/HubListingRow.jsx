import {
  HubEditListingAction,
  HubItemNavActions,
  HubViewConversationAction,
  HubViewListingAction,
  HubViewOrderAction,
} from './HubItemActions'
import {
  HubItemList,
  HubItemPrice,
  HubItemRow,
  HubItemStatusBadge,
  HubItemThumbnail,
  HubItemTitle,
} from './HubItemRow'
import './HubItemRow.css'
import { formatPricePence } from '../../lib/listings'
import {
  formatHubListingMetadata,
  getHubListingStatusBadge,
} from '../../lib/hubItemStatus'

function HubListingRow({
  listing,
  statusLabel,
  statusVariant,
  orderUrl = null,
  conversationUrl = null,
}) {
  const thumbnailUrl = listing?.listing_images?.[0]?.url
  const listingUrl = listing?.slug ? `/listings/${listing.slug}` : null
  const editUrl = listing?.slug ? `/listings/${listing.slug}/edit` : null
  const badge = getHubListingStatusBadge(listing)
  const metadata = formatHubListingMetadata(listing)
  const canEdit = editUrl && listing.status !== 'sold'

  return (
    <HubItemRow
      media={<HubItemThumbnail src={thumbnailUrl} href={listingUrl} alt="" />}
      title={<HubItemTitle href={listingUrl}>{listing.title}</HubItemTitle>}
      status={
        <HubItemStatusBadge
          variant={statusVariant ?? badge.variant}
          label={statusLabel ?? badge.label}
        />
      }
      metadata={metadata || null}
      price={<HubItemPrice amount={formatPricePence(listing.price_pence)} />}
      iconActions={
        <HubItemNavActions>
          {canEdit ? <HubEditListingAction to={editUrl} /> : null}
          {listingUrl ? <HubViewListingAction to={listingUrl} /> : null}
          {orderUrl ? <HubViewOrderAction to={orderUrl} /> : null}
          {conversationUrl ? <HubViewConversationAction to={conversationUrl} /> : null}
        </HubItemNavActions>
      }
    />
  )
}

function HubListingList({ listings, emptyMessage, statusLabel, statusVariant }) {
  if (listings.length === 0) {
    return emptyMessage ? <p className="hub-section__empty">{emptyMessage}</p> : null
  }

  return (
    <HubItemList>
      {listings.map((listing) => (
        <HubListingRow
          key={listing.id}
          listing={listing}
          statusLabel={statusLabel}
          statusVariant={statusVariant}
        />
      ))}
    </HubItemList>
  )
}

export { HubListingRow, HubListingList }
