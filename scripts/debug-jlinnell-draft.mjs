#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

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
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: jlinnellDrafts } = await admin
  .from('listings')
  .select('slug, title, status, seller_id')
  .eq('seller_id', '77749f0e-2b62-4143-905b-ec6d7b6d74ae')

console.log('jlinnell95 listings:', jlinnellDrafts)

const slug = jlinnellDrafts?.find((l) => l.status === 'draft')?.slug
if (!slug) {
  console.log('No draft for jlinnell')
  process.exit(0)
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`https://www.equipd.co.uk/listings/${slug}/edit`, { waitUntil: 'networkidle', timeout: 60000 })

const unauth = await page.evaluate(() => ({
  h1: document.querySelector('.listing-form-page__title')?.textContent?.trim(),
  error: document.querySelector('.listing-form__message--error')?.textContent?.trim(),
  buttons: [...document.querySelectorAll('.listing-form__actions button')].map((b) => b.textContent?.trim()),
}))

console.log('\nUnauthenticated edit page:', unauth)
await browser.close()
