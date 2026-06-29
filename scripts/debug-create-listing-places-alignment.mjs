#!/usr/bin/env node
/** Detect if PAC renders far from input after validation error (visual mismatch). */

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

async function fillAndSubmit() {
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
}

await fillAndSubmit()

// User manually scrolls to location WITHOUT Playwright auto-scroll on click
await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  input?.scrollIntoView({ block: 'center', behavior: 'auto' })
})
await page.waitForTimeout(300)

const loc = page.locator('#listing-location')
await page.evaluate(() => document.getElementById('listing-location')?.focus())
await page.keyboard.type('Leeds', { delay: 80 })
await page.waitForTimeout(2000)

const alignment = await page.evaluate(() => {
  const input = document.getElementById('listing-location')
  const inputRect = input?.getBoundingClientRect()
  const visiblePac = [...document.querySelectorAll('.pac-container')].find((c) => {
    const r = c.getBoundingClientRect()
    return getComputedStyle(c).display !== 'none' && r.width > 0 && c.childElementCount > 0
  })
  const pacRect = visiblePac?.getBoundingClientRect()
  return {
    input: inputRect ? { top: inputRect.top, bottom: inputRect.bottom, left: inputRect.left } : null,
    pac: pacRect ? { top: pacRect.top, bottom: pacRect.bottom, left: pacRect.left } : null,
    aligned:
      pacRect && inputRect
        ? Math.abs(pacRect.top - inputRect.bottom) < 60 && Math.abs(pacRect.left - inputRect.left) < 20
        : false,
    pacInViewport:
      pacRect && pacRect.top >= 0 && pacRect.bottom <= window.innerHeight && pacRect.width > 0,
    pacVisible: Boolean(visiblePac),
  }
})

console.log('PAC alignment after manual scroll + focus + type:', alignment)
await browser.close()
if (!alignment.pacVisible || !alignment.pacInViewport || !alignment.aligned) process.exitCode = 2
