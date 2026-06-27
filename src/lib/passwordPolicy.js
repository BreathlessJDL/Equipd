export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_REQUIREMENTS = [
  {
    id: 'length',
    label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
    test: (password) =>
      password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    test: (password) => /\d/.test(password),
  },
  {
    id: 'special',
    label: 'At least one special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
]

const STRENGTH_LEVELS = [
  { id: 'weak', label: 'Weak', percent: 20 },
  { id: 'fair', label: 'Fair', percent: 40 },
  { id: 'good', label: 'Good', percent: 60 },
  { id: 'strong', label: 'Strong', percent: 80 },
  { id: 'very-strong', label: 'Very Strong', percent: 100 },
]

export function getPasswordRequirementStatus(password = '') {
  const value = typeof password === 'string' ? password : ''

  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: requirement.test(value),
  }))
}

export function validatePassword(password) {
  if (password == null || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' }
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    }
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`,
    }
  }

  for (const requirement of PASSWORD_REQUIREMENTS) {
    if (requirement.id === 'length') continue
    if (!requirement.test(password)) {
      return { valid: false, error: `${requirement.label}.` }
    }
  }

  return { valid: true, error: null }
}

export function getPasswordStrength(password = '') {
  const value = typeof password === 'string' ? password : ''

  if (!value) {
    return STRENGTH_LEVELS[0]
  }

  const metCount = getPasswordRequirementStatus(value).filter((entry) => entry.met).length
  let score = metCount

  if (value.length >= 14) score += 0.5
  if (value.length >= 18) score += 0.5
  if (value.length >= 24) score += 0.5

  if (score < 2) return STRENGTH_LEVELS[0]
  if (score < 3) return STRENGTH_LEVELS[1]
  if (score < 4) return STRENGTH_LEVELS[2]
  if (score < 5) return STRENGTH_LEVELS[3]
  return STRENGTH_LEVELS[4]
}

export function isPasswordPolicyValid(password) {
  return validatePassword(password).valid
}

/**
 * Server-side validation via Supabase Edge Function (cannot be bypassed from the app UI).
 */
export async function validatePasswordWithServer(supabaseClient, password) {
  const clientResult = validatePassword(password)

  if (!clientResult.valid) {
    return clientResult
  }

  if (!supabaseClient?.functions?.invoke) {
    return clientResult
  }

  const { data, error } = await supabaseClient.functions.invoke('validate-password', {
    body: { password },
  })

  if (error) {
    return {
      valid: false,
      error: 'Could not verify password requirements. Please try again.',
    }
  }

  if (data?.valid) {
    return { valid: true, error: null }
  }

  return {
    valid: false,
    error: data?.error ?? 'Password does not meet the requirements.',
  }
}
