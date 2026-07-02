/** Hostnames where the production app is served (OAuth allow-list must cover these). */
export const EQUIPD_PRODUCTION_HOSTS = ['equipd.co.uk', 'www.equipd.co.uk']

/** Fixed path Supabase redirects to after Google OAuth (must be allow-listed). */
export const OAUTH_CALLBACK_PATH = '/auth/callback'

/** Password reset landing page (must be allow-listed in Supabase Auth). */
export const RESET_PASSWORD_PATH = '/auth/reset-password'

/** Forgot password request page. */
export const FORGOT_PASSWORD_PATH = '/forgot-password'

/**
 * Redirect target for email auth links (confirm signup, reset password, magic link).
 * Reuses the OAuth callback route; PKCE + detectSessionInUrl complete the session.
 */
export const EMAIL_AUTH_CALLBACK_PATH = OAUTH_CALLBACK_PATH

export function isEquipdProductionHost(hostname = '') {
  const normalized = hostname.toLowerCase()
  return EQUIPD_PRODUCTION_HOSTS.includes(normalized)
}

/**
 * Browser origin for OAuth redirectTo.
 * Must match the page origin that started sign-in (PKCE verifier + sessionStorage).
 */
export function getSiteOrigin() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

/**
 * Full URL passed to Supabase Auth as redirectTo after Google OAuth.
 * Always uses OAUTH_CALLBACK_PATH on the current origin (www or apex, or localhost in dev).
 */
export function getOAuthCallbackUrl() {
  return getAuthRedirectUrl(OAUTH_CALLBACK_PATH)
}

/** redirectTo for signUp, resetPasswordForEmail, signInWithOtp, updateUser email change. */
export function getEmailAuthRedirectUrl() {
  return getAuthRedirectUrl(EMAIL_AUTH_CALLBACK_PATH)
}

/** redirectTo for password reset emails. */
export function getPasswordResetRedirectUrl() {
  return getAuthRedirectUrl(RESET_PASSWORD_PATH)
}

/**
 * Full URL passed to Supabase Auth as redirectTo after Google OAuth.
 * Must exactly match an entry in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function getAuthRedirectUrl(pathname = OAUTH_CALLBACK_PATH) {
  if (typeof window === 'undefined') return ''

  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  const redirectUrl = `${getSiteOrigin()}${path}`

  if (import.meta.env.DEV) {
    const redirectHost = safeHostname(redirectUrl)
    const pageHost = window.location.hostname.toLowerCase()

    if (redirectHost && redirectHost !== pageHost) {
      console.warn('[oauth] redirectTo host differs from page host:', redirectUrl)
    }
  }

  return redirectUrl
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Warn when production users would send a localhost redirect (misconfigured Supabase Site URL).
 */
export function validateOAuthRedirectUrl(redirectUrl) {
  if (typeof window === 'undefined') return null

  if (!isEquipdProductionHost(window.location.hostname)) {
    return null
  }

  let redirectHost
  try {
    redirectHost = new URL(redirectUrl).hostname.toLowerCase()
  } catch {
    return 'Invalid OAuth redirect URL.'
  }

  if (redirectHost === 'localhost' || redirectHost === '127.0.0.1') {
    return (
      'Google sign-in is misconfigured for production (redirect would use localhost). ' +
      'Update Supabase Auth Site URL and Redirect URLs for equipd.co.uk.'
    )
  }

  if (!isEquipdProductionHost(redirectHost)) {
    return (
      `Google sign-in redirect host "${redirectHost}" does not match equipd.co.uk. ` +
      'Add this origin to Supabase Redirect URLs.'
    )
  }

  let pathname
  try {
    pathname = new URL(redirectUrl).pathname
  } catch {
    return 'Invalid OAuth redirect URL.'
  }

  if (pathname !== OAUTH_CALLBACK_PATH) {
    return `Google sign-in must redirect to ${OAUTH_CALLBACK_PATH} on the current origin.`
  }

  return null
}
