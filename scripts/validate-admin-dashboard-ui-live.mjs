#!/usr/bin/env node
/**
 * Production UI check for /admin user statistics.
 * Creates a temporary admin, verifies layout, then deletes the user.
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright-core'
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'

loadEnvFiles()

const origin = (process.argv[2] || 'https://equipd.co.uk').replace(/\/$/, '')
const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ADMIN_TEST_EMAIL?.trim()

if (!url || !anonKey || !serviceKey || !adminEmail) {
  console.error('Missing env')
  process.exit(1)
}

function plusAddress(baseEmail, tag) {
  const at = baseEmail.indexOf('@')
  return `${baseEmail.slice(0, at)}+${tag}@${baseEmail.slice(at + 1)}`
}

async function waitForDeploy() {
  const started = Date.now()
  while (Date.now() - started < 300000) {
    const html = await fetch(`${origin}/`).then((res) => res.text())
    const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/)
    if (scriptMatch) {
      const js = await fetch(`${origin}${scriptMatch[1]}`).then((res) => res.text())
      if (js.includes('AdminDashboardPage') || js.includes('admin_user_statistics')) {
        return scriptMatch[1]
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 8000))
  }
  throw new Error('production_deploy_not_detected')
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tag = randomUUID().slice(0, 8)
const email = plusAddress(adminEmail, `stats-ui-${tag}`)
const password = `EquipdLive_${tag}!A`
const username = `statsui_${tag}`
let userId = null

try {
  const bundle = await waitForDeploy()
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) throw created.error
  userId = created.data.user.id
  await service.from('profiles').upsert({
    id: userId,
    username,
    display_name: username,
    is_admin: true,
  })

  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const results = {}

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport })
    await page.goto(`${origin}/login?redirect=${encodeURIComponent('/admin')}`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
    if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})

    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill(password)
    await page.locator('.auth-form__button').first().click()
    await page.waitForURL(/\/admin/, { timeout: 45000 }).catch(() => {})
    await page.goto(`${origin}/admin`, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForSelector('.admin-intelligence__title, .page-stub__title', { timeout: 30000 })

    const state = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.admin-intelligence__stat')].map((el) => ({
        label: el.querySelector('span')?.textContent?.trim() || '',
        value: el.querySelector('strong')?.textContent?.trim() || '',
        overflowX: el.scrollWidth > el.clientWidth + 1,
      }))
      const rows = [...document.querySelectorAll('.admin-dashboard__table tbody tr')].map((row) => {
        const cells = [...row.querySelectorAll('td')].map((td) => td.textContent.trim())
        return { user: cells[0] || '', emailPresent: Boolean(cells[1] && cells[1].includes('@')), joined: cells[2] || '' }
      })
      const statsWrap = document.querySelector('.admin-intelligence__stats')
      return {
        title: document.querySelector('.admin-intelligence__title')?.textContent?.trim() || '',
        hubNav: [...document.querySelectorAll('.admin-hub-nav__link')].map((el) => el.textContent.trim()),
        tools: [...document.querySelectorAll('.admin-hub-tool__label')].map((el) => el.textContent.trim()),
        heading: document.querySelector('#admin-user-stats-heading')?.textContent?.trim() || '',
        bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 8,
        statsOverflow: statsWrap ? statsWrap.scrollWidth > statsWrap.clientWidth + 8 : true,
        cards,
        rowCount: rows.length,
        firstJoined: rows[0]?.joined || '',
        emailsPresent: rows.length > 0 && rows.every((row) => row.emailPresent),
        londonJoined: rows.some((row) => /Today, |[A-Z][a-z]{2} \d{4},/.test(row.joined) || /\d{1,2} [A-Z][a-z]{2} \d{4},/.test(row.joined)),
      }
    })

    const labels = state.cards.map((card) => card.label)
    results[viewport.name] = {
      ...state,
      expectedCards: ['Total users', 'New today', 'Last 7 days', 'Last 30 days', 'Users who have listed'].every(
        (label) => labels.includes(label),
      ),
      noCardOverflow: state.cards.every((card) => !card.overflowX),
    }
    await page.close()
  }

  const regression = {}
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${origin}/login?redirect=${encodeURIComponent('/admin')}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('.auth-form__button').first().click()
  await page.waitForURL(/\/admin/, { timeout: 45000 }).catch(() => {})

  for (const [name, path, selector] of [
    ['cases', '/admin/cases', '.admin-cases, .admin-cases__title, h1'],
    ['orders', '/admin/orders', '.admin-orders, .admin-orders__title, h1'],
    ['catalogue', '/admin/intelligence/products', '.admin-products, .equipment-catalogue-nav, h1'],
  ]) {
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector(selector, { timeout: 30000 })
    regression[name] = await page.locator(selector).first().isVisible()
  }

  await browser.close()

  const failed = Object.values(results).some(
    (row) =>
      row.title !== 'Equipd Admin' ||
      !row.expectedCards ||
      !['Dashboard', 'Cases', 'Support', 'Orders', 'Catalogue', 'Price Guide'].every((label) => row.hubNav.includes(label)) ||
      !['Cases', 'Support', 'Orders', 'Catalogue', 'Price Guide'].every((label) => row.tools.includes(label)) ||
      row.bodyOverflow ||
      row.rowCount < 1 ||
      !row.emailsPresent ||
      !row.londonJoined,
  ) || Object.values(regression).some((ok) => !ok)

  console.log(JSON.stringify({ origin, bundle, results, regression }, null, 2))
  if (failed) process.exitCode = 1
} finally {
  if (userId) {
    await service.from('profiles').delete().eq('id', userId)
    await service.auth.admin.deleteUser(userId)
  }
}
