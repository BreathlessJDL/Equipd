import { supabase } from './supabase'

const localFunctionsUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim().replace(/\/+$/, '') ?? ''

const supabaseProjectUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '') ?? ''

function logFunctionInvocationDiagnostics(
  functionName,
  { mode, url, method, hasAccessToken, accessTokenLength, requestBody },
) {
  if (!import.meta.env.DEV) return

  console.group(`[stripe-api] invoke ${functionName}`)
  console.log('VITE_SUPABASE_FUNCTIONS_URL set:', Boolean(localFunctionsUrl))
  console.log('VITE_SUPABASE_FUNCTIONS_URL raw:', import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? '(undefined)')
  console.log('VITE_SUPABASE_FUNCTIONS_URL resolved:', localFunctionsUrl || '(not set — using hosted Supabase)')
  console.log('mode:', mode)
  console.log('URL:', url)
  console.log('method:', method)
  console.log('access token present:', hasAccessToken)
  console.log('access token length:', accessTokenLength)
  console.log('VITE_SUPABASE_URL:', supabaseProjectUrl || '(not set)')
  if (requestBody !== undefined) {
    console.log('request body:', requestBody)
  }
  console.groupEnd()
}

function extractErrorMessageFromBody(data) {
  if (!data) return null

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim()
  }

  if (typeof data.msg === 'string' && data.msg.trim()) {
    return data.msg.trim()
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  return null
}

async function readAuthSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw new Error(`Could not read auth session: ${error.message}`)
  }

  return session
}

async function getAccessToken() {
  const session = await readAuthSession()

  if (!session?.access_token) {
    throw new Error('You must be logged in to continue.')
  }

  return session.access_token
}

async function invokeFunctionViaFetch(functionName, { body } = {}) {
  const accessToken = await getAccessToken()
  const baseUrl = localFunctionsUrl || `${supabaseProjectUrl}/functions/v1`
  const url = `${baseUrl}/${functionName}`
  const mode = localFunctionsUrl ? 'local-fetch' : 'hosted-fetch'
  const requestBody = body ?? {}

  logFunctionInvocationDiagnostics(functionName, {
    mode,
    url,
    method: 'POST',
    hasAccessToken: true,
    accessTokenLength: accessToken.length,
    requestBody,
  })

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  let response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed'
    throw new Error(`Could not reach Edge Function at ${url}: ${message}`)
  }

  const responseText = await response.text()
  let data = null

  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { error: responseText }
    }
  }

  if (!response.ok) {
    const message =
      extractErrorMessageFromBody(data) ||
      responseText ||
      `Edge Function failed (${response.status} ${response.statusText})`

    console.error(`[stripe-api] ${functionName} failed`, {
      status: response.status,
      statusText: response.statusText,
      url,
      body: data ?? responseText,
    })

    throw new Error(message)
  }

  return data
}

async function invokeFunction(functionName, options = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!localFunctionsUrl && !supabaseProjectUrl) {
    return { data: null, error: new Error('Supabase project URL is not configured.') }
  }

  try {
    const data = await invokeFunctionViaFetch(functionName, options)
    return { data, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edge Function request failed'
    return { data: null, error: new Error(message) }
  }
}

export async function startStripeConnectOnboarding() {
  const { data, error } = await invokeFunction('stripe-connect-onboard')

  if (error) {
    return { url: null, error }
  }

  if (!data?.url) {
    return {
      url: null,
      error: new Error(extractErrorMessageFromBody(data) ?? 'Could not start payout setup.'),
    }
  }

  return { url: data.url, error: null }
}

export async function syncStripeConnectStatus() {
  const { data, error } = await invokeFunction('stripe-connect-sync')

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

export async function createCheckoutSession(paymentId) {
  if (import.meta.env.DEV) {
    console.log('[stripe-api] createCheckoutSession payment_id:', paymentId)
  }

  const { data, error } = await invokeFunction('stripe-create-checkout', {
    body: { payment_id: paymentId },
  })

  if (error) {
    return { url: null, error }
  }

  if (!data?.url) {
    return {
      url: null,
      error: new Error(extractErrorMessageFromBody(data) ?? 'Could not start checkout.'),
    }
  }

  return { url: data.url, error: null }
}

export async function releaseOrderPayout(orderId) {
  const { data, error } = await invokeFunction('stripe-release-payout', {
    body: { order_id: orderId },
  })

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

export function getStripeApiErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}
