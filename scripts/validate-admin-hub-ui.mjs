#!/usr/bin/env node
/**
 * Local UI check for the Admin Hub navigation.
 * Creates a temporary admin, verifies hub nav across admin routes, then deletes the user.
 *
 * Usage: node scripts/validate-admin-hub-ui.mjs [origin]
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright-core'
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'

loadEnvFiles()

const origin = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
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

const EXPECTED_NAV = ['Dashboard', 'Cases', 'Support', 'Orders', 'Catalogue', 'Price Guide']

async function readHubState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.admin-hub-nav')
    const links = [...document.querySelectorAll('.admin-hub-nav__link')].map((el) => ({
      label: el.textContent.trim(),
      href: el.getAttribute('href') || '',
      active: el.classList.contains('admin-hub-nav__link--active'),
    }))
    const navOverflow = nav ? nav.scrollWidth > nav.clientWidth + 2 : true
    return {
      path: window.location.pathname,
      hasNav: Boolean(nav),
      navTitle: document.querySelector('.admin-hub-nav__title')?.textContent?.trim() || '',
      links,
      navOverflow,
      bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 8,
      pageTitle: document.querySelector('h1')?.textContent?.trim() || '',
      tools: [...document.querySelectorAll('.admin-hub-tool__label')].map((el) => el.textContent.trim()),
      statLabels: [...document.querySelectorAll('.admin-intelligence__stat span')].map((el) => el.textContent.trim()),
      denied: Boolean(document.querySelector('.page-stub__title')),
    }
  })
}

async function login(page, email, password, redirectTo) {
  await page.goto(`${origin}/login?redirect=${encodeURIComponent(redirectTo)}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  })
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('.auth-form__button').first().click()
  await page.waitForURL(new RegExp(redirectTo.replaceAll('/', '\\/')), { timeout: 45000 }).catch(() => {})
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tag = randomUUID().slice(0, 8)
const email = plusAddress(adminEmail, `hub-ui-${tag}`)
const password = `EquipdLive_${tag}!A`
const username = `hubui_${tag}`
let userId = null
let nonAdminId = null

try {
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

  const nonAdminEmail = plusAddress(adminEmail, `hub-non-${tag}`)
  const nonAdmin = await service.auth.admin.createUser({
    email: nonAdminEmail,
    password,
    email_confirm: true,
  })
  if (nonAdmin.error) throw nonAdmin.error
  nonAdminId = nonAdmin.data.user.id
  await service.from('profiles').upsert({
    id: nonAdminId,
    username: `hubnon_${tag}`,
    display_name: `hubnon_${tag}`,
    is_admin: false,
  })

  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const results = {}

  const guest = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await guest.goto(`${origin}/admin`, { waitUntil: 'networkidle', timeout: 90000 })
  results.guestProtection = await guest.evaluate(() => ({
    hasNav: Boolean(document.querySelector('.admin-hub-nav')),
    path: window.location.pathname,
  }))
  await guest.close()

  const nonAdminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(nonAdminPage, nonAdminEmail, password, '/admin')
  await nonAdminPage.goto(`${origin}/admin`, { waitUntil: 'networkidle', timeout: 90000 })
  await nonAdminPage.waitForSelector('.page-stub__title, .admin-hub-nav', { timeout: 30000 })
  results.nonAdminProtection = await readHubState(nonAdminPage)
  await nonAdminPage.close()

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport })
    await login(page, email, password, '/admin')
    await page.goto(`${origin}/admin`, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForSelector('.admin-hub-nav', { timeout: 30000 })
    const dashboard = await readHubState(page)

    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Cases', exact: true }).click()
    await page.waitForURL(/\/admin\/cases$/, { timeout: 30000 })
    await page.waitForSelector('.admin-cases__title', { timeout: 30000 })
    const casesClick = await readHubState(page)

    await page.goto(`${origin}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector('.admin-hub-nav', { timeout: 30000 })
    const ordersDirect = await readHubState(page)

    await page.goto(`${origin}/admin/catalogue`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForURL(/\/admin\/intelligence\/products/, { timeout: 30000 })
    await page.waitForSelector('.admin-hub-nav', { timeout: 30000 })
    const catalogueAlias = await readHubState(page)

    await page.goto(`${origin}/admin/support`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector('.admin-hub-nav', { timeout: 30000 })
    const supportDirect = await readHubState(page)

    await page.goto(`${origin}/admin/price-guide/import`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector('.admin-hub-nav', { timeout: 30000 })
    const priceGuideDirect = await readHubState(page)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.admin-hub-nav', { timeout: 30000 })
    const refreshed = await readHubState(page)

    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Dashboard', exact: true }).click()
    await page.waitForURL((href) => new URL(href).pathname === '/admin', { timeout: 30000 })
    await page.waitForSelector('.admin-dashboard', { timeout: 30000 })
    const backToDashboard = await readHubState(page)

    results[viewport.name] = {
      dashboard,
      casesClick,
      ordersDirect,
      catalogueAlias,
      supportDirect,
      priceGuideDirect,
      refreshed,
      backToDashboard,
    }
    await page.close()
  }

  await browser.close()

  function navLabels(state) {
    return state.links.map((link) => link.label)
  }
  function activeLabel(state) {
    return state.links.find((link) => link.active)?.label || ''
  }

  const checks = []
  function check(name, ok) {
    checks.push({ name, ok })
    if (!ok) console.error(`FAIL: ${name}`)
  }

  check('guest has no hub nav', !results.guestProtection.hasNav)
  check('non-admin is denied', results.nonAdminProtection.denied && !results.nonAdminProtection.hasNav)

  for (const viewport of ['mobile', 'desktop']) {
    const row = results[viewport]
    check(`${viewport} dashboard nav`, row.dashboard.hasNav && navLabels(row.dashboard).join('|') === EXPECTED_NAV.join('|'))
    check(`${viewport} dashboard title`, row.dashboard.pageTitle === 'Equipd Admin')
    check(`${viewport} dashboard active`, activeLabel(row.dashboard) === 'Dashboard')
    check(`${viewport} user stats`, ['Total users', 'New today', 'Last 7 days', 'Last 30 days', 'Users who have listed'].every((label) => row.dashboard.statLabels.includes(label)))
    check(`${viewport} tools`, ['Cases', 'Support', 'Orders', 'Catalogue', 'Price Guide'].every((label) => row.dashboard.tools.includes(label)))
    check(`${viewport} cases click`, row.casesClick.path === '/admin/cases' && activeLabel(row.casesClick) === 'Cases' && /support cases/i.test(row.casesClick.pageTitle))
    check(`${viewport} orders direct`, row.ordersDirect.path === '/admin/orders' && activeLabel(row.ordersDirect) === 'Orders')
    check(`${viewport} catalogue alias`, row.catalogueAlias.path === '/admin/intelligence/products' && activeLabel(row.catalogueAlias) === 'Catalogue')
    check(`${viewport} support`, row.supportDirect.path === '/admin/support' && activeLabel(row.supportDirect) === 'Support')
    check(`${viewport} price guide`, row.priceGuideDirect.path.startsWith('/admin/price-guide') && activeLabel(row.priceGuideDirect) === 'Price Guide')
    check(`${viewport} refresh keeps nav`, row.refreshed.hasNav && activeLabel(row.refreshed) === 'Price Guide')
    check(`${viewport} back to dashboard`, row.backToDashboard.path === '/admin' && activeLabel(row.backToDashboard) === 'Dashboard')
    check(`${viewport} no body overflow`, !row.dashboard.bodyOverflow && !row.dashboard.navOverflow)
    check(`${viewport} cases no overflow`, !row.casesClick.bodyOverflow && !row.casesClick.navOverflow)
  }

  const failed = checks.some((item) => !item.ok)
  console.log(JSON.stringify({
    origin,
    failed,
    checks,
    guest: results.guestProtection,
    nonAdminDenied: results.nonAdminProtection.denied,
    debug: {
      mobileCases: results.mobile.casesClick,
      mobileBack: results.mobile.backToDashboard,
      desktopCases: results.desktop.casesClick,
      desktopBack: results.desktop.backToDashboard,
    },
  }, null, 2))
  if (failed) process.exitCode = 1
} finally {
  if (userId) {
    await service.from('profiles').delete().eq('id', userId)
    await service.auth.admin.deleteUser(userId)
  }
  if (nonAdminId) {
    await service.from('profiles').delete().eq('id', nonAdminId)
    await service.auth.admin.deleteUser(nonAdminId)
  }
}
