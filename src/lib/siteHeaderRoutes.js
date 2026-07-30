import { LOCATION_SLUGS } from './locations'
import { EQUIPMENT_LANDING_PATH_SET } from './equipmentLandingDefs.js'

export function isBrowseShellRoute(pathname) {
  if (pathname === '/' || pathname === '/browse') {
    return true
  }

  return LOCATION_SLUGS.some((slug) => pathname === `/listings/${slug}`)
}

export function isSellGymEquipmentRoute(pathname) {
  return pathname === '/sell-gym-equipment'
}

export function isBuyUsedGymEquipmentRoute(pathname) {
  return pathname === '/buy-used-gym-equipment'
}

export function isCommercialGymEquipmentRoute(pathname) {
  return pathname === '/commercial-gym-equipment'
}

export function isHomeGymEquipmentRoute(pathname) {
  return pathname === '/home-gym-equipment'
}

export function isCommercialCardioEquipmentRoute(pathname) {
  return pathname === '/commercial-cardio-equipment'
}

export function isCommercialStrengthEquipmentRoute(pathname) {
  return pathname === '/commercial-strength-equipment'
}

export function isHomeCardioEquipmentRoute(pathname) {
  return pathname === '/home-cardio-equipment'
}

export function isHomeStrengthEquipmentRoute(pathname) {
  return pathname === '/home-strength-equipment'
}

export function isRefurbishedCommercialGymEquipmentRoute(pathname) {
  return pathname === '/refurbished-commercial-gym-equipment'
}

export function isRefurbishedHomeGymEquipmentRoute(pathname) {
  return pathname === '/refurbished-home-gym-equipment'
}

export function isEquipmentLandingRoute(pathname) {
  return EQUIPMENT_LANDING_PATH_SET.has(pathname)
}

export function isMarketingLandingRoute(pathname) {
  return (
    isSellGymEquipmentRoute(pathname)
    || isBuyUsedGymEquipmentRoute(pathname)
    || isCommercialGymEquipmentRoute(pathname)
    || isHomeGymEquipmentRoute(pathname)
    || isCommercialCardioEquipmentRoute(pathname)
    || isCommercialStrengthEquipmentRoute(pathname)
    || isHomeCardioEquipmentRoute(pathname)
    || isHomeStrengthEquipmentRoute(pathname)
    || isRefurbishedCommercialGymEquipmentRoute(pathname)
    || isRefurbishedHomeGymEquipmentRoute(pathname)
    || isEquipmentLandingRoute(pathname)
  )
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
