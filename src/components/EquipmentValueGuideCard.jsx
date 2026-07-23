import { Link } from 'react-router-dom'
import './EquipmentValueGuideCard.css'

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
 * Curated brand valuation card — image + valuation dominate hierarchy.
 */
export default function EquipmentValueGuideCard({
  product,
  priority = false,
  showEquipmentType = false,
}) {
  if (!product?.href) return null

  const rrpLabel = formatMoney(product.originalRrp, product.currency)
  const alt = product.displayName || 'Equipment'
  const metaBits = [
    product.yearLabel || null,
    rrpLabel ? `RRP ${rrpLabel}` : null,
    showEquipmentType && product.equipmentType ? product.equipmentType : null,
  ].filter(Boolean)

  return (
    <Link to={product.href} className="equipment-value-card">
      <div className="equipment-value-card__media">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="equipment-value-card__image"
          />
        ) : (
          <div className="equipment-value-card__placeholder" aria-hidden="true">
            No image
          </div>
        )}
      </div>
      <div className="equipment-value-card__body">
        <h3 className="equipment-value-card__title">{product.displayName}</h3>

        <p className="equipment-value-card__value-label">Typical value today</p>
        <p className="equipment-value-card__value-amount">
          {product.estimatedValueLabel || 'See guide'}
        </p>

        {metaBits.length ? (
          <p className="equipment-value-card__meta">{metaBits.join(' · ')}</p>
        ) : (
          <p className="equipment-value-card__meta equipment-value-card__meta--spacer" aria-hidden="true">
            &nbsp;
          </p>
        )}

        <span className="equipment-value-card__cta">View valuation →</span>
      </div>
    </Link>
  )
}
