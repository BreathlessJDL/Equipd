import { NavLink } from 'react-router-dom'
import { useUnreadMessageCount } from '../hooks/useUnreadMessageCount'
import { EnvelopeIcon } from './icons/NavIcons'
import './icons/NavIcons.css'
import './MessagesNavLink.css'

function MessagesNavLink({ onNavigate, iconOnly = false }) {
  const { unreadCount } = useUnreadMessageCount()

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <NavLink
      to="/messages"
      className={({ isActive }) =>
        `messages-nav-link${iconOnly ? ' messages-nav-link--icon-only' : ''}${isActive ? ' messages-nav-link--active' : ''}`
      }
      aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
      onClick={onNavigate}
    >
      <EnvelopeIcon className="messages-nav-link__icon nav-action-icon" />
      {!iconOnly ? <span className="messages-nav-link__label">Messages</span> : null}
      {unreadCount > 0 ? (
        <span className="messages-nav-link__badge">{badgeLabel}</span>
      ) : null}
    </NavLink>
  )
}

export default MessagesNavLink
