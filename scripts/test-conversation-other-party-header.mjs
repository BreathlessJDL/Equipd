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
  getConversationParticipantLabel,
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

assert(getConversationOtherPartyName(conversation, buyerId) === 'sam_s', 'buyer sees seller username')
assert(getConversationOtherPartyName(conversation, sellerId) === 'alex_b', 'seller sees buyer username')
logPass('header name prefers username over display_name')

const usernameOnly = {
  ...conversation,
  seller: { id: sellerId, display_name: '  ', username: 'sam_s', avatar_url: null },
}
assert(getConversationOtherPartyName(usernameOnly, buyerId) === 'sam_s', 'falls back to username')
logPass('uses username when display name is blank')

const emailSeededDisplayName = {
  ...conversation,
  seller: {
    id: sellerId,
    display_name: 'siobhan.oleary81',
    username: 'rower-sellpoint',
    avatar_url: null,
  },
}
assert(
  getConversationOtherPartyName(emailSeededDisplayName, buyerId) === 'rower-sellpoint',
  'username wins over email-seeded display_name',
)
assert(
  getConversationParticipantLabel(emailSeededDisplayName.seller) === 'rower-sellpoint',
  'participant label prefers username',
)
logPass('email-prefix display_name never beats username')

const displayNameOnly = {
  ...conversation,
  seller: { id: sellerId, display_name: 'Sam Seller', username: null, avatar_url: null },
}
assert(
  getConversationOtherPartyName(displayNameOnly, buyerId) === 'Sam Seller',
  'uses display_name when username missing',
)
logPass('display_name used when username missing')

const neither = {
  ...conversation,
  seller: { id: sellerId, display_name: null, username: null, avatar_url: null },
}
assert(getConversationOtherPartyName(neither, buyerId) === 'Equipd user', 'neutral fallback')
logPass('Equipd user fallback when username and display_name missing')

const legacySeededOnly = {
  ...conversation,
  seller: {
    id: sellerId,
    username: null,
    display_name: 'siobhan.oleary81',
    email: 'siobhan.oleary81@gmail.com',
    avatar_url: null,
  },
}
assert(
  getConversationOtherPartyName(legacySeededOnly, buyerId) === 'Equipd user',
  'legacy email-seeded display_name suppressed when email known',
)
logPass('legacy email-seeded display_name suppressed')

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
  getConversationOtherPartyName(conversation, String(buyerId)) === 'sam_s',
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
assert(messagesSource.includes('username'), 'conversation profile select includes username')
logPass('conversation loading uses public profile enrichment')

const profilesSource = readFileSync(join(ROOT, 'src/lib/profiles.js'), 'utf8')
assert(
  profilesSource.includes('getPublicUserName'),
  'getProfileDisplayName must use shared public identity helper',
)
assert(
  !profilesSource.includes("email?.split('@')[0]"),
  'profiles helper must not derive public names from email',
)
assert(
  profilesSource.includes('insert({ id: userId, display_name: null })'),
  'new profiles must not seed display_name from email',
)
const publicNameSource = readFileSync(join(ROOT, 'src/lib/publicUserName.js'), 'utf8')
assert(
  publicNameSource.includes("PUBLIC_USER_NAME_FALLBACK = 'Equipd user'"),
  'public identity fallback is Equipd user',
)
assert(
  publicNameSource.includes('isEmailSeededDisplayName'),
  'public identity suppresses email-seeded display_name',
)
logPass('profile helpers never use email as public identity')

console.log('\nAll conversation other-party header checks passed.')
