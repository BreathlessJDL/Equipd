#!/usr/bin/env node
/**
 * Unit tests for Stripe Connect account invalidation detection (live/test mismatch).
 */
function isStripeInvalidConnectAccountError(err) {
  if (!err || typeof err !== 'object') {
    return false
  }

  const message = (err.message ?? '').toLowerCase()
  const code = err.code ?? ''

  if (code === 'resource_missing') {
    return true
  }

  if (message.includes('no such account')) {
    return true
  }

  if (message.includes('does not exist')) {
    return true
  }

  if (message.includes('a similar object exists in test mode')) {
    return true
  }

  if (message.includes('a similar object exists in live mode')) {
    return true
  }

  if (message.includes('was created in test mode')) {
    return true
  }

  if (message.includes('was created in live mode')) {
    return true
  }

  return false
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const cases = [
  {
    label: 'resource_missing',
    err: { code: 'resource_missing', message: 'No such account: acct_test_123' },
    expected: true,
  },
  {
    label: 'no such account message',
    err: { message: 'No such account: acct_123' },
    expected: true,
  },
  {
    label: 'test mode mismatch',
    err: {
      message:
        'No such account: acct_123; a similar object exists in test mode, but a live mode key was used to make this request.',
    },
    expected: true,
  },
  {
    label: 'live mode mismatch',
    err: {
      message:
        'No such account: acct_123; a similar object exists in live mode, but a test mode key was used to make this request.',
    },
    expected: true,
  },
  {
    label: 'unrelated stripe error',
    err: { code: 'account_invalid', message: 'Your account cannot currently make transfers.' },
    expected: false,
  },
  {
    label: 'null error',
    err: null,
    expected: false,
  },
]

let passed = 0

for (const { label, err, expected } of cases) {
  const result = isStripeInvalidConnectAccountError(err)
  assert(result === expected, `${label}: expected ${expected}, got ${result}`)
  passed += 1
}

console.log(`test-stripe-connect-account-reset: ${passed}/${cases.length} passed`)
