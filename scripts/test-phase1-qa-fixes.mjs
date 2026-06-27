#!/usr/bin/env node
/**
 * Unit checks for Phase 1 production QA fixes.
 * Run: node scripts/test-phase1-qa-fixes.mjs
 */

const OFFER_EXCEEDS_ASKING_PRICE_ERROR =
  'Offers cannot be higher than the asking price.'

function validateBuyerOfferAmount(amountPence, listingPricePence) {
  if (
    listingPricePence != null &&
    Number.isFinite(listingPricePence) &&
    amountPence > listingPricePence
  ) {
    return OFFER_EXCEEDS_ASKING_PRICE_ERROR
  }
  return null
}

function avatarLetter(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.charAt(0).toUpperCase()
}

function getProfileInitials(profile, { user } = {}) {
  const fromUsername = avatarLetter(profile?.username)
  if (fromUsername) return fromUsername

  const fromDisplayName = avatarLetter(profile?.display_name)
  if (fromDisplayName) return fromDisplayName

  const fromEmail = avatarLetter(user?.email)
  if (fromEmail) return fromEmail

  const fromFirstName = avatarLetter(user?.user_metadata?.first_name)
  if (fromFirstName) return fromFirstName

  return '?'
}

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    passed += 1
    console.log(`PASS ${label}`)
    return
  }

  failed += 1
  console.error(`FAIL ${label}`)
}

assert(
  validateBuyerOfferAmount(10000, 10000) === null,
  'offer equal to asking price allowed',
)
assert(
  validateBuyerOfferAmount(9999, 10000) === null,
  'offer below asking price allowed',
)
assert(
  validateBuyerOfferAmount(10001, 10000) === OFFER_EXCEEDS_ASKING_PRICE_ERROR,
  'offer above asking price blocked',
)

assert(getProfileInitials({ username: 'jordan' }) === 'J', 'avatar uses username first')
assert(
  getProfileInitials({ username: 'jordan', display_name: 'Jordan L' }) === 'J',
  'avatar prefers username over display name',
)
assert(
  getProfileInitials({ display_name: 'Jordan L' }) === 'J',
  'avatar falls back to display name',
)
assert(
  getProfileInitials(null, { user: { email: 'buyer@example.com' } }) === 'B',
  'avatar falls back to email',
)

console.log(`\n${passed}/${passed + failed} checks passed`)

if (failed > 0) {
  process.exit(1)
}
