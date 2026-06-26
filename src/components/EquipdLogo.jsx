const LOGO_SOURCES = {
  default: '/design-reference/Full%20logo.png',
  header: '/design-reference/Full%20logo%201.png',
  headerMobile: '/design-reference/Equipd%20logo%20mobile%20header%20grey.png',
}

function EquipdLogo({ className = '', variant = 'default' }) {
  const variantClass =
    variant === 'header'
      ? ' equipd-logo--header'
      : variant === 'headerMobile'
        ? ' equipd-logo--header-mobile'
        : ''

  return (
    <span
      className={`equipd-logo${variantClass}${className ? ` ${className}` : ''}`}
    >
      <img
        src={LOGO_SOURCES[variant] ?? LOGO_SOURCES.default}
        alt="Equipd"
        className="equipd-logo__image"
      />
    </span>
  )
}

export default EquipdLogo
