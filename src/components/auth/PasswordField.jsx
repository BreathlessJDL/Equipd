import { useId, useMemo, useState } from 'react'
import {
  getPasswordRequirementStatus,
  getPasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_SUMMARY,
} from '../../lib/passwordPolicy'
import './PasswordField.css'

function RequirementIcon({ met }) {
  if (met) {
    return (
      <span className="password-field__requirement-icon password-field__requirement-icon--met" aria-hidden="true">
        ✓
      </span>
    )
  }

  return (
    <span className="password-field__requirement-icon password-field__requirement-icon--pending" aria-hidden="true">
      ○
    </span>
  )
}

function PasswordField({
  id,
  label = 'Password',
  value,
  onChange,
  autoComplete = 'new-password',
  disabled = false,
  showRequirements = true,
  showStrength = true,
}) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const [showPassword, setShowPassword] = useState(false)

  const requirements = useMemo(() => getPasswordRequirementStatus(value), [value])
  const strength = useMemo(() => getPasswordStrength(value), [value])
  const hasValue = value.length > 0

  return (
    <div className="password-field">
      <label className="auth-form__label" htmlFor={inputId}>
        {label}
      </label>

      <div className="password-field__input-wrap">
        <input
          id={inputId}
          className="auth-form__input password-field__input"
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-pressed={showPassword}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          disabled={disabled}
          onClick={() => setShowPassword((current) => !current)}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      {showStrength && hasValue ? (
        <div className="password-field__strength" aria-live="polite">
          <div className="password-field__strength-header">
            <span className="password-field__strength-label">Password strength</span>
            <span
              className={`password-field__strength-value password-field__strength-value--${strength.id}`}
            >
              {strength.label}
            </span>
          </div>
          <div
            className="password-field__strength-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={strength.percent}
            aria-label={`Password strength: ${strength.label}`}
          >
            <span
              className={`password-field__strength-fill password-field__strength-fill--${strength.id}`}
              style={{ width: `${strength.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {showRequirements ? (
        <>
          <p className="password-field__summary">{PASSWORD_POLICY_SUMMARY}</p>
          <ul className="password-field__requirements" aria-label="Password requirements">
          {requirements.map((requirement) => (
            <li
              key={requirement.id}
              className={`password-field__requirement${
                requirement.met ? ' password-field__requirement--met' : ''
              }`}
            >
              <RequirementIcon met={requirement.met} />
              <span>{requirement.label}</span>
            </li>
          ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

export default PasswordField
