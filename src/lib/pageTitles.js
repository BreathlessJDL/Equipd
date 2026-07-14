export const SITE_NAME = 'Equipd'

export const DEFAULT_PAGE_TITLE = 'Used Gym Equipment for Sale | Buy & Sell on Equipd'

export const DEFAULT_PAGE_DESCRIPTION =
  'Buy and sell used gym equipment across the UK on Equipd. Browse home and commercial fitness equipment, list items for sale and value eligible equipment.'

export function formatPageTitle(pageTitle) {
  if (!pageTitle?.trim()) return DEFAULT_PAGE_TITLE
  return `${pageTitle.trim()} | ${SITE_NAME}`
}
