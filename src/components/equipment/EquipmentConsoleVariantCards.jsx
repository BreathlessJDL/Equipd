import './EquipmentConsoleVariantCards.css'

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
                {imageUrl ? (
                  <div className="equipment-console-variants__image-wrap">
                    <img
                      src={imageUrl}
                      alt={consoleLabel}
                      className="equipment-console-variants__image"
                      width={320}
                      height={240}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="equipment-console-variants__placeholder" aria-hidden="true">
                    <span>Image coming soon</span>
                  </div>
                )}
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
