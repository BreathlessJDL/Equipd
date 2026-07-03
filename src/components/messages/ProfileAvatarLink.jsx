import { Link } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { getProfileDisplayName } from '../../lib/profiles'
import { getSellerShopPath } from '../../lib/sellerShopUrls'
import './ProfileAvatarLink.css'

export function getProfileLinkLabel(profile, fallbackName = '') {
  const name = fallbackName.trim() || getProfileDisplayName(profile)?.trim() || 'profile'
  return `View ${name}'s profile`
}

function ProfileAvatarLink({ profile, size = 'sm', className = '' }) {
  const userId = profile?.id

  if (!userId) {
    return <UserAvatar profile={profile} size={size} className={className} />
  }

  return (
    <Link
      to={getSellerShopPath(profile)}
      className={`profile-avatar-link${className ? ` ${className}` : ''}`}
      aria-label={getProfileLinkLabel(profile)}
    >
      <UserAvatar profile={profile} size={size} />
    </Link>
  )
}

export default ProfileAvatarLink
