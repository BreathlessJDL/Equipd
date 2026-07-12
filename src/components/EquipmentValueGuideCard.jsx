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

export default function EquipmentValueGuideCard({
  product,
  priority = false,
}) {
  if (!product?.href) return null

  const rrpLabel = formatMoney(product.originalRrp, product.currency)
  const alt = product.displayName || 'Equipment'

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
        <p className="equipment-value-card__category">
          {product.equipmentType || '\u00A0'}
        </p>

        <dl className="equipment-value-card__facts">
          {product.yearLabel ? (
            <div className="equipment-value-card__fact">
              <dt>Production</dt>
              <dd>{product.yearLabel}</dd>
            </div>
          ) : null}
          {product.estimatedValueLabel ? (
            <div className="equipment-value-card__fact equipment-value-card__fact--value">
              <dt>Estimated used value</dt>
              <dd>{product.estimatedValueLabel}</dd>
            </div>
          ) : null}
          {rrpLabel ? (
            <div className="equipment-value-card__fact">
              <dt>Original RRP</dt>
              <dd>From {rrpLabel}</dd>
            </div>
          ) : null}
        </dl>

        <span className="equipment-value-card__cta">View value guide →</span>
      </div>
    </Link>
  )
}
