import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import StripeOnboardingModal from '../components/settings/StripeOnboardingModal'
import { getStripeApiErrorMessage, startStripeConnectOnboarding } from '../lib/stripe-api'

const StripeConnectOnboardingContext = createContext(null)

export function StripeConnectOnboardingProvider({ children }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const errorReporterRef = useRef(null)

  const openOnboarding = useCallback(({ onError } = {}) => {
    errorReporterRef.current = typeof onError === 'function' ? onError : null
    setError('')
    setModalOpen(true)
  }, [])

  const closeOnboarding = useCallback(() => {
    if (loading) return
    setModalOpen(false)
    setError('')
    errorReporterRef.current = null
  }, [loading])

  const continueToStripe = useCallback(async () => {
    setLoading(true)
    setError('')

    const { url, error: onboardingError } = await startStripeConnectOnboarding()

    if (onboardingError) {
      const message = getStripeApiErrorMessage(onboardingError)
      setLoading(false)
      setError(message)
      errorReporterRef.current?.(message)
      return
    }

    globalThis.location.assign(url)
  }, [])

  const value = useMemo(
    () => ({
      modalOpen,
      loading,
      error,
      openOnboarding,
      closeOnboarding,
      continueToStripe,
    }),
    [modalOpen, loading, error, openOnboarding, closeOnboarding, continueToStripe],
  )

  return (
    <StripeConnectOnboardingContext.Provider value={value}>
      {children}
      <StripeOnboardingModal
        open={modalOpen}
        loading={loading}
        error={error}
        onClose={closeOnboarding}
        onContinue={continueToStripe}
      />
    </StripeConnectOnboardingContext.Provider>
  )
}

export function useStripeConnectOnboarding() {
  const context = useContext(StripeConnectOnboardingContext)
  if (!context) {
    throw new Error('useStripeConnectOnboarding must be used within a StripeConnectOnboardingProvider')
  }
  return context
}
