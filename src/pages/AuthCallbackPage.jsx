import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { OAUTH_PENDING_KEY } from '../lib/auth'
import { LoadingState } from '../components/ui/UiState'
import '../components/PageStub.css'
import { usePageTitle } from '../hooks/usePageTitle'

function AuthCallbackPage() {
  usePageTitle('Signing In')
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const completeTimer = window.setTimeout(() => {
      if (!sessionStorage.getItem(OAUTH_PENDING_KEY)) {
        navigate('/', { replace: true })
      }
    }, 3000)

    const timeoutTimer = window.setTimeout(() => {
      if (sessionStorage.getItem(OAUTH_PENDING_KEY)) {
        setTimedOut(true)
      }
    }, 20000)

    return () => {
      window.clearTimeout(completeTimer)
      window.clearTimeout(timeoutTimer)
    }
  }, [navigate])

  if (timedOut) {
    return (
      <div className="page-stub">
        <h1 className="page-stub__title">Sign-in delayed</h1>
        <p className="page-stub__message">
          Google sign-in is taking longer than expected. You can return to login and try again.
        </p>
        <Link to="/login" className="page-stub__link">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="page-stub">
      <LoadingState>Completing sign-in…</LoadingState>
    </div>
  )
}

export default AuthCallbackPage
