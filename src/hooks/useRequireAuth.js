import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { useAuthModal } from './useAuthModal'

export function useRequireAuth() {
  const { user, loading } = useAuth()
  const { openLoginModal } = useAuthModal()
  const location = useLocation()

  const requireAuth = useCallback(
    (redirectTo) => {
      if (user) return true

      const path =
        redirectTo ?? `${location.pathname}${location.search}${location.hash}`

      openLoginModal({ redirectTo: path })
      return false
    },
    [user, location.pathname, location.search, location.hash, openLoginModal],
  )

  return { user, loading, requireAuth }
}
