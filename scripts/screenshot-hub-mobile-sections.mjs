import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const outDir = path.join(ROOT, 'debug-screenshots', 'hub-mobile')
const baseUrl = process.argv[2] ?? 'http://localhost:5176/'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const DEV_EMAIL = 'dev-seller-leeds@equipd.dev'

const SECTIONS = [
  { id: 'buying', path: '/hub?section=buying&tab=offers', label: 'buying-offers' },
  { id: 'buying', path: '/hub?section=buying&tab=awaiting_payment', label: 'buying-awaiting-payment' },
  { id: 'selling', path: '/hub?section=selling&tab=offers', label: 'selling-offers' },
  { id: 'selling', path: '/hub?section=selling&tab=active', label: 'selling-active' },
  { id: 'orders', path: '/hub?section=orders&tab=purchases&subTab=in_progress', label: 'orders-purchases' },
  { id: 'orders', path: '/hub?section=orders&tab=sales&subTab=in_progress', label: 'orders-sales' },
  { id: 'listings', path: '/hub?section=listings&tab=active', label: 'listings-active' },
  { id: 'saved', path: '/hub?section=saved', label: 'saved' },
  { id: 'reviews', path: '/hub?section=reviews&tab=received', label: 'reviews-received' },
  { id: 'offers', path: '/hub?section=offers', label: 'my-offers' },
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

function getStorageKey(supabaseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

async function createAuthenticatedContext(browser, supabaseUrl, anonKey) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  })

  if (error) {
    throw new Error(`Dev login failed: ${error.message}`)
  }

  const storageKey = getStorageKey(supabaseUrl)
  const sessionPayload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })

  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(sessionPayload) },
  )

  return context
}

await mkdir(outDir, { recursive: true })
loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase env vars — cannot authenticate for Hub screenshots')
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'msedge' })
const context = await createAuthenticatedContext(browser, supabaseUrl, anonKey)
const page = await context.newPage()

for (const section of SECTIONS) {
  await page.goto(new URL(section.path, baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await page.waitForSelector('.hub-dashboard', { timeout: 20000 })
  await page.waitForTimeout(600)
  await page.screenshot({
    path: path.join(outDir, `hub-mobile-${section.label}.png`),
    fullPage: true,
  })
  console.log(`Saved hub-mobile-${section.label}.png`)
}

await browser.close()
console.log(`\nScreenshots saved to ${outDir}`)
