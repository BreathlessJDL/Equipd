import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthModal } from '../../hooks/useAuthModal'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import './AuthModal.css'

function AuthModal() {
  const navigate = useNavigate()
  const { open, mode, redirectTo, closeAuthModal, switchAuthModal } = useAuthModal()

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeAuthModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, closeAuthModal])

  if (!open) return null

  function handleAuthSuccess({ redirectTo: nextRedirect = redirectTo }) {
    closeAuthModal()

    if (nextRedirect && nextRedirect !== window.location.pathname) {
      navigate(nextRedirect, { replace: true })
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="auth-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close dialog"
        onClick={closeAuthModal}
      />

      <div
        className="auth-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={isLogin ? 'auth-modal-login-heading' : 'auth-modal-signup-heading'}
      >
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Close"
          onClick={closeAuthModal}
        >
          ×
        </button>

        <div className="auth-modal__content">
          {isLogin ? (
            <LoginForm
              idPrefix="auth-modal-login"
              redirectTo={redirectTo}
              onSuccess={handleAuthSuccess}
              onSwitchToSignup={() => switchAuthModal('signup')}
            />
          ) : (
            <SignupForm
              idPrefix="auth-modal-signup"
              redirectTo={redirectTo}
              onSuccess={handleAuthSuccess}
              onSwitchToLogin={() => switchAuthModal('login')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthModal
