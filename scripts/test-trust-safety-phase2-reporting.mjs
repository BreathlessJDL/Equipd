#!/usr/bin/env node
/**
 * End-to-end verification for Trust & Safety Phase 2 (Reporting).
 *
 * Usage:
 *   node scripts/test-trust-safety-phase2-reporting.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY.
 * Run supabase/trust-safety-phase2-reporting.sql on Supabase first.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }
const SELLER = { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' }
const DEV_ADMIN = {
  email: 'dev-seller-london@equipd.dev',
  id: '11111111-1111-4111-8111-111111111103',
}

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

function logStep(title) {
  console.log(`\n=== ${title} ===`)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
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

async function findAdminUser(admin) {
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()

  if (adminProfile?.id) {
    const { data: authUsers } = await admin.auth.admin.listUsers()
    const authUser = authUsers?.users?.find((user) => user.id === adminProfile.id)
    return { id: adminProfile.id, email: authUser?.email ?? DEV_ADMIN.email }
  }

  const { error: bootstrapError } = await admin
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', DEV_ADMIN.id)

  if (bootstrapError) {
    throw new Error(
      `No admin profile found and bootstrap failed: ${bootstrapError.message}. Set profiles.is_admin = true manually.`,
    )
  }

  return DEV_ADMIN
}

async function findActiveListing(admin) {
  const { data, error } = await admin
    .from('listings')
    .select('id, seller_id, title')
    .eq('status', 'active')
    .neq('seller_id', BUYER.id)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to find listing: ${error.message}`)
  if (!data?.id) throw new Error('No active listing found for reporting test')

  return data
}

async function cleanupReports(admin, reporterId, listingId, reportedUserId) {
  await admin
    .from('reports')
    .delete()
    .eq('reporter_id', reporterId)
    .or(`listing_id.eq.${listingId},reported_user_id.eq.${reportedUserId}`)
}

loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('Missing Supabase env vars in .env.local')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

logStep('Setup')
const listing = await findActiveListing(admin)
const adminUser = await findAdminUser(admin)
await cleanupReports(admin, BUYER.id, listing.id, listing.seller_id)
logPass(`Using listing "${listing.title}" (${listing.id})`)

logStep('Logged-out user cannot report')
const loggedOutReport = await anon.rpc('create_report', {
  p_report_type: 'listing',
  p_reason: 'misleading_listing',
  p_description: null,
  p_reported_user_id: null,
  p_listing_id: listing.id,
  p_conversation_id: null,
  p_message_id: null,
})
assert(loggedOutReport.error, 'Logged-out create_report should fail')
logPass('Logged-out create_report rejected')

logStep('Logged-in buyer can report listing')
await signIn(anon, BUYER.email)
const listingReport = await anon.rpc('create_report', {
  p_report_type: 'listing',
  p_reason: 'misleading_listing',
  p_description: 'Photos do not match the item.',
  p_reported_user_id: null,
  p_listing_id: listing.id,
  p_conversation_id: null,
  p_message_id: null,
})
assert(!listingReport.error, `Listing report failed: ${listingReport.error?.message}`)
assert(listingReport.data?.id, 'Listing report should return a row')
logPass('Buyer created listing report')

logStep('Duplicate open listing report blocked')
const duplicateListingReport = await anon.rpc('create_report', {
  p_report_type: 'listing',
  p_reason: 'suspected_fraud',
  p_description: null,
  p_reported_user_id: null,
  p_listing_id: listing.id,
  p_conversation_id: null,
  p_message_id: null,
})
assert(duplicateListingReport.error, 'Duplicate open listing report should fail')
assert(
  duplicateListingReport.error.message.includes('open report'),
  'Duplicate listing report should mention open report',
)
logPass('Duplicate open listing report blocked')

logStep('Other reason requires description')
const otherMissing = await anon.rpc('create_report', {
  p_report_type: 'user',
  p_reason: 'other',
  p_description: null,
  p_reported_user_id: listing.seller_id,
  p_listing_id: null,
  p_conversation_id: null,
  p_message_id: null,
})
assert(otherMissing.error, 'User report with other reason and no description should fail')
logPass('Other reason without description rejected')

logStep('Logged-in buyer can report user')
const userReport = await anon.rpc('create_report', {
  p_report_type: 'user',
  p_reason: 'requested_off_platform_payment',
  p_description: 'Asked to pay by bank transfer.',
  p_reported_user_id: listing.seller_id,
  p_listing_id: null,
  p_conversation_id: null,
  p_message_id: null,
})
assert(!userReport.error, `User report failed: ${userReport.error?.message}`)
logPass('Buyer created user report')

logStep('Normal user cannot read other users reports')
const otherReports = await anon
  .from('reports')
  .select('id')
  .neq('reporter_id', BUYER.id)
  .limit(5)
assert(!otherReports.error, `Reporter select query failed: ${otherReports.error?.message}`)
assert(
  (otherReports.data ?? []).length === 0,
  'Reporter should not see reports opened by other users',
)
logPass('Buyer cannot read other users reports via direct select')

logStep('Admin can fetch and update reports')
await signIn(anon, adminUser.email)
const adminList = await anon.rpc('admin_list_reports', { p_status: 'open' })
assert(!adminList.error, `Admin list failed: ${adminList.error?.message}`)
assert((adminList.data ?? []).length >= 2, 'Admin should see open reports')
logPass('Admin fetched open reports')

const targetReport = adminList.data.find((entry) => entry.id === listingReport.data.id)
assert(targetReport?.id, 'Admin list should include buyer listing report')

const adminUpdate = await anon.rpc('admin_update_report_status', {
  p_report_id: targetReport.id,
  p_status: 'under_review',
  p_admin_note: 'Phase 2 test review',
})
assert(!adminUpdate.error, `Admin update failed: ${adminUpdate.error?.message}`)
assert(adminUpdate.data?.status === 'under_review', 'Admin update should change status')
logPass('Admin updated report status')

logStep('Cleanup')
await cleanupReports(admin, BUYER.id, listing.id, listing.seller_id)
logPass('Test reports cleaned up')

console.log('\nAll Trust & Safety Phase 2 reporting checks passed.')
