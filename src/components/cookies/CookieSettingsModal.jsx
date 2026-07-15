import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCookieConsent } from '../../hooks/useCookieConsent'
import {
  COOKIE_CATEGORIES,
  COOKIE_POLICY_PATH,
  getDefaultCategoryPreferences,
  getVisibleOptionalCookieCategories,
} from '../../lib/cookieConsent'
import '../auth/AuthModal.css'
import './CookieSettingsModal.css'

const OPTIONAL_CATEGORIES = getVisibleOptionalCookieCategories()

function CookieSettingsModal() {
  const {
    settingsOpen,
    closeCookieSettings,
    savePreferences,
    acceptAll,
    rejectNonEssential,
    categoryPreferences,
  } = useCookieConsent()

  const [draftCategories, setDraftCategories] = useState(getDefaultCategoryPreferences())
  const draftCategoriesRef = useRef(draftCategories)
  draftCategoriesRef.current = draftCategories

  useEffect(() => {
    if (!settingsOpen) return undefined

    setDraftCategories(categoryPreferences)
    draftCategoriesRef.current = categoryPreferences

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeCookieSettings()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [categoryPreferences, closeCookieSettings, settingsOpen])

  if (!settingsOpen) return null

  function toggleCategory(categoryId) {
    setDraftCategories((current) => {
      const next = {
        ...current,
        [categoryId]: !current[categoryId],
      }
      draftCategoriesRef.current = next
      return next
    })
  }

  return (
    <div className="auth-modal cookie-settings-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close cookie settings"
        onClick={closeCookieSettings}
      />

      <div
        className="auth-modal__dialog cookie-settings-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
      >
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Close"
          onClick={closeCookieSettings}
        >
          ×
        </button>

        <h2 id="cookie-settings-title" className="cookie-settings-modal__title">
          Cookie settings
        </h2>
        <p className="cookie-settings-modal__lead">
          Choose whether Equipd may use analytics cookies. See our{' '}
          <Link to={COOKIE_POLICY_PATH} onClick={closeCookieSettings}>
            Cookie Policy
          </Link>{' '}
          for more information.
        </p>

        <ul className="cookie-settings-modal__list">
          <li className="cookie-settings-modal__item">
            <div className="cookie-settings-modal__item-header">
              <div>
                <h3 className="cookie-settings-modal__item-title">Necessary cookies</h3>
                <p className="cookie-settings-modal__item-description">
                  {COOKIE_CATEGORIES.necessary.description}
                </p>
              </div>
              <span className="cookie-settings-modal__always-on">Always on</span>
            </div>
          </li>

          {OPTIONAL_CATEGORIES.map((category) => (
            <li key={category.id} className="cookie-settings-modal__item">
              <div className="cookie-settings-modal__item-header">
                <div>
                  <h3 className="cookie-settings-modal__item-title">{category.label}</h3>
                  <p className="cookie-settings-modal__item-description">
                    {category.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  className={`cookie-settings-modal__toggle${
                    draftCategories[category.id] ? ' cookie-settings-modal__toggle--on' : ''
                  }`}
                  aria-checked={draftCategories[category.id]}
                  aria-label={`${category.label}`}
                  onClick={() => toggleCategory(category.id)}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="cookie-settings-modal__actions">
          <button
            type="button"
            className="cookie-settings-modal__button cookie-settings-modal__button--secondary"
            onClick={rejectNonEssential}
          >
            Reject non-essential
          </button>
          <button
            type="button"
            className="cookie-settings-modal__button cookie-settings-modal__button--secondary"
            onClick={acceptAll}
          >
            Accept all
          </button>
          <button
            type="button"
            className="cookie-settings-modal__button cookie-settings-modal__button--primary"
            onClick={() => savePreferences(draftCategoriesRef.current)}
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieSettingsModal
