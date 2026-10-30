#!/usr/bin/env node
/**
 * Batch 1 follow-up: offer-note bypass coverage and SQL signature compatibility.
 *
 * Usage:
 *   node scripts/test-offer-note-and-deletion-followup.mjs
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  MARKETPLACE_MESSAGE_BLOCK_MESSAGE,
  MARKETPLACE_MESSAGE_PHONE_BLOCK_MESSAGE,
  validateMarketplaceMessage,
  validateOptionalMarketplaceMessage,
} from '../src/lib/marketplaceMessageValidation.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const [
  offerNoteMigration,
  phoneDeletionMigration,
  createOfferJs,
  offerMessaging,
  deletionFn,
  retentionDoc,
  previousCreateBuyerOffer,
] = await Promise.all([
  read('supabase/migrations/20261030130000_offer_notes_deletion_retention.sql'),
  read('supabase/migrations/20261030120000_messaging_phone_exchange_and_account_deletion.sql'),
  read('src/lib/offers.js'),
  read('src/lib/offerMessaging.js'),
  read('supabase/functions/request-account-deletion/index.ts'),
  read('docs/account-deletion-retention.md'),
  read('supabase/migrations/20260721223000_buyer_multi_quantity_transactions.sql'),
])

function expectOfferNoteBlocked(text, label = text) {
  const result = validateOptionalMarketplaceMessage(text)
  assert.equal(result.allowed, false, `Expected offer note blocked: ${label}`)
  const expected = result.reason === 'phone' || result.reason === 'phone_request'
    ? MARKETPLACE_MESSAGE_PHONE_BLOCK_MESSAGE
    : MARKETPLACE_MESSAGE_BLOCK_MESSAGE
  if (result.reason !== 'empty') {
    assert.equal(result.error, expected, `Expected safety copy for offer note: ${label}`)
  }
}

function expectOfferNoteAllowed(text, label = text) {
  const result = validateOptionalMarketplaceMessage(text)
  assert.equal(result.allowed, true, `Expected offer note allowed: ${label} (${result.reason})`)
}

const emptyNote = validateOptionalMarketplaceMessage('   ')
assert.equal(emptyNote.allowed, true, 'Empty offer notes remain optional')

expectOfferNoteAllowed('Would you take £200 if I collect Saturday?')
expectOfferNoteAllowed('Happy to collect this weekend if still available.')

const OFFER_NOTE_BYPASSES = [
  'Call me on 07712345678',
  'email me at buyer@gmail.com',
  'https://paypal.me/seller',
  'WhatsApp me',
  'pay cash on collection',
  'bank transfer instead',
  'WF1 2AB',
  '182 rooks nest road',
]

for (const example of OFFER_NOTE_BYPASSES) {
  expectOfferNoteBlocked(example)
}

const paidPhoneAllowedInChat = validateMarketplaceMessage('07712345678', {
  allowPhoneNumbers: true,
})
assert.equal(paidPhoneAllowedInChat.allowed, true, 'Paid chat may allow a phone number')
expectOfferNoteBlocked('07712345678', 'offer notes never unlock phones after payment')

assert.match(offerNoteMigration, /create or replace function public\.create_buyer_offer\(/)
assert.match(
  offerNoteMigration,
  /create_buyer_offer\(\s*p_listing_id uuid,\s*p_conversation_id uuid,\s*p_quantity integer,\s*p_total_amount_pence integer,\s*p_message text default null/s,
)
assert.match(offerNoteMigration, /assert_marketplace_offer_note_allowed/)
assert.match(offerNoteMigration, /assert_marketplace_offer_note_allowed\(\s*p_message/)
assert.match(offerNoteMigration, /offers_enforce_marketplace_note/)
assert.doesNotMatch(offerNoteMigration, /drop function if exists public\.create_buyer_offer/)
assert.match(
  previousCreateBuyerOffer,
  /create or replace function public\.create_buyer_offer\(\s*p_listing_id uuid,\s*p_conversation_id uuid,\s*p_quantity integer,\s*p_total_amount_pence integer,\s*p_message text default null/s,
)
assert.match(
  offerNoteMigration,
  /create or replace function public\.counter_offer\(\s*p_offer_id uuid,\s*p_amount_pence integer/s,
)
assert.doesNotMatch(
  offerNoteMigration,
  /create or replace function public\.counter_offer\([^)]*p_message/,
)
assert.match(createOfferJs, /validateOptionalMarketplaceMessage/)
assert.match(offerMessaging, /validateOptionalMarketplaceMessage/)
assert.match(offerNoteMigration, /marketplace_message_is_blocked\(v_trimmed, false\)/)
assert.match(offerNoteMigration, /phones NEVER allowed|Never unlock phones/i)

assert.match(offerNoteMigration, /deleted_at is null/)
assert.match(offerNoteMigration, /begin_account_deletion/)
assert.match(offerNoteMigration, /list_account_media_cleanup_targets/)
assert.match(offerNoteMigration, /retainSoldListingImages/)
assert.doesNotMatch(offerNoteMigration, /pg_cron/)
assert.doesNotMatch(offerNoteMigration, /select cron\./)

assert.match(phoneDeletionMigration, /anonymize_deleted_account/)
assert.match(deletionFn, /begin_account_deletion/)
assert.match(deletionFn, /abort_account_deletion_pending/)
assert.match(deletionFn, /unlinkOAuthIdentities/)
assert.match(deletionFn, /list_account_media_cleanup_targets/)
assert.match(deletionFn, /listing-images/)
assert.match(deletionFn, /lockAuthAccount/)
assert.match(retentionDoc, /Proposed Equipd period/)
assert.match(retentionDoc, /Statutory/)
assert.match(retentionDoc, /Do not `auth\.admin\.deleteUser\(\)`/)
assert.match(retentionDoc, /no cron/i)

assert.match(
  offerNoteMigration,
  /p\.is_suspended\s+or p\.deleted_at is not null\s+or p\.deletion_requested_at is not null/s,
)

console.log('PASS: offer notes reject contact, payment and URL bypasses')
console.log('PASS: empty offer notes stay optional; phones stay locked in notes')
console.log('PASS: create_buyer_offer / counter_offer signatures match production history')
console.log('PASS: deletion pending, shop hide, retryable media cleanup, no auto-purge job')
console.log('\nAll offer-note and deletion follow-up checks passed.')
