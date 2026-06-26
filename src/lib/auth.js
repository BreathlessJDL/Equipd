import { supabase } from './supabase'

export const OAUTH_REDIRECT_KEY = 'equipd:oauth-redirect'
export const OAUTH_PENDING_KEY = 'equipd:oauth-pending'

export function getAuthErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message ?? ''

  if (/provider is not enabled/i.test(message)) {
    return 'Google sign-in is not enabled yet. Please try email and password, or contact support.'
  }

  if (/redirect url/i.test(message)) {
    return 'Sign-in redirect is not configured for this site. Please contact support.'
  }

  return message || 'Something went wrong. Please try again.'
}

/** Full URL for Supabase OAuth callback — works on localhost and production. */
export function getAuthRedirectUrl(pathname = '/') {
  if (typeof window === 'undefined') return ''

  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${window.location.origin}${path}`
}

export function clearOAuthSessionFlags() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(OAUTH_REDIRECT_KEY)
  sessionStorage.removeItem(OAUTH_PENDING_KEY)
}

export async function signInWithGoogle({ postAuthRedirect = '/' } = {}) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  if (typeof window === 'undefined') {
    return { error: new Error('Google sign-in is only available in the browser.') }
  }

  sessionStorage.setItem(OAUTH_REDIRECT_KEY, postAuthRedirect)
  sessionStorage.setItem(OAUTH_PENDING_KEY, '1')

  const callbackPath = `${window.location.pathname}${window.location.search}`

  const result = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(callbackPath),
    },
  })

  if (result.error) {
    clearOAuthSessionFlags()
  }

  return result
}
