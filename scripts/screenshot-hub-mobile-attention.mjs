import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const outDir = path.join(ROOT, 'reports', 'hub-mobile-attention')
const baseUrl = process.argv[2] ?? 'http://localhost:5175/'
const label = process.argv[3] ?? 'after'
const DEV_EMAIL = process.env.HUB_SCREENSHOT_EMAIL ?? 'dev-seller-leeds@equipd.dev'
const DEV_PASSWORD = process.env.HUB_SCREENSHOT_PASSWORD ?? 'EquipdDevSeed123!'
const WIDTHS = [375, 390, 430]

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

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
  })
  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(sessionPayload) },
  )

  const page = await context.newPage()
  await page.goto(new URL('/hub', baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await page.waitForSelector('.hub-dashboard', { timeout: 20000 })
  const acceptCookies = page.getByRole('button', { name: /Accept all/i })
  if (await acceptCookies.count()) {
    await acceptCookies.click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(500)

  const fileName = `${label}-${width}.png`
  await page.screenshot({
    path: path.join(outDir, fileName),
    fullPage: false,
  })
  console.log(`Saved ${fileName}`)
  await context.close()
}

const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await desktop.addInitScript(
  ({ key, value }) => {
    localStorage.setItem(key, value)
  },
  { key: storageKey, value: JSON.stringify(sessionPayload) },
)
const desktopPage = await desktop.newPage()
await desktopPage.goto(new URL('/hub', baseUrl).href, {
  waitUntil: 'networkidle',
  timeout: 45000,
})
await desktopPage.waitForSelector('.hub-dashboard', { timeout: 20000 })
const desktopCookies = desktopPage.getByRole('button', { name: /Accept all/i })
if (await desktopCookies.count()) {
  await desktopCookies.click()
  await desktopPage.waitForTimeout(200)
}
await desktopPage.waitForTimeout(500)
await desktopPage.screenshot({
  path: path.join(outDir, `${label}-desktop-1280.png`),
  fullPage: false,
})
console.log(`Saved ${label}-desktop-1280.png`)
await desktop.close()

if (label === 'after') {
  const fixture = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await fixture.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(sessionPayload) },
  )
  const fixturePage = await fixture.newPage()
  await fixturePage.goto(new URL('/hub', baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await fixturePage.waitForSelector('.hub-mobile-marketplace', { timeout: 20000 })
  const fixtureCookies = fixturePage.getByRole('button', { name: /Accept all/i })
  if (await fixtureCookies.count()) {
    await fixtureCookies.click()
    await fixturePage.waitForTimeout(200)
  }

  const metrics = await fixturePage.evaluate(() => {
    const summary = document.querySelector('.hub-mobile-summary')
    if (!summary) return { error: 'missing summary' }

    document.querySelector('.hub-mobile-attention')?.remove()

    const section = document.createElement('section')
    section.className = 'hub-mobile-attention'
    section.innerHTML = `
      <header class="hub-mobile-attention__header">
        <h2 id="hub-mobile-attention-title" class="hub-mobile-attention__title">Needs your attention</h2>
        <p class="hub-mobile-attention__subtitle">Your next steps on Equipd</p>
      </header>
      <ul class="hub-mobile-attention__list">
        <li>
          <button type="button" class="hub-mobile-attention__row hub-mobile-attention__row--action" data-hub-attention-row="buyer-pay">
            <span class="equipd-type-icon hub-mobile-attention__icon" aria-hidden="true"></span>
            <span class="hub-mobile-attention__body">
              <span class="hub-mobile-attention__title-row">
                <span class="hub-mobile-attention__label">Payment needed</span>
                <span class="hub-mobile-attention__count">1</span>
              </span>
              <span class="hub-mobile-attention__description">1 accepted offer waiting for your payment.</span>
            </span>
            <span class="hub-attention__chevron" aria-hidden="true">›</span>
          </button>
        </li>
        <li>
          <button type="button" class="hub-mobile-attention__row hub-mobile-attention__row--info" data-hub-attention-row="seller-awaiting-pay">
            <span class="equipd-type-icon hub-mobile-attention__icon" aria-hidden="true"></span>
            <span class="hub-mobile-attention__body">
              <span class="hub-mobile-attention__title-row">
                <span class="hub-mobile-attention__label">Waiting for payment with a very long compact title that should ellipsis</span>
                <span class="hub-mobile-attention__count">128</span>
              </span>
              <span class="hub-mobile-attention__description">128 buyers still need to complete checkout.</span>
            </span>
            <span class="hub-attention__chevron" aria-hidden="true">›</span>
          </button>
        </li>
        <li>
          <button type="button" class="hub-mobile-attention__row hub-mobile-attention__row--urgent" data-hub-attention-row="disputes">
            <span class="equipd-type-icon hub-mobile-attention__icon" aria-hidden="true"></span>
            <span class="hub-mobile-attention__body">
              <span class="hub-mobile-attention__title-row">
                <span class="hub-mobile-attention__label">Open disputes</span>
                <span class="hub-mobile-attention__count">2</span>
              </span>
              <span class="hub-mobile-attention__description">2 open disputes need your attention.</span>
            </span>
            <span class="hub-attention__chevron" aria-hidden="true">›</span>
          </button>
        </li>
      </ul>
    `
    summary.prepend(section)

    const rows = [...document.querySelectorAll('.hub-mobile-attention__row')]
    return {
      count: rows.length,
      heights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
    }
  })

  await fixturePage.screenshot({
    path: path.join(outDir, 'after-populated-390.png'),
    fullPage: false,
  })
  console.log('Saved after-populated-390.png', JSON.stringify(metrics))

  const oneItem = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await oneItem.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(sessionPayload) },
  )
  const onePage = await oneItem.newPage()
  await onePage.goto(new URL('/hub', baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await onePage.waitForSelector('.hub-mobile-marketplace', { timeout: 20000 })
  const oneCookies = onePage.getByRole('button', { name: /Accept all/i })
  if (await oneCookies.count()) {
    await oneCookies.click()
    await onePage.waitForTimeout(200)
  }
  await onePage.evaluate(() => {
    const summary = document.querySelector('.hub-mobile-summary')
    document.querySelector('.hub-mobile-attention')?.remove()
    const section = document.createElement('section')
    section.className = 'hub-mobile-attention'
    section.innerHTML = `
      <header class="hub-mobile-attention__header">
        <h2 class="hub-mobile-attention__title">Needs your attention</h2>
        <p class="hub-mobile-attention__subtitle">Your next steps on Equipd</p>
      </header>
      <ul class="hub-mobile-attention__list">
        <li>
          <button type="button" class="hub-mobile-attention__row hub-mobile-attention__row--action">
            <span class="equipd-type-icon hub-mobile-attention__icon" aria-hidden="true"></span>
            <span class="hub-mobile-attention__body">
              <span class="hub-mobile-attention__title-row">
                <span class="hub-mobile-attention__label">Leave a review</span>
                <span class="hub-mobile-attention__count">1</span>
              </span>
              <span class="hub-mobile-attention__description">Leave a review for completed orders.</span>
            </span>
            <span class="hub-attention__chevron" aria-hidden="true">›</span>
          </button>
        </li>
      </ul>
    `
    summary.prepend(section)
  })
  await onePage.screenshot({
    path: path.join(outDir, 'after-one-item-390.png'),
    fullPage: false,
  })
  console.log('Saved after-one-item-390.png')
  await oneItem.close()
  await fixture.close()
}

await browser.close()
console.log(`Screenshots saved to ${outDir}`)
