export const MOBILE_SEARCH_MEDIA_QUERY = '(max-width: 960px)'

export function isBrowseRoute(pathname) {
  return pathname === '/browse'
}

export function buildBrowseNavPath({ search = '', categorySlug = '', rating = '' } = {}) {
  const params = new URLSearchParams()
  const trimmedSearch = search.trim()

  if (trimmedSearch) {
    params.set('search', trimmedSearch)
  }

  if (categorySlug) {
    params.set('category', categorySlug)
  }

  if (rating) {
    params.set('rating', rating)
  }

  const query = params.toString()
  return query ? `/browse?${query}` : '/browse'
}

export function buildBrowseSearchPath(search = '') {
  return buildBrowseNavPath({ search })
}

/** @deprecated Prefer isBrowseRoute — kept for existing callers during migration */
export function shouldNavigateToBrowseOnMobileSearch(pathname) {
  return !isBrowseRoute(pathname)
}

export function isMobileSearchViewport() {
  return window.matchMedia(MOBILE_SEARCH_MEDIA_QUERY).matches
}
