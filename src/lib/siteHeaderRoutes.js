import { LOCATION_SLUGS } from './locations'

export function isBrowseShellRoute(pathname) {
  if (pathname === '/' || pathname === '/browse') {
    return true
  }

  return LOCATION_SLUGS.some((slug) => pathname === `/listings/${slug}`)
}

export function isSellGymEquipmentRoute(pathname) {
  return pathname === '/sell-gym-equipment'
}

export function isMobileHomepageRoute(pathname) {
  return pathname === '/'
}

export function isMessagesThreadRoute(pathname) {
  if (!pathname.startsWith('/messages/')) {
    return false
  }

  const conversationId = pathname.slice('/messages/'.length).split('/')[0]
  return conversationId.length > 0
}
