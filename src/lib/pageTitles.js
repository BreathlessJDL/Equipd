export const SITE_NAME = 'Equipd'

export const DEFAULT_PAGE_TITLE = 'Equipd — Used Gym Equipment'

export function formatPageTitle(pageTitle) {
  if (!pageTitle?.trim()) return DEFAULT_PAGE_TITLE
  return `${pageTitle.trim()} | ${SITE_NAME}`
}
