import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { fetchTotalUnreadMessageCount } from '../lib/messages'

export const UNREAD_MESSAGES_CHANGED_EVENT = 'equipd:unread-messages-changed'

// The badge renders in both the mobile header and the nav bar, so several
// components ask for the same count on every navigation. Share one request.
const DEDUPE_WINDOW_MS = 5000

let inflightRequest = null
let inflightUserId = null
let lastResult = null

function readUnreadCount(userId, { force = false } = {}) {
  if (
    !force &&
    lastResult &&
    lastResult.userId === userId &&
    Date.now() - lastResult.at < DEDUPE_WINDOW_MS
  ) {
    return Promise.resolve(lastResult.count)
  }

  if (inflightRequest && inflightUserId === userId) {
    return inflightRequest
  }

  inflightUserId = userId
  inflightRequest = fetchTotalUnreadMessageCount(userId)
    .then(({ count }) => {
      lastResult = { userId, count, at: Date.now() }
      return count
    })
    .finally(() => {
      inflightRequest = null
      inflightUserId = null
    })

  return inflightRequest
}

export function notifyUnreadMessagesChanged() {
  lastResult = null
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

    setUnreadCount(await readUnreadCount(user.id))
  }, [user?.id])

  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount, location.pathname])

  useEffect(() => {
    if (!user?.id) return undefined

    function handleRefresh() {
      lastResult = null
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
