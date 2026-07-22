/**
 * Regression checks for welcome-email-after-confirmation migration.
 * Validates trigger SQL without requiring a live database.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260722121000_welcome_email_after_confirmation.sql',
)
const sql = readFileSync(migrationPath, 'utf8')

assert.match(sql, /create or replace function public\.notify_welcome_email/i)
assert.match(sql, /tg_op = 'INSERT'/i)
assert.match(sql, /tg_op = 'UPDATE'/i)
assert.match(sql, /email_confirmed_at is null/i)
assert.match(sql, /email_confirmed_at is not null/i)
assert.match(sql, /notify_marketplace_email\(\s*'welcome'/i)
assert.match(sql, /auth_users_email_welcome_on_insert/)
assert.match(sql, /auth_users_email_welcome_on_confirm/)
assert.match(sql, /drop trigger if exists auth_users_email_welcome on auth\.users/)

// Unconfirmed INSERT must early-return (no welcome yet).
assert.match(
  sql,
  /if tg_op = 'INSERT' then[\s\S]*if new\.email_confirmed_at is null then[\s\S]*return new;/i,
  'unconfirmed signup INSERT must skip welcome',
)

// Confirmation UPDATE must require null → non-null transition.
assert.match(
  sql,
  /old\.email_confirmed_at is null[\s\S]*new\.email_confirmed_at is not null/i,
  'welcome on UPDATE only for first confirmation',
)

// Idempotency key remains welcome:{userId} in compose layer.
const composePath = join(
  process.cwd(),
  'supabase',
  'functions',
  '_shared',
  'marketplaceEmailComposePhase5.js',
)
const compose = readFileSync(composePath, 'utf8')
assert.ok(
  compose.includes('welcome:${parts.userId}') || compose.includes('`welcome:${parts.userId}`'),
  'welcome idempotency key includes userId',
)

console.log('test-welcome-email-after-confirmation: ok')
