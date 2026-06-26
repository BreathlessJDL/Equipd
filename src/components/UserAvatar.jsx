import { getProfileInitials } from '../lib/profiles'
import './UserAvatar.css'

function UserAvatar({ profile, user, size = 'md', className = '' }) {
  const avatarUrl = profile?.avatar_url?.trim()
  const initial = profile?.initial ?? getProfileInitials(profile, { user })
  const initialClassName =
    initial.length > 1 ? ' user-avatar--initial-duo' : ''

  if (avatarUrl) {
    return (
      <span
        className={`user-avatar user-avatar--${size} user-avatar--image${className ? ` ${className}` : ''}`}
      >
        <img src={avatarUrl} alt="" className="user-avatar__image" />
      </span>
    )
  }

  return (
    <span
      className={`user-avatar user-avatar--${size} user-avatar--initial${initialClassName}${className ? ` ${className}` : ''}`}
      aria-hidden={Boolean(className)}
    >
      {initial}
    </span>
  )
}

export default UserAvatar
