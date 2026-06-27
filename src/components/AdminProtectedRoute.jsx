import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { getAuthRedirectPath, navigateAwayFromProtectedRoute } from '../lib/authReturnNavigation'
import { LoadingState } from './ui/UiState'
import '../components/PageStub.css'

function AdminProtectedRoute({ children }) {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { openLoginModal } = useAuthModal()
  const location = useLocation()
  const navigate = useNavigate()
  const hasPromptedRef = useRef(false)
  const loading = authLoading || adminLoading

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
        <LoadingState>Checking admin access…</LoadingState>
      </section>
    )
  }

  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <section className="page-stub">
        <h2 className="page-stub__title">Admin access required</h2>
        <p className="page-stub__lead">
          You do not have permission to view this page.
        </p>
        <p className="page-stub__lead">
          <Link to="/">Back to browse</Link>
        </p>
      </section>
    )
  }

  return children
}

export default AdminProtectedRoute
