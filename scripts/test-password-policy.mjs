#!/usr/bin/env node
/**
 * Password policy unit checks.
 * Run: node scripts/test-password-policy.mjs
 */

import {
  getPasswordRequirementStatus,
  getPasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from '../src/lib/passwordPolicy.js'

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    passed += 1
    console.log(`PASS ${label}`)
    return
  }

  failed += 1
  console.error(`FAIL ${label}`)
}

const validPassword = 'EquipdTest1!'

assert(validatePassword(validPassword).valid, 'valid password accepted')
assert(!validatePassword('short1!A').valid, 'short password rejected')
assert(!validatePassword('equipdtest1!').valid, 'missing uppercase rejected')
assert(!validatePassword('EQUIPDTEST1!').valid, 'missing lowercase rejected')
assert(!validatePassword('EquipdTest!').valid, 'missing number rejected')
assert(!validatePassword('EquipdTest1').valid, 'missing special character rejected')
assert(!validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1)).valid, 'over max length rejected')
assert(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH) + 'A1!').valid, 'minimum length accepted')

const statuses = getPasswordRequirementStatus(validPassword)
assert(statuses.every((entry) => entry.met), 'all requirements met for valid password')

const weak = getPasswordStrength('abc')
const strong = getPasswordStrength(validPassword)
assert(weak.label === 'Weak', 'weak password scores Weak')
assert(['Strong', 'Very Strong'].includes(strong.label), 'strong sample scores Strong or Very Strong')

console.log(`\n${passed}/${passed + failed} checks passed`)

if (failed > 0) {
  process.exit(1)
}
