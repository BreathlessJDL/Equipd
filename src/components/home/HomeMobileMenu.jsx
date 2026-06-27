import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import EquipdLogo from '../EquipdLogo'
import MobileMenuIconImage from '../icons/MobileMenuIconImage'
import {
  getMobileMenuAccountIconSrc,
  getMobileMenuCategoryIconSrc,
} from '../../lib/mobileMenuIconAssets'
import {
  getMobileMenuCategoryHref,
  MOBILE_MENU_CATEGORIES,
} from '../../lib/mobileMenuCategories'
import { useAuth } from '../../hooks/useAuth'
import { useAuthModal } from '../../hooks/useAuthModal'

function useMobileMenuEffects(open, onClose) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])
}

function MenuIconSlot({ variant, children }) {
  return (
    <span className={`home-mobile-menu__icon-slot home-mobile-menu__icon-slot--${variant}`}>
      {children}
    </span>
  )
}

function HomeMobileMenuHeader({ onClose, onHomeBrandClick }) {
  function handleLogoClick(event) {
    onHomeBrandClick?.(event)
    onClose()
  }

  return (
    <header className="home-mobile-menu__header">
      <Link to="/" className="home-mobile-menu__logo" onClick={handleLogoClick}>
        <EquipdLogo variant="header" />
      </Link>
      <button
        type="button"
        className="home-mobile-menu__close"
        aria-label="Close menu"
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  )
}

function MobileMenuCategorySection({ onClose, headingId = 'home-mobile-menu-categories' }) {
  return (
    <section className="home-mobile-menu__categories" aria-labelledby={headingId}>
      <h2 id={headingId} className="home-mobile-menu__categories-heading">
        Categories
      </h2>
      <ul className="home-mobile-menu__menu-list">
        {MOBILE_MENU_CATEGORIES.map((category) => (
          <li key={category.id}>
            <Link
              to={getMobileMenuCategoryHref(category.slug)}
              className="home-mobile-menu__row home-mobile-menu__row--category"
              onClick={onClose}
            >
              <MenuIconSlot variant="category">
                <MobileMenuIconImage
                  src={getMobileMenuCategoryIconSrc(category.icon)}
                  className="home-mobile-menu__icon home-mobile-menu__icon--category"
                />
              </MenuIconSlot>
              <span className="home-mobile-menu__row-label">{category.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function LoggedOutMobileMenu({ onClose, onHomeBrandClick }) {
  const { openLoginModal, openSignupModal } = useAuthModal()

  return (
    <>
      <HomeMobileMenuHeader onClose={onClose} onHomeBrandClick={onHomeBrandClick} />

      <div className="home-mobile-menu__actions">
        <button
          type="button"
          className="home-mobile-menu__cta home-mobile-menu__cta--primary"
          onClick={() => {
            openLoginModal({ redirectTo: '/listings/new' })
            onClose()
          }}
        >
          Sell now
        </button>
        <button
          type="button"
          className="home-mobile-menu__cta home-mobile-menu__cta--secondary"
          onClick={() => {
            openSignupModal({ redirectTo: '/settings' })
            onClose()
          }}
        >
          Sign up
        </button>
        <button
          type="button"
          className="home-mobile-menu__cta home-mobile-menu__cta--secondary"
          onClick={() => {
            openLoginModal({ redirectTo: '/' })
            onClose()
          }}
        >
          Log in
        </button>
      </div>

      <MobileMenuCategorySection onClose={onClose} />
    </>
  )
}

function LoggedInMobileMenu({ user, onClose, onSignOut, onHomeBrandClick }) {
  const accountLinks = [
    { to: `/shop/${user.id}`, label: 'Profile', icon: 'profile' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
    { to: '/hub', label: 'My Hub', icon: 'hub' },
    { to: '/saved-listings', label: 'Saved Listings', icon: 'saved' },
  ]

  return (
    <>
      <HomeMobileMenuHeader onClose={onClose} onHomeBrandClick={onHomeBrandClick} />

      <div className="home-mobile-menu__actions home-mobile-menu__actions--logged-in">
        <Link
          to="/listings/new"
          className="home-mobile-menu__cta home-mobile-menu__cta--primary"
          onClick={onClose}
        >
          Sell now
        </Link>
      </div>

      <ul className="home-mobile-menu__menu-list home-mobile-menu__menu-list--account">
        {accountLinks.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="home-mobile-menu__row home-mobile-menu__row--account"
              onClick={onClose}
            >
              <MenuIconSlot variant="account">
                <MobileMenuIconImage
                  src={getMobileMenuAccountIconSrc(item.icon)}
                  className={`home-mobile-menu__icon home-mobile-menu__icon--account${
                    item.icon === 'saved' ? ' home-mobile-menu__icon--saved' : ''
                  }`}
                />
              </MenuIconSlot>
              <span className="home-mobile-menu__row-label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <MobileMenuCategorySection
        onClose={onClose}
        headingId="home-mobile-menu-categories-logged-in"
      />

      <div className="home-mobile-menu__footer">
        <button
          type="button"
          className="home-mobile-menu__row home-mobile-menu__row--account home-mobile-menu__row--logout"
          onClick={onSignOut}
        >
          <MenuIconSlot variant="account">
            <MobileMenuIconImage
              src={getMobileMenuAccountIconSrc('logout')}
              className="home-mobile-menu__icon home-mobile-menu__icon--account"
            />
          </MenuIconSlot>
          <span className="home-mobile-menu__row-label">Log out</span>
        </button>
      </div>
    </>
  )
}

function HomeMobileMenu({ open, onClose, onHomeBrandClick }) {
  const { user, loading, signOut } = useAuth()

  useMobileMenuEffects(open, onClose)

  if (!open) return null

  async function handleSignOut() {
    onClose()
    const { error } = await signOut()

    if (error) {
      console.error('Sign out failed:', error.message)
    }
  }

  return (
    <div className="home-mobile-menu" role="presentation">
      <div
        id="home-mobile-menu"
        className="home-mobile-menu__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        {loading ? (
          <>
            <HomeMobileMenuHeader onClose={onClose} onHomeBrandClick={onHomeBrandClick} />
            <p className="home-mobile-menu__loading">Loading…</p>
          </>
        ) : !user ? (
          <LoggedOutMobileMenu onClose={onClose} onHomeBrandClick={onHomeBrandClick} />
        ) : (
          <LoggedInMobileMenu
            user={user}
            onClose={onClose}
            onSignOut={handleSignOut}
            onHomeBrandClick={onHomeBrandClick}
          />
        )}
      </div>
    </div>
  )
}

export default HomeMobileMenu
