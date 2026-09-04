import { Link } from 'react-router-dom'
import './BrandValueResearchCard.css'

function formatMoney(amount, currency = 'GBP') {
  if (amount == null || Number.isNaN(Number(amount)) || Number(amount) <= 0) return null
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount))
  } catch {
    return `£${Math.round(Number(amount))}`
  }
}

/**
 * Compact brand-page entry into a model value guide.
 * Intentionally omits typical-value £ ranges — those belong on the model page.
 */
export default function BrandValueResearchCard({
  product,
  priority = false,
}) {
  if (!product?.href) return null

  const name = product.displayName || 'Equipment'
  const rrpLabel = formatMoney(product.originalRrp, product.currency)
  const metaBits = [
    product.equipmentType || null,
    product.yearLabel || null,
    rrpLabel ? `Original RRP ${rrpLabel}` : null,
  ].filter(Boolean)

  return (
    <Link
      to={product.href}
      className="brand-value-research-card"
      aria-label={`View value guide for ${name}`}
    >
      <div className="brand-value-research-card__media">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="brand-value-research-card__image"
          />
        ) : (
          <div className="brand-value-research-card__placeholder" aria-hidden="true">
            —
          </div>
        )}
      </div>
      <div className="brand-value-research-card__body">
        <h3 className="brand-value-research-card__title">{name}</h3>
        {metaBits.length ? (
          <p className="brand-value-research-card__meta">{metaBits.join(' · ')}</p>
        ) : null}
      </div>
      <span className="brand-value-research-card__cta" aria-hidden="true">
        View value guide →
      </span>
    </Link>
  )
}
