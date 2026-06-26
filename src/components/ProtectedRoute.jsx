import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import '../components/PageStub.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { openLoginModal } = useAuthModal()
  const location = useLocation()
  const hasPromptedRef = useRef(false)

  useEffect(() => {
    if (loading || user) {
      if (user) {
        hasPromptedRef.current = false
      }
      return
    }

    if (hasPromptedRef.current) return

    hasPromptedRef.current = true
    openLoginModal({
      redirectTo: `${location.pathname}${location.search}${location.hash}`,
    })
  }, [loading, user, location.pathname, location.search, location.hash, openLoginModal])

  if (loading) {
    return (
      <section className="page-stub">
        <p className="page-stub__lead">Checking your session…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-stub">
        <p className="page-stub__lead">Sign in to access this page.</p>
      </section>
    )
  }

  return children
}

export default ProtectedRoute
