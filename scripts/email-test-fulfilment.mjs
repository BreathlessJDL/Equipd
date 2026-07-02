#!/usr/bin/env node
/**
 * Send all fulfilment transactional emails via SendGrid (mock data only).
 *
 * Usage:
 *   npm run email:test-fulfilment -- <recipient_email>
 *
 * Example:
 *   npm run email:test-fulfilment -- you@example.com
 *
 * Does not create orders, write to marketplace tables, or invoke business logic.
 */

import { loadEnvFiles } from '../emails/node/loadEnv.mjs'
import { FULFILMENT_EMAIL_TEMPLATE_KEYS } from './fulfilmentEmailTestData.mjs'
import { sendAllFulfilmentTestEmails } from './fulfilmentEmailTestSend.mjs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const getEnv = (key) => process.env[key] ?? ''

loadEnvFiles()

function parseRecipient() {
  const arg = process.argv[2]?.trim()
  const to = arg || getEnv('EMAIL_TEST_TO')?.trim() || getEnv('SENDGRID_TEST_TO')?.trim()

  if (!to) {
    console.error(
      'Usage: npm run email:test-fulfilment -- you@example.com\n' +
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

console.log(`Sending ${FULFILMENT_EMAIL_TEMPLATE_KEYS.length} fulfilment test emails to ${recipient}...`)
console.log(`Templates: ${FULFILMENT_EMAIL_TEMPLATE_KEYS.join(', ')}`)

const outcome = await sendAllFulfilmentTestEmails({ to: recipient, getEnv })

if (!outcome.ok) {
  console.error(`\nFailed at template "${outcome.failedAt}":`, outcome.results.at(-1)?.error)
  process.exit(1)
}

console.log(`\nAll ${FULFILMENT_EMAIL_TEMPLATE_KEYS.length} fulfilment test emails sent successfully.`)
if (outcome.results.every((entry) => entry.dryRun)) {
  console.log('Dry-run mode — no messages were delivered. Set SENDGRID_API_KEY and disable EMAIL_DRY_RUN to send.')
}
