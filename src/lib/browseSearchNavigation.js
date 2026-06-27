export const MOBILE_SEARCH_MEDIA_QUERY = '(max-width: 960px)'

export function buildBrowseSearchPath(search = '') {
  const query = search.trim()
  return query ? `/browse?search=${encodeURIComponent(query)}` : '/browse'
}

export function shouldNavigateToBrowseOnMobileSearch(pathname) {
  return pathname === '/'
}

export function isMobileSearchViewport() {
  return window.matchMedia(MOBILE_SEARCH_MEDIA_QUERY).matches
}
