import { Link } from 'react-router-dom'
import './PageBreadcrumbs.css'

/**
 * Simple crawlable breadcrumbs.
 * items: [{ label, to? }] — last item is current page (no link).
 */
export default function PageBreadcrumbs({ items = [], className = '' }) {
  if (!items.length) return null

  return (
    <nav className={`page-breadcrumbs ${className}`.trim()} aria-label="Breadcrumb">
      <ol className="page-breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="page-breadcrumbs__item">
              {index > 0 ? <span className="page-breadcrumbs__sep" aria-hidden="true">/</span> : null}
              {isLast || !item.to ? (
                <span className="page-breadcrumbs__current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="page-breadcrumbs__link">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
