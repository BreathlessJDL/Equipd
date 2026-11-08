#!/usr/bin/env node
/**
 * Mobile inbox list helpers and layout contracts.
 *
 *   node scripts/test-conversation-list-inbox.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getConversationParticipantLine } from '../src/lib/conversationParticipants.js'
import { formatConversationListTime } from '../src/lib/conversationListPresentation.js'

function atLocal(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute)
}

const buyerId = 'buyer-1'
const sellerId = 'seller-1'
const conversation = {
  buyer_id: buyerId,
  seller_id: sellerId,
  buyer: { id: buyerId, username: 'Upi', display_name: 'Upi' },
  seller: { id: sellerId, username: 'JDLFITNESS', display_name: 'JDL Fitness' },
}

assert.equal(getConversationParticipantLine(conversation, sellerId), 'Upi')
assert.equal(getConversationParticipantLine(conversation, buyerId), 'JDLFITNESS')
assert.doesNotMatch(
  getConversationParticipantLine(conversation, sellerId),
  /Buyer ·/,
  'inbox names do not include a Buyer prefix',
)
assert.doesNotMatch(
  getConversationParticipantLine(conversation, buyerId),
  /Seller ·/,
  'inbox names do not include a Seller prefix',
)

const now = atLocal(2026, 11, 8, 23, 10)
assert.equal(formatConversationListTime(atLocal(2026, 11, 8, 22, 52), now), '22:52')
assert.equal(formatConversationListTime(atLocal(2026, 11, 7, 9, 5), now), 'Yesterday')
assert.equal(formatConversationListTime(atLocal(2026, 11, 3, 9, 0), now), 'Tue')
assert.equal(formatConversationListTime(atLocal(2026, 7, 3, 9, 0), now), '3 Jul')
assert.equal(formatConversationListTime(atLocal(2025, 7, 3, 9, 0), now), '3 Jul 2025')
assert.equal(formatConversationListTime(null, now), '')

const itemSource = readFileSync('src/components/messages/ConversationListItem.jsx', 'utf8')
assert.doesNotMatch(itemSource, /ProfileAvatarLink/, 'inbox cards do not overlay avatars')
assert.doesNotMatch(itemSource, /conversation-card__avatar-badge/, 'inbox cards do not render avatar badges')
assert.match(itemSource, /conversation-card__unread-dot/, 'unread conversations keep a status indicator')
assert.match(itemSource, /conversation-card__listing/, 'listing titles remain visible')

const css = readFileSync('src/components/messages/ConversationListItem.css', 'utf8')
assert.match(css, /minmax\(0,\s*1fr\)/, 'conversation rows can shrink without overflow')
assert.match(css, /white-space:\s*nowrap/, 'long preview text truncates')
assert.match(css, /border-radius:\s*0\.95rem/, 'mobile cards are rounded')
assert.match(css, /conversation-card--unread/, 'unread cards have distinct styling')

const pageCss = readFileSync('src/components/Messages.css', 'utf8')
assert.match(
  pageCss,
  /messages-page--list-only \.messages-page__lead \{\s*display:\s*none/s,
  'mobile inbox hides the subtitle under Messages',
)

console.log('test-conversation-list-inbox: ok')
