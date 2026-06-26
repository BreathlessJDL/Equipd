/**
 * Mobile menu icon image assets (public/mobile-menu-icons/).
 * Copied from design-reference with URL-safe filenames.
 */

export const MOBILE_MENU_ACCOUNT_ICON_SRC = {
  profile: '/mobile-menu-icons/profile-menu-icon.png',
  settings: '/mobile-menu-icons/settings-menu-icon.png',
  hub: '/mobile-menu-icons/my-hub-menu-icon.png',
  saved: '/mobile-menu-icons/saved-listings-menu-icon.svg',
  logout: '/mobile-menu-icons/log-out-menu-icon.png',
}

export const MOBILE_MENU_CATEGORY_ICON_SRC = {
  treadmill: '/mobile-menu-icons/treadmill-menu-icon.png',
  crosstrainer: '/mobile-menu-icons/crosstrainer-menu-icon.png',
  'upright-bike': '/mobile-menu-icons/upright-bike-menu-icon.png',
  'spin-bike': '/mobile-menu-icons/spin-bike-menu-icon.png',
  'multi-gym': '/mobile-menu-icons/multi-gym-menu-icon.png',
  'plate-loaded': '/mobile-menu-icons/plate-loaded-menu-icon.png',
  'pin-loaded': '/mobile-menu-icons/pin-loaded-menu-icon.png',
  dumbbell: '/mobile-menu-icons/dumbbells-menu-icon.png',
  'weight-plate': '/mobile-menu-icons/weight-plates-menu-icon.png',
  'squat-rack': '/mobile-menu-icons/squat-rack-menu-icon.png',
}

export function getMobileMenuAccountIconSrc(name) {
  return MOBILE_MENU_ACCOUNT_ICON_SRC[name] ?? null
}

export function getMobileMenuCategoryIconSrc(name) {
  return MOBILE_MENU_CATEGORY_ICON_SRC[name] ?? null
}
