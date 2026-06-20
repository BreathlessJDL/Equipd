import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin credentials are not configured')
  }

  return createClient(url, serviceRoleKey)
}

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return null
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!url || !anonKey) {
    throw new Error('Supabase auth credentials are not configured')
  }

  const supabase = createClient(url, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function syncSellerFromStripeAccount(
  admin: SupabaseClient,
  accountId: string,
  onboardingComplete: boolean,
) {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('stripe_account_id', accountId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!profile) {
    return null
  }

  const { data, error } = await admin.rpc('sync_seller_stripe_onboarding', {
    p_seller_id: profile.id,
    p_stripe_account_id: accountId,
    p_onboarding_complete: onboardingComplete,
  })

  if (error) {
    throw error
  }

  if (onboardingComplete) {
    const { error: promoteError } = await admin.rpc('promote_seller_payments_to_pending', {
      p_seller_id: profile.id,
    })

    if (promoteError) {
      throw promoteError
    }
  }

  return data
}
