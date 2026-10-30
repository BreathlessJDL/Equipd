#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { accountHasPasswordIdentity } from '../src/lib/accountAuthIdentities.js'
import {
  DELETED_ACCOUNT_DISPLAY_NAME,
  getPublicUserName,
} from '../src/lib/publicUserName.js'
import { formatAdminConversationParticipantName } from '../src/lib/adminConversationsFormat.js'
import {
  isOpenStripeDispute,
  mergeDeletionEvaluation,
  STRIPE_DISPUTE_BLOCK_MESSAGE,
  STRIPE_DISPUTE_UNAVAILABLE_MESSAGE,
} from '../supabase/functions/_shared/accountDeletionStripeDisputes.js'

assert.equal(accountHasPasswordIdentity({ identities: [{ provider: 'email' }] }), true)
assert.equal(accountHasPasswordIdentity({ identities: [{ provider: 'google' }] }), false)
assert.equal(accountHasPasswordIdentity({ identities: [{ provider: 'apple' }] }), false)
assert.equal(accountHasPasswordIdentity({ app_metadata: { providers: ['google'] } }), false)
assert.equal(accountHasPasswordIdentity({}), true)

assert.equal(isOpenStripeDispute({ status: 'needs_response' }), true)
assert.equal(isOpenStripeDispute({ status: 'under_review' }), true)
assert.equal(isOpenStripeDispute({ status: 'won' }), false)
assert.equal(isOpenStripeDispute({ status: 'lost' }), false)

const blocked = mergeDeletionEvaluation(
  { allowed: true, blockers: [], counts: { activeOrders: 0 } },
  { ok: true, openCount: 1 },
)
assert.equal(blocked.allowed, false)
assert.equal(blocked.blockers[0].code, 'open_stripe_disputes')
assert.equal(blocked.blockers[0].message, STRIPE_DISPUTE_BLOCK_MESSAGE)

const unavailable = mergeDeletionEvaluation(
  { allowed: true, blockers: [] },
  { ok: false, openCount: 0, error: 'stripe down' },
)
assert.equal(unavailable.allowed, false)
assert.equal(unavailable.blockers[0].code, 'stripe_disputes_unavailable')
assert.equal(unavailable.blockers[0].message, STRIPE_DISPUTE_UNAVAILABLE_MESSAGE)

const allowed = mergeDeletionEvaluation(
  { allowed: true, blockers: [], counts: {} },
  { ok: true, openCount: 0 },
)
assert.equal(allowed.allowed, true)

assert.equal(
  getPublicUserName({ username: 'gone_abcdef12', display_name: 'Deleted account' }),
  DELETED_ACCOUNT_DISPLAY_NAME,
)
assert.equal(
  formatAdminConversationParticipantName({ username: 'gone_abcdef12' }),
  DELETED_ACCOUNT_DISPLAY_NAME,
)

const [deletionFn, stripeHelper, settingsPage] = await Promise.all([
  readFile(new URL('../supabase/functions/request-account-deletion/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/_shared/checkAccountStripeDisputes.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/SettingsPage.jsx', import.meta.url), 'utf8'),
])
assert.match(deletionFn, /evaluateOnly/)
assert.match(deletionFn, /evaluateDeletionWithStripe/)
assert.match(deletionFn, /checkAccountStripeDisputes/)
assert.match(stripeHelper, /stripe\.disputes\.list/)
assert.doesNotMatch(deletionFn, /auth\.admin\.deleteUser/)
assert.match(settingsPage, /isAccountDeletionUiEnabled\(\)/)
assert.match(
  settingsPage,
  /isAccountDeletionUiEnabled\(\) \? \([\s\S]*<DeleteAccountSection/,
)

console.log('PASS: Stripe dispute blockers fail closed')
console.log('PASS: Google/Apple-only users are not treated as password accounts')
console.log('PASS: historic identity fallback is Deleted account')
console.log('\nAll account-deletion follow-up checks passed.')
