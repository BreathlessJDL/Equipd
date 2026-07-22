#!/usr/bin/env node
/**
 * Stage 1 inventory concurrency tests.
 *
 * Runs only against the isolated local database created from the production
 * schema (`equipd_inventory_stage1_test`). It uses two independent psql
 * sessions to prove row-lock behaviour under real concurrent transactions.
 */

import { spawn, spawnSync } from 'node:child_process'

const CONTAINER = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_equipd'
const DATABASE = process.env.INVENTORY_TEST_DATABASE || 'equipd_inventory_stage1_test'

const SELLER = '11000000-0000-0000-0000-000000000001'
const BUYER_A = '11000000-0000-0000-0000-000000000002'
const BUYER_B = '11000000-0000-0000-0000-000000000003'
const CATEGORY = '21000000-0000-0000-0000-000000000001'

function psqlArgs(sql) {
  return [
    'exec',
    CONTAINER,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    DATABASE,
    '-At',
    '-c',
    sql,
  ]
}

function run(sql) {
  const result = spawnSync('docker', psqlArgs(sql), {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `psql exited ${result.status}`)
  }
  return result.stdout.trim()
}

function runConcurrent(sql) {
  return new Promise((resolve) => {
    const child = spawn('docker', psqlArgs(sql), {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function authSql(userId, body) {
  return `select set_config('request.jwt.claim.sub', '${userId}', false); ${body}`
}

const setupSql = `
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('${SELLER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-seller@example.test', '', now(), now()),
  ('${BUYER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-a@example.test', '', now(), now()),
  ('${BUYER_B}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race-b@example.test', '', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name, stripe_onboarding_complete)
values
  ('${SELLER}', 'Race Seller', true),
  ('${BUYER_A}', 'Race Buyer A', false),
  ('${BUYER_B}', 'Race Buyer B', false)
on conflict (id) do nothing;

insert into public.categories (id, name, slug, sort_order)
values ('${CATEGORY}', 'Inventory Race Test', 'inventory-race-test', 998)
on conflict (id) do nothing;
`

const cleanupSql = `
delete from public.listings where id in (
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000002'
);
delete from public.categories where id = '${CATEGORY}';
delete from public.profiles where id in ('${SELLER}', '${BUYER_A}', '${BUYER_B}');
delete from auth.users where id in ('${SELLER}', '${BUYER_A}', '${BUYER_B}');
`

async function finalUnitRace() {
  run(`
    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition, status,
      source, collection_available, courier_available,
      quantity_total, quantity_available, quantity_reserved, quantity_sold
    ) values (
      '31000000-0000-0000-0000-000000000001',
      '${SELLER}', '${CATEGORY}', 'race-final-unit', 'Race Final Unit',
      10000, 'good', 'active', 'manual', true, false, 1, 1, 0, 0
    );
    insert into public.offers (
      id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
    ) values
      ('51000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '${BUYER_A}', '${SELLER}', 10000, 1, 'pending', 'buyer_to_seller'),
      ('51000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', '${BUYER_B}', '${SELLER}', 10000, 1, 'pending', 'buyer_to_seller');
  `)

  const calls = [
    runConcurrent(authSql(SELLER, `select public.accept_offer('51000000-0000-0000-0000-000000000001');`)),
    runConcurrent(authSql(SELLER, `select public.accept_offer('51000000-0000-0000-0000-000000000002');`)),
  ]
  const results = await Promise.all(calls)
  const successes = results.filter((result) => result.code === 0)
  const failures = results.filter((result) => result.code !== 0)

  assert(successes.length === 1, `expected one acceptance success, got ${successes.length}`)
  assert(failures.length === 1, `expected one acceptance failure, got ${failures.length}`)
  assert(
    /Insufficient inventory|Only pending offers can be accepted/.test(failures[0].stderr),
    `losing transaction did not report expected acceptance failure: ${failures[0].stderr}`,
  )

  const state = JSON.parse(run(`
    select json_build_object(
      'total', l.quantity_total,
      'available', l.quantity_available,
      'reserved', l.quantity_reserved,
      'sold', l.quantity_sold,
      'version', l.inventory_version,
      'accepted', (select count(*) from public.offers o where o.listing_id = l.id and o.status = 'accepted'),
      'pending', (select count(*) from public.offers o where o.listing_id = l.id and o.status = 'pending'),
      'payments', (select count(*) from public.payments p where p.listing_id = l.id),
      'orders', (select count(*) from public.orders o where o.listing_id = l.id)
    )
    from public.listings l
    where l.id = '31000000-0000-0000-0000-000000000001';
  `))

  assert(state.total === 1 && state.available === 0 && state.reserved === 1 && state.sold === 0, `invalid final inventory: ${JSON.stringify(state)}`)
  assert(state.version === 1, `inventory version should be 1: ${JSON.stringify(state)}`)
  assert(state.accepted === 1 && state.pending === 0, `quantity-1 sibling was not rejected: ${JSON.stringify(state)}`)
  assert(
    Number(run(`
      select count(*) from public.offers
      where listing_id = '31000000-0000-0000-0000-000000000001'
        and status = 'rejected'
    `)) === 1,
    'losing quantity-1 offer was not rejected',
  )
  assert(state.payments === 1 && state.orders === 1, `acceptance side effects were not atomic: ${JSON.stringify(state)}`)

  return { outcomes: results.map((result) => result.code), state }
}

async function sellerEditVsAcceptanceRace() {
  run(`
    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition, status,
      source, collection_available, courier_available,
      quantity_total, quantity_available, quantity_reserved, quantity_sold
    ) values (
      '31000000-0000-0000-0000-000000000002',
      '${SELLER}', '${CATEGORY}', 'race-edit-accept', 'Race Edit Accept',
      10000, 'good', 'active', 'manual', true, false, 2, 2, 0, 0
    );
    insert into public.offers (
      id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
    ) values (
      '51000000-0000-0000-0000-000000000003',
      '31000000-0000-0000-0000-000000000002',
      '${BUYER_A}', '${SELLER}', 10000, 1, 'pending', 'buyer_to_seller'
    );
  `)

  const [acceptance, edit] = await Promise.all([
    runConcurrent(authSql(SELLER, `select public.accept_offer('51000000-0000-0000-0000-000000000003');`)),
    runConcurrent(authSql(SELLER, `select public.update_listing_quantity('31000000-0000-0000-0000-000000000002', 1, 0);`)),
  ])

  assert(acceptance.code === 0, `acceptance unexpectedly failed: ${acceptance.stderr}`)
  assert(
    edit.code === 0 || /Inventory was changed by another transaction/.test(edit.stderr),
    `seller edit failed for an unexpected reason: ${edit.stderr}`,
  )

  const state = JSON.parse(run(`
    select json_build_object(
      'total', quantity_total,
      'available', quantity_available,
      'reserved', quantity_reserved,
      'sold', quantity_sold,
      'version', inventory_version
    )
    from public.listings
    where id = '31000000-0000-0000-0000-000000000002';
  `))

  assert(state.available + state.reserved + state.sold === state.total, `seller/edit race broke invariant: ${JSON.stringify(state)}`)
  assert(state.reserved === 1 && state.sold === 0, `accepted quantity is not reserved: ${JSON.stringify(state)}`)
  assert(state.total >= state.reserved + state.sold, `seller edit reduced total below committed inventory: ${JSON.stringify(state)}`)

  return { outcomes: [acceptance.code, edit.code], state }
}

async function main() {
  run(cleanupSql)
  run(setupSql)
  try {
    const finalUnit = await finalUnitRace()
    const editVsAcceptance = await sellerEditVsAcceptanceRace()
    console.log(JSON.stringify({
      passed: true,
      final_unit_race: finalUnit,
      seller_edit_vs_acceptance_race: editVsAcceptance,
    }, null, 2))
  } finally {
    run(cleanupSql)
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
