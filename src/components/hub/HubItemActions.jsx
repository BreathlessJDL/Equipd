import { Link } from 'react-router-dom'
import {
  EnvelopeIcon,
  EyeIcon,
  PencilIcon,
  ReceiptIcon,
  StarIcon,
} from '../icons/NavIcons'

export function HubItemNavActions({ children }) {
  if (!children) return null

  return <div className="hub-item-nav-actions">{children}</div>
}

/** @deprecated Use HubItemNavActions */
export const HubItemIconActions = HubItemNavActions

export function HubNavAction({ to, label, icon: Icon }) {
  if (!to || !label || !Icon) return null

  return (
    <Link to={to} className="hub-item-nav-action" aria-label={label} title={label}>
      <Icon className="hub-item-nav-action__icon" aria-hidden="true" />
      <span className="hub-item-nav-action__label">{label}</span>
    </Link>
  )
}

/** @deprecated Use HubNavAction */
export const HubIconAction = HubNavAction

export function HubItemReviewButton({ to, onClick, label = 'Leave review', disabled = false }) {
  const className = 'hub-item-row__btn hub-item-row__review-btn'

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
      >
        <StarIcon className="hub-item-row__review-btn-icon" aria-hidden="true" />
        <span>{label}</span>
      </button>
    )
  }

  if (!to) return null

  return (
    <Link to={to} className={className} aria-label={label} title={label}>
      <StarIcon className="hub-item-row__review-btn-icon" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  )
}

export function HubItemReviewSubmitted({ label = 'Review submitted' }) {
  return (
    <span className="hub-item-row__btn hub-item-row__review-submitted" role="status">
      <StarIcon className="hub-item-row__review-submitted-icon" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export function HubViewListingAction({ to }) {
  return <HubNavAction to={to} label="View listing" icon={EyeIcon} />
}

export function HubViewConversationAction({ to }) {
  return <HubNavAction to={to} label="Message" icon={EnvelopeIcon} />
}

export function HubViewOrderAction({ to }) {
  return <HubNavAction to={to} label="View order" icon={ReceiptIcon} />
}

export function HubEditListingAction({ to, label = 'Edit' }) {
  return <HubNavAction to={to} label={label} icon={PencilIcon} />
}

export function buildHubNavActions({ order, conversationUrl, listingUrl, includeViewOrder = false }) {
  const actions = []

  if (includeViewOrder && order?.id) {
    actions.push(<HubViewOrderAction key="order" to={`/orders/${order.id}`} />)
  }

  if (conversationUrl) {
    actions.push(<HubViewConversationAction key="conversation" to={conversationUrl} />)
  }

  if (listingUrl) {
    actions.push(<HubViewListingAction key="listing" to={listingUrl} />)
  }

  if (actions.length === 0) return null

  return <HubItemNavActions>{actions}</HubItemNavActions>
}
