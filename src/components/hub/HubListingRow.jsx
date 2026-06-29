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
import { HubEmptyState } from './HubEmptyState'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
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
  const isDraft = listing.status === 'draft'

  return (
    <HubItemRow
      media={<HubItemThumbnail src={thumbnailUrl} href={isDraft ? editUrl : listingUrl} alt="" />}
      title={<HubItemTitle href={isDraft ? editUrl : listingUrl}>{listing.title}</HubItemTitle>}
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
          {canEdit ? (
            <HubEditListingAction to={editUrl} label={isDraft ? 'Edit draft' : 'Edit'} />
          ) : null}
          {listingUrl && !isDraft ? <HubViewListingAction to={listingUrl} /> : null}
          {orderUrl ? <HubViewOrderAction to={orderUrl} /> : null}
          {conversationUrl ? <HubViewConversationAction to={conversationUrl} /> : null}
        </HubItemNavActions>
      }
    />
  )
}

function HubListingList({ listings, emptyState = null, emptyMessage = '', statusLabel, statusVariant }) {
  if (listings.length === 0) {
    if (emptyState) return <HubEmptyState {...emptyState} />
    if (emptyMessage) {
      return (
        <HubEmptyState
          variant={EQUIPD_ICON_VARIANT.MY_LISTINGS}
          title={emptyMessage}
        />
      )
    }
    return null
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
