#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.argv[2] ?? 'http://localhost:5176/'

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

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

if (supabaseUrl && anonKey) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await client.auth.signInWithPassword({
    email: 'dev-seller-leeds@equipd.dev',
    password: 'EquipdDevSeed123!',
  })
  if (data?.session) {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    const storageKey = `sb-${projectRef}-auth-token`
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
  }
}

await page.goto(new URL('/hub', baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForSelector('.hub-summary-card--buying', { timeout: 30000 })

const report = await page.evaluate(() => {
  const card = document.querySelector('.hub-summary-card--buying')
  const iconWrap = card?.querySelector('.hub-summary-card__feature-icon')
  const img = card?.querySelector('.hub-scoped-png-icon__image')
  const ordersIcon = document.querySelector('.hub-transaction-action .hub-scoped-png-icon')

  function styles(el) {
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      className: el.className,
      width: cs.width,
      height: cs.height,
      maxWidth: cs.maxWidth,
      maxHeight: cs.maxHeight,
    }
  }

  return {
    cardClass: card?.className ?? null,
    iconWrap: styles(iconWrap),
    img: styles(img),
    ordersIcon: styles(ordersIcon),
    iconWrapHTML: iconWrap?.outerHTML?.slice(0, 200) ?? null,
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
