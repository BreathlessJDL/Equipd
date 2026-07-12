import { useMemo, useState } from 'react'
import { parseListingDescriptionExtras } from '../../lib/listingDetailDisplay'

const COLLAPSED_CHAR_LIMIT = 320
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)'\]])/gi

function linkifyDescription(text) {
  const parts = []
  let lastIndex = 0
  const source = String(text ?? '')

  source.replace(URL_PATTERN, (match, _group, offset) => {
    if (offset > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, offset) })
    }
    parts.push({ type: 'link', value: match })
    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) })
  }

  if (!parts.length) {
    return [{ type: 'text', value: source }]
  }

  return parts
}

function ListingSellerDescription({ listing }) {
  const [expanded, setExpanded] = useState(false)
  const extras = useMemo(
    () => parseListingDescriptionExtras(listing?.description),
    [listing?.description],
  )
  const description = extras.description

  if (!description) {
    return (
      <section
        className="listing-detail__seller-description"
        aria-labelledby="listing-seller-description-title"
      >
        <header className="listing-detail__seller-description-header">
          <h2 id="listing-seller-description-title" className="listing-detail__seller-description-title">
            Seller&apos;s description
          </h2>
          <p className="listing-detail__seller-description-eyebrow">Provided by the seller</p>
        </header>
        <p className="listing-detail__seller-description-body listing-detail__seller-description-body--empty">
          No description provided.
        </p>
      </section>
    )
  }

  const needsClamp = description.length > COLLAPSED_CHAR_LIMIT
  const displayText =
    !needsClamp || expanded
      ? description
      : `${description.slice(0, COLLAPSED_CHAR_LIMIT).replace(/\s+\S*$/, '')}…`

  const segments = linkifyDescription(displayText)

  return (
    <section
      className="listing-detail__seller-description"
      aria-labelledby="listing-seller-description-title"
    >
      <header className="listing-detail__seller-description-header">
        <h2 id="listing-seller-description-title" className="listing-detail__seller-description-title">
          Seller&apos;s description
        </h2>
        <p className="listing-detail__seller-description-eyebrow">Provided by the seller</p>
      </header>
      <div className="listing-detail__seller-description-body">
        {segments.map((segment, index) =>
          segment.type === 'link' ? (
            <a
              key={`link-${index}`}
              href={segment.value}
              target="_blank"
              rel="noopener noreferrer"
              className="listing-detail__seller-description-link"
            >
              {segment.value}
            </a>
          ) : (
            <span key={`text-${index}`}>{segment.value}</span>
          ),
        )}
      </div>
      {needsClamp ? (
        <button
          type="button"
          className="listing-detail__seller-description-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </section>
  )
}

export default ListingSellerDescription
