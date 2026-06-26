import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  getNotificationErrorMessage,
  getNotificationNavigationPath,
  markNotificationRead,
  NOTIFICATION_POPOVER_LIMIT,
} from '../lib/notifications'
import { BellIcon } from './icons/NavIcons'
import NotificationsList from './NotificationsList'
import './icons/NavIcons.css'
import './NotificationBell.css'
import './Notifications.css'

function NotificationBell({ onNavigate, iconOnly = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState(null)

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const { count } = await fetchUnreadNotificationCount(user.id)
    setUnreadCount(count)
  }, [user?.id])

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    const { data, error: notificationsError } = await fetchNotifications(user.id, {
      limit: NOTIFICATION_POPOVER_LIMIT,
    })

    if (notificationsError) {
      setError(getNotificationErrorMessage(notificationsError))
      setNotifications([])
    } else {
      setNotifications(data ?? [])
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount])

  useEffect(() => {
    if (!user?.id) return undefined

    function handleFocus() {
      refreshUnreadCount()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?.id, refreshUnreadCount])

  useEffect(() => {
    if (!open || !user?.id) return

    loadNotifications()
  }, [open, user?.id, loadNotifications])

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    function handlePointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  function closePopover() {
    setOpen(false)
  }

  function togglePopover() {
    setOpen((current) => !current)
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
      await refreshUnreadCount()
    }

    setOpeningId(null)
    closePopover()
    onNavigate?.()

    const destination = getNotificationNavigationPath(notification)

    if (destination) {
      navigate(destination)
    }
  }

  function handleViewAllClick() {
    closePopover()
    onNavigate?.()
  }

  if (!user) return null

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`notification-bell${iconOnly ? ' notification-bell--icon-only' : ''}${
          open ? ' notification-bell--open' : ''
        }`}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notification-popover"
        onClick={togglePopover}
      >
        <BellIcon className="notification-bell__icon nav-action-icon" />
        {!iconOnly ? <span className="notification-bell__label">Notifications</span> : null}
        {unreadCount > 0 ? (
          <span className="notification-bell__badge">{badgeLabel}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="notification-popover__backdrop"
            aria-label="Close notifications"
            onClick={closePopover}
          />
          <div
            id="notification-popover"
            className="notification-popover"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
          >
            <div className="notification-popover__header">
              <h2 className="notification-popover__title">Notifications</h2>
              {unreadCount > 0 ? (
                <span className="notification-popover__unread-count">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>

            <div className="notification-popover__body">
              <NotificationsList
                notifications={notifications}
                loading={loading}
                error={error}
                openingId={openingId}
                onOpenNotification={handleOpenNotification}
                compact
              />
            </div>

            <div className="notification-popover__footer">
              <Link
                to="/notifications"
                className="notification-popover__view-all"
                onClick={handleViewAllClick}
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default NotificationBell
