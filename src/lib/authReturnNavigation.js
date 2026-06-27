export function getAuthRedirectPath({ pathname, search = '', hash = '' }) {
  return `${pathname}${search}${hash}`
}

export function navigateAwayFromProtectedRoute(navigate) {
  const historyIdx = window.history.state?.idx ?? 0

  if (historyIdx > 0) {
    navigate(-1)
    return
  }

  navigate('/', { replace: true })
}
