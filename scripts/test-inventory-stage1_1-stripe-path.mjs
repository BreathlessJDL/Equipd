#!/usr/bin/env node
/**
 * Stage 1.1 Stripe test-mode + DB path validation.
 *
 * Proves:
 * 1. Stripe test-mode API connectivity
 * 2. Late-payment exception records Stripe identifiers from a test PaymentIntent
 * 3. On-time capture still works with Stripe test identifiers
 * 4. Duplicate Stripe event delivery remains idempotent
 */

import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CONTAINER = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_equipd'
const DATABASE = process.env.INVENTORY_TEST_DATABASE || 'equipd_inventory_stage1_test'

const SELLER = '13000000-0000-0000-0000-000000000001'
const BUYER = '13000000-0000-0000-0000-000000000002'
const CATEGORY = '23000000-0000-0000-0000-000000000001'
const LISTING_LATE = '33000000-0000-0000-0000-000000000001'
const LISTING_ONTIME = '33000000-0000-0000-0000-000000000002'
const OFFER_LATE = '53000000-0000-0000-0000-000000000001'
const OFFER_ONTIME = '53000000-0000-0000-0000-000000000002'

function readStripeTestKey() {
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    return process.env.STRIPE_SECRET_KEY
  }

  const configPath = join(homedir(), '.config', 'stripe', 'config.toml')
  const raw = readFileSync(configPath, 'utf8')
  const match = raw.match(/test_mode_api_key\s*=\s*'([^']+)'/)
  if (!match) {
    throw new Error('Stripe test_mode_api_key not found in CLI config')
  }
  return match[1]
}

async function stripeRequest(secretKey, method, path, body) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${json?.error?.message || response.status}`)
  }
  return json
}

function run(sql) {
  const result = spawnSync(
    'docker',
    [
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
    ],
    { encoding: 'utf8', windowsHide: true },
  )
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `psql exited ${result.status}`)
  }
  return result.stdout.trim()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const cleanupSql = `
delete from public.commerce_exceptions
where payment_id in (
  select id from public.payments where offer_id in ('${OFFER_LATE}', '${OFFER_ONTIME}')
);
delete from public.orders where offer_id in ('${OFFER_LATE}', '${OFFER_ONTIME}');
delete from public.payments where offer_id in ('${OFFER_LATE}', '${OFFER_ONTIME}');
delete from public.offers where id in ('${OFFER_LATE}', '${OFFER_ONTIME}');
delete from public.listings where id in ('${LISTING_LATE}', '${LISTING_ONTIME}');
delete from public.categories where id = '${CATEGORY}';
delete from public.profiles where id in ('${SELLER}', '${BUYER}');
delete from auth.users where id in ('${SELLER}', '${BUYER}');
`

const setupSql = `
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('${SELLER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage11-stripe-seller@example.test', '', now(), now()),
  ('${BUYER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage11-stripe-buyer@example.test', '', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name, stripe_onboarding_complete)
values
  ('${SELLER}', 'Stage11 Stripe Seller', true),
  ('${BUYER}', 'Stage11 Stripe Buyer', false)
on conflict (id) do nothing;

insert into public.categories (id, name, slug, sort_order)
values ('${CATEGORY}', 'Stage11 Stripe', 'stage11-stripe', 996)
on conflict (id) do nothing;

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values
  ('${LISTING_LATE}', '${SELLER}', '${CATEGORY}', 'stage11-stripe-late', 'Stage11 Stripe Late', 10000, 'good', 'active', 'manual', true, false, 1, 1, 0, 0),
  ('${LISTING_ONTIME}', '${SELLER}', '${CATEGORY}', 'stage11-stripe-ontime', 'Stage11 Stripe Ontime', 10000, 'good', 'active', 'manual', true, false, 1, 1, 0, 0);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values
  ('${OFFER_LATE}', '${LISTING_LATE}', '${BUYER}', '${SELLER}', 10000, 1, 'pending', 'buyer_to_seller'),
  ('${OFFER_ONTIME}', '${LISTING_ONTIME}', '${BUYER}', '${SELLER}', 10000, 1, 'pending', 'buyer_to_seller');
