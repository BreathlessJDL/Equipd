import { supabase } from './supabase'

export function getGeneralSupportErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function submitGeneralSupportInquiry({
  name,
  email,
  subject,
  message,
  category,
  subcategory,
}) {
  if (!supabase) {
    return { error: new Error('Support is not available right now.') }
  }

  const { error } = await supabase.rpc('submit_general_support_inquiry', {
    p_name: name,
    p_email: email,
    p_subject: subject,
    p_message: message,
    p_category: category,
    p_subcategory: subcategory,
  })

  return { error }
}
