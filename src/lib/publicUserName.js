/**
 * Public marketplace identity helpers (pure — safe for Node tests).
 * Never derive a public name from email or email local-part.
 */

export const PUBLIC_USER_NAME_FALLBACK = 'Equipd user'

export function getEmailLocalPart(email) {
  const value = String(email ?? '').trim()
  if (!value.includes('@')) return null
  const local = value.slice(0, value.indexOf('@')).trim()
  return local || null
}

/**
 * True when display_name is exactly the email local-part (legacy signup seed).
 * Case-insensitive exact match only — no fuzzy matching.
 */
export function isEmailSeededDisplayName(displayName, email) {
  const name = String(displayName ?? '').trim()
  const local = getEmailLocalPart(email)
  if (!name || !local) return false
  return name.toLowerCase() === local.toLowerCase()
}

/**
 * Safe public display_name, or null if missing / email-seeded.
 */
export function getSafePublicDisplayName(displayName, email, {
  allowEmailSeededDisplayName = false,
} = {}) {
  const name = String(displayName ?? '').trim()
  if (!name) return null
  if (!allowEmailSeededDisplayName && isEmailSeededDisplayName(name, email)) {
    return null
  }
  return name
}

/**
 * Public marketplace identity.
 * Priority: username → safe display_name → Equipd user
 *
 * @param {object | null | undefined} profile
 * @param {{
 *   email?: string | null,
 *   fallback?: string,
 *   allowEmailSeededDisplayName?: boolean,
 * }} [options]
 */
export function getPublicUserName(profile, {
  email = null,
  fallback = PUBLIC_USER_NAME_FALLBACK,
  allowEmailSeededDisplayName = false,
} = {}) {
  const username = profile?.username?.trim()
  if (username) return username

  const emailForCheck = email ?? profile?.email ?? null
  const safeDisplayName = getSafePublicDisplayName(profile?.display_name, emailForCheck, {
    allowEmailSeededDisplayName,
  })
  if (safeDisplayName) return safeDisplayName

  return fallback
}
