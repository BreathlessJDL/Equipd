#!/usr/bin/env node
/**
 * Documents expected direct-attack outcomes for trust & safety.
 * Runtime DB integration is manual/post-deploy; this file asserts the
 * migration/edge source contains the blocking controls for paths A–L.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isReservedEquipdIdentity } from '../src/lib/reservedEquipdIdentity.js'

const root = process.cwd()
const migration = readFileSync(
  join(root, 'supabase/migrations/20260911140000_trust_safety_scam_hardening.sql'),
  'utf8',
)
const uploadFn = readFileSync(
  join(root, 'supabase/functions/upload-profile-image/index.ts'),
  'utf8',
)
const checkoutFn = readFileSync(
  join(root, 'supabase/functions/stripe-create-checkout/index.ts'),
  'utf8',
)
const wantedFn = readFileSync(
  join(root, 'supabase/functions/create-wanted-request/index.ts'),
  'utf8',
)
const adminModerate = readFileSync(
  join(root, 'supabase/functions/admin-moderate-user/index.ts'),
  'utf8',
)

const cases = [
  ['A Equipd username', () => assert.equal(isReservedEquipdIdentity('Equipd'), true)],
  ['B EQUlPD username', () => assert.equal(isReservedEquipdIdentity('EQUlPD'), true)],
  ['C is_official_equipd client set', () => assert.match(migration, /Official Equipd status can only be/)],
  ['D is_admin client set', () => assert.match(migration, /Admin status can only be/)],
  ['E suspension fields client set', () => assert.match(migration, /Suspension fields can only be/)],
  ['F direct conversation insert', () => assert.match(migration, /Buyers can start conversations on active listings/)],
  ['G message while suspended', () => assert.match(migration, /messages_enforce_not_suspended/)],
  ['H direct storage insert', () => assert.match(migration, /Users can upload profile images to own folder/)],
  ['I direct storage update', () => assert.match(migration, /Users can update own profile images/)],
  ['J other profile update', () => assert.match(migration, /prevent_profile_privilege_client_updates/)],
  ['K checkout while suspended', () => assert.match(checkoutFn, /is_suspended/)],
  ['L wanted while suspended', () => {
    assert.match(wantedFn, /is_suspended/)
    assert.match(migration, /wanted_requests/)
  }],
  ['JWT window: profile edit blocked while suspended', () =>
    assert.match(migration, /Your account is suspended and cannot update your profile/)],
  ['JWT window: listings blocked while suspended', () =>
    assert.match(migration, /listings_enforce_not_suspended/)],
  ['JWT window: offers blocked while suspended', () =>
    assert.match(migration, /offers_enforce_not_suspended/)],
  ['JWT window: conversation RPC asserts not suspended', () =>
    assert.match(migration, /assert_not_suspended/)],
  ['No direct auth.sessions deletes', () =>
    assert.equal(migration.includes('delete from auth.sessions'), false)],
  ['Auth ban via Admin API', () => assert.match(adminModerate, /ban_duration:\s*action === 'suspend'/)],
]

for (const [label, fn] of cases) {
  fn()
  console.log(`ok - ${label}`)
}

assert.match(uploadFn, /jsQR|jsqr/)
assert.match(uploadFn, /QR codes aren't permitted/)
assert.match(migration, /create or replace function public\.create_report/)
assert.match(migration, /admin_update_report_status/)

console.log('test-trust-safety-attack-paths: ok')
