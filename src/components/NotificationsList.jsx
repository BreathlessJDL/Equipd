import NotificationTypeIcon from './notifications/NotificationTypeIcon'
import EquipdTypeIcon from './icons/EquipdTypeIcon'
import { EQUIPD_ICON_VARIANT } from '../lib/equipdIconVariants'
import './icons/EquipdTypeIcon.css'
import {
  formatNotificationTimestamp,
  getNotificationNavigationPath,
} from '../lib/notifications'
import {
  formatNotificationRelativeTime,
  getNotificationActionLabel,
  getNotificationThumbnailUrl,
  groupNotificationsByDate,
} from '../lib/notificationPresentation'

function NotificationFeedCard({ notification, openingId, onOpenNotification }) {
  const destination = getNotificationNavigationPath(notification)
  const actionLabel = getNotificationActionLabel(notification)
  const thumbnailUrl = getNotificationThumbnailUrl(notification)
  const isUnread = !notification.is_read

  return (
    <li className="notifications-feed__item">
      <button
        type="button"
        className={`notification-card${isUnread ? ' notification-card--unread' : ''}${
          destination ? ' notification-card--clickable' : ''
        }`}
        disabled={openingId === notification.id}
        onClick={() => onOpenNotification(notification)}
      >
        <NotificationTypeIcon notification={notification} />

        <div className="notification-card__content">
          <div className="notification-card__header">
            <span className="notification-card__title">{notification.title}</span>
            {isUnread ? (
              <span className="notification-card__unread-dot" aria-label="Unread" />
            ) : null}
          </div>

          <p className="notification-card__body">{notification.body}</p>

          <div className="notification-card__footer">
            <time className="notification-card__time" dateTime={notification.created_at}>
              {formatNotificationRelativeTime(notification.created_at)}
            </time>
            {destination ? (
              <span className="notification-card__action">{actionLabel}</span>
            ) : null}
          </div>
        </div>

        {thumbnailUrl ? (
          <img
            className="notification-card__thumbnail"
            src={thumbnailUrl}
            alt=""
            loading="lazy"
          />
        ) : null}
      </button>
    </li>
  )
}

function NotificationsFeedEmptyState() {
  return (
    <div className="notifications-feed__empty">
      <EquipdTypeIcon
        variant={EQUIPD_ICON_VARIANT.DEFAULT}
        className="notifications-feed__empty-icon"
      />
      <p className="notifications-feed__empty-title">You&apos;re all caught up.</p>
      <p className="notifications-feed__empty-lead">
        We&apos;ll notify you when something important needs your attention.
      </p>
    </div>
  )
}

function NotificationsCompactList({
  notifications,
  openingId,
  onOpenNotification,
}) {
  return (
    <ul className="notifications-list notifications-list--compact">
      {notifications.map((notification) => (
        <li key={notification.id} className="notifications-list__item">
          <button
            type="button"
            className={`notifications-list__button${
              notification.is_read ? '' : ' notifications-list__button--unread'
            }`}
            disabled={openingId === notification.id}
            onClick={() => onOpenNotification(notification)}
          >
            <span className="notifications-list__item-header">
              <span className="notifications-list__item-title">{notification.title}</span>
              {!notification.is_read ? (
                <span className="notifications-list__unread-dot" aria-hidden="true" />
              ) : null}
            </span>
            <span className="notifications-list__item-body">{notification.body}</span>
            <time className="notifications-list__item-time" dateTime={notification.created_at}>
              {formatNotificationTimestamp(notification.created_at)}
            </time>
          </button>
        </li>
      ))}
    </ul>
  )
}

function NotificationsFeed({ notifications, openingId, onOpenNotification }) {
  const groups = groupNotificationsByDate(notifications)

  return (
    <div className="notifications-feed">
      {groups.map((group) => (
        <section key={group.key} className="notifications-feed__group" aria-label={group.label}>
          <h3 className="notifications-feed__group-title">{group.label}</h3>
          <ul className="notifications-feed__list">
            {group.notifications.map((notification) => (
              <NotificationFeedCard
                key={notification.id}
                notification={notification}
                openingId={openingId}
                onOpenNotification={onOpenNotification}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function NotificationsList({
  notifications,
  loading,
  error,
  openingId,
  onOpenNotification,
  emptyMessage = 'No notifications yet.',
  compact = false,
}) {
  if (loading) {
    return (
      <p className="notifications-list__message notifications-list__message--empty">
        Loading…
      </p>
    )
  }

  if (error) {
    return (
      <p className="notifications-list__message notifications-list__message--error" role="alert">
        {error}
      </p>
    )
  }

  if (notifications.length === 0) {
    if (compact) {
      return (
        <p className="notifications-list__message notifications-list__message--empty">
          {emptyMessage}
        </p>
      )
    }

    return <NotificationsFeedEmptyState />
  }

  if (compact) {
    return (
      <NotificationsCompactList
        notifications={notifications}
        openingId={openingId}
        onOpenNotification={onOpenNotification}
      />
    )
  }

  return (
    <NotificationsFeed
      notifications={notifications}
      openingId={openingId}
      onOpenNotification={onOpenNotification}
    />
  )
}

export default NotificationsList
