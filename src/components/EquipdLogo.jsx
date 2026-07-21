const LOGO_SOURCES = {
  default: {
    webp: '/brand-logos/equipd-full-logo.webp',
    png: '/design-reference/Full%20logo%201.png',
    width: 1066,
    height: 270,
  },
  header: {
    webp: '/brand-logos/equipd-full-logo.webp',
    png: '/design-reference/Full%20logo%201.png',
    width: 1066,
    height: 270,
  },
  headerMobile: {
    webp: '/brand-logos/equipd-logo-mobile-header-grey.webp',
    png: '/design-reference/Equipd%20logo%20mobile%20header%20grey.png',
    width: 268,
    height: 262,
  },
}

function EquipdLogo({ className = '', variant = 'default' }) {
  const variantClass =
    variant === 'header'
      ? ' equipd-logo--header'
      : variant === 'headerMobile'
        ? ' equipd-logo--header-mobile'
        : ''

  const source = LOGO_SOURCES[variant] ?? LOGO_SOURCES.default

  return (
    <span
      className={`equipd-logo${variantClass}${className ? ` ${className}` : ''}`}
    >
      <picture>
        <source srcSet={source.webp} type="image/webp" />
        <img
          src={source.png}
          alt="Equipd"
          className="equipd-logo__image"
          width={source.width}
          height={source.height}
          decoding="async"
        />
      </picture>
    </span>
  )
}

export default EquipdLogo
