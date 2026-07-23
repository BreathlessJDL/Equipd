import { NavLink } from 'react-router-dom'
import AccountDropdown from './AccountDropdown'
import MessagesNavLink from './MessagesNavLink'
import NotificationBell from './NotificationBell'
import { HeartIcon, PlusIcon } from './icons/NavIcons'
import './icons/NavIcons.css'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import { useIsAdmin } from '../hooks/useIsAdmin'

const CREATE_LISTING_PATH = '/listings/new'

const loggedOutPublicNavLinks = [
  { to: '/brands', label: 'Equipment Values' },
  { to: '/buy-used-gym-equipment', label: 'Buy Equipment' },
  { to: '/sell-gym-equipment', label: 'Sell Equipment' },
]

const loggedInPublicNavLinks = [
  { to: '/browse', label: 'Browse' },
  { to: '/brands', label: 'Equipment Values' },
  { to: '/buy-used-gym-equipment', label: 'Buy Equipment' },
  { to: '/sell-gym-equipment', label: 'Sell Equipment' },
]

const adminNavLinks = [
  { to: '/admin/cases', label: 'Cases' },
  { to: '/admin/support', label: 'Support' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/intelligence/products', label: 'Equipment Catalogue' },
  { to: '/admin/price-guide/import', label: 'Price Guide' },
]

function AppNav({
  id,
  className = '',
  linkClassName = 'app-shell__nav-link',
  activeLinkClassName = 'app-shell__nav-link--active',
  onNavigate,
  showAuthActions = true,
  variant = 'default',
}) {
  const { user, loading } = useAuth()
  const { openLoginModal, openSignupModal } = useAuthModal()
  const { isAdmin } = useIsAdmin()
  const isHome = variant === 'home'

  function linkClass(isActive, extraClass = '') {
    return `${linkClassName}${extraClass ? ` ${extraClass}` : ''}${isActive ? ` ${activeLinkClassName}` : ''}`
  }

  function handleOpenLogin() {
    onNavigate?.()
    openLoginModal()
  }

  function handleOpenSignup() {
    onNavigate?.()
    openSignupModal()
  }

  function handleCreateListingClick(event) {
    if (!loading && !user) {
      event.preventDefault()
      onNavigate?.()
      openLoginModal({ redirectTo: CREATE_LISTING_PATH })
      return
    }

    onNavigate?.()
  }

  function handlePublicNavClick(event, to) {
    onNavigate?.()
  }

  const publicNavLinks = !loading && user ? loggedInPublicNavLinks : loggedOutPublicNavLinks

  return (
    <nav id={id} className={className} aria-label="Main">
      {!isHome
        ? publicNavLinks.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => linkClass(isActive)}
              onClick={(event) => handlePublicNavClick(event, to)}
            >
              {label}
            </NavLink>
          ))
        : null}

      {isHome ? (
        <>
          {!loading && user ? (
            <div className="home-header__nav-group home-header__nav-group--icons">
              <MessagesNavLink onNavigate={onNavigate} iconOnly />
              <NotificationBell onNavigate={onNavigate} iconOnly />
              <NavLink
                to="/saved-listings"
                className={({ isActive }) =>
                  `home-header__icon-link${isActive ? ' home-header__icon-link--active' : ''}`
                }
                aria-label="Saved listings"
                onClick={onNavigate}
              >
                <HeartIcon className="nav-action-icon" />
              </NavLink>
            </div>
          ) : null}

          <div className="home-header__nav-group home-header__nav-group--links">
            <NavLink
              to="/brands"
              className={({ isActive }) => linkClass(isActive)}
              onClick={onNavigate}
            >
              Equipment Values
            </NavLink>
            <NavLink
              to="/buy-used-gym-equipment"
              className={({ isActive }) => linkClass(isActive)}
              onClick={onNavigate}
            >
              Buy Equipment
            </NavLink>
            <NavLink
              to="/sell-gym-equipment"
              className={({ isActive }) => linkClass(isActive)}
              onClick={onNavigate}
            >
              Sell Equipment
            </NavLink>
            {!loading && user ? (
              <NavLink
                to="/browse"
                className={({ isActive }) => linkClass(isActive)}
                onClick={onNavigate}
              >
                Browse
              </NavLink>
            ) : null}
          </div>

          <div className="home-header__nav-group home-header__nav-group--actions">
            <NavLink
              to={CREATE_LISTING_PATH}
              className={({ isActive }) =>
                `home-header__create-listing${isActive ? ' home-header__create-listing--active' : ''}`
              }
              onClick={handleCreateListingClick}
            >
              <PlusIcon className="home-header__create-listing-icon" />
              Create Listing
            </NavLink>

            {!loading && user ? <AccountDropdown onNavigate={onNavigate} /> : null}
          </div>

          {!loading && !user ? (
            <div className="home-header__nav-group home-header__nav-group--auth">
              <button
                type="button"
                className="home-header__auth-button home-header__auth-button--login"
                onClick={handleOpenLogin}
              >
                Log in
              </button>
              <button
                type="button"
                className="home-header__auth-button home-header__auth-button--signup"
                onClick={handleOpenSignup}
              >
                Sign up
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {!loading && user && isAdmin && !isHome
        ? adminNavLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => linkClass(isActive)}
              onClick={onNavigate}
            >
              {label}
            </NavLink>
          ))
        : null}

      {!loading && user && !isHome ? (
        <MessagesNavLink onNavigate={onNavigate} />
      ) : null}
      {!loading && user && !isHome ? (
        <NotificationBell onNavigate={onNavigate} />
      ) : null}

      {!loading && user && !isHome ? (
        <AccountDropdown onNavigate={onNavigate} />
      ) : null}

      {showAuthActions && !loading && !user && !isHome ? (
        <>
          <button
            type="button"
            className={`${linkClassName} app-shell__nav-button`}
            onClick={handleOpenLogin}
          >
            Log in
          </button>
          <button
            type="button"
            className={`${linkClassName} app-shell__nav-button`}
            onClick={handleOpenSignup}
          >
            Sign up
          </button>
        </>
      ) : null}
    </nav>
  )
}

export default AppNav
