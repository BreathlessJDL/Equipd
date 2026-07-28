import { useEffect, useRef } from 'react'
import { WantedBellIcon, WantedSearchIcon } from './WantedRequestIcons'
import { useWantedRequest } from './useWantedRequest'
import { trackWantedRequestCtaViewed } from '../../lib/wantedRequestAnalytics'
import { WANTED_REQUEST_SOURCES } from '../../lib/wantedRequestConstants'
import './WantedRequestSurfaces.css'

function useWantedCtaViewed(source, productId = null, searchTerm = null, brand = null) {
  const ref = useRef(null)
  const sent = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node || sent.current) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (sent.current) return
        sent.current = true
        trackWantedRequestCtaViewed({
          source,
          product_id: productId,
          search_term: searchTerm,
          brand,
        })
        observer.disconnect()
      },
      { threshold: 0.35 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [source, productId, searchTerm, brand])

  return ref
}

export function WantedRequestCard({
  productName,
  product = null,
  className = '',
}) {
  const { openWantedRequest } = useWantedRequest()
  const name = productName || product?.productName || 'this equipment'
  const ref = useWantedCtaViewed(
    WANTED_REQUEST_SOURCES.PRODUCT_PAGE,
    product?.productId ?? null,
    null,
    product?.brand ?? null,
  )

  return (
    <div ref={ref} className={`wanted-request-card${className ? ` ${className}` : ''}`}>
      <span className="wanted-request-card__icon" aria-hidden="true">
        <WantedBellIcon />
      </span>
      <h3 className="wanted-request-card__title">Can&apos;t find a {name}?</h3>
      <p className="wanted-request-card__body">
        Create a wanted request and we&apos;ll notify you when one becomes available.
      </p>
      <button
        type="button"
        className="wanted-request-card__button"
        onClick={(event) =>
          openWantedRequest({
            source: WANTED_REQUEST_SOURCES.PRODUCT_PAGE,
            product,
            preferredEntryMode: 'catalogue',
            triggerElement: event.currentTarget,
          })
        }
      >
        Request this equipment
      </button>
    </div>
  )
}

export function WantedRequestSecondaryCta({ product = null, className = '' }) {
  const { openWantedRequest } = useWantedRequest()

  return (
    <div className={`wanted-request-secondary${className ? ` ${className}` : ''}`}>
      <p className="wanted-request-secondary__copy">
        Looking for a different condition or location?
      </p>
      <button
        type="button"
        className="wanted-request-secondary__button"
        onClick={(event) =>
          openWantedRequest({
            source: WANTED_REQUEST_SOURCES.PRODUCT_PAGE,
            product,
            preferredEntryMode: 'catalogue',
            triggerElement: event.currentTarget,
          })
        }
      >
        Request this equipment
      </button>
    </div>
  )
}

export function WantedRequestEmptyState({
  onClearFilters = null,
  hasFilters = false,
  searchTerm = '',
  brand = '',
  location = '',
  className = '',
}) {
  const { openWantedRequest } = useWantedRequest()
  const ref = useWantedCtaViewed(
    WANTED_REQUEST_SOURCES.BROWSE_NO_RESULTS,
    null,
    searchTerm || null,
    brand || null,
  )

  return (
    <div
      ref={ref}
      className={`wanted-request-empty${className ? ` ${className}` : ''}`}
    >
      <span className="wanted-request-empty__icon" aria-hidden="true">
        <WantedSearchIcon />
      </span>
      <h3 className="wanted-request-empty__title">We couldn&apos;t find any matching equipment</h3>
      <p className="wanted-request-empty__body">
        Try adjusting your search or create a wanted request and we&apos;ll let you know when
        something suitable becomes available.
      </p>
      <div className="wanted-request-empty__actions">
        <button
          type="button"
          className="wanted-request-empty__button wanted-request-empty__button--primary"
          onClick={(event) =>
            openWantedRequest({
              source: WANTED_REQUEST_SOURCES.BROWSE_NO_RESULTS,
              searchTerm,
              brand: brand || null,
              location: location || null,
              suggestManualFromSearch: Boolean(String(searchTerm || '').trim()),
              triggerElement: event.currentTarget,
            })
          }
        >
          Request equipment
        </button>
        {hasFilters && typeof onClearFilters === 'function' ? (
          <button
            type="button"
            className="wanted-request-empty__button wanted-request-empty__button--secondary"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function WantedRequestLowStockBanner({
  searchTerm = '',
  brand = '',
  location = '',
  className = '',
}) {
  const { openWantedRequest } = useWantedRequest()
  const ref = useWantedCtaViewed(
    WANTED_REQUEST_SOURCES.BROWSE_LOW_STOCK,
    null,
    searchTerm || null,
    brand || null,
  )

  return (
    <aside
      ref={ref}
      className={`wanted-request-low-stock${className ? ` ${className}` : ''}`}
      aria-label="Wanted request suggestion"
    >
      <span className="wanted-request-low-stock__icon" aria-hidden="true">
        <WantedBellIcon />
      </span>
      <div className="wanted-request-low-stock__copy">
        <h3 className="wanted-request-low-stock__title">Looking for more options?</h3>
        <p className="wanted-request-low-stock__body">
          Create a wanted request and we&apos;ll notify you when more matching equipment becomes
          available.
        </p>
      </div>
      <button
        type="button"
        className="wanted-request-low-stock__button"
        onClick={(event) =>
          openWantedRequest({
            source: WANTED_REQUEST_SOURCES.BROWSE_LOW_STOCK,
            searchTerm,
            brand: brand || null,
            location: location || null,
            triggerElement: event.currentTarget,
          })
        }
      >
        Request equipment
      </button>
    </aside>
  )
}

export function BrandWantedRequestCard({ brandName, className = '' }) {
  const { openWantedRequest } = useWantedRequest()
  const name = brandName || 'this brand'
  const ref = useWantedCtaViewed(WANTED_REQUEST_SOURCES.BRAND_PAGE, null, null, name)

  return (
    <div ref={ref} className={`wanted-request-brand${className ? ` ${className}` : ''}`}>
      <div className="wanted-request-brand__copy">
        <h3 className="wanted-request-brand__title">Looking for a specific {name} machine?</h3>
        <p className="wanted-request-brand__body">
          Create a wanted request and we&apos;ll notify you when it becomes available.
        </p>
      </div>
      <button
        type="button"
        className="wanted-request-brand__button"
        onClick={(event) =>
          openWantedRequest({
            source: WANTED_REQUEST_SOURCES.BRAND_PAGE,
            brand: name,
            preferredEntryMode: 'catalogue',
            triggerElement: event.currentTarget,
          })
        }
      >
        Request equipment
      </button>
    </div>
  )
}
