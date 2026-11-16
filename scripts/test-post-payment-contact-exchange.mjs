#!/usr/bin/env node
/**
 * Post-payment contact exchange: JS filters, SQL source contracts, and
 * send-path guarantees that the client cannot unlock contact details.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  MARKETPLACE_MESSAGE_PAYMENT_CONTACT_NOTE,
  MARKETPLACE_MESSAGE_PHONE_BLOCK_MESSAGE,
  isPostPaymentContactBlockReason,
  validateMarketplaceMessage,
  validateMarketplaceMessageWithContext,
  validateOptionalMarketplaceMessage,
} from '../src/lib/marketplaceMessageValidation.js'

const migration = readFileSync(
  'supabase/migrations/20261116140000_post_payment_contact_exchange.sql',
  'utf8',
)
const sendPath = readFileSync('src/lib/messages.js', 'utf8')
const attachmentsPath = readFileSync('src/lib/messageAttachments.js', 'utf8')
const messagesPage = readFileSync('src/pages/MessagesPage.jsx', 'utf8')
const hardening = readFileSync(
  'supabase/migrations/20260911140000_trust_safety_scam_hardening.sql',
  'utf8',
)
const sendMessageSql = readFileSync(
  'supabase/migrations/20260911140000_trust_safety_scam_hardening.sql',
  'utf8',
)
const sendAttachmentsSql = readFileSync(
  'supabase/migrations/20260703150000_prelaunch_security_hardening.sql',
  'utf8',
)

function expectBlocked(body, label, options = {}) {
  const result = validateMarketplaceMessage(body, options)
  assert.equal(result.allowed, false, `${label}: expected blocked (${body})`)
  return result
}

function expectAllowed(body, label, options = {}) {
  const result = validateMarketplaceMessage(body, options)
  assert.equal(
    result.allowed,
    true,
    `${label}: expected allowed (${body}) got ${result.reason}`,
  )
  return result
}

const unpaid = { allowPhoneNumbers: false }
const paid = { allowPhoneNumbers: true }
const offerAcceptedUnpaid = unpaid
const pendingPayment = unpaid

expectAllowed('Can you collect Saturday at 10am?', 'unpaid collection time', unpaid)
expectAllowed('Please use the back gate and leave it with reception.', 'unpaid delivery instructions', unpaid)
expectAllowed('I can do Tuesday evening after 6.', 'unpaid collection date', unpaid)

expectBlocked('07712345678', '1. unpaid phone', unpaid)
expectBlocked('Call me on 07712345678', '1b. unpaid phone request', unpaid)

expectBlocked('test@gmail.com', '2. unpaid email', unpaid)
expectBlocked('email me at test@gmail.com', '2b. unpaid email request', unpaid)

expectBlocked('07712345678', '3. offer submitted still blocks phone', unpaid)
expectBlocked('test@gmail.com', '3b. offer submitted still blocks email', unpaid)

expectBlocked('07712345678', '4. offer accepted unpaid still blocks phone', offerAcceptedUnpaid)
expectBlocked('WF1 2AB', '4b. offer accepted unpaid still blocks postcode', offerAcceptedUnpaid)

expectBlocked('07712345678', '5. order created unpaid still blocks', pendingPayment)
expectBlocked('07712345678', '6. payment pending/failed still blocks', { allowPhoneNumbers: false })

expectAllowed('07712345678', '7. verified paid phone', paid)
expectAllowed('Call me on 07712345678', '8. buyer phone after payment', paid)
expectAllowed('My number is 07712345678', '9. seller phone after payment', paid)
expectAllowed('email me at buyer@gmail.com', '10. email after payment', paid)
expectAllowed('Collect from 182 Rooks Nest Road WF1 2AB', '10b. address after payment', paid)
expectAllowed('My postcode is WF1 2AB', '10c. postcode after payment', paid)
expectAllowed('+44 7712 345678', '10d. +44 mobile after payment', paid)
expectAllowed('Flat 4, 12 Park Avenue, Leeds', '10e. full collection address after payment', paid)
expectAllowed('Please leave it in the garage and text me when you arrive.', '10f. delivery instructions after payment', paid)

expectBlocked('WhatsApp me on 07712345678', 'off-platform WhatsApp stays blocked after payment', paid)
expectBlocked('pay cash on collection', 'off-platform cash stays blocked after payment', paid)
expectBlocked('bank transfer instead', 'off-platform bank transfer stays blocked after payment', paid)
expectBlocked('https://paypal.me/seller', 'off-platform URL stays blocked after payment', paid)

const unpaidSplit = validateMarketplaceMessageWithContext('rooks nest road', [
  {
    sender_id: 'buyer-1',
    message_type: 'text',
    body: '182',
    created_at: new Date().toISOString(),
  },
], { senderId: 'buyer-1', allowPhoneNumbers: false })
assert.equal(unpaidSplit.allowed, false, '11. split address still blocked before payment')

const paidSplit = validateMarketplaceMessageWithContext('rooks nest road', [
  {
    sender_id: 'buyer-1',
    message_type: 'text',
    body: '182',
    created_at: new Date().toISOString(),
  },
], { senderId: 'buyer-1', allowPhoneNumbers: true })
assert.equal(paidSplit.allowed, true, '11b. split address allowed after payment')

const otherConversation = validateMarketplaceMessage('07712345678', { allowPhoneNumbers: false })
assert.equal(otherConversation.allowed, false, '14. unrelated conversations remain restricted')

const offerNote = validateOptionalMarketplaceMessage('Call me on 07712345678')
assert.equal(offerNote.allowed, false, 'Offer notes never unlock contact details')

const forgedFlag = validateMarketplaceMessageWithContext('07712345678', [], {
  senderId: 'user-1',
  allowPhoneNumbers: false,
})
assert.equal(forgedFlag.allowed, false, '15. client cannot unlock without paid-order flag')

assert.equal(
  isPostPaymentContactBlockReason('email'),
  true,
  'email is a post-payment contact reason',
)
assert.match(MARKETPLACE_MESSAGE_PHONE_BLOCK_MESSAGE, /contact details/)
assert.match(MARKETPLACE_MESSAGE_PAYMENT_CONTACT_NOTE, /Payment confirmed/)

assert.match(migration, /pay\.status = 'paid'::public\.payment_status/)
assert.match(migration, /o\.listing_id = v_conversation\.listing_id/)
assert.match(migration, /o\.buyer_id = v_conversation\.buyer_id/)
assert.match(migration, /o\.seller_id = v_conversation\.seller_id/)
assert.match(migration, /fulfilment_status::text not in \('cancelled', 'refunded'\)/)
assert.match(migration, /v_allow_contact/)
assert.match(migration, /regexp_replace/)
assert.doesNotMatch(migration, /join public\.offers off on off\.id = o\.offer_id/)

assert.match(sendPath, /rpc\('send_message'/)
assert.doesNotMatch(
  sendPath.slice(sendPath.indexOf("rpc('send_message'")),
  /allowPhoneNumbers|p_allow_phone/,
)
assert.match(sendPath, /rpc\('conversation_allows_phone_exchange'/)

assert.match(migration, /messages_enforce_marketplace_body/)
assert.match(migration, /assert_marketplace_message_allowed/)
assert.match(sendMessageSql, /v_body := public\.assert_marketplace_message_allowed/)
assert.match(
  sendAttachmentsSql,
  /v_trimmed_body := public\.assert_marketplace_message_allowed/,
)
assert.match(attachmentsPath, /rpc\('send_message_with_attachments'/)

assert.match(messagesPage, /CONTACT_EXCHANGE_POLL_MS/)
assert.match(messagesPage, /CONTACT_EXCHANGE_UNLOCKED_POLL_MS/)
assert.doesNotMatch(
  messagesPage,
  /if \(!conversationId \|\| !user\?\.id \|\| contactExchangeAllowed\)/,
)
assert.match(messagesPage, /setContactExchangeAllowed\(allowed\)/)
assert.match(messagesPage, /MARKETPLACE_MESSAGE_PAYMENT_CONTACT_NOTE/)
assert.match(messagesPage, /isPostPaymentContactBlockReason/)
assert.match(hardening, /start_listing_conversation/)
assert.match(
  hardening,
  /c\.listing_id = p_listing_id\s+and c\.buyer_id = v_user_id/,
)

console.log('PASS: post-payment contact exchange contracts')
