/**
 * Regression checks for message_received email migration + template wiring.
 *
 * Usage:
 *   node scripts/test-message-received-email.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EMAIL_TEMPLATE_KEYS } from '../supabase/functions/_shared/emailTemplateConfig.js'
import { MARKETPLACE_EMAIL_EVENT_KEYS } from '../supabase/functions/_shared/marketplaceEmailCore.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(
  join(root, 'supabase/migrations/20260806120000_message_received_email.sql'),
  'utf8',
)

assert.match(sql, /create or replace function public\.notify_message_received_email/i)
assert.match(sql, /messages_notify_message_received_email/)
assert.match(sql, /notify_marketplace_email\(\s*'message_received'/i)
assert.match(sql, /'message_received'/)
assert.match(sql, /message_type is distinct from 'text'/i)
assert.match(sql, /exception/i)
assert.doesNotMatch(sql, /messages_notify_recipient/)

assert.equal(EMAIL_TEMPLATE_KEYS.message_received, 'SENDGRID_TEMPLATE_MESSAGE_RECEIVED')
assert.equal(EMAIL_TEMPLATE_KEYS.welcome, 'SENDGRID_TEMPLATE_WELCOME')
assert.ok(MARKETPLACE_EMAIL_EVENT_KEYS.includes('message_received'))
assert.ok(MARKETPLACE_EMAIL_EVENT_KEYS.includes('welcome'))
assert.ok(MARKETPLACE_EMAIL_EVENT_KEYS.includes('counter_offer_received'))

console.log('test-message-received-email: ok')
