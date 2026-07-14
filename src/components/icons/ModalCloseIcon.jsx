/**
 * Reliable modal close glyph — inline SVG (no icon fonts / Unicode specials).
 */
export function ModalCloseIcon({ className = '', size = 18 } = {}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
