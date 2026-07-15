import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { applyConsentedAnalytics } from '../lib/analytics'
import {
  getAcceptAllCategoryPreferences,
  getDefaultCategoryPreferences,
  getRejectNonEssentialCategoryPreferences,
  hasRecordedCookieConsent,
  readStoredCookieConsent,
  writeStoredCookieConsent,
} from '../lib/cookieConsent'

const CookieConsentContext = createContext(null)

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => readStoredCookieConsent())
  const [bannerVisible, setBannerVisible] = useState(() => !hasRecordedCookieConsent())
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    applyConsentedAnalytics(consent)
  }, [consent])

  const persistConsent = useCallback((categories) => {
    const record = writeStoredCookieConsent(categories)
    // Apply immediately so GA can load without waiting for the next effect.
    applyConsentedAnalytics(record)
    setConsent(record)
    setBannerVisible(false)
    return record
  }, [])

  const acceptAll = useCallback(() => {
    persistConsent(getAcceptAllCategoryPreferences())
    setSettingsOpen(false)
  }, [persistConsent])

  const rejectNonEssential = useCallback(() => {
    persistConsent(getRejectNonEssentialCategoryPreferences())
    setSettingsOpen(false)
  }, [persistConsent])

  const savePreferences = useCallback(
    (categories) => {
      persistConsent(categories)
      setSettingsOpen(false)
    },
    [persistConsent],
  )

  const openCookieSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const closeCookieSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      consent,
      bannerVisible,
      settingsOpen,
      categoryPreferences: consent?.categories ?? getDefaultCategoryPreferences(),
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openCookieSettings,
      closeCookieSettings,
    }),
    [
      acceptAll,
      bannerVisible,
      closeCookieSettings,
      consent,
      openCookieSettings,
      rejectNonEssential,
      savePreferences,
      settingsOpen,
    ],
  )

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext)

  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider')
  }

  return context
}
