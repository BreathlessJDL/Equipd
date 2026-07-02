import { supabase } from './supabase'
import { getEmailAuthRedirectUrl, getOAuthCallbackUrl, getPasswordResetRedirectUrl, validateOAuthRedirectUrl } from './siteUrl'
import { PASSWORD_POLICY_SUMMARY } from './passwordPolicy'

export { getAuthRedirectUrl, getEmailAuthRedirectUrl, getOAuthCallbackUrl, OAUTH_CALLBACK_PATH, EMAIL_AUTH_CALLBACK_PATH, getPasswordResetRedirectUrl, RESET_PASSWORD_PATH, FORGOT_PASSWORD_PATH } from './siteUrl'

export const OAUTH_REDIRECT_KEY = 'equipd:oauth-redirect'
export const OAUTH_PENDING_KEY = 'equipd:oauth-pending'

export function getAuthErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message ?? ''

  if (
    error.code === '23505'
    || /username is already taken/i.test(message)
    || (/username/i.test(message) && /(unique|duplicate|already)/i.test(message))
  ) {
    return 'That username is already taken.'
  }

  if (/provider is not enabled/i.test(message)) {
    return 'Google sign-in is not enabled yet. Please try email and password, or contact support.'
  }

  if (/redirect url/i.test(message)) {
    return 'Sign-in redirect is not configured for this site. Please contact support.'
  }

  if (/password/i.test(message) && /(weak|short|least|character|requirement)/i.test(message)) {
    return PASSWORD_POLICY_SUMMARY
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

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmailAddress(email) {
  const normalized = email?.trim() ?? ''
  if (!normalized) {
    return { valid: false, email: normalized, error: 'Email is required.' }
  }

  if (!EMAIL_ADDRESS_PATTERN.test(normalized)) {
    return { valid: false, email: normalized, error: 'Enter a valid email address.' }
  }

  return { valid: true, email: normalized, error: null }
}

export async function updateUserEmailWithPassword({ currentEmail, currentPassword, newEmail }) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const validation = validateEmailAddress(newEmail)
  if (!validation.valid) {
    return { error: new Error(validation.error) }
  }

  const normalizedCurrentEmail = currentEmail?.trim() ?? ''
  if (!normalizedCurrentEmail) {
    return { error: new Error('Current email is unavailable. Sign in again and retry.') }
  }

  if (validation.email.toLowerCase() === normalizedCurrentEmail.toLowerCase()) {
    return { error: new Error('Enter a different email address.') }
  }

  if (!currentPassword) {
    return { error: new Error('Enter your current password to change your email.') }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedCurrentEmail,
    password: currentPassword,
  })

  if (signInError) {
    return { error: new Error('Current password is incorrect.') }
  }

  const { error: updateError } = await supabase.auth.updateUser(
    { email: validation.email },
    { emailRedirectTo: getEmailAuthRedirectUrl() },
  )

  if (updateError) {
    return { error: updateError }
  }

  return { error: null, email: validation.email }
}

export const SIGNUP_CONFIRMATION_RESEND_COOLDOWN_SECONDS = 60

export function getResendConfirmationErrorMessage(error) {
  if (!error) return 'Could not resend the confirmation email. Please try again in a moment.'

  const message = error.message ?? ''

  if (/rate limit|too many|after \d+ seconds/i.test(message)) {
    return 'Please wait a moment before requesting another confirmation email.'
  }

  return 'Could not resend the confirmation email. Please try again in a moment.'
}

export async function resendSignupConfirmationEmail(email) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const normalizedEmail = email?.trim() ?? ''
  if (!normalizedEmail) {
    return { error: new Error('Email is unavailable for resend.') }
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo: getEmailAuthRedirectUrl(),
    },
  })

  return { error }
}

export async function requestPasswordReset(email) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const validation = validateEmailAddress(email)
  if (!validation.valid) {
    return { error: new Error(validation.error) }
  }

  const redirectTo = getPasswordResetRedirectUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(validation.email, {
    redirectTo,
  })

  return { error }
}

export async function updatePasswordAfterReset(password) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const { error } = await supabase.auth.updateUser({ password })

  return { error }
}
