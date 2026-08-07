import { lazy, Suspense } from 'react'
import { useAuthModal } from '../../hooks/useAuthModal'

const AuthModal = lazy(() => import('./AuthModal'))

/**
 * Keeps the auth forms out of the initial bundle: the modal chunk is only
 * requested once a visitor actually opens login/signup.
 */
function AuthModalMount() {
  const { open } = useAuthModal()

  if (!open) return null

  return (
    <Suspense fallback={null}>
      <AuthModal />
    </Suspense>
  )
}

export default AuthModalMount
