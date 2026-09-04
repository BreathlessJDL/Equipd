import { Link } from 'react-router-dom'
import './BrandModelCard.css'

/**
 * Visual catalogue discovery card for buyer-intent brand pages.
 * No valuation figures — those live on the model/value guide page.
 */
export default function BrandModelCard({
  product,
  blurb = null,
  priority = false,
  ctaLabel = 'View model →',
}) {
  if (!product?.href) return null

  const name = product.displayName || 'Equipment'
  const typeLabel = product.equipmentType || null

  return (
    <Link
      to={product.href}
      className="brand-model-card"
      aria-label={`View ${name} model guide`}
    >
      <div className="brand-model-card__media">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="brand-model-card__image"
          />
        ) : (
          <div className="brand-model-card__placeholder" aria-hidden="true">
            No image
          </div>
        )}
      </div>
      <div className="brand-model-card__body">
        {typeLabel ? (
          <p className="brand-model-card__type">{typeLabel}</p>
        ) : null}
        <h3 className="brand-model-card__title">{name}</h3>
        {blurb ? <p className="brand-model-card__blurb">{blurb}</p> : null}
        <span className="brand-model-card__cta" aria-hidden="true">{ctaLabel}</span>
      </div>
    </Link>
  )
}
