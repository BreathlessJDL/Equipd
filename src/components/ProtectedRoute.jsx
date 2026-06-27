import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import { getAuthRedirectPath, navigateAwayFromProtectedRoute } from '../lib/authReturnNavigation'
import '../components/PageStub.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { openLoginModal } = useAuthModal()
  const location = useLocation()
  const navigate = useNavigate()
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
      redirectTo: getAuthRedirectPath(location),
    })
    navigateAwayFromProtectedRoute(navigate)
  }, [loading, user, location, openLoginModal, navigate])

  if (loading) {
    return (
      <section className="page-stub">
        <p className="page-stub__lead">Checking your session…</p>
      </section>
    )
  }

  if (!user) {
    return null
  }

  return children
}

export default ProtectedRoute
