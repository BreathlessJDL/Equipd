import { useState } from 'react'
import { getBrandLogoMeta } from '../lib/brandCatalogueCore'
import './BrandLogo.css'

const warnedLogoPaths = new Set()

function warnMissingLogo(path) {
  if (!path || warnedLogoPaths.has(path)) return
  warnedLogoPaths.add(path)
  console.warn(`[BrandLogo] Missing logo asset: ${path}`)
}

function resolveLogoMeta(brand, brandSlug) {
  if (brand && (brand.displayName || brand.logoPath != null || brand.slug)) {
    const fallback = getBrandLogoMeta(brand.slug || brandSlug)
    return {
      displayName: brand.displayName || fallback?.displayName || '',
      logoPath: brand.logoPath ?? fallback?.logoPath ?? null,
      logoAlt: brand.logoAlt || fallback?.logoAlt || (brand.displayName ? `${brand.displayName} logo` : 'Brand logo'),
      logoScale: brand.logoScale ?? fallback?.logoScale ?? 1,
      logoMaxWidth: brand.logoMaxWidth ?? fallback?.logoMaxWidth ?? null,
      logoMaxHeight: brand.logoMaxHeight ?? fallback?.logoMaxHeight ?? null,
      logoBackground: brand.logoBackground ?? fallback?.logoBackground ?? null,
    }
  }
  return getBrandLogoMeta(brandSlug)
}

/**
 * Shared brand logo renderer driven by the central brand registry.
 * Uses a fixed-height container plus optional registry scale values.
 */
export default function BrandLogo({
  brand = null,
  brandSlug = null,
  className = '',
  priority = false,
  size = 'card',
}) {
  const [failed, setFailed] = useState(false)
  const meta = resolveLogoMeta(brand, brandSlug)

  if (!meta?.displayName) return null

  const showImage = Boolean(meta.logoPath) && !failed
  const scale = Number(meta.logoScale) > 0 ? Number(meta.logoScale) : 1
  const classes = [
    'brand-logo',
    `brand-logo--${size}`,
    showImage ? '' : 'brand-logo--fallback',
    meta.logoBackground ? `brand-logo--bg-${meta.logoBackground}` : '',
    className,
  ].filter(Boolean).join(' ')

  if (!showImage) {
    if (meta.logoPath) warnMissingLogo(meta.logoPath)
    return (
      <span className={classes} role="img" aria-label={meta.logoAlt || `${meta.displayName} logo`}>
        <span className="brand-logo__text">{meta.displayName}</span>
      </span>
    )
  }

  const imageStyle = {
    '--brand-logo-scale': String(scale),
  }
  if (meta.logoMaxWidth) imageStyle.maxWidth = meta.logoMaxWidth
  if (meta.logoMaxHeight) imageStyle.maxHeight = meta.logoMaxHeight

  return (
    <span className={classes}>
      <img
        className="brand-logo__image"
        src={meta.logoPath}
        alt={meta.logoAlt || `${meta.displayName} logo`}
        width={220}
        height={90}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={imageStyle}
        onError={() => {
          warnMissingLogo(meta.logoPath)
          setFailed(true)
        }}
      />
    </span>
  )
}
