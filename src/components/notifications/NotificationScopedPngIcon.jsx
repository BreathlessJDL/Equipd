/**
 * Notification-only PNG icon tile. Sizing is controlled by Notifications.css.
 */
function NotificationScopedPngIcon({ src, className = '' }) {
  return (
    <span
      className={`notification-scoped-png-icon${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        className="notification-scoped-png-icon__image"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  )
}

export default NotificationScopedPngIcon
