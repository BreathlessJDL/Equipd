import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { fetchTotalUnreadMessageCount } from '../lib/messages'

export const UNREAD_MESSAGES_CHANGED_EVENT = 'equipd:unread-messages-changed'

export function notifyUnreadMessagesChanged() {
  globalThis.dispatchEvent(new Event(UNREAD_MESSAGES_CHANGED_EVENT))
}

export function useUnreadMessageCount() {
  const { user } = useAuth()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const { count } = await fetchTotalUnreadMessageCount(user.id)
    setUnreadCount(count)
  }, [user?.id])

  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount, location.pathname])

  useEffect(() => {
    if (!user?.id) return undefined

    function handleRefresh() {
      refreshUnreadCount()
    }

    globalThis.addEventListener('focus', handleRefresh)
    globalThis.addEventListener(UNREAD_MESSAGES_CHANGED_EVENT, handleRefresh)

    return () => {
      globalThis.removeEventListener('focus', handleRefresh)
      globalThis.removeEventListener(UNREAD_MESSAGES_CHANGED_EVENT, handleRefresh)
    }
  }, [user?.id, refreshUnreadCount])

  return { unreadCount, refreshUnreadCount }
}
