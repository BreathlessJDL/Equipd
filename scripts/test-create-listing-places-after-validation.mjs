#!/usr/bin/env node
/**
 * Regression: Google Places suggestions work on Create Listing after failed publish.
 *
 * Usage:
 *   node scripts/test-create-listing-places-after-validation.mjs [baseUrl]
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.argv[2] ?? 'http://localhost:5178/'

function loadEnvFile(relativePath) {
  const envPath = path.join(ROOT, relativePath)
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey || !process.env.VITE_GOOGLE_MAPS_API_KEY) {
  console.error('Missing env vars for Places regression test')
  process.exit(1)
}

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
const { data, error } = await client.auth.signInWithPassword({
  email: 'dev-seller-leeds@equipd.dev',
  password: 'EquipdDevSeed123!',
})
if (error) throw error

const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext()
await context.addInitScript(
  ({ key, value }) => localStorage.setItem(key, value),
  {
    key: storageKey,
    value: JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.session.user,
    }),
  },
)

const page = await context.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(new URL('/listings/new', baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => Boolean(window.google?.maps?.places))

await page.locator('#listing-title').fill('Test listing title')
await page.locator('#listing-description').fill('Test description long enough for validation.')
await page.locator('#listing-category').selectOption({ index: 1 })
await page.waitForSelector('#listing-condition')
await page.locator('#listing-condition').selectOption({ index: 1 })
await page.locator('#listing-price').fill('100')
await page.locator('input[value="collection"]').check()
await page.locator('#listing-collection-address').fill('10 Test Street, Leeds')
await page.locator('#listing-collection-phone').fill('07123456789')
await page.locator('input[type="file"]').first().setInputFiles({
  name: 'test.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
})

await page.locator('button.listing-form__button--primary[type="submit"]').click()
await page.waitForSelector('.listing-form__message--error', { timeout: 15000 })
assert(
  (await page.locator('.listing-form__message--error').textContent())?.includes(
    'Select a location from the suggestions',
  ),
  'Location validation error shown',
)
logPass('Validation error appears when location missing')

const loc = page.locator('#listing-location')
await loc.click()
await loc.pressSequentially('Leeds', { delay: 80 })
await page.waitForTimeout(2000)

const pacState = await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  const inputRect = input?.getBoundingClientRect()
  const visiblePac = [...document.querySelectorAll('.pac-container')].find((c) => {
    const r = c.getBoundingClientRect()
    return getComputedStyle(c).display !== 'none' && r.width > 0 && c.childElementCount > 0
  })
  const pacRect = visiblePac?.getBoundingClientRect()
  return {
    bound: Boolean(input?._equipdPlacesAutocomplete),
    inputInViewport: inputRect ? inputRect.top >= 0 && inputRect.bottom <= window.innerHeight : false,
    pacVisible: Boolean(visiblePac),
    pacAligned:
      pacRect && inputRect
        ? Math.abs(pacRect.top - inputRect.bottom) < 80 && Math.abs(pacRect.left - inputRect.left) < 30
        : false,
  }
})

assert(pacState.bound, 'Autocomplete instance still bound after failed submit')
assert(pacState.inputInViewport, 'Location input scrolled into view after validation')
assert(pacState.pacVisible, 'Google suggestions visible after failed submit')
assert(pacState.pacAligned, 'Suggestions positioned below location input')
logPass('Suggestions appear after failed submit')

await loc.press('ArrowDown')
await page.waitForTimeout(200)
await loc.press('Enter')
await page.waitForTimeout(500)

const afterSelect = await page.evaluate(() => ({
  value: document.getElementById('listing-location')?.value ?? '',
  errorCount: document.querySelectorAll('.listing-form__message--error').length,
}))

assert(afterSelect.value.length > 0, 'Selected place written to location input')
assert(afterSelect.errorCount === 0, 'Validation error cleared after place selected')
logPass('Selecting a place clears validation error')

await browser.close()
console.log('\nAll Create Listing Places regression checks passed.')
