import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const outDir = path.join(ROOT, 'debug-screenshots', 'collection-confirm')
const baseUrl = process.argv[2] ?? 'http://localhost:5176/'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const BUYER = { email: 'dev-buyer-chris@equipd.dev' }
const SELLER = { email: 'dev-seller-leeds@equipd.dev' }

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
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
  return data.session
}

async function createBuyerContext(browser, supabaseUrl, anonKey) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const session = await signIn(client, BUYER.email)
  const context = await browser.newContext()
  await context.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: getStorageKey(supabaseUrl),
      value: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      }),
    },
  )
  return context
}

async function screenshotPage(context, url, filename, viewport) {
  const page = await context.newPage({ viewport })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.collect-order-page', { timeout: 20000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true })
  await page.close()
  console.log(`Saved ${filename}`)
}

loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const authed = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

await mkdir(outDir, { recursive: true })

const { data: orders } = await admin
  .from('orders')
  .select('id, fulfilment_status, order_type, payment_id')
  .in('fulfilment_status', ['awaiting_collection', 'awaiting_seller_delivery', 'collected'])
  .in('order_type', ['collection', 'seller_delivery'])
  .order('updated_at', { ascending: false })
  .limit(30)

let readyOrder = null
let collectedOrder = null

for (const candidate of orders ?? []) {
  const { data: payment } = await admin
    .from('payments')
    .select('status')
    .eq('id', candidate.payment_id)
    .single()

  if (payment?.status !== 'paid') continue

  if (!collectedOrder && candidate.fulfilment_status === 'collected') {
    collectedOrder = candidate
  }

  const isReadyCollection =
    candidate.order_type === 'collection' && candidate.fulfilment_status === 'awaiting_collection'
  const isReadyHandover =
    candidate.order_type === 'seller_delivery' &&
    candidate.fulfilment_status === 'awaiting_seller_delivery'

  if (!readyOrder && (isReadyCollection || isReadyHandover)) {
    readyOrder = candidate
  }
}

if (!readyOrder) {
  throw new Error('No paid order ready for handover confirmation screenshot')
}

await signIn(authed, SELLER.email)
const { data: tokenData, error: tokenError } = await authed.rpc('generate_collection_qr_token', {
  p_order_id: readyOrder.id,
})
if (tokenError) throw tokenError

const confirmUrl = new URL(`/orders/collect/${tokenData.token}`, baseUrl).href

const browser = await chromium.launch({ channel: 'msedge' })
const context = await createBuyerContext(browser, supabaseUrl, anonKey)

await screenshotPage(
  context,
  confirmUrl,
  'collection-confirm-after-mobile.png',
  { width: 390, height: 844 },
)
await screenshotPage(
  context,
  confirmUrl,
  'collection-confirm-after-desktop.png',
  { width: 1280, height: 900 },
)

if (collectedOrder) {
  const { data: collected } = await admin
    .from('orders')
    .select('collection_qr_token')
    .eq('id', collectedOrder.id)
    .single()

  if (collected?.collection_qr_token) {
    const successUrl = new URL(`/orders/collect/${collected.collection_qr_token}`, baseUrl).href
    await screenshotPage(
      context,
      successUrl,
      'collection-confirmed-after-mobile.png',
      { width: 390, height: 844 },
    )
    await screenshotPage(
      context,
      successUrl,
      'collection-confirmed-after-desktop.png',
      { width: 1280, height: 900 },
    )
  }
} else {
  await signIn(authed, BUYER.email)
  await authed.rpc('confirm_collection_by_qr', {
    p_token: tokenData.token,
    p_checks: {
      item_collected: true,
      item_inspected: true,
      item_matches_listing: true,
    },
    p_user_agent: 'collection-screenshot-script',
  })

  const successUrl = new URL(`/orders/collect/${tokenData.token}`, baseUrl).href
  await screenshotPage(
    context,
    successUrl,
    'collection-confirmed-after-mobile.png',
    { width: 390, height: 844 },
  )
  await screenshotPage(
    context,
    successUrl,
    'collection-confirmed-after-desktop.png',
    { width: 1280, height: 900 },
  )
}

await browser.close()
console.log(`\nScreenshots saved to ${outDir}`)
