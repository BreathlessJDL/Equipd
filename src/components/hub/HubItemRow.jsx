import { Link } from 'react-router-dom'
import './HubItemRow.css'

export function HubItemStatusBadge({ variant, label }) {
  return (
    <span className={`hub-item-status hub-item-status--${variant}`}>
      {label}
    </span>
  )
}

export function HubItemThumbnail({ src, href, alt = '' }) {
  if (src && href) {
    return (
      <Link to={href} className="hub-item-row__thumb-link">
        <img src={src} alt={alt} className="hub-item-row__thumb" />
      </Link>
    )
  }

  if (src) {
    return <img src={src} alt={alt} className="hub-item-row__thumb" />
  }

  return <div className="hub-item-row__thumb hub-item-row__thumb--empty" aria-hidden="true" />
}

export function HubItemRow({
  id,
  highlighted = false,
  media,
  title,
  status,
  metadata,
  hint,
  message,
  price,
  priceNote,
  primaryActions,
  secondaryActions,
  iconActions,
  links,
  details,
  centerActions = false,
}) {
  const hasDecisionActions = Boolean(primaryActions || secondaryActions)

  return (
    <li
      id={id}
      className={`hub-item-row${highlighted ? ' hub-item-row--highlighted' : ''}${
        centerActions ? ' hub-item-row--center-actions' : ''
      }`}
    >
      <div className="hub-item-row__main">
        <div className="hub-item-row__media">{media}</div>

        <div className="hub-item-row__info">
          <div className="hub-item-row__title-row">{title}</div>
          {price || priceNote ? (
            <div className="hub-item-row__price-row">
              {price ? <div className="hub-item-row__price-block">{price}</div> : null}
              {priceNote ? <p className="hub-item-row__price-note">{priceNote}</p> : null}
            </div>
          ) : null}
          {status ? <div className="hub-item-row__status-row">{status}</div> : null}
          {metadata ? <p className="hub-item-row__metadata">{metadata}</p> : null}
          {hint ? <p className="hub-item-row__hint">{hint}</p> : null}
          {message ? <p className="hub-item-row__message">{message}</p> : null}
        </div>

        <div className="hub-item-row__actions-col">
          {hasDecisionActions ? (
            <div className="hub-item-row__decision-actions">
              {primaryActions ? (
                <div className="hub-item-row__primary-actions">{primaryActions}</div>
              ) : null}
              {secondaryActions ? (
                <div className="hub-item-row__secondary-actions">{secondaryActions}</div>
              ) : null}
            </div>
          ) : null}

          {iconActions ? <div className="hub-item-row__nav-row">{iconActions}</div> : null}

          {links ? <div className="hub-item-row__links">{links}</div> : null}
        </div>
      </div>

      {details ? <div className="hub-item-row__details">{details}</div> : null}
    </li>
  )
}

export function HubItemTitle({ children, href }) {
  if (href) {
    return (
      <Link to={href} className="hub-item-row__title">
        {children}
      </Link>
    )
  }

  return <span className="hub-item-row__title">{children}</span>
}

export function HubItemPrice({ amount, label }) {
  return (
    <div className="hub-item-row__price-wrap">
      <p className="hub-item-row__price">
        {amount}
        {label ? <span className="hub-item-row__price-suffix"> {label}</span> : null}
      </p>
    </div>
  )
}

export function HubItemButton({
  children,
  onClick,
  disabled = false,
  variant = 'secondary',
  type = 'button',
  ariaExpanded,
}) {
  return (
    <button
      type={type}
      className={`hub-item-row__btn hub-item-row__btn--${variant}`}
      disabled={disabled}
      onClick={onClick}
      aria-expanded={ariaExpanded}
    >
      {children}
    </button>
  )
}

export function HubItemLink({ to, children }) {
  return (
    <Link to={to} className="hub-item-row__link">
      {children}
    </Link>
  )
}

export function HubItemList({ children }) {
  return <ul className="hub-item-list">{children}</ul>
}
