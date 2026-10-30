import { isSensitiveAccountActionBlockedByImpersonation } from './adminImpersonation'
import { supabase } from './supabase'
export { accountHasPasswordIdentity } from './accountAuthIdentities'

export const ACCOUNT_DELETION_CONFIRMATION_TEXT = 'DELETE'

/** Off unless VITE_ENABLE_ACCOUNT_DELETION=true. Production stays off until separately approved. */
export function isAccountDeletionUiEnabled() {
  return import.meta.env.VITE_ENABLE_ACCOUNT_DELETION === 'true'
}

export function getAccountDeletionErrorMessage(error) {
  if (!error) return 'Could not delete your account. Please try again.'
  return error.message || 'Could not delete your account. Please try again.'
}

function functionInvokeErrorMessage(error, fallback) {
  let message = error?.message || fallback
  return message
}

async function readFunctionError(error, fallback) {
  let message = functionInvokeErrorMessage(error, fallback)
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json()
      if (payload?.error) message = String(payload.error)
      return { message, payload }
    }
  } catch {
    // keep message
  }
  return { message, payload: null }
}

export async function evaluateAccountDeletion() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.functions.invoke('request-account-deletion', {
    body: { evaluateOnly: true },
  })

  if (!error && data?.evaluation) {
    return { data: data.evaluation, error: null }
  }

  if (!error && data?.error) {
    return { data: data.evaluation ?? null, error: new Error(String(data.error)) }
  }

  const { data: sqlEvaluation, error: sqlError } = await supabase.rpc('evaluate_account_deletion')
  if (sqlError) {
    const { message } = error ? await readFunctionError(error, sqlError.message) : { message: sqlError.message }
    return { data: null, error: new Error(message) }
  }

  return { data: sqlEvaluation, error: null }
}

export async function requestAccountDeletion({ password, confirmationText, passwordRequired = true }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  if (isSensitiveAccountActionBlockedByImpersonation(sessionData.session, sessionData.session?.user)) {
    return { error: new Error('Unavailable while logged in as another user.') }
  }

  if (passwordRequired && !password) {
    return { error: new Error('Enter your current password to delete your account.') }
  }

  if (confirmationText?.trim() !== ACCOUNT_DELETION_CONFIRMATION_TEXT) {
    return {
      error: new Error(`Type ${ACCOUNT_DELETION_CONFIRMATION_TEXT} to confirm account deletion.`),
    }
  }

  const { data, error } = await supabase.functions.invoke('request-account-deletion', {
    body: {
      password,
      confirmationText: confirmationText.trim(),
    },
  })

  if (error) {
    const { message } = await readFunctionError(error, 'Could not delete your account.')
    return { data: null, error: new Error(message) }
  }

  if (data?.error) {
    return { data: data.evaluation ?? null, error: new Error(String(data.error)) }
  }

  return { data, error: null }
}
