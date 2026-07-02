import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { touchUserActivity } from '../lib/profiles'

const CLIENT_MIN_INTERVAL_MS = 15 * 60 * 1000

export function useActivityHeartbeat() {
  const { user } = useAuth()
  const location = useLocation()
  const lastTouchRef = useRef(0)

  useEffect(() => {
    if (!user?.id) return

    const now = Date.now()
    if (now - lastTouchRef.current < CLIENT_MIN_INTERVAL_MS) return

    lastTouchRef.current = now
    touchUserActivity()
  }, [user?.id, location.pathname])
}
