/**
 * Keep in sync with src/lib/passwordPolicy.js
 */

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

const PASSWORD_REQUIREMENTS = [
  {
    id: 'length',
    label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
    test: (password: string) =>
      password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    test: (password: string) => /\d/.test(password),
  },
  {
    id: 'special',
    label: 'At least one special character',
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const

export function getPasswordRequirementStatus(password = '') {
  const value = typeof password === 'string' ? password : ''

  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: requirement.test(value),
  }))
}

export function validatePassword(password: unknown): { valid: boolean; error: string | null } {
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
