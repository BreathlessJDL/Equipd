#!/usr/bin/env node

import {
  CONVERSATION_SAFETY_BANNER_STORAGE_KEY,
  dismissConversationSafetyBanner,
  isConversationSafetyBannerDismissed,
} from '../src/lib/conversationSafetyBannerPreference.js'
import {
  getConversationOrderForViewer,
  isOfferAcceptedSystemMessage,
  OFFER_ACCEPTED_HANDOVER_SYSTEM_MESSAGE,
} from '../src/lib/offerAcceptedSystemMessage.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const memory = {}
globalThis.window = {
  localStorage: {
    getItem(key) {
      return memory[key] ?? null
    },
    setItem(key, value) {
      memory[key] = String(value)
    },
  },
}

assert(
  !isConversationSafetyBannerDismissed('user-1', 'conv-1'),
  'Banner should be visible by default',
)

dismissConversationSafetyBanner('user-1', 'conv-1')
assert(
  isConversationSafetyBannerDismissed('user-1', 'conv-1'),
  'Dismissed banner should stay hidden for that conversation',
)
assert(
  !isConversationSafetyBannerDismissed('user-1', 'conv-2'),
  'Dismissing one conversation should not hide another',
)
assert(
  !isConversationSafetyBannerDismissed('user-2', 'conv-1'),
  'Dismissing for one user should not hide it for another',
)
assert(
  memory[CONVERSATION_SAFETY_BANNER_STORAGE_KEY]?.includes('conv-1'),
  'Preference should persist in local storage',
)

assert(
  isOfferAcceptedSystemMessage({
    message_type: 'system',
    body: OFFER_ACCEPTED_HANDOVER_SYSTEM_MESSAGE,
  }),
  'New offer-accepted copy should be recognised',
)
assert(
  isOfferAcceptedSystemMessage({
    message_type: 'system',
    body: 'Offer accepted.',
  }),
  'Historical offer-accepted copy should still get a View Order link',
)
assert(
  !isOfferAcceptedSystemMessage({
    message_type: 'text',
    body: OFFER_ACCEPTED_HANDOVER_SYSTEM_MESSAGE,
  }),
  'User text must not be treated as a system offer message',
)

const order = getConversationOrderForViewer(
  [
    {
      conversation_id: 'conv-a',
      order: { id: 'order-a', buyer_id: 'buyer-1', seller_id: 'seller-1', listing_id: 'listing-1' },
    },
    {
      conversation_id: 'conv-b',
      order: { id: 'order-b', buyer_id: 'buyer-1', seller_id: 'seller-1', listing_id: 'listing-1' },
    },
  ],
  { id: 'conv-b', listing_id: 'listing-1' },
  'buyer-1',
)
assert(order?.id === 'order-b', 'View Order should use the order for this conversation only')

const otherBuyer = getConversationOrderForViewer(
  [
    {
      conversation_id: 'conv-b',
      order: { id: 'order-b', buyer_id: 'buyer-1', seller_id: 'seller-1', listing_id: 'listing-1' },
    },
  ],
  { id: 'conv-b', listing_id: 'listing-1' },
  'stranger',
)
assert(!otherBuyer, 'Unauthorised viewers should not get a View Order link')

console.log('PASS: conversation safety banner preference')
console.log('PASS: offer-accepted system message helpers')
console.log('\nAll Batch 1 helper checks passed.')
