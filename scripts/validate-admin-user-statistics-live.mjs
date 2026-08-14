#!/usr/bin/env node
/**
 * Production security + count validation for admin_user_statistics.
 * Does not print emails, passwords, or secrets.
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'

loadEnvFiles()

const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ADMIN_TEST_EMAIL?.trim()

if (!url || !anonKey || !serviceKey || !adminEmail) {
  console.error('Missing required env for admin user statistics validation')
  process.exit(1)
}

function plusAddress(baseEmail, tag) {
  const at = baseEmail.indexOf('@')
  return `${baseEmail.slice(0, at)}+${tag}@${baseEmail.slice(at + 1)}`
}

async function createTestUser(service, email, username, { isAdmin = false } = {}) {
  const password = `EquipdLive_${randomUUID().slice(0, 12)}!`
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const userId = data.user.id
  await service.from('profiles').upsert({
    id: userId,
    username,
    display_name: username,
    is_admin: isAdmin,
  })
  return { userId, email, password }
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return { client: null, error: error.message ?? 'sign_in_failed' }
  return { client, error: null }
}

function summarize(data) {
  if (!data || typeof data !== 'object') return null
  const latest = Array.isArray(data.latestSignups) ? data.latestSignups : []
  return {
    totalUsers: data.totalUsers ?? null,
    newToday: data.newToday ?? null,
    last7Days: data.last7Days ?? null,
    last30Days: data.last30Days ?? null,
    usersWhoHaveListed: data.usersWhoHaveListed ?? null,
    latestCount: latest.length,
    latestHasUsername: latest.every((row) => Boolean(row.username || row.displayName)),
    latestHasEmail: latest.every((row) => typeof row.email === 'string' && row.email.includes('@')),
    latestHasCreatedAt: latest.every((row) => Boolean(row.createdAt)),
    newestFirst: latest.length < 2 || new Date(latest[0].createdAt) >= new Date(latest[latest.length - 1].createdAt),
  }
}

function invariants(s) {
  if (!s) return false
  return (
    s.newToday <= s.last7Days &&
    s.last7Days <= s.last30Days &&
    s.last30Days <= s.totalUsers &&
    s.usersWhoHaveListed <= s.totalUsers
  )
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tag = randomUUID().slice(0, 8)
const createdIds = []

try {
  const anonRpc = await anon.rpc('admin_user_statistics')

  const nonAdmin = await createTestUser(
    service,
    plusAddress(adminEmail, `stats-user-${tag}`),
    `statsuser_${tag}`,
    { isAdmin: false },
  )
  createdIds.push(nonAdmin.userId)
  const nonAdminAuth = await signIn(url, anonKey, nonAdmin.email, nonAdmin.password)
  if (nonAdminAuth.error) throw new Error('non_admin_login_failed')
  const userRpc = await nonAdminAuth.client.rpc('admin_user_statistics')
  await nonAdminAuth.client.auth.signOut()

  const adminUser = await createTestUser(
    service,
    plusAddress(adminEmail, `stats-admin-${tag}`),
    `statsadm_${tag}`,
    { isAdmin: true },
  )
  createdIds.push(adminUser.userId)
  const adminAuth = await signIn(url, anonKey, adminUser.email, adminUser.password)
  if (adminAuth.error) throw new Error('admin_login_failed')
  const adminRpc = await adminAuth.client.rpc('admin_user_statistics')
  await adminAuth.client.auth.signOut()
  const adminSummary = summarize(adminRpc.data)

  const result = {
    admin: {
      ok: !adminRpc.error && Boolean(adminSummary),
      error: adminRpc.error ? 'blocked_or_failed' : null,
      counts: adminSummary,
      invariantsOk: invariants(adminSummary),
    },
    nonAdmin: {
      blocked: Boolean(userRpc.error) && userRpc.data == null,
      returnedData: userRpc.data != null,
    },
    anonymous: {
      blocked: Boolean(anonRpc.error) && anonRpc.data == null,
      returnedData: anonRpc.data != null,
    },
  }

  const failed =
    !result.admin.ok ||
    !result.admin.invariantsOk ||
    !result.nonAdmin.blocked ||
    !result.anonymous.blocked ||
    result.admin.counts.totalUsers < 68

  console.log(JSON.stringify(result, null, 2))
  if (failed) process.exitCode = 1
} catch (error) {
  console.error(error instanceof Error ? error.message : 'validation_failed')
  process.exitCode = 1
} finally {
  for (const userId of createdIds) {
    await service.from('profiles').delete().eq('id', userId)
    await service.auth.admin.deleteUser(userId)
  }
}
