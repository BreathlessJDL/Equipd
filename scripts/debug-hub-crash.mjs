#!/usr/bin/env node
import { chromium } from 'playwright-core'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const baseUrl = process.argv[2] ?? 'http://localhost:5176/'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const DEV_EMAIL = 'dev-seller-leeds@equipd.dev'

const HUB_PATHS = [
  '/hub',
  '/hub?section=summary',
  '/hub?section=selling&tab=offers',
  '/hub?section=selling&tab=awaiting_payment',
  '/hub?section=buying&tab=offers',
  '/hub?section=orders&tab=purchases',
  '/hub?section=reviews&tab=received',
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

if (error) throw new Error(`Login failed: ${error.message}`)

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
const consoleErrors = []
const pageErrors = []

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => pageErrors.push(`${err.message}\n${err.stack ?? ''}`))

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  console.log(`\n######## ${viewport.name.toUpperCase()} ########`)
  await page.setViewportSize({ width: viewport.width, height: viewport.height })

  for (const hubPath of HUB_PATHS) {
  consoleErrors.length = 0
  pageErrors.length = 0

  await page.goto(`${baseUrl.replace(/\/$/, '')}${hubPath}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const title = await page.title()
  const hubVisible = await page.locator('.hub-page').count()
  const errorBoundary = await page.locator('text=Something went wrong').count()
  const viteOverlay = await page.locator('vite-error-overlay').count()
  const loading = await page.locator('text=Loading your buyer and seller activity').count()
  const hubTitle = await page.locator('.hub-page__title').count()
  const mainText = await page.locator('.hub-dashboard__main').innerText().catch(() => '')

  console.log(`\n=== ${hubPath} ===`)
  console.log(`  title: ${title}`)
  console.log(`  hub-page elements: ${hubVisible}`)
  console.log(`  hub title visible: ${hubTitle}`)
  console.log(`  still loading: ${loading}`)
  console.log(`  error boundary: ${errorBoundary}`)
  console.log(`  vite overlay: ${viteOverlay}`)
  console.log(`  main preview: ${mainText.slice(0, 80).replace(/\s+/g, ' ')}`)

  if (pageErrors.length) {
    console.log('  PAGE ERRORS:')
    for (const e of pageErrors) console.log(`    ${e.split('\n')[0]}`)
    if (pageErrors[0]) console.log(`  STACK:\n${pageErrors[0]}`)
  }
  if (consoleErrors.length) {
    console.log('  CONSOLE ERRORS:')
    for (const e of consoleErrors) console.log(`    ${e}`)
  }
  }
}

await browser.close()
