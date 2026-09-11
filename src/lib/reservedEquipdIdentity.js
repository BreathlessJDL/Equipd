/**
 * Reserved Equipd identity helpers (client UX).
 * Server/DB `is_reserved_equipd_identity` is the source of truth.
 *
 * Homoglyph handling is intentional and narrow: only for detecting visual
 * impersonation of the Equipd brand token (e.g. EQUlPD with l→i, EQU1PD with 1→i).
 * This does NOT rewrite stored usernames or user content.
 */

export const RESERVED_EQUIPD_IDENTITY_ERROR =
  'That name is reserved for Equipd. Please choose a different username or display name.'

/** Strip separators only (identity comparison). */
export function normalizeEquipdIdentity(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return raw.replace(/[\s_\-.]+/g, '')
}

/**
 * Equipd brand token with obvious ASCII lookalikes for the "i" position:
 * i, l (as in EQUlPD), 1, |.
 */
const EQUIPD_BRAND = 'equ[il1|]pd'
const EQUIPD_SUFFIX =
  '(support|admin|team|payment|payments|customersupport|customerservice|help|helpdesk|official|security|verification)?'
const EQUIPD_PREFIX =
  '(support|admin|team|payment|payments|official|help|helpdesk|security|verification|customersupport|customerservice)'

export function isReservedEquipdIdentity(value) {
  const norm = normalizeEquipdIdentity(value)
  if (!norm) return false

  if (new RegExp(`^${EQUIPD_BRAND}$`).test(norm)) return true
  if (new RegExp(`^(official)?${EQUIPD_BRAND}${EQUIPD_SUFFIX}$`).test(norm)) return true
  if (new RegExp(`^${EQUIPD_PREFIX}${EQUIPD_BRAND}$`).test(norm)) return true

  return false
}

export function validatePublicIdentityName(value, { fieldLabel = 'Name' } = {}) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return { valid: true, value: '', error: null }
  if (isReservedEquipdIdentity(trimmed)) {
    return { valid: false, value: trimmed, error: RESERVED_EQUIPD_IDENTITY_ERROR }
  }
  return { valid: true, value: trimmed, error: null }
}
