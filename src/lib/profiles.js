import { supabase } from './supabase'

const profileFields = 'id, display_name, location'

export async function fetchProfile(userId, { email } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(profileFields)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  if (data) {
    return { data, error: null }
  }

  const displayName = email?.split('@')[0] ?? null

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, display_name: displayName })
    .select(profileFields)
    .single()

  return { data: created, error: insertError }
}

export async function updateProfile(userId, { display_name, location }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: display_name?.trim() || null,
      location: location?.trim() || null,
    })
    .eq('id', userId)
    .select(profileFields)
    .single()

  return { data, error }
}

export function getProfileErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}
