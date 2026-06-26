import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AuthModalContext = createContext(null)

export function AuthModalProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    mode: 'login',
    redirectTo: '/',
  })

  const openLoginModal = useCallback(({ redirectTo = '/' } = {}) => {
    setState({ open: true, mode: 'login', redirectTo })
  }, [])

  const openSignupModal = useCallback(({ redirectTo = '/' } = {}) => {
    setState({ open: true, mode: 'signup', redirectTo })
  }, [])

  const closeAuthModal = useCallback(() => {
    setState((current) => ({ ...current, open: false }))
  }, [])

  const switchAuthModal = useCallback((mode) => {
    setState((current) => ({ ...current, mode }))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      openLoginModal,
      openSignupModal,
      closeAuthModal,
      switchAuthModal,
    }),
    [state, openLoginModal, openSignupModal, closeAuthModal, switchAuthModal],
  )

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>
}

export function useAuthModal() {
  const context = useContext(AuthModalContext)
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider')
  }
  return context
}
