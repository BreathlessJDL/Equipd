import { useState } from 'react'
import './EquipmentConsoleVariantCards.css'

function ConsoleImageFallback() {
  return (
    <div className="equipment-console-variants__fallback" role="img" aria-label="Image unavailable">
      <svg
        className="equipment-console-variants__fallback-icon"
        viewBox="0 0 48 36"
        width="40"
        height="30"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="2"
          y="2"
          width="44"
          height="32"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <rect
          x="8"
          y="8"
          width="32"
          height="16"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="24" cy="30" r="1.5" fill="currentColor" />
      </svg>
      <span className="equipment-console-variants__fallback-label">Image unavailable</span>
    </div>
  )
}

function ConsoleVariantImage({ imageUrl, alt }) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) {
    return <ConsoleImageFallback />
  }

  return (
    <div className="equipment-console-variants__image-wrap">
      <img
        src={imageUrl}
        alt={alt}
        className="equipment-console-variants__image"
        width={320}
        height={240}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export default function EquipmentConsoleVariantCards({
  variants = [],
  imageUrlByName = {},
  brandName = '',
  mode = 'compare',
  integrated = false,
}) {
  if (!variants.length) return null

  const isFixed = integrated || mode === 'fixed' || variants.length === 1
  const isIntegrated = Boolean(integrated)
  const brandPrefix = String(brandName || '').trim()

  return (
    <section className="equipment-console-variants" aria-labelledby="equipment-console-variants-title">
      <div className="equipment-console-variants__header">
        <h2 id="equipment-console-variants-title" className="equipment-console-variants__title">
          {isFixed ? 'Console' : 'Console variants'}
        </h2>
        <p className="equipment-console-variants__lead">
          {isIntegrated
            ? 'This machine has an integrated console. There is no alternative factory option to choose.'
            : isFixed
              ? 'This machine is fitted with the following console.'
              : 'Not sure which console you have? Compare your machine to the examples below.'}
        </p>
      </div>

      <ul className="equipment-console-variants__grid">
        {variants.map((variant) => {
          const imageUrl = imageUrlByName[variant] ?? null
          const consoleLabel = brandPrefix
            ? `${brandPrefix} ${variant} console`
            : `${variant} console`

          return (
            <li
              key={variant}
              className={
                isIntegrated
                  ? 'equipment-console-variants__card equipment-console-variants__card--integrated'
                  : 'equipment-console-variants__card'
              }
            >
              <div className="equipment-console-variants__media">
                <ConsoleVariantImage
                  key={imageUrl || `missing:${variant}`}
                  imageUrl={imageUrl}
                  alt={consoleLabel}
                />
              </div>
              <p className="equipment-console-variants__name">{variant}</p>
              {isIntegrated ? (
                <p className="equipment-console-variants__badge">Integrated console</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
