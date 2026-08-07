import './RouteFallback.css'

/**
 * Placeholder shown while a lazily loaded route chunk downloads.
 * Reserves viewport height so the footer does not jump up mid-navigation.
 */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback__label">Loading…</span>
    </div>
  )
}

export default RouteFallback
