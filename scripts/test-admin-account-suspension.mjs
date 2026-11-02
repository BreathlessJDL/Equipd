#!/usr/bin/env node
/**
 * Guards the admin suspend/unsuspend trusted path.
 * Static checks always run. Optional live checks run only against local or
 * dedicated staging Supabase — never production.
 *
 *   node scripts/test-admin-account-suspension.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  assertServiceRoleTestNotProduction,
  isLocalSupabaseUrl,
  isProductionProjectRef,
  parseHostedSupabaseProjectRef,
  resolveConfiguredSupabaseUrl,
} from './lib/supabaseProjectSafety.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

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

function runStaticChecks() {
  const hardening = read('supabase/migrations/20260911140000_trust_safety_scam_hardening.sql')
  const fix = read('supabase/migrations/20261102140000_fix_admin_suspend_trusted_path.sql')
  const edge = read('supabase/functions/admin-moderate-user/index.ts')
  const client = read('src/lib/adminModeration.js')
  const usersPage = read('src/pages/AdminUsersPage.jsx')
  const trustPage = read('src/pages/AdminTrustSafetyPage.jsx')
  const adminErrors = read('src/lib/admin.js')

  assert.match(
    hardening,
    /Suspension fields can only be updated by the server/,
    'client profile updates still blocked by privilege trigger',
  )
  assert.match(
    hardening,
    /prevent_profile_privilege_client_updates/,
    'privilege trigger remains in place',
  )

  assert.match(fix, /drop function if exists public\.admin_suspend_user\(uuid, text\)/)
  assert.match(fix, /drop function if exists public\.admin_unsuspend_user\(uuid, text\)/)
  assert.match(fix, /p_admin_id uuid default null/)
  assert.match(fix, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(fix, /You cannot suspend yourself/)
  assert.match(fix, /Cannot suspend an admin account/)
  assert.match(fix, /Cannot suspend an official Equipd account/)
  assert.match(fix, /alreadyApplied', true/)
  assert.match(
    fix,
    /if v_row\.is_suspended then/,
    'retrying suspend does not rewrite an already-suspended profile',
  )
  assert.match(fix, /grant execute on function public\.admin_suspend_user\(uuid, text, uuid\) to service_role/)
  assert.match(fix, /grant execute on function public\.admin_unsuspend_user\(uuid, text, uuid\) to service_role/)
  assert.match(
    fix,
    /revoke all on function public\.admin_suspend_user\(uuid, text, uuid\) from public, anon, authenticated/,
  )
  assert.match(
    fix,
    /revoke all on function public\.admin_unsuspend_user\(uuid, text, uuid\) from public, anon, authenticated/,
  )
  assert.doesNotMatch(
    fix,
    /grant execute on function public\.admin_suspend_user[\s\S]* to authenticated/,
    'authenticated callers cannot execute suspend RPC',
  )

  assert.match(edge, /requireAdmin/)
  assert.match(edge, /getSupabaseAdmin\(\)/)
  assert.match(edge, /p_admin_id:\s*adminGate\.user\.id/)
  assert.doesNotMatch(
    edge,
    /createClient\(url, anonKey/,
    'edge function does not call suspend RPC with the caller JWT',
  )
  assert.match(edge, /ban_duration:\s*action === 'suspend' \? AUTH_BAN_DURATION : AUTH_UNBAN_DURATION/)
  assert.match(edge, /876000h/)
  assert.match(edge, /AUTH_UNBAN_DURATION = 'none'/)
  assert.match(
    edge,
    /const \{ data, error \} = await admin\.rpc\(rpcName/,
    'profile RPC runs before Auth ban',
  )
  const rpcIndex = edge.indexOf('await admin.rpc(rpcName')
  const banIndex = edge.indexOf('updateUserById')
  assert.ok(rpcIndex > -1 && banIndex > rpcIndex, 'Auth ban only runs after a successful profile RPC')
  assert.match(edge, /if \(error\) \{/)
  assert.match(edge, /authBanWarning/)
  assert.match(edge, /Incomplete: the Equipd profile is suspended/)
  assert.match(edge, /ok: !authBanWarning/)
  assert.match(edge, /authBanApplied: !authBanWarning/)
  assert.match(client, /moderationAuthWarning/)
  assert.match(usersPage, /warning/)
  assert.match(trustPage, /warning/)

  assert.match(client, /functions\.invoke\('admin-moderate-user'/)
  assert.doesNotMatch(client, /\.from\(['"]profiles['"]\)/, 'frontend does not update profiles directly')
  assert.doesNotMatch(client, /admin_suspend_user/, 'frontend does not call suspend RPC directly')
  assert.match(client, /payload\?\.error/)
  assert.match(usersPage, /getAdminErrorMessage\(suspendError\)/)
  assert.match(trustPage, /getAdminErrorMessage\(suspendError\)/)
  assert.match(adminErrors, /error\.message/)
  assert.match(usersPage, /You cannot suspend yourself|isAdmin \|\| isOfficial/)
  assert.match(usersPage, /Confirm suspend/)
  assert.match(usersPage, /Unsuspend/)

  console.log('static admin account suspension checks: ok')
}

async function runLiveChecks() {
  loadEnvFile('.env.local')
  const url = resolveConfiguredSupabaseUrl()
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anon || !service) {
    console.log('live admin account suspension checks: skipped (missing env)')
    return
  }

  if (!isLocalSupabaseUrl(url)) {
    const ref = parseHostedSupabaseProjectRef(url)
    if (!ref || isProductionProjectRef(ref)) {
      console.log('live admin account suspension checks: skipped (refusing production)')
      return
    }
  }

  assertServiceRoleTestNotProduction()

  const adminClient = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: fnMissing } = await adminClient.rpc('admin_suspend_user', {
    p_user_id: '00000000-0000-4000-8000-000000000000',
    p_reason: 'probe',
    p_admin_id: '00000000-0000-4000-8000-000000000000',
  })

  if (fnMissing?.message && /could not find the function/i.test(fnMissing.message)) {
    console.log(
      'live admin account suspension checks: skipped (migration not applied):',
      fnMissing.message,
    )
    return
  }

  const { data: sample, error: sampleError } = await adminClient
    .from('profiles')
    .select('id, is_admin, is_official_equipd, is_suspended')
    .limit(1)

  if (sampleError) {
    console.log(
      'live admin account suspension checks: skipped (cannot read profiles):',
      sampleError.message,
    )
    return
  }

  const probeId = sample?.[0]?.id
  if (probeId) {
    const { error: directError } = await anonClient
      .from('profiles')
      .update({
        is_suspended: true,
        suspension_reason: 'client probe',
      })
      .eq('id', probeId)

    assert.ok(directError, 'anonymous client must not update suspension fields')
    assert.match(
      String(directError.message || ''),
      /Suspension fields can only be updated by the server|row-level security/i,
      'direct client suspension update is rejected',
    )
  }

  const { error: anonRpcError } = await anonClient.rpc('admin_suspend_user', {
    p_user_id: '00000000-0000-4000-8000-000000000000',
    p_reason: 'probe',
    p_admin_id: '00000000-0000-4000-8000-000000000000',
  })
  assert.ok(anonRpcError, 'anon cannot execute admin_suspend_user')

  const { error: nonAdminRpcError } = await adminClient.rpc('admin_suspend_user', {
    p_user_id: '00000000-0000-4000-8000-000000000000',
    p_reason: 'probe',
    p_admin_id: '00000000-0000-4000-8000-000000000000',
  })
  assert.ok(nonAdminRpcError, 'service-role RPC still requires a real admin id')
  assert.match(
    String(nonAdminRpcError.message || ''),
    /Admin access required|User not found|Authentication required/,
    'non-admin p_admin_id is rejected',
  )

  console.log('live admin account suspension checks: ok (no production writes)')
}

runStaticChecks()
await runLiveChecks()
console.log('test-admin-account-suspension: ok')
