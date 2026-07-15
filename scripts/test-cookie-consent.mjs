/**
 * Cookie consent storage + preference helpers.
 * Run: node scripts/test-cookie-consent.mjs
 */

import assert from 'node:assert/strict'
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  getAcceptAllCategoryPreferences,
  getDefaultCategoryPreferences,
  getRejectNonEssentialCategoryPreferences,
  getVisibleOptionalCookieCategories,
  isCategoryEnabled,
  readStoredCookieConsent,
  writeStoredCookieConsent,
} from '../src/lib/cookieConsent.js'

function resetWindowStore() {
  const store = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, String(value))
      },
      removeItem: (key) => {
        store.delete(key)
      },
    },
  }
  return store
}

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

check('first visit defaults analytics to false', () => {
  const defaults = getDefaultCategoryPreferences()
  assert.equal(defaults.necessary, true)
  assert.equal(defaults.analytics, false)
  assert.equal(defaults.marketing, false)
  assert.equal(defaults.preferences, false)
})

check('Accept all grants analytics', () => {
  const all = getAcceptAllCategoryPreferences()
  assert.equal(all.analytics, true)
  assert.equal(all.necessary, true)
})

check('Reject non-essential denies analytics', () => {
  const rejected = getRejectNonEssentialCategoryPreferences()
  assert.equal(rejected.analytics, false)
  assert.equal(rejected.necessary, true)
})

check('Cookie Settings only exposes analytics as optional category', () => {
  const visible = getVisibleOptionalCookieCategories()
  assert.equal(visible.length, 1)
  assert.equal(visible[0].id, 'analytics')
  assert.match(visible[0].description, /Google Analytics/)
})

check('legacy consent without analytics field defaults false', () => {
  const store = resetWindowStore()
  store.set(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify({
      version: COOKIE_CONSENT_VERSION,
      consentedAt: '2026-01-01T00:00:00.000Z',
      categories: { necessary: true },
    }),
  )
  const record = readStoredCookieConsent()
  assert.equal(record.categories.analytics, false)
  assert.equal(isCategoryEnabled(record, 'analytics'), false)
})

check('settings save persists analytics true', () => {
  resetWindowStore()
  const record = writeStoredCookieConsent({
    necessary: true,
    analytics: true,
    marketing: false,
    preferences: false,
  })
  assert.equal(record.categories.analytics, true)
  assert.equal(readStoredCookieConsent().categories.analytics, true)
})

check('settings save persists analytics false', () => {
  resetWindowStore()
  writeStoredCookieConsent({
    necessary: true,
    analytics: true,
  })
  const revoked = writeStoredCookieConsent({
    necessary: true,
    analytics: false,
  })
  assert.equal(revoked.categories.analytics, false)
  assert.equal(isCategoryEnabled(revoked, 'analytics'), false)
})

check('isCategoryEnabled treats missing consent as analytics denied', () => {
  assert.equal(isCategoryEnabled(null, 'analytics'), false)
  assert.equal(isCategoryEnabled(null, 'necessary'), true)
})

console.log('Cookie consent unit checks\n')
for (const entry of checks) {
  console.log(entry.ok ? `  ✓ ${entry.name}` : `  ✗ ${entry.name}: ${entry.error}`)
}

const failed = checks.filter((entry) => !entry.ok)
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${checks.length} checks passed.`)