`

async function main() {
  const secretKey = readStripeTestKey()
  assert(secretKey.startsWith('sk_test_'), 'Stripe key is not test mode')

  const paymentIntent = await stripeRequest(secretKey, 'POST', '/payment_intents', {
    amount: '10000',
    currency: 'gbp',
    'metadata[source]': 'stage1_1_validation',
  })

  const eventId = `evt_stage11_${Date.now()}`
  const sessionId = `cs_test_stage11_${Date.now()}`

  run(cleanupSql)
  run(setupSql)

  try {
    run(`select set_config('request.jwt.claim.sub', '${SELLER}', false); select public.accept_offer('${OFFER_LATE}');`)
    run(`update public.orders set order_type = 'collection' where offer_id = '${OFFER_LATE}';`)
    run(`update public.payments set expires_at = now() - interval '2 minutes' where offer_id = '${OFFER_LATE}';`)
    run(`select public.expire_payment((select id from public.payments where offer_id = '${OFFER_LATE}'));`)

    const late = JSON.parse(run(`
      select public.mark_payment_captured_or_exception(
        (select id from public.payments where offer_id = '${OFFER_LATE}'),
        '${sessionId}',
        '${paymentIntent.id}',
        ${paymentIntent.latest_charge ? `'${paymentIntent.latest_charge}'` : 'null'},
        '${eventId}',
        jsonb_build_object('stripe_test', true, 'payment_intent_status', '${paymentIntent.status}')
      );
    `))

    assert(late.outcome === 'late_payment_exception', `late outcome wrong: ${JSON.stringify(late)}`)
    assert(late.exception_id, 'late payment missing exception_id')

    const exception = JSON.parse(run(`
      select json_build_object(
        'stripe_event_id', stripe_event_id,
        'stripe_checkout_session_id', stripe_checkout_session_id,
        'stripe_payment_intent_id', stripe_payment_intent_id,
        'status', status,
        'exception_type', exception_type
      )
      from public.commerce_exceptions
      where id = '${late.exception_id}';
    `))

    assert(exception.exception_type === 'late_payment_after_release', 'wrong exception type')
    assert(exception.status === 'open', 'exception not open')
    assert(exception.stripe_event_id === eventId, 'stripe_event_id not stored')
    assert(exception.stripe_checkout_session_id === sessionId, 'checkout session not stored')
    assert(exception.stripe_payment_intent_id === paymentIntent.id, 'payment intent not stored')

    const inventory = JSON.parse(run(`
      select json_build_object(
        'available', quantity_available,
        'reserved', quantity_reserved,
        'sold', quantity_sold
      )
      from public.listings where id = '${LISTING_LATE}';
    `))
    assert(
      inventory.available === 1 && inventory.reserved === 0 && inventory.sold === 0,
      `late payment mutated inventory: ${JSON.stringify(inventory)}`,
    )

    const duplicate = JSON.parse(run(`
      select public.mark_payment_captured_or_exception(
        (select id from public.payments where offer_id = '${OFFER_LATE}'),
        '${sessionId}',
        '${paymentIntent.id}',
        null,
        '${eventId}',
        '{}'::jsonb
      );
    `))
    assert(duplicate.outcome === 'already_recorded_exception', `duplicate not idempotent: ${JSON.stringify(duplicate)}`)
    assert(duplicate.exception_id === late.exception_id, 'duplicate created a new exception')

    run(`select set_config('request.jwt.claim.sub', '${SELLER}', false); select public.accept_offer('${OFFER_ONTIME}');`)
    run(`update public.orders set order_type = 'collection' where offer_id = '${OFFER_ONTIME}';`)

    const ontimePi = await stripeRequest(secretKey, 'POST', '/payment_intents', {
      amount: '10000',
      currency: 'gbp',
      'metadata[source]': 'stage1_1_validation_ontime',
    })

    const ontime = JSON.parse(run(`
      select public.mark_payment_captured_or_exception(
        (select id from public.payments where offer_id = '${OFFER_ONTIME}'),
        'cs_test_stage11_ontime',
        '${ontimePi.id}',
        null,
        'evt_stage11_ontime_${Date.now()}',
        '{}'::jsonb
      );
    `))
    assert(ontime.outcome === 'captured', `on-time capture failed: ${JSON.stringify(ontime)}`)

    console.log(JSON.stringify({
      passed: true,
      stripe_mode: 'test',
      late_payment: {
        outcome: late.outcome,
        exception_id: late.exception_id,
        stripe_payment_intent_id: paymentIntent.id,
        inventory,
      },
      duplicate_event: {
        outcome: duplicate.outcome,
        same_exception: duplicate.exception_id === late.exception_id,
      },
      ontime_payment: {
        outcome: ontime.outcome,
        stripe_payment_intent_id: ontimePi.id,
      },
    }, null, 2))
  } finally {
    run(cleanupSql)
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
