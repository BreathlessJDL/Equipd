#!/usr/bin/env node
/** Additional scenario: after failed submit, append keystroke without clearing existing text. */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.argv[2] ?? 'http://localhost:5178/'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const DEV_EMAIL = 'dev-seller-leeds@equipd.dev'

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

function pacState(page, inputId) {
  return page.evaluate((id) => {
    const input = document.getElementById(id)
    const containers = [...document.querySelectorAll('.pac-container')].map((c) => ({
      display: getComputedStyle(c).display,
      width: c.getBoundingClientRect().width,
      items: c.childElementCount,
      hidden: c.classList.contains('equipd-pac-hidden'),
    }))
    return {
      inputValue: input?.value,
      bound: Boolean(input?._equipdPlacesAutocomplete),
      containers,
      visible: containers.some((c) => c.display !== 'none' && c.width > 0 && c.items > 0),
    }
  }, inputId)
}

loadEnvFile('.env.local')
const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
const { data, error } = await client.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD })
if (error) throw error

const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
const sessionPayload = JSON.stringify({
  access_token: data.session.access_token,
  refresh_token: data.session.refresh_token,
  expires_at: data.session.expires_at,
  expires_in: data.session.expires_in,
  token_type: data.session.token_type,
  user: data.session.user,
})

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext()
await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
  key: storageKey,
  value: sessionPayload,
})
const page = await context.newPage()
await page.goto(new URL('/listings/new', baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => Boolean(window.google?.maps?.places))

const loc = page.locator('#listing-location')
await loc.click()
await loc.pressSequentially('Leed', { delay: 60 })
await page.waitForTimeout(1200)
console.log('Before submit typing:', await pacState(page, 'listing-location'))

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
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
})

await page.locator('button.listing-form__button--primary[type="submit"]').click()
await page.waitForTimeout(1500)

await loc.scrollIntoViewIfNeeded()
console.log('After error (existing Leed text):', await pacState(page, 'listing-location'))

await loc.click()
await page.waitForTimeout(800)
console.log('After click only:', await pacState(page, 'listing-location'))

await loc.press('s')
await page.waitForTimeout(1500)
console.log('After append s (Leeds):', await pacState(page, 'listing-location'))

await loc.fill('')
await loc.pressSequentially('Leeds', { delay: 60 })
await page.waitForTimeout(1500)
console.log('After clear+retype:', await pacState(page, 'listing-location'))

await browser.close()
