import { Link } from 'react-router-dom'
import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import './HubEmptyState.css'

function HubEmptyState({
  variant = EQUIPD_ICON_VARIANT.DEFAULT,
  title,
  description,
  actionLabel,
  actionTo,
  compact = false,
  className = '',
}) {
  if (!title) return null

  return (
    <div
      className={`hub-empty-state${compact ? ' hub-empty-state--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="hub-empty-state__icon" aria-hidden="true">
        <EquipdTypeIcon variant={variant} className="hub-empty-state__type-icon" />
      </div>
      <h4 className="hub-empty-state__title">{title}</h4>
      {description ? <p className="hub-empty-state__description">{description}</p> : null}
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="hub-empty-state__action">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

export { HubEmptyState }
