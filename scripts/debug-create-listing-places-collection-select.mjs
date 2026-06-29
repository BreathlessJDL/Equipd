#!/usr/bin/env node
/** Test flow: select collection address from Places, then fail submit on location, then retry location. */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.argv[2] ?? 'https://equipd.co.uk/'

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

loadEnvFile('.env.local')
const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
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
const page = await context.newPage()
await page.goto(new URL('/listings/new', baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => Boolean(window.google?.maps?.places))

await page.locator('#listing-title').fill('Test listing title')
await page.locator('#listing-description').fill('Test description long enough for validation.')
await page.locator('#listing-category').selectOption({ index: 1 })
await page.waitForSelector('#listing-condition')
await page.locator('#listing-condition').selectOption({ index: 1 })
await page.locator('#listing-price').fill('100')
await page.locator('input[value="collection"]').check()

const collection = page.locator('#listing-collection-address')
await collection.click()
await collection.pressSequentially('12 Stonegate Road, Leeds', { delay: 50 })
await page.waitForTimeout(1500)
await page.locator('.pac-container .pac-item').first().click()
await page.waitForTimeout(500)

const afterCollectionSelect = await page.evaluate(() => ({
  collection: document.getElementById('listing-collection-address')?.value,
  location: document.getElementById('listing-location')?.value,
  locationBound: Boolean(document.getElementById('listing-location')?._equipdPlacesAutocomplete),
}))
console.log('After collection Places select:', afterCollectionSelect)

// Clear auto-filled location to simulate user clearing it or validation still failing
await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  if (input) input.value = ''
})

await page.locator('#listing-collection-phone').fill('07123456789')
await page.locator('input[type="file"]').first().setInputFiles({
  name: 'test.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
})

await page.locator('button.listing-form__button--primary[type="submit"]').click()
await page.waitForTimeout(1500)

const loc = page.locator('#listing-location')
await loc.scrollIntoViewIfNeeded()
await loc.click()
await loc.pressSequentially('Leeds', { delay: 80 })
await page.waitForTimeout(2000)

const after = await page.evaluate(() => {
  const containers = [...document.querySelectorAll('.pac-container')]
  return {
    locationValue: document.getElementById('listing-location')?.value,
    bound: Boolean(document.getElementById('listing-location')?._equipdPlacesAutocomplete),
    pacVisible: containers.some(
      (c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0 && c.childElementCount > 0,
    ),
    pacCount: containers.length,
  }
})
console.log('After error + retype location:', after)

await browser.close()
if (!after.pacVisible) process.exitCode = 2
