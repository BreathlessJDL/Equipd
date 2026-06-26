export const MARKETPLACE_MESSAGE_BLOCK_MESSAGE =
  "For everyone's safety, please keep communication and payments on Equipd. Collection details are shared securely after payment."

export const MARKETPLACE_MESSAGE_SAFETY_NOTE =
  'Keep payments and communication on Equipd to stay protected.'

export const MESSAGE_CONTEXT_MAX_RECENT_MESSAGES = 5
export const MESSAGE_CONTEXT_WINDOW_MINUTES = 10

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s]+/i
const DOMAIN_PATH_PATTERN =
  /\b(?:[a-z0-9-]+\.)+(?:com|co\.uk|net|org|io|me|app)(?:\/[^\s]*)?\b/i
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/i
const SOCIAL_HANDLE_PATTERN = /(?:^|\s)@[A-Za-z0-9._]{2,}\b/

const UK_POSTCODE_PATTERN =
  /\b(?:GIR\s?0AA|[A-Z]{1,2}\d{1,2}[A-Z]?(?:\s+\d[A-Z]{2}|\d[A-Z]{2}))\b/i

const STREET_ADDRESS_PATTERN = new RegExp(
  String.raw`\b(?:` +
    String.raw`(?:flat|unit|apartment)\s+\d+[A-Za-z]?(?:\s*,\s*|\s+)\d+` +
    String.raw`|unit\s+\d+[A-Za-z]?\s*(?:,?\s*)?(?:industrial\s+estate|business\s+park)` +
    String.raw`|(?:unit\s+\d+[A-Za-z]?\s*,?\s*)?(?:industrial\s+estate|business\s+park)` +
    String.raw`|\d+[A-Za-z]?\s+(?:[\w'-]+\s+)*(?:road|avenue|crescent|terrace|high\s+street)\b` +
    String.raw`|\d+[A-Za-z]?\s+(?:[\w'-]+\s+)+street\b` +
    String.raw`|\d+[A-Za-z]?\s+(?:[\w'-]+\s+)+(?:lane|drive|close|court|way|place)\b` +
    String.raw`|\d+[A-Za-z]?\s+(?:[\w'-]+\s+)+(?:rd|st|ave|dr|ln)\b` +
    String.raw`)`,
  'i',
)

const MEASUREMENT_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|cm|mm|m|metres?|meters?|miles?|mi|hours?|hrs?|hr)\b/i

const PRICE_NEGOTIATION_PATTERN =
  /\b(?:would you take|would you accept|can you do|could you do|i can offer|my offer|best price|lower the price|lower price|too low|accept|offer|price|£|\bpounds?\b|\bquid\b)\b/i

const STREET_ADDRESS_KEYWORD_PATTERN =
  /\b(?:road|street|high\s+street|avenue|lane|drive|close|court|way|place|terrace|crescent|industrial\s+estate|business\s+park|\brd\b|\bst\b|\bave\b|\bdr\b|\bln\b)\b/i

