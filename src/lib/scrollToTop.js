/**
 * Window scroll-to-top belongs on real page changes, not search-param updates.
 * Homepage browse filters push `/?location=` (and similar) while the pathname
 * stays `/`. Resetting scroll in that case jumps the user away from listings.
 */
export function shouldResetWindowScrollOnRouteChange({
  previousPathname,
  nextPathname,
  hash = '',
  navigationType,
} = {}) {
  if (navigationType === 'POP') return false
  if (hash) return false
  if (!nextPathname) return false
  if (previousPathname === nextPathname) return false
  return true
}
