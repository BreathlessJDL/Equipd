import { getSellerDeliveryRadiusMiles, inferDeliveryOptionsFromListing } from './listings'
import {
  evaluateSellerDeliveryAvailability,
  getSellerDeliveryDisabledReason,
} from './sellerDeliveryRadius'

export function parseListingDescriptionExtras(description = '') {
  const lines = (description ?? '').split('\n')
  let colour = null
  let length = null
  let width = null
  let height = null
  const bodyLines = []

  for (const line of lines) {
    const colourMatch = line.match(/^Colour:\s*(.+)$/i)
    const dimensionsMatch = line.match(/^Dimensions \(L×W×H cm\):\s*(.+)$/i)

    if (colourMatch) {
      colour = colourMatch[1].trim()
      continue
    }

    if (dimensionsMatch) {
      const parts = dimensionsMatch[1].split('×').map((part) => part.trim())
      if (parts[0] && parts[0] !== '—') length = parts[0]
      if (parts[1] && parts[1] !== '—') width = parts[1]
      if (parts[2] && parts[2] !== '—') height = parts[2]
      continue
    }

    bodyLines.push(line)
  }

  let trimmedBody = bodyLines.join('\n').trim()

  while (trimmedBody.endsWith('\n\n')) {
    trimmedBody = trimmedBody.slice(0, -1)
  }

  return {
    colour,
    length,
    width,
    height,
    description: trimmedBody || null,
  }
}

export function formatListingDimensions({ length, width, height }) {
  const parts = [length, width, height].filter(Boolean)
  if (parts.length === 0) return null

  const labels = []
  if (length) labels.push(`L ${length} cm`)
  if (width) labels.push(`W ${width} cm`)
  if (height) labels.push(`H ${height} cm`)

  return labels.join(' · ')
}

const LISTING_DELIVERY_OPTION_META = [
  {
    id: 'collection',
    title: 'Collection available',
    description: 'Arrange collection with the seller after checkout.',
  },
  {
    id: 'seller_delivery',
    title: 'Seller delivery available',
    description: 'The seller can deliver this item after checkout.',
  },
  {
    id: 'buyer_courier',
    title: 'Buyer-arranged courier',
    description: 'Arrange your own courier or collection service after payment.',
  },
]

/** Structured delivery options for listing detail UI (available options only). */
export function getListingDeliveryOptions(listing, { buyerProfile = null, viewerUserId = null } = {}) {
  if (!listing) return []

  const selected = inferDeliveryOptionsFromListing(listing)
  const rangeMiles = getSellerDeliveryRadiusMiles(listing)
  const isOwner = Boolean(viewerUserId && listing.seller_id === viewerUserId)

  const options = LISTING_DELIVERY_OPTION_META.flatMap((option) => {
    if (!selected.includes(option.id)) return []

    let description = option.description
    let disabled = false
    let disabledReason = null

    if (option.id === 'seller_delivery') {
      if (rangeMiles) {
        description = `${description} Up to ${rangeMiles} miles.`
      }

      if (!isOwner) {
        const evaluation = evaluateSellerDeliveryAvailability(listing, buyerProfile)

        if (!evaluation.available) {
          disabled = true
          disabledReason = getSellerDeliveryDisabledReason(evaluation)
          description = null
        }
      }
    }

    return [
      {
        id: option.id,
        title: option.title,
        description,
        disabled,
        disabledReason,
      },
    ]
  })

  if (options.length === 0 && listing.delivery_notes?.trim()) {
    return [
      {
        id: 'legacy',
        title: listing.delivery_notes.trim(),
        description: null,
      },
    ]
  }

  return options
}

/** @deprecated Use getListingDeliveryOptions for detail UI */
export function formatListingDeliveryLines(listing) {
  if (!listing) return []

  const options = inferDeliveryOptionsFromListing(listing)
  const lines = []
  const rangeMiles = getSellerDeliveryRadiusMiles(listing)

  if (options.includes('collection')) {
    lines.push('Collection available')
  }

  if (options.includes('seller_delivery')) {
    lines.push(
      rangeMiles
        ? `Seller can personally deliver (up to ${rangeMiles} miles)`
        : 'Seller can personally deliver',
    )
  }

  if (options.includes('buyer_courier')) {
    lines.push('Buyer can arrange courier / collection service')
  }

  if (lines.length === 0 && listing.delivery_notes?.trim()) {
    lines.push(listing.delivery_notes.trim())
  }

  return lines
}

export function formatListingUploadedAgo(createdAt) {
  if (!createdAt) return null

  const created = new Date(createdAt)
  const diffMs = Date.now() - created.getTime()

  if (Number.isNaN(diffMs) || diffMs < 0) return null

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Uploaded just now'
  if (minutes < 60) return `Uploaded ${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Uploaded ${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 14) return `Uploaded ${days} day${days === 1 ? '' : 's'} ago`

  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(created)
}

/** e.g. "Listed 25 Jun 2026" for listing detail metadata. */
export function formatListingListedDate(createdAt) {
  if (!createdAt) return null

  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return null

  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(created)

  return `Listed ${formatted}`
}
