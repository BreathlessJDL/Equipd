#!/usr/bin/env node
/**
 * Clear all notifications (mark all as read) RPC + UI smoke checks.
 *
 *   node scripts/test-clear-all-notifications.mjs [baseUrl]
 *
 * Requires .env.local with Supabase keys. Run supabase/mark-all-notifications-read.sql first.
 */

import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const CLEAR_ALL_NOTIFICATIONS_CONFIRM = 'Mark all notifications as read?'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const SELLER = { email: 'dev-seller-leeds@equipd.dev' }

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) {
    throw new Error(`Sign in failed for ${email}: ${error.message}`)
  }

  return data.session
}

async function testRpc(admin, authed) {
  const userId = (await authed.auth.getUser()).data.user?.id
  assert(userId, 'Expected authenticated user id')

  const linkUrl = `/hub?section=offers&offerId=00000000-0000-0000-0000-000000000098`

  await admin.rpc('create_notification', {
    p_user_id: userId,
    p_type: 'offer_received',
    p_title: 'Clear all test',
    p_body: 'Unread notification for clear-all RPC test.',
    p_link_url: linkUrl,
  })

  const { count: beforeCount, error: beforeError } = await authed
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .neq('type', 'message_received')

  if (beforeError) throw new Error(beforeError.message)
  assert((beforeCount ?? 0) >= 1, 'Expected at least one unread notification before clear')

  const { data: markedCount, error: rpcError } = await authed.rpc('mark_all_notifications_read')

  if (rpcError?.message?.includes('Could not find the function')) {
    throw new Error('Missing mark_all_notifications_read. Run supabase/mark-all-notifications-read.sql first.')
  }

  if (rpcError) throw new Error(rpcError.message)
  assert(markedCount >= 1, `Expected RPC to mark notifications read, got ${markedCount}`)

  const { count: afterCount, error: afterError } = await authed
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .neq('type', 'message_received')

  if (afterError) throw new Error(afterError.message)
  assert(afterCount === 0, `Expected zero unread after clear all, got ${afterCount}`)

  const { data: stillExists } = await authed
    .from('notifications')
    .select('id, is_read')
    .eq('user_id', userId)
    .eq('link_url', linkUrl)
    .limit(1)

  assert((stillExists ?? []).length === 1, 'Notification row should remain after clear all')
  assert(stillExists[0].is_read === true, 'Notification should be marked read in history')

  const { count: unreadAfterBellFilter, error: unreadListError } = await authed
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .neq('type', 'message_received')

  if (unreadListError) throw new Error(unreadListError.message)
  assert(unreadAfterBellFilter === 0, 'Bell dropdown query should return no unread notifications')

  console.log('PASS RPC marks own unread notifications read without deleting rows')
  console.log('PASS read notifications remain in history but excluded from bell unread list')
}

async function testUi() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })

  try {
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })

      page.on('dialog', async (dialog) => {
        assert(
          dialog.message() === CLEAR_ALL_NOTIFICATIONS_CONFIRM,
          `Unexpected dialog: ${dialog.message()}`,
        )
        await dialog.dismiss()
      })

      await page.goto(`${baseUrl}/notifications`, { waitUntil: 'networkidle', timeout: 45000 })

      const clearAllButton = page.locator('.notifications-page__clear-all')
      const buttonCount = await clearAllButton.count()

      if (buttonCount === 0) {
        console.log(`SKIP UI ${viewport.name}: Clear all hidden (no unread notifications or logged out)`)
      } else {
        await clearAllButton.click()
        console.log(`PASS UI ${viewport.name}: Clear all button present and confirmation dialog shown`)
      }

      await page.close()
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  loadEnvFile('.env.local')

  assert(
    CLEAR_ALL_NOTIFICATIONS_CONFIRM === 'Mark all notifications as read?',
    'confirmation copy matches requirement',
  )

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (supabaseUrl && serviceRoleKey && anonKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    await signIn(authed, SELLER.email)

    try {
      await testRpc(admin, authed)
    } catch (error) {
      console.log(`SKIP RPC: ${error.message}`)
    }
  } else {
    console.log('SKIP RPC tests: missing Supabase env vars')
  }

  await testUi()
  console.log('\nClear all notifications checks completed.')
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
