#!/usr/bin/env node
/** Type into location while still off-screen after validation error (no scrollIntoView). */

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
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
})
await page.locator('button.listing-form__button--primary[type="submit"]').click()
await page.waitForTimeout(1500)

const beforeType = await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  const r = input?.getBoundingClientRect()
  return { inputTop: r?.top, scrollY: window.scrollY }
})
console.log('Before type (no scroll):', beforeType)

// Focus without scrollIntoViewIfNeeded - use JS focus only
await page.evaluate(() => document.getElementById('listing-location')?.focus())
await page.keyboard.type('Leeds', { delay: 80 })
await page.waitForTimeout(2000)

const afterType = await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  const inputRect = input?.getBoundingClientRect()
  const containers = [...document.querySelectorAll('.pac-container')].map((c) => {
    const r = c.getBoundingClientRect()
    const cs = getComputedStyle(c)
    return {
      display: cs.display,
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      items: c.childElementCount,
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0,
    }
  })
  const visibleInViewport = containers.some((c) => c.display !== 'none' && c.inViewport && c.items > 0)
  const visibleAnywhere = containers.some((c) => c.display !== 'none' && c.width > 0 && c.items > 0)
  return { inputTop: inputRect?.top, containers, visibleInViewport, visibleAnywhere, inputValue: input?.value }
})

console.log('After type off-screen:', JSON.stringify(afterType, null, 2))
await browser.close()
if (!afterType.visibleInViewport && afterType.visibleAnywhere) {
  console.log('\nROOT CAUSE SIGNAL: PAC exists but renders off-screen / wrong position')
  process.exitCode = 2
} else if (!afterType.visibleAnywhere) {
  console.log('\nROOT CAUSE SIGNAL: PAC not created/visible at all')
  process.exitCode = 2
}
