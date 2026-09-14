#!/usr/bin/env node
/**
 * Public marketplace identity — username / safe display_name / Equipd user.
 *
 * Usage:
 *   node scripts/test-public-user-name.mjs
 */

import assert from 'node:assert/strict'
import {
  getEmailLocalPart,
  getPublicUserName,
  getSafePublicDisplayName,
  isEmailSeededDisplayName,
  PUBLIC_USER_NAME_FALLBACK,
} from '../src/lib/publicUserName.js'
import {
  getConversationOtherPartyName,
  getConversationParticipantLabel,
} from '../src/lib/conversationParticipants.js'

assert.equal(getEmailLocalPart('siobhan.oleary81@gmail.com'), 'siobhan.oleary81')
assert.equal(getEmailLocalPart('  JOHN.SMITH@Example.COM '), 'JOHN.SMITH')
assert.equal(getEmailLocalPart('not-an-email'), null)

assert.equal(
  isEmailSeededDisplayName('siobhan.oleary81', 'siobhan.oleary81@gmail.com'),
  true,
)
assert.equal(
  isEmailSeededDisplayName('SIOBHAN.OLEARY81', 'siobhan.oleary81@gmail.com'),
  true,
)
assert.equal(
  isEmailSeededDisplayName("Siobhan O'Leary", 'siobhan.oleary81@gmail.com'),
  false,
)
assert.equal(
  isEmailSeededDisplayName('siobhan', 'siobhan.oleary81@gmail.com'),
  false,
)

// Username present — wins regardless of email-seeded display_name
assert.equal(
  getPublicUserName(
    { username: 'rower-sellpoint', display_name: 'siobhan.oleary81' },
    { email: 'siobhan.oleary81@gmail.com' },
  ),
  'rower-sellpoint',
)

// Legacy email-seeded display_name with no username
assert.equal(
  getPublicUserName(
    { username: null, display_name: 'siobhan.oleary81' },
    { email: 'siobhan.oleary81@gmail.com' },
  ),
  'Equipd user',
)
assert.equal(
  getSafePublicDisplayName('siobhan.oleary81', 'siobhan.oleary81@gmail.com'),
  null,
)

// Safe display name
assert.equal(
  getPublicUserName(
    { username: null, display_name: "Siobhan O'Leary" },
    { email: 'siobhan.oleary81@gmail.com' },
  ),
  "Siobhan O'Leary",
)

// No username / display name
assert.equal(getPublicUserName({}), PUBLIC_USER_NAME_FALLBACK)
assert.equal(
  getPublicUserName({ username: null, display_name: null }, { email: 'a@b.com' }),
  'Equipd user',
)

// Case variation of seeded display_name
assert.equal(
  getPublicUserName(
    { username: null, display_name: 'SIOBHAN.OLEARY81' },
    { email: 'siobhan.oleary81@gmail.com' },
  ),
  'Equipd user',
)

// profile.email is also consulted
assert.equal(
  getPublicUserName({
    username: null,
    display_name: 'john.smith',
    email: 'john.smith@gmail.com',
  }),
  'Equipd user',
)

// Private settings may keep showing stored seeded display_name
assert.equal(
  getPublicUserName(
    { username: null, display_name: 'john.smith' },
    { email: 'john.smith@gmail.com', allowEmailSeededDisplayName: true },
  ),
  'john.smith',
)

// Messaging helpers honour profile.email sanitisation
assert.equal(
  getConversationParticipantLabel({
    username: null,
    display_name: 'siobhan.oleary81',
    email: 'siobhan.oleary81@gmail.com',
  }),
  null,
)
assert.equal(
  getConversationOtherPartyName(
    {
      buyer_id: 'b1',
      seller_id: 's1',
      seller: {
        id: 's1',
        username: null,
        display_name: 'siobhan.oleary81',
        email: 'siobhan.oleary81@gmail.com',
      },
    },
    'b1',
  ),
  'Equipd user',
)
assert.equal(
  getConversationOtherPartyName(
    {
      buyer_id: 'b1',
      seller_id: 's1',
      seller: {
        id: 's1',
        username: 'rower-sellpoint',
        display_name: 'siobhan.oleary81',
        email: 'siobhan.oleary81@gmail.com',
      },
    },
    'b1',
  ),
  'rower-sellpoint',
)

console.log('test-public-user-name: ok')
