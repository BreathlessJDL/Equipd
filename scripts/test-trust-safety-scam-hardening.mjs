#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  isReservedEquipdIdentity,
  normalizeEquipdIdentity,
  RESERVED_EQUIPD_IDENTITY_ERROR,
  validatePublicIdentityName,
} from '../src/lib/reservedEquipdIdentity.js'
import { MARKETPLACE_MESSAGE_SAFETY_NOTE } from '../src/lib/marketplaceMessageValidation.js'

const root = process.cwd()
const migration = readFileSync(
  join(root, 'supabase/migrations/20260911140000_trust_safety_scam_hardening.sql'),
  'utf8',
)
const adminModerate = readFileSync(
  join(root, 'supabase/functions/admin-moderate-user/index.ts'),
  'utf8',
)

assert.equal(normalizeEquipdIdentity(' Equipd_Support '), 'equipdsupport')
assert.equal(normalizeEquipdIdentity('EQUlPD'), 'equlpd')

const mustReject = [
  'Equipd',
  'EQUIPD',
  'equipd',
  'EQUlPD',
  'equlpd',
  'EQU1PD',
  'equ1pd',
  'equipd_support',
  'equlpd_support',
  'equipd-support',
  'equlpd-support',
  'EquipdSupport',
  'EqulpdSupport',
  'OfficialEquipd',
  'OfficialEqulpd',
  'EquipdPayments',
  'EqulpdPayments',
  'support-equipd',
  'Official Equipd',
]

for (const value of mustReject) {
  assert.equal(
    isReservedEquipdIdentity(value),
    true,
    `expected reserved identity rejection for ${JSON.stringify(value)}`,
  )
}

assert.equal(isReservedEquipdIdentity('jordan'), false)
assert.equal(isReservedEquipdIdentity('equipment'), false)
assert.equal(isReservedEquipdIdentity('myequipdsale'), false)
assert.equal(isReservedEquipdIdentity('equlipment'), false)

const rejected = validatePublicIdentityName('EQUlPD')
assert.equal(rejected.valid, false)
assert.equal(rejected.error, RESERVED_EQUIPD_IDENTITY_ERROR)

assert.match(migration, /equ\[il1\|\]pd/)
assert.match(migration, /create or replace function public\.create_report/)
assert.match(migration, /create or replace function public\.admin_list_reports/)
assert.match(migration, /create or replace function public\.admin_update_report_status/)
assert.match(migration, /create or replace function public\.has_open_report/)
assert.match(migration, /lower\(p\.username\) = lower\(normalized\)/)
assert.equal(migration.includes('delete from auth.sessions'), false)
assert.equal(migration.includes('delete from auth.refresh_tokens'), false)
assert.match(adminModerate, /ban_duration/)
assert.match(adminModerate, /876000h/)
assert.match(adminModerate, /['"]none['"]/)
assert.match(adminModerate, /updateUserById/)
assert.equal(adminModerate.includes('admin.signOut('), false)
assert.equal(adminModerate.includes('auth.sessions'), false)
assert.match(migration, /is_official_equipd/)
assert.match(migration, /is_suspended/)
assert.match(migration, /start_listing_conversation/)
assert.match(migration, /admin_suspend_user/)
assert.match(migration, /suspicious_message_flags/)
assert.match(migration, /listing_is_publicly_visible/)
assert.match(migration, /Users can upload profile images to own folder/)
assert.match(migration, /admin_list_reserved_equipd_identity_conflicts/)
assert.match(migration, /wanted_requests/)
assert.match(migration, /You''ve started several new conversations recently/)
assert.match(MARKETPLACE_MESSAGE_SAFETY_NOTE, /QR code/)

assert.ok(existsSync(join(root, 'supabase/functions/upload-profile-image/index.ts')))
assert.ok(existsSync(join(root, 'supabase/functions/admin-moderate-user/index.ts')))
assert.ok(existsSync(join(root, 'src/pages/AdminTrustSafetyPage.jsx')))
assert.ok(existsSync(join(root, 'src/components/OfficialEquipdBadge.jsx')))

console.log('test-trust-safety-scam-hardening: ok')
console.log('EQUlPD blocked:', isReservedEquipdIdentity('EQUlPD'))
