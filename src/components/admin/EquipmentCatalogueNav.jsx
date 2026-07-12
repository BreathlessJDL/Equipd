import { NavLink, Link } from 'react-router-dom'
import {
  EQUIPMENT_CATALOGUE_LEGACY_LINKS,
  EQUIPMENT_CATALOGUE_NAV,
} from '../../lib/equipmentCatalogueAdmin'
import './EquipmentCatalogueNav.css'

export default function EquipmentCatalogueNav({
  title = 'Equipment Catalogue',
  subtitle = 'Manage products, images, valuation data and catalogue content.',
  actions = null,
  showLegacy = true,
}) {
  return (
    <header className="equipment-catalogue-nav">
      <div className="equipment-catalogue-nav__intro">
        <div className="equipment-catalogue-nav__copy">
          <h1 className="equipment-catalogue-nav__title">{title}</h1>
          {subtitle ? (
            <p className="equipment-catalogue-nav__subtitle">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="equipment-catalogue-nav__actions">{actions}</div>
        ) : null}
      </div>

      <nav className="equipment-catalogue-nav__tabs" aria-label="Equipment catalogue">
        {EQUIPMENT_CATALOGUE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (
              `equipment-catalogue-nav__tab${isActive ? ' equipment-catalogue-nav__tab--active' : ''}`
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {showLegacy ? (
        <details className="equipment-catalogue-nav__legacy">
          <summary>Legacy tools</summary>
          <div className="equipment-catalogue-nav__legacy-links">
            {EQUIPMENT_CATALOGUE_LEGACY_LINKS.map((item) => (
              <Link key={item.to} to={item.to}>{item.label}</Link>
            ))}
          </div>
        </details>
      ) : null}
    </header>
  )
}
