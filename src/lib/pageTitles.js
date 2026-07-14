export const SITE_NAME = 'Equipd'

export const DEFAULT_PAGE_TITLE = 'Buy, Sell & Value Used Gym Equipment | Equipd Marketplace'

export const DEFAULT_PAGE_DESCRIPTION =
  "The UK's marketplace for used gym equipment. Buy and sell commercial and home gym equipment, browse thousands of listings and value your equipment instantly using original RRP, manufacture year and UK market data."

export function formatPageTitle(pageTitle) {
  if (!pageTitle?.trim()) return DEFAULT_PAGE_TITLE
  return `${pageTitle.trim()} | ${SITE_NAME}`
}
