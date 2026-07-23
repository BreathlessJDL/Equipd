import { Link } from 'react-router-dom'
import { getProductSeriesLabel } from '../../lib/brandCatalogueCore'
import { buildCanonicalProductDisplayNameFromProduct } from '../../lib/canonicalProductDisplayName'
import { resolveEquipmentProductImageDisplayUrl } from '../../lib/equipmentProductImages'
import { supabase } from '../../lib/supabase'
import './RelatedEquipmentCard.css'

function hasDisplayableType(equipmentType) {
  const text = String(equipmentType ?? '').trim()
  return Boolean(text) && text.toLowerCase() !== 'unknown'
}

function resolveMetaLabel(product, series) {
  if (series) return series
  if (hasDisplayableType(product?.equipment_type)) {
    return String(product.equipment_type).trim()
  }
  return null
}

/**
 * Compact product-guide card for related equipment on public product pages.
 * Not a marketplace listing card — no seller price, condition, or favourites.
 */
export default function RelatedEquipmentCard({
  product,
  href,
  name = null,
  priority = false,
}) {
  const resolvedHref = href || null
  if (!product || !resolvedHref) return null

  const displayName = String(
    name
    || buildCanonicalProductDisplayNameFromProduct(product)
    || product.canonical_product_name
    || product.model
    || 'Equipment',
  ).trim()
  const brand = String(product.brand || '').trim()
  const series = getProductSeriesLabel(product)
  const metaLabel = resolveMetaLabel(product, series)
  const imageUrl = resolveEquipmentProductImageDisplayUrl(product, supabase, { warn: false })
  const accessibleName = `View equipment guide for ${displayName}`

  return (
    <Link
      to={resolvedHref}
      className="related-equipment-card"
      aria-label={accessibleName}
    >
      <div className="related-equipment-card__media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="related-equipment-card__image"
          />
        ) : (
          <div className="related-equipment-card__placeholder" aria-hidden="true">
            <span>No image</span>
          </div>
        )}
      </div>

      <div className="related-equipment-card__body">
        <p className="related-equipment-card__brand">
          {brand || '\u00A0'}
        </p>
        <h3 className="related-equipment-card__title">{displayName}</h3>
        <p className="related-equipment-card__meta">
          {metaLabel || '\u00A0'}
        </p>
        <span className="related-equipment-card__cta" aria-hidden="true">
          View equipment guide →
        </span>
      </div>
    </Link>
  )
}
