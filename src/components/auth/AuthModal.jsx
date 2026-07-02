import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthModal } from '../../hooks/useAuthModal'
import ForgotPasswordForm from './ForgotPasswordForm'
import LoginForm from './LoginForm'
import SignupEmailConfirmation from './SignupEmailConfirmation'
import SignupForm from './SignupForm'
import './AuthModal.css'

function AuthModal() {
  const navigate = useNavigate()
  const {
    open,
    mode,
    redirectTo,
    pendingConfirmationEmail,
    closeAuthModal,
    switchAuthModal,
    showSignupConfirmation,
  } = useAuthModal()

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

  function handleEmailConfirmationRequired({ email }) {
    showSignupConfirmation(email)
  }

  function handleOpenLoginFromConfirmation() {
    switchAuthModal('login')
  }

  const isLogin = mode === 'login'
  const isSignupConfirmation = mode === 'signup-confirmation'
  const isForgotPassword = mode === 'forgot-password'

  const dialogLabelId = isLogin
    ? 'auth-modal-login-heading'
    : isForgotPassword
      ? 'auth-modal-forgot-password-heading'
    : isSignupConfirmation
      ? 'auth-modal-signup-confirmation-heading'
      : 'auth-modal-signup-heading'

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
        aria-labelledby={dialogLabelId}
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
              onForgotPassword={() => switchAuthModal('forgot-password')}
            />
          ) : isForgotPassword ? (
            <ForgotPasswordForm
              idPrefix="auth-modal-forgot-password"
              compact
              onBackToLogin={() => switchAuthModal('login')}
            />
          ) : isSignupConfirmation ? (
            <SignupEmailConfirmation
              idPrefix="auth-modal-signup-confirmation"
              email={pendingConfirmationEmail}
              onOpenLogin={handleOpenLoginFromConfirmation}
              onClose={closeAuthModal}
            />
          ) : (
            <SignupForm
              idPrefix="auth-modal-signup"
              redirectTo={redirectTo}
              onSuccess={handleAuthSuccess}
              onEmailConfirmationRequired={handleEmailConfirmationRequired}
              onSwitchToLogin={() => switchAuthModal('login')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthModal
