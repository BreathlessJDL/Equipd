import './OfficialEquipdBadge.css'

export const OFFICIAL_EQUIPD_LABEL = 'Official Equipd account'
export const OFFICIAL_EQUIPD_BADGE_TEXT = 'Official Equipd'

function OfficialMark({ className = '' }) {
  return (
    <svg
      className={`official-equipd-badge__mark${className ? ` ${className}` : ''}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 1.5 2.8 3.7v3.9c0 3.3 2.1 6.3 5.2 7.4 3.1-1.1 5.2-4.1 5.2-7.4V3.7L8 1.5Zm-.2 9.1L4.8 7.6l1.1-1.1 1.8 1.8 3.3-3.3 1.1 1.1-4.3 4.5Z"
      />
    </svg>
  )
}

/**
 * Official Equipd identity badge.
 * Only render when the server-provided `is_official_equipd` flag is true.
 *
 * @param {'full' | 'compact'} [variant='full']
 */
function OfficialEquipdBadge({ className = '', variant = 'full' }) {
  const isCompact = variant === 'compact'

  if (isCompact) {
    return (
      <span
        className={`official-equipd-badge official-equipd-badge--compact${
          className ? ` ${className}` : ''
        }`}
        title={OFFICIAL_EQUIPD_LABEL}
        aria-label={OFFICIAL_EQUIPD_LABEL}
        role="img"
      >
        <OfficialMark />
      </span>
    )
  }

  return (
    <span
      className={`official-equipd-badge official-equipd-badge--full${
        className ? ` ${className}` : ''
      }`}
      title={OFFICIAL_EQUIPD_LABEL}
    >
      <OfficialMark />
      {OFFICIAL_EQUIPD_BADGE_TEXT}
    </span>
  )
}

/**
 * Name + optional compact official tick, driven only by `isOfficial`.
 */
export function OfficialEquipdName({
  name,
  isOfficial = false,
  className = '',
  nameClassName = '',
  badgeClassName = '',
  as: Component = 'span',
}) {
  const label = name ?? ''

  return (
    <Component
      className={`official-equipd-name${className ? ` ${className}` : ''}`}
    >
      <span className={`official-equipd-name__text${nameClassName ? ` ${nameClassName}` : ''}`}>
        {label}
      </span>
      {isOfficial ? (
        <>
          <OfficialEquipdBadge variant="compact" className={badgeClassName} />
        </>
      ) : null}
    </Component>
  )
}

export default OfficialEquipdBadge
