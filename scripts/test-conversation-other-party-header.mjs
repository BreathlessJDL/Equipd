#!/usr/bin/env node
/**
 * Conversation header other-party resolution (buyer vs seller viewpoints).
 *
 * Usage:
 *   node scripts/test-conversation-other-party-header.mjs
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  getConversationOtherPartyId,
  getConversationOtherPartyName,
  getConversationOtherPartyProfile,
} from '../src/lib/conversationParticipants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const buyerId = 'buyer-uuid-1'
const sellerId = 'seller-uuid-2'

const conversation = {
  id: 'conv-1',
  buyer_id: buyerId,
  seller_id: sellerId,
  buyer: {
    id: buyerId,
    display_name: 'Alex Buyer',
    username: 'alex_b',
    avatar_url: 'https://example.com/buyer.jpg',
  },
  seller: {
    id: sellerId,
    display_name: 'Sam Seller',
    username: 'sam_s',
    avatar_url: 'https://example.com/seller.jpg',
  },
}

assert(getConversationOtherPartyId(conversation, buyerId) === sellerId, 'buyer sees seller id')
assert(getConversationOtherPartyId(conversation, sellerId) === buyerId, 'seller sees buyer id')
logPass('other party id flips correctly for buyer and seller')

assert(
  getConversationOtherPartyProfile(conversation, buyerId)?.id === sellerId,
  'buyer profile resolution returns seller',
)
assert(
  getConversationOtherPartyProfile(conversation, sellerId)?.id === buyerId,
  'seller profile resolution returns buyer',
)
logPass('other party profile never returns the viewer')

assert(getConversationOtherPartyName(conversation, buyerId) === 'Sam Seller', 'buyer sees seller display name')
assert(getConversationOtherPartyName(conversation, sellerId) === 'Alex Buyer', 'seller sees buyer display name')
logPass('header name uses the other participant display name')

const usernameOnly = {
  ...conversation,
  seller: { id: sellerId, display_name: '  ', username: 'sam_s', avatar_url: null },
}
assert(getConversationOtherPartyName(usernameOnly, buyerId) === 'sam_s', 'falls back to username')
logPass('falls back to username when display name is blank')

assert(getConversationOtherPartyName(conversation, null) === 'Unknown user', 'missing viewer → Unknown user')
assert(
  getConversationOtherPartyName({ ...conversation, buyer: null, seller: null }, buyerId) ===
    'Unknown user',
  'missing other profile → Unknown user',
)
assert(
  !String(getConversationOtherPartyName({ ...conversation, buyer: null, seller: null }, buyerId))
    .toLowerCase()
    .includes('conversation'),
  'never uses Conversation as title',
)
logPass('sensible Unknown user fallback; never Conversation')

assert(
  getConversationOtherPartyName(conversation, String(buyerId)) === 'Sam Seller',
  'string-normalized viewer id still resolves',
)
logPass('string-normalized ids resolve')

const headerSource = readFileSync(
  join(ROOT, 'src/components/messages/MessageThreadHeader.jsx'),
  'utf8',
)
assert(
  !headerSource.includes("'Conversation'") && !headerSource.includes('"Conversation"'),
  'MessageThreadHeader must not fall back to Conversation',
)
assert(headerSource.includes('Unknown user'), 'MessageThreadHeader falls back to Unknown user')
logPass('header component fallback is Unknown user')

const messagesSource = readFileSync(join(ROOT, 'src/lib/messages.js'), 'utf8')
assert(
  messagesSource.includes('withParticipantPublicProfiles'),
  'conversation fetches enrich via profiles_public',
)
assert(
  !messagesSource.includes('buyer:profiles!buyer_id'),
  'conversation selects must not embed owner-only profiles',
)
logPass('conversation loading uses public profile enrichment')

console.log('\nAll conversation other-party header checks passed.')
