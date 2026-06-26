import { useEffect, useState } from 'react'
import { fetchProfile, PROFILE_UPDATED_EVENT } from '../lib/profiles'
import { isUserAdmin } from '../lib/admin'
import { useAuth } from './useAuth'

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return undefined

    if (!user?.id) {
      setIsAdmin(false)
      setLoading(false)
      return undefined
    }

    let active = true

    async function loadAdminStatus() {
      setLoading(true)

      const { data } = await fetchProfile(user.id, { email: user.email })

      if (!active) return

      setIsAdmin(isUserAdmin(data))
      setLoading(false)
    }

    loadAdminStatus()

    function handleProfileUpdated(event) {
      const updatedUserId = event.detail?.userId
      if (updatedUserId && updatedUserId !== user.id) return
      loadAdminStatus()
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)

    return () => {
      active = false
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [authLoading, user?.email, user?.id])

  return {
    isAdmin,
    loading: authLoading || loading,
  }
}
