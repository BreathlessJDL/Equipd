import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  exitImpersonation,
  failSafeLeaveImpersonation,
  getImpersonationClientState,
  getImpersonationDisplayName,
  isImpersonatingSession,
  isImpersonationExpired,
} from '../../lib/adminImpersonation'
import './AdminImpersonationBanner.css'

function AdminImpersonationBanner() {
  const { session, user, loading } = useAuth()
  const navigate = useNavigate()
  const [exiting, setExiting] = useState(false)
  const [tick, setTick] = useState(0)

  const impersonating = !loading && isImpersonatingSession(session, user)

  useEffect(() => {
    if (!impersonating) return undefined
    const id = window.setInterval(() => setTick((value) => value + 1), 15000)
    return () => window.clearInterval(id)
  }, [impersonating])

  useEffect(() => {
    if (!impersonating || exiting) return undefined

    async function leaveIfExpired() {
      if (!isImpersonationExpired(session)) return
      const stored = getImpersonationClientState()
      setExiting(true)
      if (stored?.adminRestoreHashedToken) {
        const result = await exitImpersonation()
        navigate(result.redirectTo || '/login', { replace: true })
        return
      }
      const fail = await failSafeLeaveImpersonation(
        'Your impersonation session expired. Please sign in again.',
      )
      navigate(fail.redirectTo, { replace: true })
    }

    leaveIfExpired()
    return undefined
  }, [impersonating, exiting, session, tick, navigate])

  if (!impersonating) return null

  const displayName = getImpersonationDisplayName(session, user)

  async function handleExit() {
    if (exiting) return
    setExiting(true)
    const result = await exitImpersonation()
    navigate(result.redirectTo || '/login', { replace: true })
  }

  return (
    <div className="admin-impersonation-banner" role="status">
      <p className="admin-impersonation-banner__text">
        Admin mode — You are logged in as <strong>{displayName}</strong>
      </p>
      <button
        type="button"
        className="admin-impersonation-banner__exit"
        onClick={handleExit}
        disabled={exiting}
      >
        {exiting ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  )
}

export default AdminImpersonationBanner
