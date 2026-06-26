const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function AboutIcon({ className = '', children }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      {children}
    </svg>
  )
}

/**
 * Open cardboard box — design-reference/what we offer.png
 * Front face, seam line across upper third, interior W-fold.
 */
export function AboutWideSelectionIcon({ className = '' }) {
  return (
    <AboutIcon className={className}>
      <path d="M5.75 8.25h12.5v10.5H5.75z" />
      <path d="M5.75 11.75h12.5" />
      <path d="M9.25 14.25 12 17.25 14.75 14.25" />
    </AboutIcon>
  )
}

/**
 * Shopping cart facing right with check badge — reference match.
 */
export function AboutCartCheckIcon({ className = '' }) {
  return (
    <AboutIcon className={className}>
      <path d="M4.5 5.5h1.75" />
      <path d="M6.25 5.5 7.1 6.75H16.75" />
      <path d="M7.1 6.75 6.45 16h9.1l1.65-7.5H7.85" />
      <circle cx="8.95" cy="18" r="1.1" />
      <circle cx="14.85" cy="18" r="1.1" />
      <circle cx="16.35" cy="13.85" r="2.05" />
      <path d="m15.35 13.85.95.95 1.95-1.95" />
    </AboutIcon>
  )
}

/**
 * Delivery van moving right with three speed lines — reference match.
 */
export function AboutDeliveryVanIcon({ className = '' }) {
  return (
    <AboutIcon className={className}>
      <path d="M2 10.75h2.6" />
      <path d="M2 13h3.35" />
      <path d="M2 15.25h2.25" />
      <path d="M7.15 8.75h8.05v7.95H7.15z" />
      <path d="M15.2 10.75h3.1l2.3 2.5v3.45H15.2z" />
      <circle cx="10.05" cy="16.7" r="1.2" />
      <circle cx="17.35" cy="16.7" r="1.2" />
    </AboutIcon>
  )
}

/**
 * Shield with centred check — reference match.
 */
export function AboutShieldCheckIcon({ className = '' }) {
  return (
    <AboutIcon className={className}>
      <path d="M12 3.15 6.75 5.35v5.05c0 3.55 2.35 6.2 5.25 7.45 2.9-1.25 5.25-3.9 5.25-7.45V5.35L12 3.15z" />
      <path d="m9.55 12.1 1.65 1.65 3.45-3.65" />
    </AboutIcon>
  )
}

/**
 * Price tag tilted ~45° with hole and £ — reference match.
 */
export function AboutPriceTagIcon({ className = '' }) {
  return (
    <AboutIcon className={className}>
      <g transform="rotate(-45 12 12)">
        <path d="M5.25 7.75h8.75l7.75 7.75-7.75 7.75H5.25z" />
        <circle cx="5.25" cy="9.75" r="0.95" fill="currentColor" stroke="none" />
        <text
          x="11.85"
          y="15.35"
          fill="currentColor"
          stroke="none"
          fontSize="6.75"
          fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
          textAnchor="middle"
        >
          £
        </text>
      </g>
    </AboutIcon>
  )
}

/**
 * Three-person community icon — centre figure forward — reference match.
 */
export function AboutCommunityIcon({ className = '' }) {
  return (
    <AboutIcon className={className}>
      <circle cx="7.25" cy="9.65" r="1.75" />
      <path d="M4.65 18.2c.5-1.9 1.6-3 2.85-3" />
      <circle cx="16.75" cy="9.65" r="1.75" />
      <path d="M16.5 15.2c1.15 0 2.25 1.05 2.7 3" />
      <circle cx="12" cy="10.55" r="2.05" />
      <path d="M7.75 18.55c.65-2.55 2.45-4.05 4.25-4.05s3.6 1.5 4.25 4.05" />
    </AboutIcon>
  )
}
