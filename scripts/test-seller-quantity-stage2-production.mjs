// Stage 2 production verification: atomic multi-quantity creation and
// seller quantity editing, exercised through the real authenticated path.
// Fixtures stay in draft (never publicly visible) and are deleted afterwards.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  const content = readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, '')
    }
  }
}

loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Missing Supabase env')

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const results = []
let failures = 0

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}

const runId = Date.now().toString(36)
const password = `Stage2-verify-${runId}-!aA1`
const createdUserIds = []
const createdListingIds = []

async function createUser(label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `stage2-${label}-${runId}@equipd-internal.test`,
    password,
    email_confirm: true,
  })
  if (error) throw error
  createdUserIds.push(data.user.id)
  return data.user
}

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

function listingPayload(sellerId, categoryId, slugSuffix, extra = {}) {
  return {
    seller_id: sellerId,
    category_id: categoryId,
    slug: `stage2-prod-verify-${runId}-${slugSuffix}`,
    title: `Stage 2 verify ${slugSuffix}`,
    price_pence: 50000,
    condition: 'good',
    status: 'draft',
    source: 'manual',
    collection_available: true,
    courier_available: false,
    ...extra,
  }
}

async function main() {
  const { data: category, error: categoryError } = await admin
    .from('categories')
    .select('id')
    .limit(1)
    .single()
  if (categoryError) throw categoryError

  const { count: publicCountBefore } = await createClient(url, anonKey)
    .from('listings_public_browse')
    .select('id', { count: 'exact', head: true })

  const seller = await createUser('seller')
  const other = await createUser('other')
  const sellerClient = await signIn(`stage2-seller-${runId}@equipd-internal.test`)
  const otherClient = await signIn(`stage2-other-${runId}@equipd-internal.test`)
  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } })

  // --- Atomic creation: quantity 6 in one insert ---
  const { data: created, error: createError } = await sellerClient
    .from('listings')
    .insert(listingPayload(seller.id, category.id, 'qty6', { quantity_total: 6 }))
    .select('*')
    .single()
  if (createError) throw createError
  createdListingIds.push(created.id)

  check(
    'atomic creation stores total=6 available=6 reserved=0 sold=0 version=0',
    created.quantity_total === 6
      && created.quantity_available === 6
      && created.quantity_reserved === 0
      && created.quantity_sold === 0
      && created.inventory_version === 0,
    JSON.stringify({
      total: created.quantity_total,
      available: created.quantity_available,
      reserved: created.quantity_reserved,
      sold: created.quantity_sold,
      version: created.inventory_version,
    }),
  )
  check('created listing keeps requested draft status', created.status === 'draft', created.status)
  check('created listing is not test data and unpublished',
    created.is_test_data === false && created.published_at === null)

  // --- Derived fields cannot be client-controlled ---
  const { data: overridden, error: overrideError } = await sellerClient
    .from('listings')
    .insert(listingPayload(seller.id, category.id, 'override', {
      quantity_total: 4,
      quantity_available: 50,
      quantity_reserved: 10,
      quantity_sold: 5,
      inventory_version: 99,
    }))
    .select('*')
    .single()
  if (overrideError) throw overrideError
  createdListingIds.push(overridden.id)
  check(
    'client-supplied derived counters are overwritten at insert',
    overridden.quantity_total === 4
      && overridden.quantity_available === 4
      && overridden.quantity_reserved === 0
      && overridden.quantity_sold === 0
      && overridden.inventory_version === 0,
  )

  // --- Omitted quantity defaults to 1 ---
  const { data: qtyOne, error: qtyOneError } = await sellerClient
    .from('listings')
    .insert(listingPayload(seller.id, category.id, 'qty1'))
    .select('*')
    .single()
  if (qtyOneError) throw qtyOneError
  createdListingIds.push(qtyOne.id)
  check(
    'omitted quantity preserves quantity-1 behaviour',
    qtyOne.quantity_total === 1
      && qtyOne.quantity_available === 1
      && qtyOne.quantity_reserved === 0
      && qtyOne.quantity_sold === 0
      && qtyOne.inventory_version === 0,
  )

  // --- Invalid create quantities rejected ---
  for (const bad of [0, -1, 1000, 1.5]) {
    const { error } = await sellerClient
      .from('listings')
      .insert(listingPayload(seller.id, category.id, `bad-${String(bad).replace(/[.-]/g, '_')}`, {
        quantity_total: bad,
      }))
      .select('id')
      .single()
    check(`create with quantity ${bad} is rejected`, Boolean(error), error?.message ?? 'no error')
  }

  // --- Seller editing via RPC ---
  const { data: increased, error: increaseError } = await sellerClient.rpc(
    'update_listing_quantity',
    { p_listing_id: created.id, p_new_total: 8, p_expected_inventory_version: 0 },
  )
  check(
    'owner can increase quantity to 8',
    !increaseError
      && increased?.quantity_total === 8
      && increased?.quantity_available === 8
      && increased?.inventory_version === 1,
    increaseError?.message ?? '',
  )

  const { data: reduced, error: reduceError } = await sellerClient.rpc(
    'update_listing_quantity',
    { p_listing_id: created.id, p_new_total: 6, p_expected_inventory_version: 1 },
  )
  check(
    'owner can reduce quantity to 6 (>= reserved+sold)',
    !reduceError
      && reduced?.quantity_total === 6
      && reduced?.quantity_available === 6
      && reduced?.inventory_version === 2,
    reduceError?.message ?? '',
  )

  for (const [label, total, version] of [
    ['below 1', 0, 2],
    ['above 999', 1000, 2],
  ]) {
    const { error } = await sellerClient.rpc('update_listing_quantity', {
      p_listing_id: created.id,
      p_new_total: total,
      p_expected_inventory_version: version,
    })
    check(`owner cannot set quantity ${label}`, Boolean(error), error?.message ?? 'no error')
  }

  const { error: staleError } = await sellerClient.rpc('update_listing_quantity', {
    p_listing_id: created.id,
    p_new_total: 7,
    p_expected_inventory_version: 0,
  })
  check('stale inventory version is rejected',
    Boolean(staleError) && /changed by another transaction/i.test(staleError?.message ?? ''),
    staleError?.message ?? 'no error')

  const { data: directWrite, error: directError } = await sellerClient
    .from('listings')
    .update({ quantity_available: 99 })
    .eq('id', created.id)
    .select('id')
  check(
    'owner cannot directly write inventory counters',
    Boolean(directError) || (directWrite ?? []).length === 0,
    directError?.message ?? 'update silently blocked by RLS/trigger',
  )

  const { error: nonOwnerError } = await otherClient.rpc('update_listing_quantity', {
    p_listing_id: created.id,
    p_new_total: 9,
    p_expected_inventory_version: 2,
  })
  check('another authenticated seller cannot edit inventory',
    Boolean(nonOwnerError), nonOwnerError?.message ?? 'no error')

  const { error: anonRpcError } = await anonClient.rpc('update_listing_quantity', {
    p_listing_id: created.id,
    p_new_total: 9,
    p_expected_inventory_version: 2,
  })
  check('anonymous client cannot execute quantity RPC',
    Boolean(anonRpcError), anonRpcError?.message ?? 'no error')

  // --- Fixtures never publicly visible ---
  const { data: anonRows } = await anonClient
    .from('listings')
    .select('id')
    .in('id', createdListingIds)
  const { data: anonBrowseRows } = await anonClient
    .from('listings_public_browse')
    .select('id')
    .in('id', createdListingIds)
  check('draft fixtures invisible to anonymous users',
    (anonRows ?? []).length === 0 && (anonBrowseRows ?? []).length === 0)

  const { count: publicCountAfter } = await anonClient
    .from('listings_public_browse')
    .select('id', { count: 'exact', head: true })
  check('public browse count unchanged',
    publicCountAfter === publicCountBefore,
    `before=${publicCountBefore} after=${publicCountAfter}`)

  // --- Final state of the edited fixture ---
  const { data: final } = await admin
    .from('listings')
    .select('quantity_total, quantity_available, quantity_reserved, quantity_sold, inventory_version, status, published_at')
    .eq('id', created.id)
    .single()
  check(
    'final fixture state consistent (6/6/0/0, version 2, draft)',
    final.quantity_total === 6
      && final.quantity_available === 6
      && final.quantity_reserved === 0
      && final.quantity_sold === 0
      && final.inventory_version === 2
      && final.status === 'draft'
      && final.published_at === null,
    JSON.stringify(final),
  )
}

async function cleanup() {
  if (createdListingIds.length > 0) {
    const { error } = await admin.from('listings').delete().in('id', createdListingIds)
    if (error) console.error('cleanup listings failed:', error.message)
    else console.log(`cleanup: deleted ${createdListingIds.length} draft fixtures`)
  }
  for (const id of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.error(`cleanup user ${id} failed:`, error.message)
  }
  if (createdUserIds.length > 0) console.log(`cleanup: deleted ${createdUserIds.length} test users`)
}

try {
  await main()
} finally {
  await cleanup()
}

if (failures > 0) {
  console.error(`\n${failures} verification check(s) failed`)
  process.exit(1)
}
console.log('\nAll Stage 2 production verification checks passed')
