import { Link } from 'react-router-dom'
import { getHubStatusAccentClass } from '../../lib/hubItemStatus'
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

function HubMetadataPinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5a4 4 0 0 0-4 4c0 2.75 4 8.5 4 8.5s4-5.75 4-8.5a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="5.5" r="1.25" fill="currentColor" />
    </svg>
  )
}

function HubMetadataClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 5v3.25l2 1.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function HubMetadataPersonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M3.75 13.25c.65-2.35 2.35-3.5 4.25-3.5s3.6 1.15 4.25 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

const HUB_METADATA_ICONS = {
  party: HubMetadataPersonIcon,
  fulfilment: HubMetadataPinIcon,
  date: HubMetadataClockIcon,
}

export function HubItemMetadata({ items = [] }) {
  const visibleItems = items.filter((item) => item?.text)

  if (visibleItems.length === 0) return null

  return (
    <ul className="hub-item-row__metadata-list">
      {visibleItems.map((item) => {
        const Icon = HUB_METADATA_ICONS[item.type] ?? null

        return (
          <li key={`${item.type}-${item.text}`} className="hub-item-row__metadata-item">
            {Icon ? (
              <span className="hub-item-row__metadata-icon">
                <Icon />
              </span>
            ) : null}
            <span>{item.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function HubItemRow({
  id,
  highlighted = false,
  statusAccent = null,
  media,
  title,
  status,
  metadata,
  hint,
  message,
  finance,
  price,
  priceNote,
  primaryActions,
  secondaryActions,
  iconActions,
  links,
  details,
  centerActions = false,
}) {
  const financeBlock = finance ?? price
  const hasActionStack = Boolean(primaryActions || secondaryActions || iconActions || links)
  const accentClass = getHubStatusAccentClass(statusAccent)

  return (
    <li
      id={id}
      className={`hub-item-row ${accentClass}${highlighted ? ' hub-item-row--highlighted' : ''}${
        centerActions ? ' hub-item-row--center-actions' : ''
      }${financeBlock ? ' hub-item-row--has-finance' : ''}${hasActionStack ? ' hub-item-row--has-actions' : ''}`}
    >
      <div className="hub-item-row__main">
        <div className="hub-item-row__media">{media}</div>

        <div className="hub-item-row__content">
          {title ? <div className="hub-item-row__title-row">{title}</div> : null}
          {status ? <div className="hub-item-row__status-row">{status}</div> : null}
          {metadata ? <div className="hub-item-row__metadata-wrap">{metadata}</div> : null}
          {hint ? <p className="hub-item-row__hint">{hint}</p> : null}
          {message ? <p className="hub-item-row__message">{message}</p> : null}
        </div>

        {financeBlock || priceNote ? (
          <div className="hub-item-row__finance">
            {financeBlock ? <div className="hub-item-row__finance-block">{financeBlock}</div> : null}
            {priceNote ? <p className="hub-item-row__price-note">{priceNote}</p> : null}
          </div>
        ) : null}

        {hasActionStack ? (
          <div className="hub-item-row__actions-col">
            <div className="hub-item-row__action-stack">
              {primaryActions ? (
                <div className="hub-item-row__primary-actions">{primaryActions}</div>
              ) : null}
              {secondaryActions ? (
                <div className="hub-item-row__secondary-actions">{secondaryActions}</div>
              ) : null}
              {iconActions ? <div className="hub-item-row__nav-row">{iconActions}</div> : null}
              {links ? <div className="hub-item-row__links">{links}</div> : null}
            </div>
          </div>
        ) : null}
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
    <dl className="hub-item-finance">
      <div className="hub-item-finance__row">
        <dt>{label ?? 'Price'}</dt>
        <dd>{amount}</dd>
      </div>
    </dl>
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
