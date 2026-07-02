#!/usr/bin/env node
/**
 * Send all Phase 5 remaining transactional emails via SendGrid (mock data only).
 *
 * Usage:
 *   npm run email:test-all-remaining -- <recipient_email>
 */

import { loadEnvFiles } from '../emails/node/loadEnv.mjs'
import { REMAINING_EMAIL_TEMPLATE_KEYS } from './remainingEmailTestData.mjs'
import { sendRemainingTestEmail } from './remainingEmailTestSend.mjs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const getEnv = (key) => process.env[key] ?? ''

loadEnvFiles()

function parseRecipient() {
  const arg = process.argv[2]?.trim()
  const to = arg || getEnv('EMAIL_TEST_TO')?.trim() || getEnv('SENDGRID_TEST_TO')?.trim()

  if (!to) {
    console.error(
      'Usage: npm run email:test-all-remaining -- you@example.com\n' +
        'Or set EMAIL_TEST_TO in .env.local',
    )
    process.exit(1)
  }

  if (!EMAIL_PATTERN.test(to)) {
    console.error(`Invalid recipient email: ${to}`)
    process.exit(1)
  }

  return to
}

const recipient = parseRecipient()

console.log(`Sending ${REMAINING_EMAIL_TEMPLATE_KEYS.length} remaining test emails to ${recipient}...`)
console.log(`Templates: ${REMAINING_EMAIL_TEMPLATE_KEYS.join(', ')}`)

for (const templateKey of REMAINING_EMAIL_TEMPLATE_KEYS) {
  const result = await sendRemainingTestEmail({ templateKey, to: recipient, getEnv })
  if (!result.ok) {
    console.error(`\nFailed at template "${templateKey}":`, result.error)
    process.exit(1)
  }
}

console.log(`\nAll ${REMAINING_EMAIL_TEMPLATE_KEYS.length} remaining test emails sent successfully.`)
