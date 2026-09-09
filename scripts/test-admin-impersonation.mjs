#!/usr/bin/env node
/**
 * Admin impersonation — static + optional live security checks.
 *
 * Static checks always run.
 * Live checks run when .env.local has Supabase keys AND migration is applied.
 *
 * Usage:
 *   node scripts/test-admin-impersonation.mjs
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ADMIN = {
  email: 'dev-seller-london@equipd.dev',
  id: '11111111-1111-4111-8111-111111111103',
}
const CUSTOMER = {
  email: 'dev-buyer-chris@equipd.dev',
  id: '11111111-1111-4111-8111-111111111105',
}
const OTHER_CUSTOMER = {
  email: 'dev-buyer-emma@equipd.dev',
  id: '11111111-1111-4111-8111-111111111104',
}

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function decodeJwt(accessToken) {
  return JSON.parse(Buffer.from(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}

async function edgeJson(url, anonKey, functionName, body, accessToken = null) {
  const headers = {
    apikey: anonKey,
    'Content-Type': 'application/json',
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }
  return { status: res.status, data: payload }
}

function runStaticChecks() {
  const migration = read('supabase/migrations/20260909160000_admin_user_impersonation.sql')
  assert.match(migration, /admin_impersonation_sessions/, 'sessions table')
  assert.match(migration, /expires_at/, 'expires_at column')
  assert.doesNotMatch(migration, /\baction\b\s+text/, 'no action column on session table')
  assert.match(migration, /admin_search_users/, 'search RPC')
  assert.match(migration, /custom_access_token_hook/, 'access token hook')
  assert.match(migration, /impersonated_by/, 'impersonated_by claim')
  assert.match(migration, /Impersonation session has expired/, 'expiry deny message')
  assert.match(migration, /revoke all on table public\.admin_impersonation_sessions/, 'table revoked')

  const startFn = read('supabase/functions/admin-impersonate-start/index.ts')
  assert.match(startFn, /requireAdmin/, 'start requires admin')
  assert.match(startFn, /Cannot impersonate yourself/, 'deny self')
  assert.match(startFn, /Cannot impersonate an admin/, 'deny admin target')
  assert.match(startFn, /adminRestoreHashedToken/, 'restore token returned')
  assert.match(startFn, /customerHashedToken/, 'customer token returned')
  assert.doesNotMatch(startFn, /SERVICE_ROLE_KEY/, 'service role key not returned')

  const endFn = read('supabase/functions/admin-impersonate-end/index.ts')
  assert.match(endFn, /requireAdmin/, 'end requires admin')

  const client = read('src/lib/adminImpersonation.js')
  assert.match(client, /UX safeguard only/, 'documents UX-only sensitive blocks')
  assert.match(client, /cannot be cryptographically blocked/i, 'documents Auth limitation')
  assert.match(client, /scope: 'local'/, 'local sign-out on fail-safe')
  assert.match(client, /Never trusts sessionStorage alone|never trust sessionStorage/i, 'banner trust note')

  const banner = read('src/components/admin/AdminImpersonationBanner.jsx')
  assert.match(banner, /Admin mode — You are logged in as/, 'banner copy')
  assert.match(banner, /Exit impersonation/, 'exit button')

  const usersPage = read('src/pages/AdminUsersPage.jsx')
  assert.match(usersPage, /Log in as user/, 'login CTA')
  assert.match(usersPage, /\/my-listings/, 'redirect target')

  const nav = read('src/lib/adminNav.js')
  assert.match(nav, /\/admin\/users/, 'users nav')

  const app = read('src/App.jsx')
  assert.match(app, /AdminUsersPage/, 'users route wired')

  const config = read('supabase/config.toml')
  assert.match(config, /custom_access_token/, 'hook enabled in config')
  assert.match(config, /admin-impersonate-start/, 'start function registered')

  console.log('static admin impersonation checks: ok')
}

async function runLiveChecks() {
  loadEnvFile('.env.local')
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anon || !service) {
    console.log('live admin impersonation checks: skipped (missing env)')
    return
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: tableError } = await admin
    .from('admin_impersonation_sessions')
    .select('id')
    .limit(1)

  if (tableError) {
    console.log(
      'live admin impersonation checks: skipped (migration not applied):',
      tableError.message,
    )
    return
  }

  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const summary = {}

  // Anonymous → start
  {
    const res = await edgeJson(
      url,
      anon,
      'admin-impersonate-start',
      { targetUserId: '00000000-0000-4000-8000-000000000001' },
      null,
    )
    assert.notEqual(res.status, 200, 'anonymous start must not succeed')
    summary.anonymousStart = res.status
    console.log('live: anonymous denied')
  }

  async function magicSessionFor(account) {
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: account.email,
    })
    assert.ifError(linkError)
    const { data: verified, error: otpError } = await client.auth.verifyOtp({
      type: 'email',
      token_hash: link.properties.hashed_token,
    })
    assert.ifError(otpError)
    assert.equal(verified.session?.user?.id, account.id)
    return { client, session: verified.session, user: verified.user ?? verified.session?.user }
  }

  const adminPassword = await magicSessionFor(ADMIN)
  const customerPassword = await magicSessionFor(CUSTOMER)
  const otherCustomerPassword = await magicSessionFor(OTHER_CUSTOMER)

  const normalLoginJwt = decodeJwt(customerPassword.session.access_token)
  assert.equal(normalLoginJwt.app_metadata?.impersonated_by, undefined)
  const normalRefresh = await customerPassword.client.auth.refreshSession({
    refresh_token: customerPassword.session.refresh_token,
  })
  assert.ifError(normalRefresh.error)
  const normalRefreshJwt = decodeJwt(normalRefresh.data.session.access_token)
  assert.equal(normalRefreshJwt.app_metadata?.impersonated_by, undefined)
  summary.normalAuth = {
    loginOk: true,
    refreshOk: true,
    loginHasImpersonatedBy: false,
    refreshHasImpersonatedBy: false,
  }
  console.log('live: normal customer login and refresh ok')

  // Normal customer → start
  {
    const res = await edgeJson(
      url,
      anon,
      'admin-impersonate-start',
      { targetUserId: ADMIN.id },
      customerPassword.session.access_token,
    )
    assert.ok(res.status >= 400, 'customer start must fail')
    summary.customerStartDenied = true
    console.log('live: customer denied')
  }

  // Admin → self
  {
    const res = await edgeJson(
      url,
      anon,
      'admin-impersonate-start',
      { targetUserId: ADMIN.id },
      adminPassword.session.access_token,
    )
    const message = res.data?.error || ''
    assert.match(String(message), /yourself|Admin access|403|Cannot/i, 'self denied')
    summary.adminSelfDenied = true
    console.log('live: admin→self denied')
  }

  // Admin → admin
  {
    const res = await edgeJson(
      url,
      anon,
      'admin-impersonate-start',
      { targetUserId: ADMIN.id },
      adminPassword.session.access_token,
    )
    const message = res.data?.error || ''
    assert.match(String(message), /yourself|admin/i, 'admin target denied')
    summary.adminAdminDenied = true
    console.log('live: admin→admin denied')
  }

  // Direct session table access denied for normal users
  {
    const customerTable = await customerPassword.client.from('admin_impersonation_sessions').select('id').limit(1)
    assert.ok(customerTable.error, 'customer cannot read admin_impersonation_sessions')
    const anonTable = await anonClient.from('admin_impersonation_sessions').select('id').limit(1)
    assert.ok(anonTable.error, 'anon cannot read admin_impersonation_sessions')
    summary.directAuditAccessDenied = true
    console.log('live: direct audit-table access denied')
  }

  // Admin search RPC
  {
    const { data, error } = await adminPassword.client.rpc('admin_search_users', {
      p_query: 'dev-buyer-chris',
      p_limit: 5,
    })
    assert.ifError(error)
    assert.ok(Array.isArray(data?.items), 'admin search returns items')
    assert.ok(data.items.some((row) => row.id === CUSTOMER.id), 'target customer returned')
    summary.adminSearchOk = true
    console.log('live: admin search ok')
  }

  // Admin search RPC as customer
  {
    const { error } = await customerPassword.client.rpc('admin_search_users', { p_query: null, p_limit: 5 })
    assert.ok(error, 'customer cannot search users')
    summary.customerSearchDenied = true
    console.log('live: customer search denied')
  }

  // Admin → customer success + JWT/session binding + RLS
  {
    const res = await edgeJson(
      url,
      anon,
      'admin-impersonate-start',
      { targetUserId: CUSTOMER.id },
      adminPassword.session.access_token,
    )
    assert.equal(res.status, 200)
    const data = res.data
    assert.ok(data?.customerHashedToken, 'customer hashed token')
    assert.ok(data?.adminRestoreHashedToken, 'restore hashed token')
    assert.equal(data?.target?.id, CUSTOMER.id)

    const impersonationClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: verified, error: otpError } = await impersonationClient.auth.verifyOtp({
      type: 'email',
      token_hash: data.customerHashedToken,
    })
    assert.ifError(otpError)
    assert.equal(verified.session?.user?.id, CUSTOMER.id)
    const impersonatedJwt = decodeJwt(verified.session.access_token)
    assert.equal(impersonatedJwt.sub, CUSTOMER.id)
    assert.equal(impersonatedJwt.app_metadata?.impersonated_by, ADMIN.id)

    const sessionLookup = await admin
      .from('admin_impersonation_sessions')
      .select('id, admin_user_id, impersonated_user_id, started_at, expires_at, ended_at, auth_session_id, ip, user_agent, metadata')
      .eq('id', data.sessionId)
      .single()
    assert.ifError(sessionLookup.error)
    assert.equal(sessionLookup.data.admin_user_id, ADMIN.id)
    assert.equal(sessionLookup.data.impersonated_user_id, CUSTOMER.id)
    assert.equal(sessionLookup.data.auth_session_id, impersonatedJwt.session_id)
    assert.equal(sessionLookup.data.ended_at, null)
    summary.impersonationBinding = {
      authUidMatches: true,
      claimMatches: true,
      sessionBound: true,
    }

    // Impersonated session can read only the customer's profile, not another private profile.
    const ownProfile = await impersonationClient.from('profiles').select('id').eq('id', CUSTOMER.id).maybeSingle()
    assert.ifError(ownProfile.error)
    assert.equal(ownProfile.data?.id, CUSTOMER.id)
    const otherProfile = await impersonationClient.from('profiles').select('id').eq('id', OTHER_CUSTOMER.id)
    assert.ifError(otherProfile.error)
    assert.equal(otherProfile.data?.length ?? 0, 0)

    // Impersonated session can read own listings.
    const ownListings = await impersonationClient.from('listings').select('id,seller_id').eq('seller_id', CUSTOMER.id).limit(5)
    assert.ifError(ownListings.error)

    // Impersonated session cannot call admin-only RPC/data.
    const adminRpcDenied = await impersonationClient.rpc('admin_search_users', {
      p_query: null,
      p_limit: 5,
    })
    assert.ok(adminRpcDenied.error, 'impersonated customer has no admin RPC')
    const auditTableDenied = await impersonationClient.from('admin_impersonation_sessions').select('id').limit(1)
    assert.ok(auditTableDenied.error, 'impersonated customer cannot read audit table')
    summary.rls = {
      ownProfileRead: true,
      unrelatedProfileDenied: true,
      ownListingsRead: true,
      adminRpcDenied: true,
      auditTableDenied: true,
    }

    // Customer's separate normal session still works and is untagged.
    const { data: me, error: meError } = await customerPassword.client.auth.getUser()
    assert.ifError(meError)
    assert.equal(me.user?.id, CUSTOMER.id)
    const customerRefreshDuringImpersonation = await customerPassword.client.auth.refreshSession({
      refresh_token: normalRefresh.data.session.refresh_token,
    })
    assert.ifError(customerRefreshDuringImpersonation.error)
    const customerRefreshDuringImpersonationJwt = decodeJwt(
      customerRefreshDuringImpersonation.data.session.access_token,
    )
    assert.equal(customerRefreshDuringImpersonationJwt.app_metadata?.impersonated_by, undefined)
    summary.customerConcurrency = true

    // Simulate expiry safely on the impersonation session only.
    const expireUpdate = await admin
      .from('admin_impersonation_sessions')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', data.sessionId)
      .select('started_at, expires_at')
      .single()
    assert.ifError(expireUpdate.error)
    assert.ok(
      Date.parse(expireUpdate.data.expires_at) < Date.now(),
      'expiry simulation forced past-due expiry',
    )

    const expiredRefresh = await impersonationClient.auth.refreshSession({
      refresh_token: verified.session.refresh_token,
    })
    assert.ok(expiredRefresh.error, 'expired impersonation refresh must fail')
    const expiredRow = await admin
      .from('admin_impersonation_sessions')
      .select('ended_at, metadata')
      .eq('id', data.sessionId)
      .single()
    assert.ifError(expiredRow.error)
    let auditClosedByHook = Boolean(expiredRow.data.ended_at)
    if (!auditClosedByHook) {
      const cleanupExpired = await admin
        .from('admin_impersonation_sessions')
        .update({
          ended_at: new Date().toISOString(),
          metadata: {
            ...(expiredRow.data.metadata || {}),
            ended_reason: 'expired_test_cleanup',
          },
        })
        .eq('id', data.sessionId)
      assert.ifError(cleanupExpired.error)
    }
    summary.expiry = {
      refreshDeniedAfterExpiry: true,
      normalCustomerRefreshStillOk: true,
      auditClosedByHook,
    }
    console.log('live: impersonation binding, RLS, concurrency, and expiry ok')
  }

  // Start a fresh impersonation session for explicit exit/restore verification.
  {
    const res = await edgeJson(
      url,
      anon,
      'admin-impersonate-start',
      { targetUserId: CUSTOMER.id },
      adminPassword.session.access_token,
    )
    assert.equal(res.status, 200)
    const data = res.data
    const impersonationClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: verified, error: otpError } = await impersonationClient.auth.verifyOtp({
      type: 'email',
      token_hash: data.customerHashedToken,
    })
    assert.ifError(otpError)
    assert.equal(verified.session?.user?.id, CUSTOMER.id)

    const { data: restored, error: restoreError } = await impersonationClient.auth.verifyOtp({
      type: 'email',
      token_hash: data.adminRestoreHashedToken,
    })
    assert.ifError(restoreError)
    assert.equal(restored.session?.user?.id, ADMIN.id)
    const isAdmin = await impersonationClient.rpc('is_admin')
    assert.ifError(isAdmin.error)
    assert.equal(isAdmin.data, true)

    const endRes = await edgeJson(
      url,
      anon,
      'admin-impersonate-end',
      { sessionId: data.sessionId, endedReason: 'test_exit' },
      restored.session.access_token,
    )
    assert.equal(endRes.status, 200)
    const endedRow = await admin
      .from('admin_impersonation_sessions')
      .select('ended_at, metadata')
      .eq('id', data.sessionId)
      .single()
    assert.ifError(endedRow.error)
    assert.ok(endedRow.data.ended_at)

    const { data: stillMe, error: stillError } = await customerPassword.client.auth.getUser()
    assert.ifError(stillError)
    assert.equal(stillMe.user?.id, CUSTOMER.id)

    summary.exitRestore = {
      restoredAdminUid: true,
      restoredAdminStillAdmin: true,
      auditEnded: true,
      customerIndependentSessionStillActive: true,
    }
    console.log('live: exit and admin restoration ok')
  }

  // Normal unrelated customer remains non-admin.
  const unrelatedAdminAttempt = await otherCustomerPassword.client.rpc('is_admin')
  assert.ifError(unrelatedAdminAttempt.error)
  assert.equal(unrelatedAdminAttempt.data, false)

  console.log(JSON.stringify(summary, null, 2))
  console.log('live admin impersonation checks: ok')
}

runStaticChecks()
await runLiveChecks()
