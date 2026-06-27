#!/usr/bin/env node
/**
 * Verify Hub sections render (local preview or production).
 * Usage: node scripts/verify-hub-production.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const baseUrl = process.argv[2] ?? 'https://equipd.co.uk/'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const DEV_EMAIL = 'dev-seller-leeds@equipd.dev'

const HUB_PATHS = [
  { path: '/hub', label: 'Summary (default)' },
  { path: '/hub?section=summary', label: 'Summary' },
  { path: '/hub?section=buying&tab=offers', label: 'Buying' },
  { path: '/hub?section=buying&tab=awaiting_payment', label: 'Buying awaiting payment' },
  { path: '/hub?section=selling&tab=offers', label: 'Selling offers' },
  { path: '/hub?section=selling&tab=awaiting_payment', label: 'Selling awaiting payment' },
  { path: '/hub?section=selling&tab=active', label: 'Selling active' },
  { path: '/hub?section=listings&tab=active', label: 'Listings' },
  { path: '/hub?section=offers', label: 'My offers' },
  { path: '/hub?section=orders&tab=purchases&subTab=in_progress', label: 'Orders purchases' },
  { path: '/hub?section=orders&tab=sales&subTab=in_progress', label: 'Orders sales' },
  { path: '/hub?section=saved', label: 'Saved listings' },
  { path: '/hub?section=reviews&tab=received', label: 'Reviews' },
]

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

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

function getStorageKey(url) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await client.auth.signInWithPassword({
  email: DEV_EMAIL,
  password: DEV_PASSWORD,
})

if (error) {
  console.error(`Login failed for ${DEV_EMAIL}: ${error.message}`)
  process.exit(1)
}

const storageKey = getStorageKey(supabaseUrl)
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
await context.addInitScript(
  ({ key, value }) => localStorage.setItem(key, value),
  { key: storageKey, value: sessionPayload },
)

const page = await context.newPage()
const failures = []

for (const viewport of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  console.log(`\n=== ${viewport.name.toUpperCase()} @ ${baseUrl} ===`)

  for (const { path: hubPath, label } of HUB_PATHS) {
    const pageErrors = []
    const consoleErrors = []
    page.removeAllListeners('pageerror')
    page.removeAllListeners('console')
    page.on('pageerror', (err) => pageErrors.push(err))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(`${baseUrl.replace(/\/$/, '')}${hubPath}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    await page.waitForTimeout(2000)

    const hubVisible = (await page.locator('.hub-page').count()) > 0
    const boundaryVisible = (await page.locator('text=My Hub could not load').count()) > 0
    const loading = (await page.locator('text=Loading your buyer and seller activity').count()) > 0
    const blankMain =
      hubVisible &&
      !loading &&
      !boundaryVisible &&
      ((await page.locator('.hub-dashboard__main').innerText().catch(() => '')).trim().length === 0)

    const ok = hubVisible && !boundaryVisible && !loading && !blankMain && pageErrors.length === 0
    const status = ok ? 'PASS' : 'FAIL'
    console.log(`${status}: ${label}`)

    if (!ok) {
      failures.push({ viewport: viewport.name, label, hubPath, pageErrors, consoleErrors, boundaryVisible, blankMain, loading })
      if (pageErrors[0]) console.log(`  pageerror: ${pageErrors[0].message}`)
      if (boundaryVisible) console.log('  HubErrorBoundary fallback shown')
      if (blankMain) console.log('  main content blank')
      if (loading) console.log('  stuck on loading')
    }
  }
}

await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} Hub section check(s) failed.`)
  process.exit(1)
}

console.log('\nAll Hub section checks passed.')
