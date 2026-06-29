#!/usr/bin/env node
/**
 * Hub summary icon sizing screenshots.
 * Run: node scripts/screenshot-hub-icon-sizing.mjs [baseUrl]
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const outDir = path.join(ROOT, 'debug-screenshots')
const baseUrl = process.argv[2] ?? 'http://localhost:5176/'
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

  const context = await browser.newContext()
  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(sessionPayload) },
  )

  return context
}

async function captureHubSummary(page, filename) {
  await page.goto(new URL('/hub', baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await page.waitForSelector('.hub-summary-panel__body', { timeout: 20000 })
  await page.waitForTimeout(600)
  const panel = page.locator('.hub-summary-panel__body').first()
  await panel.screenshot({ path: path.join(outDir, filename) })
}

loadEnvFile('.env.local')
await mkdir(outDir, { recursive: true })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase env vars — cannot authenticate for Hub screenshots')
  process.exit(1)
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await createAuthenticatedContext(browser, supabaseUrl, anonKey)

const desktop = await context.newPage()
await desktop.setViewportSize({ width: 1280, height: 900 })
await captureHubSummary(desktop, 'hub-icons-desktop-summary.png')

const mobile = await context.newPage()
await mobile.setViewportSize({ width: 390, height: 844 })
await captureHubSummary(mobile, 'hub-icons-mobile-summary.png')

await browser.close()
console.log('Saved debug-screenshots/hub-icons-desktop-summary.png')
console.log('Saved debug-screenshots/hub-icons-mobile-summary.png')
