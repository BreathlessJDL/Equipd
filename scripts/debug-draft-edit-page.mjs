#!/usr/bin/env node
/**
 * Investigate draft edit page: DB status, fetch path, deployed bundle.
 * Usage: node scripts/debug-draft-edit-page.mjs [baseUrl]
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = (process.argv[2] ?? 'http://localhost:5178/').replace(/\/?$/, '/')

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const authed = createClient(supabaseUrl, anonKey)
const { data: auth, error: authError } = await authed.auth.signInWithPassword({
  email: 'dev-seller-leeds@equipd.dev',
  password: 'EquipdDevSeed123!',
})
if (authError) throw authError

const userId = auth.user.id

const admin = serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : authed

const { data: draftsFromDb } = await admin
  .from('listings')
  .select('id, slug, title, status, seller_id')
  .eq('seller_id', userId)
  .eq('status', 'draft')
  .order('updated_at', { ascending: false })
  .limit(5)

console.log('\n=== 1. Draft listings in DB (seller dev account) ===')
console.log(JSON.stringify(draftsFromDb ?? [], null, 2))

if (!draftsFromDb?.length) {
  console.log('No draft listings found for dev seller — create one first.')
  process.exit(0)
}

const draft = draftsFromDb[0]

const { data: fetchedAsSeller, error: fetchError } = await authed
  .from('listings')
  .select('id, slug, title, status')
  .eq('slug', draft.slug)
  .maybeSingle()

console.log('\n=== 2. fetchListingBySlug equivalent (authenticated seller) ===')
console.log({ fetchedAsSeller, fetchError: fetchError?.message ?? null })

console.log('\n=== 3. fetchListingBySlug helper ===')
console.log('(skipped in node — use browser test below)')

// Live bundle check
const liveUrl = 'https://www.equipd.co.uk/'
let bundleHasPublish = null
let bundleHasSaveDraft = null
let bundleName = null
try {
  const res = await fetch(liveUrl)
  const html = await res.text()
  const match = html.match(/\/assets\/(index-[^"]+\.js)/)
  bundleName = match?.[1] ?? null
  if (bundleName) {
    const js = await fetch(`${liveUrl}assets/${bundleName}`).then((r) => r.text())
    bundleHasPublish = js.includes('Publish listing')
    bundleHasSaveDraft = js.includes('Save draft')
  }
} catch (e) {
  console.log('\n=== 4. Live bundle check failed ===', e.message)
}

console.log('\n=== 4. Live deployed bundle (www.equipd.co.uk) ===')
console.log({ bundleName, bundleHasPublish, bundleHasSaveDraft: bundleHasSaveDraft ?? null })

const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext()
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

for (const label of ['local', 'live']) {
  const url = label === 'live' ? liveUrl : baseUrl
  const page = await context.newPage()
  const editUrl = new URL(`/listings/${draft.slug}/edit`, url).href
  console.log(`\n=== 5. Browser test (${label}): ${editUrl} ===`)

  try {
    await page.goto(editUrl, { waitUntil: 'networkidle', timeout: 60000 })
    const ui = await page.evaluate(() => ({
      h1: document.querySelector('.listing-form-page__title')?.textContent?.trim(),
      buttons: [...document.querySelectorAll('.listing-form__actions button, .listing-form__actions a')].map(
        (el) => ({
          tag: el.tagName,
          type: el.getAttribute('type'),
          text: el.textContent?.trim(),
          visible: el.offsetParent !== null,
          display: getComputedStyle(el).display,
          rect: el.getBoundingClientRect(),
        }),
      ),
      hint: document.querySelector('.listing-form__hint--inline')?.textContent?.trim() ?? null,
    }))
    console.log(JSON.stringify(ui, null, 2))
  } catch (e) {
    console.log('Navigation failed:', e.message)
  }
  await page.close()
}

await browser.close()
