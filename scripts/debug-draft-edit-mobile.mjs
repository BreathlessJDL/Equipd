#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

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
const { data: auth } = await client.auth.signInWithPassword({
  email: 'dev-seller-leeds@equipd.dev',
  password: 'EquipdDevSeed123!',
})

const { data: draft } = await client
  .from('listings')
  .select('slug')
  .eq('status', 'draft')
  .limit(1)
  .maybeSingle()

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
await context.addInitScript(
  ({ key, value }) => localStorage.setItem(key, value),
  {
    key: storageKey,
    value: JSON.stringify({
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
      expires_at: auth.session.expires_at,
      expires_in: auth.session.expires_in,
      token_type: auth.session.token_type,
      user: auth.session.user,
    }),
  },
)

const page = await context.newPage()
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5178'
await page.goto(`${baseUrl}/listings/${draft.slug}/edit`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})

const actionSelector = '.listing-form-page__actions-bar button, .listing-form-page__actions-bar a'

const viewportButtons = await page.evaluate((selector) => {
  const vh = window.innerHeight
  return [...document.querySelectorAll(selector)].map((el) => {
    const r = el.getBoundingClientRect()
    return {
      text: el.textContent?.trim(),
      inViewport: r.top >= 0 && r.bottom <= vh,
      top: r.top,
      bottom: r.bottom,
    }
  })
}, actionSelector)

console.log('Mobile viewport buttons (initial load, not scrolled):')
console.log(JSON.stringify(viewportButtons, null, 2))

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(500)

const scrolled = await page.evaluate((selector) => {
  const vh = window.innerHeight
  return [...document.querySelectorAll(selector)].map((el) => {
    const r = el.getBoundingClientRect()
    return {
      text: el.textContent?.trim(),
      inViewport: r.top >= 0 && r.bottom <= vh,
    }
  })
}, actionSelector)

console.log('\nAfter scroll to bottom:')
console.log(JSON.stringify(scrolled, null, 2))

await browser.close()
