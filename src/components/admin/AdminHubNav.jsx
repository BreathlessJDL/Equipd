import { NavLink, useLocation } from 'react-router-dom'
import { ADMIN_HUB_NAV, isAdminHubNavActive } from '../../lib/adminNav'
import './AdminHubNav.css'

function AdminHubNav() {
  const location = useLocation()

  return (
    <header className="admin-hub-nav">
      <NavLink to="/admin" end className="admin-hub-nav__title">
        Equipd Admin
      </NavLink>
      <nav className="admin-hub-nav__links" aria-label="Admin sections">
        {ADMIN_HUB_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={Boolean(item.end)}
            className={() => {
              const active = isAdminHubNavActive(location.pathname, item)
              return `admin-hub-nav__link${active ? ' admin-hub-nav__link--active' : ''}`
            }}
            aria-current={isAdminHubNavActive(location.pathname, item) ? 'page' : undefined}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export default AdminHubNav
