/** Hub sidebar / mobile summary menu PNG icons (design-reference). */
export const HUB_MENU_ICON_FILES = {
  summary: 'summary icon menu.png',
  buying: 'buying icon menu.png',
  selling: 'selling icon menu.png',
  listings: 'listing icon menu.png',
  offers: 'my offers icon menu.png',
  orders: 'orders icon menu.png',
  saved: 'saved icon menu.png',
  reviews: 'reviews icon menu.png',
  settings: 'settings icon menu.png',
}

export function getHubMenuIconSrc(sectionId) {
  const filename = HUB_MENU_ICON_FILES[sectionId]
  if (!filename) return null

  return `/design-reference/${encodeURIComponent(filename)}`
}
