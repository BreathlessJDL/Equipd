import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import AppNav from '../AppNav'
import EquipdLogo from '../EquipdLogo'
import MessagesNavLink from '../MessagesNavLink'
import NotificationBell from '../NotificationBell'
import { HeartIcon } from '../icons/NavIcons'
import '../icons/NavIcons.css'
import '../MessagesNavLink.css'
import '../NotificationBell.css'
import { useAuth } from '../../hooks/useAuth'
import HomeMobileMenu from './HomeMobileMenu'
import './HomeHeader.css'
import './HomeMobileMenu.css'

function HomeHeader({ search, onSearchChange, onSearchSubmit }) {
  const { user, loading } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const isLoggedIn = !loading && Boolean(user)

  function handleSearchSubmit(event) {
    event.preventDefault()
    onSearchSubmit?.()
  }

  function closeMenu() {
    setNavOpen(false)
  }

  return (
    <header className={`home-header${isLoggedIn ? ' home-header--logged-in' : ''}`}>
      <div className="home-header__inner">
        <div className="home-header__bar">
          <div className="home-header__toolbar">
            <Link to="/" className="home-header__brand" onClick={closeMenu}>
              <EquipdLogo variant="header" className="home-header__logo--full" />
              {isLoggedIn ? (
                <EquipdLogo variant="headerMobile" className="home-header__logo--mobile" />
              ) : null}
            </Link>

            <div className="home-header__top-actions">
              {isLoggedIn ? (
                <div className="home-header__mobile-icons" aria-label="Quick actions">
                  <MessagesNavLink onNavigate={closeMenu} iconOnly />
                  <NotificationBell onNavigate={closeMenu} iconOnly />
                  <NavLink
                    to="/saved-listings"
                    className={({ isActive }) =>
                      `home-header__icon-link${isActive ? ' home-header__icon-link--active' : ''}`
                    }
                    aria-label="Saved listings"
                    onClick={closeMenu}
                  >
                    <HeartIcon className="nav-action-icon" />
                  </NavLink>
                </div>
              ) : null}

              <button
                type="button"
                className="home-header__menu-toggle"
                aria-expanded={navOpen}
                aria-controls="home-mobile-menu"
                aria-label={navOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setNavOpen((open) => !open)}
              >
                <span className="home-header__menu-toggle-bar" />
                <span className="home-header__menu-toggle-bar" />
                <span className="home-header__menu-toggle-bar" />
              </button>
            </div>
          </div>

          <form className="home-header__search" onSubmit={handleSearchSubmit}>
            <label className="visually-hidden" htmlFor="home-search">
              Search listings
            </label>
            <span className="home-header__search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16.5 16.5 20 20" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="home-search"
              className="home-header__search-input"
              type="search"
              placeholder="Search for equipment..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <button type="submit" className="home-header__search-button">
              Search
            </button>
          </form>

          <AppNav
            id="home-header-nav"
            className="home-header__nav"
            linkClassName="home-header__nav-link"
            activeLinkClassName="home-header__nav-link--active"
            onNavigate={closeMenu}
            variant="home"
          />
        </div>
      </div>

      <HomeMobileMenu open={navOpen} onClose={closeMenu} />
    </header>
  )
}

export default HomeHeader
