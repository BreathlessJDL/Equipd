#!/usr/bin/env node
/**
 * Trust & Safety Phase 1 — marketplace message validation tests.
 *
 * Usage:
 *   node scripts/test-marketplace-message-validation.mjs
 */

import {
  MARKETPLACE_MESSAGE_BLOCK_MESSAGE,
  validateMarketplaceMessage,
  validateMarketplaceMessageWithContext,
} from '../src/lib/marketplaceMessageValidation.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

function makeTextMessage(body, { senderId = 'user-1', minutesAgo = 1 } = {}) {
  return {
    sender_id: senderId,
    message_type: 'text',
    body,
    created_at: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
  }
}

const BLOCKED_EXAMPLES = [
  'Call me on 07712345678',
  'Email me at test@gmail.com',
  'WhatsApp me',
  'Can I pay cash?',
  'Bank transfer instead?',
  'Bank transfer is fine',
  'facebook.com/example',
  '@myinstagram',
  'pay outside Equipd',
  'cash on collection',
  'text me when you are free',
  'send me your number',
  'https://example.com/deal',
  'WF1 2AB',
  'My postcode is WF1 2AB',
  'wf12ab',
  '182 rooks nest road',
  '10 High Street',
  'Unit 4 Industrial Estate',
  'Come to my address',
  'Pick up from 12 Station Road',
  'Flat 4, 12 Park Avenue',
  'I will send my address after we agree',
]

const ALLOWED_EXAMPLES = [
  'Is this treadmill still available?',
  'Does it fold?',
  'Can it be collected on Saturday?',
  'Can I collect on Saturday?',
  'Is collection possible on Saturday?',
  'Is the belt worn?',
  'Can you deliver within 20 miles?',
  'Does it need a standard plug?',
  'Happy to collect this weekend if still available.',
  'What is the max user weight?',
  'What area are you based in?',
  'Is the treadmill on the ground floor?',
  'It was used in a commercial gym',
  'The frame has some marks',
  'It has been used in a commercial gym',
  'It has some marks on the frame',
  "It's about 182kg",
  'The treadmill is 182cm long',
  "It's near Leeds",
  'would you take £200',
  'would you take 200',
  'can you do £350',
  'I can offer 500',
  "what's your best price",
  'could you do 200 if I collect',
  'Would you accept 750?',
  'Would you take £200 through Equipd?',
]

const PRICE_BLOCKED_EXAMPLES = [
  '£200 cash',
  '200 cash on collection',
  'bank transfer 200',
  '200 High Street',
]

const BLOCKED_SEQUENCES = [
  {
    label: 'split house number + street',
    messages: ['182', 'rooks nest road'],
  },
  {
    label: 'split number + high street',
    messages: ['10', 'High Street'],
  },
  {
    label: 'split flat + avenue',
    messages: ['Flat 4', '12 Park Avenue'],
  },
  {
    label: 'split unit + estate',
    messages: ['Unit 3', 'Industrial Estate'],
  },
  {
    label: 'split postcode',
    messages: ['WF1', '2AB'],
  },
  {
    label: 'split LS postcode',
    messages: ['LS1', '4DY'],
  },
  {
    label: 'address intent + number + street',
    messages: ['Address is', '182', 'Rooks Nest Road'],
  },
  {
    label: 'pick up from + street',
    messages: ['Pick up from', '10 High Street'],
  },
  {
    label: 'come to mine + unit + estate',
    messages: ['Come to mine', 'Unit 4', 'Industrial Estate'],
  },
  {
    label: 'send address + number + street',
    messages: ["I'll send my address", '22A', 'King Street'],
  },
  {
    label: 'address intent + house number only',
    messages: ['Address is', '182'],
  },
  {
    label: 'split price-looking number + street',
    messages: ['200', 'High Street'],
  },
  {
    label: 'address intent + price-looking number',
    messages: ['address is', '200'],
  },
]

const ALLOWED_PRICE_SEQUENCES = [
  ['would you take', '200'],
  ['would you take', '£200'],
  ['can you do', '350'],
]

