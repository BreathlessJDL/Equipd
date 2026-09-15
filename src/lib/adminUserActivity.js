import { supabase } from './supabase'
import {
  parseAdminMarketplaceActivityStatistics,
  parseAdminUserMarketplaceActivity,
} from './adminMarketplaceActivity'

export {
  parseAdminMarketplaceActivityStatistics,
  parseAdminUserMarketplaceActivity,
} from './adminMarketplaceActivity'

export async function fetchAdminUserMarketplaceActivity(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  if (!userId) {
    return { data: null, error: new Error('User id required.') }
  }

  const { data, error } = await supabase.rpc('admin_user_marketplace_activity', {
    p_user_id: userId,
  })
  if (error) return { data: null, error }
  return { data: parseAdminUserMarketplaceActivity(data), error: null }
}

export async function fetchAdminMarketplaceActivityStatistics() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_marketplace_activity_statistics')
  if (error) return { data: null, error }
  return { data: parseAdminMarketplaceActivityStatistics(data), error: null }
}
