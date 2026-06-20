import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchUnreadNotificationCount } from '../lib/notifications'
import './NotificationBell.css'

function NotificationBell({ onNavigate }) {
  const { user } = useAuth()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const { count } = await fetchUnreadNotificationCount(user.id)
    setUnreadCount(count)
  }, [user?.id])

  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount, location.pathname])

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

  if (!user) return null

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        `notification-bell${isActive ? ' notification-bell--active' : ''}`
      }
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
      onClick={onNavigate}
    >
      <span className="notification-bell__icon" aria-hidden="true">
        🔔
      </span>
      {unreadCount > 0 ? (
        <span className="notification-bell__badge">{badgeLabel}</span>
      ) : null}
    </NavLink>
  )
}

export default NotificationBell
