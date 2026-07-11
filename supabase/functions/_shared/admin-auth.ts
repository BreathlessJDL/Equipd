import { createClient, type User } from 'npm:@supabase/supabase-js@2'
import { errorResponse } from './cors.ts'
import { getAuthenticatedUser } from './supabase-admin.ts'

export async function requireAdmin(
  req: Request,
): Promise<{ user: User; authHeader: string } | Response> {
  const user = await getAuthenticatedUser(req)

  if (!user) {
    return errorResponse('Unauthorized', 401)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return errorResponse('Unauthorized', 401)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!url || !anonKey) {
    return errorResponse('Supabase auth credentials are not configured', 500)
  }

  const supabase = createClient(url, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

  const { data: isAdmin, error } = await supabase.rpc('is_admin')

  if (error) {
    console.error('requireAdmin: is_admin RPC failed', error.message)
    return errorResponse('Could not verify admin access', 500)
  }

  if (!isAdmin) {
    return errorResponse('Admin access required', 403)
  }

  return { user, authHeader }
}
