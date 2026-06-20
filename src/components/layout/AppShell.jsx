import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import NotificationBell from '../NotificationBell'
import LocationPageLinks from '../LocationPageLinks'
import { useAuth } from '../../hooks/useAuth'
import './AppShell.css'

const publicNavLinks = [
  { to: '/', label: 'Browse', end: true },
  { to: '/listings/new', label: 'Sell' },
  { to: '/profile', label: 'Profile' },
]

const authedNavLinks = [
  { to: '/saved-listings', label: 'Saved Listings' },
  { to: '/my-listings', label: 'My Listings' },
  { to: '/messages', label: 'Messages' },
]

function AppShell() {
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const { error } = await signOut()
    setSigningOut(false)
    setNavOpen(false)

    if (error) {
      console.error('Sign out failed:', error.message)
      return
    }

    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <Link to="/" className="app-shell__brand" onClick={() => setNavOpen(false)}>
            <h1 className="app-shell__logo">Equipd</h1>
            <p className="app-shell__tagline">UK marketplace for used gym equipment</p>
          </Link>

          <button
            type="button"
            className="app-shell__nav-toggle"
            aria-expanded={navOpen}
            aria-controls="app-shell-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            Menu
          </button>

          <nav
            id="app-shell-nav"
            className={`app-shell__nav${navOpen ? ' app-shell__nav--open' : ''}`}
            aria-label="Main"
          >
            {publicNavLinks.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`
                }
                onClick={() => setNavOpen(false)}
              >
                {label}
              </NavLink>
            ))}

            {!loading && user
              ? authedNavLinks.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`
                    }
                    onClick={() => setNavOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))
              : null}

            {!loading && user ? <NotificationBell onNavigate={() => setNavOpen(false)} /> : null}

            {!loading && user ? (
              <button
                type="button"
                className="app-shell__nav-link app-shell__nav-button"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Logging out…' : 'Log out'}
              </button>
            ) : null}

            {!loading && !user ? (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`
                  }
                  onClick={() => setNavOpen(false)}
                >
                  Log in
                </NavLink>
                <NavLink
                  to="/signup"
                  className={({ isActive }) =>
                    `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`
                  }
                  onClick={() => setNavOpen(false)}
                >
                  Sign up
                </NavLink>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="app-shell__main">
        <Outlet />
      </main>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <p>&copy; {new Date().getFullYear()} Equipd</p>
          <div className="app-shell__footer-links">
            <Link to="/">Browse listings</Link>
            <Link to="/listings/new">Sell equipment</Link>
          </div>
          <LocationPageLinks variant="footer" />
        </div>
      </footer>
    </div>
  )
}

export default AppShell
