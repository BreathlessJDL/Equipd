#!/usr/bin/env node
/**
 * Measure rendered notification icon dimensions (SVG vs PNG).
 * Run: node scripts/measure-notification-icon-sizes.mjs [baseUrl]
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const baseUrl = process.argv[2] ?? 'http://localhost:4179/'
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

function measureElement(el) {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return {
    rect: {
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
    },
    cssWidth: cs.width,
    cssHeight: cs.height,
    maxWidth: cs.maxWidth,
    maxHeight: cs.maxHeight,
  }
}

loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await client.auth.signInWithPassword({
  email: DEV_EMAIL,
  password: DEV_PASSWORD,
})
if (error) throw new Error(`Dev login failed: ${error.message}`)

const storageKey = getStorageKey(supabaseUrl)
const sessionPayload = {
  access_token: data.session.access_token,
  refresh_token: data.session.refresh_token,
  expires_at: data.session.expires_at,
  expires_in: data.session.expires_in,
  token_type: data.session.token_type,
  user: data.session.user,
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext()
await context.addInitScript(
  ({ key, value }) => {
    localStorage.setItem(key, value)
  },
  { key: storageKey, value: JSON.stringify(sessionPayload) },
)

async function measureViewport(page, label) {
  await page.goto(new URL('/notifications', baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await page.waitForSelector('.notification-card', { timeout: 20000 })
  await page.waitForTimeout(600)

  const report = await page.evaluate(() => {
    function measureElement(el) {
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        rect: {
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        cssWidth: cs.width,
        cssHeight: cs.height,
        maxWidth: cs.maxWidth,
        maxHeight: cs.maxHeight,
      }
    }

    const cards = [...document.querySelectorAll('.notification-card')]
    const rows = []

    for (const card of cards) {
      const title = card.querySelector('.notification-card__title')?.textContent?.trim() ?? ''
      const pngWrapper = card.querySelector('.notification-scoped-png-icon')
      const svgWrapper = card.querySelector('.equipd-type-icon')

      if (pngWrapper) {
        rows.push({
          title,
          kind: 'png',
          wrapper: measureElement(pngWrapper),
          artwork: measureElement(pngWrapper.querySelector('.notification-scoped-png-icon__image')),
          wrapperClass: pngWrapper.className,
        })
      } else if (svgWrapper) {
        rows.push({
          title,
          kind: 'svg',
          wrapper: measureElement(svgWrapper),
          artwork: measureElement(svgWrapper.querySelector('.equipd-type-icon__svg')),
          wrapperClass: svgWrapper.className,
        })
      }
    }

    return rows
  })

  console.log(`\n=== ${label} ===`)
  for (const row of report) {
    console.log(JSON.stringify(row, null, 2))
  }

  return report
}

const desktop = await context.newPage()
await desktop.setViewportSize({ width: 1280, height: 900 })
const desktopReport = await measureViewport(desktop, 'Desktop')

const mobile = await context.newPage()
await mobile.setViewportSize({ width: 390, height: 844 })
const mobileReport = await measureViewport(mobile, 'Mobile')

const svgDesktop = desktopReport.filter((r) => r.kind === 'svg')
const pngDesktop = desktopReport.filter((r) => r.kind === 'png')
const svgMobile = mobileReport.filter((r) => r.kind === 'svg')
const pngMobile = mobileReport.filter((r) => r.kind === 'png')

function avgArtwork(rows) {
  const sizes = rows.map((r) => r.artwork?.rect?.width).filter(Boolean)
  if (!sizes.length) return null
  return Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 100) / 100
}

console.log('\n=== Summary ===')
console.log('Desktop SVG artwork avg width:', avgArtwork(svgDesktop), 'px')
console.log('Desktop PNG artwork avg width:', avgArtwork(pngDesktop), 'px')
console.log('Mobile SVG artwork avg width:', avgArtwork(svgMobile), 'px')
console.log('Mobile PNG artwork avg width:', avgArtwork(pngMobile), 'px')

if (svgDesktop[0]?.wrapper) {
  console.log('Desktop wrapper:', svgDesktop[0].wrapper.rect)
}
if (svgMobile[0]?.wrapper) {
  console.log('Mobile wrapper:', svgMobile[0].wrapper.rect)
}

await browser.close()
