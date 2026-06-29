export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 18

export const PASSWORD_POLICY_SUMMARY =
  'Password must be 6–18 characters and include an uppercase letter, lowercase letter, number and special character.'

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
  if (value.length >= 16) score += 0.5
  if (value.length >= 18) score += 0.5

  if (score < 2) return STRENGTH_LEVELS[0]
  if (score < 3) return STRENGTH_LEVELS[1]
  if (score < 4) return STRENGTH_LEVELS[2]
  if (score < 5) return STRENGTH_LEVELS[3]
  return STRENGTH_LEVELS[4]
}

export function isPasswordPolicyValid(password) {
  return validatePassword(password).valid
}

function isMissingPasswordValidationRpcError(error) {
  if (!error) return false

  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    error.code === '42883'
    || error.code === 'PGRST202'
    || (message.includes('validate_signup_password') && message.includes('does not exist'))
  )
}

/**
 * Server-side validation via Postgres RPC (same rules as client checks).
 */
export async function validatePasswordWithServer(supabaseClient, password) {
  const clientResult = validatePassword(password)

  if (!clientResult.valid) {
    return clientResult
  }

  if (!supabaseClient?.rpc) {
    return clientResult
  }

  const { data, error } = await supabaseClient.rpc('validate_signup_password', {
    p_password: password,
  })

  if (error) {
    if (isMissingPasswordValidationRpcError(error)) {
      return clientResult
    }

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