function expectBlocked(text) {
  const result = validateMarketplaceMessage(text)
  assert(!result.allowed, `Expected blocked: "${text}"`)
  assert(
    result.error === MARKETPLACE_MESSAGE_BLOCK_MESSAGE,
    `Expected safety warning for: "${text}"`,
  )
  assert(result.reason, `Expected reason for: "${text}"`)
}

function expectAllowed(text) {
  const result = validateMarketplaceMessage(text)
  assert(
    result.allowed,
    `Expected allowed: "${text}" (reason=${result.reason}, match=${result.matchedPattern})`,
  )
  assert(result.sanitizedBody === text, `Expected sanitized body preserved for: "${text}"`)
}

function expectBlockedSequence(messageBodies) {
  let recent = []
  let blocked = false

  for (const body of messageBodies) {
    const result = validateMarketplaceMessageWithContext(body, recent, {
      senderId: 'user-1',
    })

    if (!result.allowed) {
      blocked = true
      break
    }

    recent = [...recent, makeTextMessage(body)]
  }

  assert(
    blocked,
    `Expected blocked sequence: ${messageBodies.join(' -> ')}`,
  )
}

function expectAllowedSequence(messageBodies) {
  let recent = []

  for (const body of messageBodies) {
    const result = validateMarketplaceMessageWithContext(body, recent, {
      senderId: 'user-1',
    })

    assert(
      result.allowed,
      `Expected allowed sequence part "${body}" in ${messageBodies.join(' -> ')} (reason=${result.reason}, match=${result.matchedPattern})`,
    )

    recent = [...recent, makeTextMessage(body)]
  }
}

for (const example of BLOCKED_EXAMPLES) {
  expectBlocked(example)
}

logPass(`${BLOCKED_EXAMPLES.length} blocked single-message examples rejected`)

for (const example of ALLOWED_EXAMPLES) {
  expectAllowed(example)
}

logPass(`${ALLOWED_EXAMPLES.length} allowed single-message examples accepted`)

for (const example of PRICE_BLOCKED_EXAMPLES) {
  expectBlocked(example)
}

logPass(`${PRICE_BLOCKED_EXAMPLES.length} blocked price/off-platform examples rejected`)

for (const sequence of BLOCKED_SEQUENCES) {
  expectBlockedSequence(sequence.messages)
}

logPass(`${BLOCKED_SEQUENCES.length} blocked split-address sequences rejected`)

for (const sequence of ALLOWED_PRICE_SEQUENCES) {
  expectAllowedSequence(sequence)
}

logPass(`${ALLOWED_PRICE_SEQUENCES.length} allowed price negotiation sequences accepted`)

expectAllowedSequence(['Can I collect on Saturday?'])
expectAllowedSequence(['What area are you based in?'])
expectAllowedSequence(["It's on the ground floor"])
expectAllowedSequence(["It's about 182kg"])
expectAllowedSequence(['The treadmill is 182cm long'])
expectAllowedSequence(['Can you deliver within 20 miles?'])
expectAllowedSequence(['182', 'kg capacity on the plate'])

logPass('Allowed collection questions and measurement messages accepted')

const empty = validateMarketplaceMessage('   ')
assert(!empty.allowed && empty.reason === 'empty', 'Empty messages should be rejected')

const blockedMessage = validateMarketplaceMessage('WF1 2AB')
assert(!blockedMessage.allowed, 'Blocked messages should not be allowed to save')
assert(blockedMessage.sanitizedBody == null, 'Blocked messages should not return sanitized body')

const splitBlocked = validateMarketplaceMessageWithContext('rooks nest road', [makeTextMessage('182')], {
  senderId: 'user-1',
})
assert(!splitBlocked.allowed, 'Split address bypass should be blocked')
assert(splitBlocked.context === 'sequence', 'Split address block should report sequence context')

logPass('Empty message rejected')
logPass('Blocked messages are not saved')
logPass('Split address/postcode bypass blocked with recent context')

console.log('\nAll marketplace message validation checks passed.')
