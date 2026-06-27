import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../components/Notifications.css'
import NotificationsList from '../components/NotificationsList'
import { useAuth } from '../hooks/useAuth'
import {
  confirmClearAllNotifications,
  fetchNotifications,
  getNotificationErrorMessage,
  getNotificationNavigationPath,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
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

    function handleNotificationsChanged(event) {
      if (event.detail?.scope !== 'all') return

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      )
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)
    }
  }, [user?.id])

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

  async function handleClearAll() {
    if (!user?.id || notifications.every((notification) => notification.is_read)) return
    if (!confirmClearAllNotifications()) return

    setMarkingAll(true)
    setError('')

    const { error: markError } = await markAllNotificationsRead()

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

    const destination = getNotificationNavigationPath(notification)

    if (destination) {
      navigate(destination)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  return (
    <section className="notifications-page">
      <header className="notifications-page__header">
        <div>
          <h2 className="notifications-page__title">Notifications</h2>
          <p className="notifications-page__lead">
            Stay up to date with your offers, orders, payments and support requests.
          </p>
        </div>

        {!loading && notifications.length > 0 && unreadCount > 0 ? (
          <button
            type="button"
            className="notifications-page__clear-all"
            disabled={markingAll}
            onClick={handleClearAll}
          >
            {markingAll ? 'Clearing…' : 'Clear all'}
          </button>
        ) : null}
      </header>

      <NotificationsList
        notifications={notifications}
        loading={loading}
        error={error}
        openingId={openingId}
        onOpenNotification={handleOpenNotification}
      />
    </section>
  )
}

export default NotificationsPage
