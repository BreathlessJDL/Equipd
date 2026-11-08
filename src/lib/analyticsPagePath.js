const ANALYTICS_STRIP_QUERY_PARAMS = new Set(['lat', 'lng'])

export function sanitizeAnalyticsPagePath(path) {
  if (path == null || path === '') return '/'
  if (typeof path !== 'string') return '/'

  const queryIndex = path.indexOf('?')
  if (queryIndex === -1) return path

  const pathname = path.slice(0, queryIndex) || '/'
  const params = new URLSearchParams(path.slice(queryIndex + 1))
  let stripped = false

  for (const key of ANALYTICS_STRIP_QUERY_PARAMS) {
    if (params.has(key)) {
      params.delete(key)
      stripped = true
    }
  }

  if (!stripped) return path

  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}
