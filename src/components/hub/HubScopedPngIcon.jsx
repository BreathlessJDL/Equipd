/**
 * Hub-only PNG icon tile. Sizing is controlled by HubLayout.css — not EquipdTypeIcon.
 */
function HubScopedPngIcon({ src, className = '' }) {
  return (
    <span
      className={`hub-scoped-png-icon${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        className="hub-scoped-png-icon__image"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  )
}

export default HubScopedPngIcon
