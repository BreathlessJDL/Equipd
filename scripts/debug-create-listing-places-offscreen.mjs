#!/usr/bin/env node
/** Test typing while location input is off-screen after validation error. */

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
await page.locator('input[value="seller_delivery"]').check()
await page.locator('#listing-delivery-range').fill('10')
await page.locator('input[type="file"]').first().setInputFiles({
  name: 'test.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
})

await page.locator('button.listing-form__button--primary[type="submit"]').click()
await page.waitForTimeout(1500)

const stateOffScreen = await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  const rect = input?.getBoundingClientRect()
  return { inputTop: rect?.top, scrollY: window.scrollY }
})
console.log('After error (no scroll):', stateOffScreen)

const loc = page.locator('#listing-location')
await loc.click()
await loc.pressSequentially('Leeds', { delay: 80 })
await page.waitForTimeout(2000)

const pac = await page.evaluate(() => {
  const containers = [...document.querySelectorAll('.pac-container')]
  return {
    inputTop: document.getElementById('listing-location')?.getBoundingClientRect().top,
    pacCount: containers.length,
    visible: containers.some((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0 && c.childElementCount > 0),
    pacTops: containers.map((c) => c.getBoundingClientRect().top),
  }
})
console.log('Typed while off-screen (seller_delivery only):', pac)

await browser.close()
if (!pac.visible) process.exitCode = 2
