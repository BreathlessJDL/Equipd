import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../components/Notifications.css'
import { useAuth } from '../hooks/useAuth'
import {
  fetchNotifications,
  formatNotificationTimestamp,
  getNotificationErrorMessage,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications'

function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [openingId, setOpeningId] = useState(null)

  useEffect(() => {
    if (!user?.id) return undefined

    let active = true

    async function loadNotifications() {
      setLoading(true)
      setError('')

      const { data, error: notificationsError } = await fetchNotifications(user.id)

      if (!active) return

      if (notificationsError) {
        setError(getNotificationErrorMessage(notificationsError))
        setNotifications([])
        setLoading(false)
        return
      }

      setNotifications(data ?? [])
      setLoading(false)
    }

    loadNotifications()

    return () => {
      active = false
    }
  }, [user?.id])

  async function handleMarkAllRead() {
    if (!user?.id || notifications.every((notification) => notification.is_read)) return

    setMarkingAll(true)
    setError('')

    const { error: markError } = await markAllNotificationsRead(user.id)

    setMarkingAll(false)

    if (markError) {
      setError(getNotificationErrorMessage(markError))
      return
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, is_read: true })),
    )
  }

  async function handleOpenNotification(notification) {
    if (openingId) return

    setOpeningId(notification.id)
    setError('')

    if (!notification.is_read) {
      const { error: markError } = await markNotificationRead(notification.id)

      if (markError) {
        setOpeningId(null)
        setError(getNotificationErrorMessage(markError))
        return
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      )
    }

    setOpeningId(null)

    if (notification.link_url) {
      navigate(notification.link_url)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  return (
    <section className="notifications-page">
      <header className="notifications-page__header">
        <div>
          <h2 className="notifications-page__title">Notifications</h2>
          <p className="notifications-page__lead">
            Updates about messages and offers on your listings.
          </p>
        </div>

        {!loading && notifications.length > 0 && unreadCount > 0 ? (
          <button
            type="button"
            className="notifications-page__mark-all"
            disabled={markingAll}
            onClick={handleMarkAllRead}
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        ) : null}
      </header>

      {loading ? (
        <p className="notifications-page__message notifications-page__message--empty">Loading…</p>
      ) : null}

      {!loading && error ? (
        <p className="notifications-page__message notifications-page__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && notifications.length === 0 ? (
        <p className="notifications-page__message notifications-page__message--empty">
          No notifications yet.
        </p>
      ) : null}

      {!loading && !error && notifications.length > 0 ? (
        <ul className="notifications-page__list">
          {notifications.map((notification) => (
            <li key={notification.id} className="notifications-page__item">
              <button
                type="button"
                className={`notifications-page__button${
                  notification.is_read ? '' : ' notifications-page__button--unread'
                }`}
                disabled={openingId === notification.id}
                onClick={() => handleOpenNotification(notification)}
              >
                <span className="notifications-page__item-header">
                  <span className="notifications-page__item-title">{notification.title}</span>
                  {!notification.is_read ? (
                    <span className="notifications-page__unread-dot" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="notifications-page__item-body">{notification.body}</span>
                <time
                  className="notifications-page__item-time"
                  dateTime={notification.created_at}
                >
                  {formatNotificationTimestamp(notification.created_at)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default NotificationsPage
