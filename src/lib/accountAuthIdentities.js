export function accountHasPasswordIdentity(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : null
  const providers = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : null

  if (identities?.some((identity) => identity.provider === 'email')) return true
  if (providers?.includes('email')) return true
  if (identities?.length) return false
  if (providers?.length) return false
  return true
}
