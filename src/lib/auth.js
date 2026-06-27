import { supabase } from './supabase'
import { getOAuthCallbackUrl, validateOAuthRedirectUrl } from './siteUrl'

export { getAuthRedirectUrl, getEmailAuthRedirectUrl, getOAuthCallbackUrl, OAUTH_CALLBACK_PATH, EMAIL_AUTH_CALLBACK_PATH } from './siteUrl'

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

  if (/password/i.test(message) && /(weak|short|least|character|requirement)/i.test(message)) {
    return 'Password does not meet the Equipd requirements. Use at least 10 characters with uppercase, lowercase, a number, and a special character.'
  }

  return message || 'Something went wrong. Please try again.'
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

  const redirectTo = getOAuthCallbackUrl()
  const redirectError = validateOAuthRedirectUrl(redirectTo)

  if (redirectError) {
    return { error: new Error(redirectError) }
  }

  const result = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: false,
    },
  })

  if (result.error) {
    clearOAuthSessionFlags()
  }

  return result
}