const SUSPICIOUS_ADDRESS_INTENT_PATTERN =
  /\b(?:address\s+is|postcode\s+is|my\s+postcode|pick\s+up\s+from|collect\s+from|collect\s+at|come\s+to\s+mine|come\s+to\s+my\s+(?:house|home|address|place)|my\s+house|my\s+home|send\s+my\s+address|i['’]ll\s+send\s+my\s+address)\b/i

const BLOCK_RULES = [
  { type: 'email', pattern: EMAIL_PATTERN },
  { type: 'url', pattern: URL_PATTERN },
  { type: 'url', pattern: DOMAIN_PATH_PATTERN },
  { type: 'phone', pattern: PHONE_PATTERN },
  { type: 'social_handle', pattern: SOCIAL_HANDLE_PATTERN },
  { type: 'whatsapp', pattern: /\bwhatsapp\b/i },
  { type: 'whatsapp_request', pattern: /\bwhatsapp\s+me\b/i },
  {
    type: 'social_platform',
    pattern:
      /\b(?:telegram|signal|instagram|insta|facebook|fb|snapchat|tiktok|twitter|discord)\b/i,
  },
  {
    type: 'contact_request',
    pattern:
      /\b(?:call me|text me|email me|message me on|contact me on|add me on|dm me|reach me on)\b/i,
  },
  {
    type: 'contact_request',
    pattern: /\b(?:my number is|phone number|mobile number|send me your number)\b/i,
  },
  {
    type: 'off_platform_payment',
    pattern: /\b(?:pay outside equipd|pay off platform|outside equipd|off platform|direct payment)\b/i,
  },
  {
    type: 'bank_transfer',
    pattern: /\b(?:bank transfer|wire transfer|sort code|account number|bacs|faster payment)\b/i,
  },
  {
    type: 'cash_payment',
    pattern: /\b(?:cash on collection|pay cash|pay in cash|cash payment|cash instead|can i pay cash)\b/i,
  },
  {
    type: 'cash_payment',
    pattern: /\b(?:£\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?)\s+cash\b/i,
  },
  { type: 'cash_payment', pattern: /\b(?:cash only|cash in hand)\b/i },
  { type: 'off_platform_payment', pattern: /\b(?:paypal(?:\.me)?|venmo)\b/i },
  { type: 'uk_postcode', pattern: UK_POSTCODE_PATTERN },
  { type: 'street_address', pattern: STREET_ADDRESS_PATTERN },
  {
    type: 'collection_location',
    pattern: /\bcollect\s+from\s+my\s+(?:house|home|address|place)\b/i,
  },
  {
    type: 'collection_location',
    pattern: /\bcome\s+to\s+my\s+(?:house|home|address|place)\b/i,
  },
  {
    type: 'collection_location',
    pattern: /\b(?:i['’]ll|i will)\s+send\s+(?:you\s+)?my\s+address\b/i,
  },
  {
    type: 'collection_location',
    pattern: /\bmeet\s+(?:at|me\s+at)\s+my\s+(?:house|home|address|place)\b/i,
  },
  { type: 'collection_location', pattern: /\bpick\s+up\s+from\b/i },
  { type: 'collection_location', pattern: /\bcollect\s+at\b/i },
  { type: 'collection_location', pattern: /\bmy\s+postcode\s+is\b/i },
  { type: 'collection_location', pattern: /\b(?:my\s+)?address\s+is\b/i },
]

function findBlockedMatch(value, { allowPriceNegotiation = true } = {}) {
  const text = value?.trim() ?? ''
  const priceContext = allowPriceNegotiation && hasPriceNegotiationContext(text)
  const hasStreetTerms = containsStreetAddressKeyword(text)
  const suspiciousAddressIntent = hasSuspiciousAddressIntent(text)

  for (const rule of BLOCK_RULES) {
    if (priceContext && !hasStreetTerms && !suspiciousAddressIntent) {
      if (rule.type === 'street_address' || rule.type === 'uk_postcode') continue
      if (rule.type === 'collection_location') continue
    }

    const match = text.match(rule.pattern)

    if (match) {
      return {
        type: rule.type,
        matchedPattern: match[0],
      }
    }
  }

  return null
}

function buildBlockedResult(blocked, context = 'single') {
  return {
    allowed: false,
    ok: false,
    reason: blocked.type,
    matchedPattern: blocked.matchedPattern,
    error: MARKETPLACE_MESSAGE_BLOCK_MESSAGE,
    context,
  }
}

export function isNormalUserTextMessage(message) {
  if (!message?.body?.trim()) return false

  const type = message?.message_type ?? 'text'
  return type === 'text'
}

export function selectRecentTextMessagesForContext(
  recentMessages = [],
  senderId,
  {
    maxMessages = MESSAGE_CONTEXT_MAX_RECENT_MESSAGES,
    withinMinutes = MESSAGE_CONTEXT_WINDOW_MINUTES,
    now = new Date(),
  } = {},
) {
  if (!senderId) return []

  const cutoffMs = now.getTime() - withinMinutes * 60 * 1000

  return (recentMessages ?? [])
    .filter((message) => {
      if (!isNormalUserTextMessage(message)) return false
      if (message.sender_id !== senderId) return false

      const createdAt = message.created_at ? new Date(message.created_at).getTime() : now.getTime()
      return createdAt >= cutoffMs
    })
    .slice(-maxMessages)
}

function isMeasurementText(text) {
  return MEASUREMENT_PATTERN.test(text?.trim() ?? '')
}

function hasPriceNegotiationIntent(text) {
  return PRICE_NEGOTIATION_PATTERN.test(text?.trim() ?? '')
}

function containsStreetAddressKeyword(text) {
  return STREET_ADDRESS_KEYWORD_PATTERN.test(text?.trim() ?? '')
}

function isPriceAmountText(text) {
  const trimmed = text?.trim() ?? ''
  return (
    /^£[\d,]+(?:\.\d{1,2})?$/.test(trimmed) ||
    /^[\d,]+(?:\.\d{1,2})?(?:\s*(?:pounds?|quid))?$/i.test(trimmed)
  )
}

function hasPriceNegotiationContext(text) {
  const trimmed = text?.trim() ?? ''
  if (!trimmed) return false
  if (/£[\d,]/.test(trimmed)) return true
  if (hasPriceNegotiationIntent(trimmed)) return true
  if (isPriceAmountText(trimmed) && hasPriceNegotiationIntent(trimmed)) return true
  return false
}

function hasRecentPriceNegotiation(recentBodies = []) {
  return recentBodies.some((body) => hasPriceNegotiationContext(body))
}

function shouldAllowPriceNegotiationSequence(recentBodies, currentBody, combined) {
  const priceContext =
    hasPriceNegotiationContext(combined) ||
    hasPriceNegotiationContext(currentBody) ||
    (isPriceAmountText(currentBody) && hasRecentPriceNegotiation(recentBodies))

  if (!priceContext) return false
  if (containsStreetAddressKeyword(combined)) return false
  if (hasSuspiciousAddressIntent(combined)) return false
  return true
}

function isAddressNumberFragment(text) {
  const trimmed = text?.trim() ?? ''
  if (/^£/.test(trimmed)) return false

  return /^(?:\d+[A-Za-z]?|(?:flat|unit|apartment)\s+\d+[A-Za-z]?)$/i.test(trimmed)
}

function isPostcodeOutwardFragment(text) {
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?$/i.test(text?.trim() ?? '')
}

function isPostcodeInwardFragment(text) {
  return /^\d[A-Z]{2}$/i.test(text?.trim() ?? '')
}

function isStreetSuffixFragment(text) {
  const trimmed = text?.trim() ?? ''
  if (!trimmed || isAddressNumberFragment(trimmed)) return false

  return /^(?:[\w'-]+\s+)*(?:road|street|high\s+street|avenue|lane|drive|close|court|way|place|terrace|crescent|industrial\s+estate|business\s+park|rd|st|ave|dr|ln)$/i.test(
    trimmed,
  )
}

function isUnitOrEstateFragment(text) {
  const trimmed = text?.trim() ?? ''
  return /^(?:unit\s+\d+[A-Za-z]?|industrial\s+estate|business\s+park)$/i.test(trimmed)
}

function hasSuspiciousAddressIntent(text) {
  return SUSPICIOUS_ADDRESS_INTENT_PATTERN.test(text?.trim() ?? '')
}

function buildContextCombinations(recentBodies, currentBody) {
  const tail = [...recentBodies, currentBody]
  const combinations = []

  for (let start = 0; start < tail.length; start += 1) {
    for (let end = start + 2; end <= tail.length; end += 1) {
      combinations.push(tail.slice(start, end).join(' '))
    }
  }

  return combinations
}

function validateMessageSequence(recentBodies, currentBody) {
  const combinations = buildContextCombinations(recentBodies, currentBody)

  for (const combined of combinations) {
    if (isMeasurementText(combined)) continue
    if (shouldAllowPriceNegotiationSequence(recentBodies, currentBody, combined)) continue

    const blocked = findBlockedMatch(combined)
    if (blocked) {
      return buildBlockedResult(blocked, 'sequence')
    }
  }

  if (isMeasurementText(currentBody)) {
    return null
  }

  const recentIntent = recentBodies.some((body) => hasSuspiciousAddressIntent(body))
  const recentPriceNegotiation = hasRecentPriceNegotiation(recentBodies)

  if (
    isAddressNumberFragment(currentBody) &&
    (recentIntent || hasSuspiciousAddressIntent(currentBody)) &&
    !(isPriceAmountText(currentBody) && recentPriceNegotiation)
  ) {
    return buildBlockedResult(
      { type: 'address_fragment_sequence', matchedPattern: currentBody.trim() },
      'sequence',
    )
  }

  if (recentBodies.length > 0) {
    const previousBody = recentBodies[recentBodies.length - 1]

    if (
      (isPostcodeOutwardFragment(previousBody) && isPostcodeInwardFragment(currentBody)) ||
      (isPostcodeInwardFragment(previousBody) && isPostcodeOutwardFragment(currentBody))
    ) {
      return buildBlockedResult(
        {
          type: 'split_postcode',
          matchedPattern: `${previousBody.trim()} ${currentBody.trim()}`,
        },
        'sequence',
      )
    }

    if (
      (isAddressNumberFragment(previousBody) &&
        (isStreetSuffixFragment(currentBody) || isUnitOrEstateFragment(currentBody))) ||
      (isUnitOrEstateFragment(previousBody) &&
        (isAddressNumberFragment(currentBody) || isStreetSuffixFragment(currentBody)))
    ) {
      const combined = `${previousBody.trim()} ${currentBody.trim()}`
      const blocked = findBlockedMatch(combined)

      if (blocked) {
        return buildBlockedResult(blocked, 'sequence')
      }
    }
  }

  return null
}

export function validateMarketplaceMessage(body) {
  const trimmed = body?.trim() ?? ''

  if (!trimmed) {
    return {
      allowed: false,
      ok: false,
      reason: 'empty',
      matchedPattern: null,
      error: 'Message cannot be empty.',
      context: 'single',
    }
  }

  if (isMeasurementText(trimmed) || hasPriceNegotiationContext(trimmed)) {
    const blockedWithoutPriceBypass = findBlockedMatch(trimmed, { allowPriceNegotiation: false })

    if (blockedWithoutPriceBypass) {
      return buildBlockedResult(blockedWithoutPriceBypass, 'single')
    }

    return {
      allowed: true,
      ok: true,
      reason: null,
      matchedPattern: null,
      sanitizedBody: trimmed,
      context: 'single',
    }
  }

  const blocked = findBlockedMatch(trimmed)

  if (blocked) {
    return buildBlockedResult(blocked, 'single')
  }

  return {
    allowed: true,
    ok: true,
    reason: null,
    matchedPattern: null,
    sanitizedBody: trimmed,
    context: 'single',
  }
}

export function validateMarketplaceMessageWithContext(
  body,
  recentMessages = [],
  {
    senderId = null,
    maxMessages = MESSAGE_CONTEXT_MAX_RECENT_MESSAGES,
    withinMinutes = MESSAGE_CONTEXT_WINDOW_MINUTES,
    now = new Date(),
  } = {},
) {
  const singleResult = validateMarketplaceMessage(body)

  if (!singleResult.allowed) {
    return singleResult
  }

  const trimmed = singleResult.sanitizedBody ?? body?.trim() ?? ''
  const recent = selectRecentTextMessagesForContext(recentMessages, senderId, {
    maxMessages,
    withinMinutes,
    now,
  })
  const recentBodies = recent.map((message) => message.body.trim())
  const sequenceResult = validateMessageSequence(recentBodies, trimmed)

  if (sequenceResult) {
    return sequenceResult
  }

  return {
    ...singleResult,
    context: recentBodies.length > 0 ? 'context_checked' : 'single',
  }
}

export function validateOptionalMarketplaceMessage(body) {
  const trimmed = body?.trim() ?? ''

  if (!trimmed) {
    return {
      allowed: true,
      ok: true,
      reason: null,
      matchedPattern: null,
      sanitizedBody: '',
      context: 'single',
    }
  }

  return validateMarketplaceMessage(trimmed)
}

export function logBlockedMarketplaceMessage(details = {}) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn('[marketplace-message] blocked', details)
  }
}
