#!/usr/bin/env node
/**
 * Controlled production validation for equipment_item_saved emails.
 * Never logs full emails, API keys, webhook secrets, or template IDs.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskEmail } from '../supabase/functions/_shared/emailFormatting.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MARKER = 'saved-email-live-validation'
const LISTING_TITLE = 'Life Fitness E5 Cross-Trainer'
const EXPECTED_SUBJECT = `Someone saved your ${LISTING_TITLE}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function loadEnvFile(filename) {
  const filePath = join(ROOT, filename)
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

function plusAddress(baseEmail, tag) {
  const at = baseEmail.indexOf('@')
  if (at <= 0) throw new Error('ADMIN_TEST_EMAIL is invalid')
  return `${baseEmail.slice(0, at)}+${tag}@${baseEmail.slice(at + 1)}`
}

function log(step, detail = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), step, ...detail }))
}

function idempotencyKey(listingId, saverUserId) {
  return `equipment_item_saved:${listingId}:${saverUserId}`
}

async function waitForEmailLog(admin, key, { timeoutMs = 50000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const { data, error } = await admin
      .from('transactional_email_log')
      .select(
        'id, template_key, status, idempotency_key, recipient_user_id, related_listing_id, provider_message_id, error_message, created_at, sent_at',
      )
      .eq('idempotency_key', key)
      .maybeSingle()
    if (error) throw error
    if (data && (data.status === 'sent' || data.status === 'failed' || data.status === 'skipped')) {
      return data
    }
    await sleep(1500)
  }

  const { data: pending } = await admin
    .from('transactional_email_log')
    .select(
      'id, template_key, status, idempotency_key, recipient_user_id, related_listing_id, provider_message_id, error_message, created_at, sent_at',
    )
    .eq('idempotency_key', key)
    .maybeSingle()
  return pending
}

async function countEmailLogs(admin, key) {
  const { count, error } = await admin
    .from('transactional_email_log')
    .select('id', { count: 'exact', head: true })
    .eq('idempotency_key', key)
  if (error) throw error
  return count ?? 0
}

async function fetchSendGridActivity(apiKey, { messageId, subject }) {
  if (!apiKey) return { ok: false, reason: 'no_sendgrid_key' }
  const queries = []
  if (messageId) queries.push(`msg_id="${messageId}"`)
  if (subject) queries.push(`subject="${subject}"`)

  for (let attempt = 0; attempt < 10; attempt += 1) {
    for (const query of queries) {
      const response = await fetch(
        `https://api.sendgrid.com/v3/messages?limit=5&query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      )
      if (!response.ok) {
        return { ok: false, reason: `messages_api_${response.status}`, httpStatus: response.status }
      }
      const json = await response.json()
      const row = (json.messages || []).find((message) => {
        if (messageId && String(message.msg_id || '').includes(String(messageId).split('.')[0])) {
          return true
        }
        return query.startsWith('subject=') && message.subject === subject
      }) || json.messages?.[0]
      if (row?.subject) {
        return {
          ok: true,
          status: row.status ?? null,
          subject: row.subject ?? null,
          subjectBlank: !String(row.subject ?? '').trim(),
          matchesExpected: row.subject === subject,
          queriedBy: query.startsWith('msg_id') ? 'msg_id' : 'subject',
        }
      }
    }
    await sleep(2500)
  }

  return { ok: true, status: 'accepted_pending_activity' }
}

async function createTempUser(admin, email, username, displayName) {
  const password = `EquipdLive_${randomUUID().slice(0, 12)}!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  })
  if (error) throw error
  const userId = data.user.id
  await admin.from('profiles').upsert({
    id: userId,
    username,
    display_name: displayName,
  })
  return { userId, email, username, password }
}

async function ensureCategoryId(admin) {
  const { data, error } = await admin.from('categories').select('id').limit(1).maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error('No categories available for test listing')
  return data.id
}

function userClient(supabaseUrl, anonKey) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signedInClient(supabaseUrl, anonKey, email, password) {
  const client = userClient(supabaseUrl, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function invokeMarketplaceEmail(url, secret, eventKey, payload) {
  const response = await fetch(`${url}/functions/v1/send-marketplace-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-marketplace-email-secret': secret,
    },
    body: JSON.stringify({ eventKey, payload }),
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { httpStatus: response.status, body: json }
}

function dynamicDataLooksPrivate(data) {
  if (!data || typeof data !== 'object') return false
  const blob = JSON.stringify(data)
  return /saverUserId|saver_user_id|saver_name|saverName|jamesgym|userc_|userc-/i.test(blob)
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL?.trim()
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim()

  if (!supabaseUrl || !serviceKey || !anonKey || !adminEmail) {
    throw new Error('Missing VITE_SUPABASE_URL, keys, or ADMIN_TEST_EMAIL')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const runId = randomUUID().slice(0, 8)
  const sellerEmail = plusAddress(adminEmail, `saveseller-${runId}`)
  const saverBEmail = plusAddress(adminEmail, `saveb-${runId}`)
  const saverCEmail = plusAddress(adminEmail, `savec-${runId}`)
  const results = []
  const created = {
    sellerId: null,
    saverBId: null,
    saverCId: null,
    listingId: null,
    failListingId: null,
    failSellerId: null,
    failSaverId: null,
  }

  log('start', {
    runId,
    seller: maskEmail(sellerEmail),
    saverB: maskEmail(saverBEmail),
    saverC: maskEmail(saverCEmail),
    expectedSubject: EXPECTED_SUBJECT,
  })

  try {
    const { data: secretRow, error: secretErr } = await admin
      .from('app_config')
      .select('value')
      .eq('key', 'marketplace_email_webhook_secret')
      .maybeSingle()
    if (secretErr || !secretRow?.value) {
      throw new Error('marketplace_email_webhook_secret missing from app_config')
    }
    const webhookSecret = String(secretRow.value).trim()

    const seller = await createTempUser(admin, sellerEmail, `sarahlifts_${runId}`, 'Sarah Mitchell')
    const saverB = await createTempUser(admin, saverBEmail, `userv_${runId}`, 'User Bee')
    const saverC = await createTempUser(admin, saverCEmail, `userc_${runId}`, 'User Cee')
    created.sellerId = seller.userId
    created.saverBId = saverB.userId
    created.saverCId = saverC.userId

    const categoryId = await ensureCategoryId(admin)
    const listingId = randomUUID()
    created.listingId = listingId
    const listingSlug = `life-fitness-e5-cross-trainer-${runId}`

    const { error: listingErr } = await admin.from('listings').insert({
      id: listingId,
      seller_id: seller.userId,
      category_id: categoryId,
      slug: listingSlug,
      title: LISTING_TITLE,
      brand: 'Life Fitness',
      model: 'E5',
      description: `${MARKER} temporary listing — safe to delete`,
      price_pence: 89900,
      condition: 'good',
      location: 'Leeds, UK',
      collection_available: true,
      courier_available: false,
      status: 'active',
      source: 'manual',
      published_at: new Date().toISOString(),
    })
    if (listingErr) throw listingErr

    const clientB = await signedInClient(supabaseUrl, anonKey, saverB.email, saverB.password)
    const clientC = await signedInClient(supabaseUrl, anonKey, saverC.email, saverC.password)
    const clientSeller = await signedInClient(supabaseUrl, anonKey, seller.email, seller.password)

    // Test A — first save
    const saveA = await clientB
      .from('saved_listings')
      .insert({ user_id: saverB.userId, listing_id: listingId })
      .select('id, user_id, listing_id')
      .single()
    if (saveA.error) throw saveA.error

    const favouriteAfterA = await admin
      .from('saved_listings')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', saverB.userId)
      .maybeSingle()

    const keyB = idempotencyKey(listingId, saverB.userId)
    const logA = await waitForEmailLog(admin, keyB)
    const sgA = await fetchSendGridActivity(sendgridKey, {
      messageId: logA?.provider_message_id,
      subject: EXPECTED_SUBJECT,
    })

    const invokeInspect = await invokeMarketplaceEmail(supabaseUrl, webhookSecret, 'equipment_item_saved', {
      listingId,
      saverUserId: saverB.userId,
      savedListingId: saveA.data.id,
    })

    results.push({
      test: 'A_first_save',
      favouriteCreated: Boolean(saveA.data?.id) && Boolean(favouriteAfterA.data?.id),
      emailLogStatus: logA?.status ?? 'missing',
      emailCountForKey: await countEmailLogs(admin, keyB),
      recipientIsSeller: logA?.recipient_user_id === seller.userId,
      saverDidNotReceive: logA?.recipient_user_id !== saverB.userId,
      idempotencyKeyFormatOk: logA?.idempotency_key === keyB,
      subject: sgA.subject ?? null,
      subjectMatches: sgA.matchesExpected === true,
      subjectBlank: sgA.subjectBlank === true,
      sendGridStatus: sgA.status ?? sgA.reason ?? null,
      expectedCta: `https://equipd.co.uk/listings/${listingSlug}`,
      expectedFirstName: seller.username,
      expectedSaveCountText: '1 person has saved this item',
      invokeAfterSendSkipped: Boolean(invokeInspect.body?.skipped || invokeInspect.body?.reason),
      privacyLeakInInvoke: dynamicDataLooksPrivate(invokeInspect.body?.dynamicData || invokeInspect.body),
      error: logA?.error_message ?? null,
    })

    // Test B — unsave
    const unsave = await clientB
      .from('saved_listings')
      .delete()
      .eq('user_id', saverB.userId)
      .eq('listing_id', listingId)
    if (unsave.error) throw unsave.error
    await sleep(6000)
    const favouriteAfterUnsave = await admin
      .from('saved_listings')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', saverB.userId)
      .maybeSingle()
    const logsAfterUnsave = await countEmailLogs(admin, keyB)

    results.push({
      test: 'B_unsave',
      favouriteRemoved: !favouriteAfterUnsave.data,
      emailLogCountUnchanged: logsAfterUnsave === 1,
      noNewEmail: logsAfterUnsave === 1,
    })

    // Test C — save again
    const saveC = await clientB
      .from('saved_listings')
      .insert({ user_id: saverB.userId, listing_id: listingId })
      .select('id')
      .single()
    if (saveC.error) throw saveC.error
    await sleep(8000)
    const retryC = await invokeMarketplaceEmail(supabaseUrl, webhookSecret, 'equipment_item_saved', {
      listingId,
      saverUserId: saverB.userId,
    })
    const logsAfterResave = await countEmailLogs(admin, keyB)

    results.push({
      test: 'C_save_again',
      favouriteCreated: Boolean(saveC.data?.id),
      emailLogCount: logsAfterResave,
      noSecondEmail: logsAfterResave === 1,
      invokeSkipped: Boolean(retryC.body?.skipped || retryC.body?.reason || retryC.httpStatus === 200),
      invokeHttpStatus: retryC.httpStatus,
    })

    // Test D — different saver
    const saveD = await clientC
      .from('saved_listings')
      .insert({ user_id: saverC.userId, listing_id: listingId })
      .select('id')
      .single()
    if (saveD.error) throw saveD.error
    const keyC = idempotencyKey(listingId, saverC.userId)
    const logD = await waitForEmailLog(admin, keyC)
    const { count: saveCountAfterD } = await admin
      .from('saved_listings')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)

    results.push({
      test: 'D_different_saver',
      favouriteCreated: Boolean(saveD.data?.id),
      emailLogStatus: logD?.status ?? 'missing',
      distinctIdempotencyKey: keyC !== keyB,
      recipientIsSeller: logD?.recipient_user_id === seller.userId,
      genuineSaveCount: saveCountAfterD ?? null,
      expectedSaveCount: 2,
      expectedSaveCountText: '2 people have saved this item',
      error: logD?.error_message ?? null,
    })

    // Test E — self-save protection
    const selfSaveClient = await clientSeller
      .from('saved_listings')
      .insert({ user_id: seller.userId, listing_id: listingId })
      .select('id')
      .single()
    const selfSaveAdmin = await admin
      .from('saved_listings')
      .insert({ user_id: seller.userId, listing_id: listingId })
      .select('id')
      .single()
    await sleep(8000)
    const keySelf = idempotencyKey(listingId, seller.userId)
    const selfLog = await admin
      .from('transactional_email_log')
      .select('id, status')
      .eq('idempotency_key', keySelf)
      .maybeSingle()
    const invokeSelf = await invokeMarketplaceEmail(supabaseUrl, webhookSecret, 'equipment_item_saved', {
      listingId,
      saverUserId: seller.userId,
    })

    results.push({
      test: 'E_self_save',
      clientInsertBlocked: Boolean(selfSaveClient.error),
      adminInsertCreatedFavourite: Boolean(selfSaveAdmin.data?.id),
      noEmailLog: !selfLog.data,
      invokeSkippedSelfSave: Boolean(invokeSelf.body?.skipped || invokeSelf.body?.reason),
      invokeReason: invokeSelf.body?.reason ?? invokeSelf.body?.error ?? null,
    })

    // Failure isolation + failed-log retry semantics on a separate listing
    const failSeller = await createTempUser(
      admin,
      plusAddress(adminEmail, `savefail-s-${runId}`),
      `savefail_s_${runId}`,
      'Fail Seller',
    )
    const failSaver = await createTempUser(
      admin,
      plusAddress(adminEmail, `savefail-b-${runId}`),
      `savefail_b_${runId}`,
      'Fail Saver',
    )
    created.failSellerId = failSeller.userId
    created.failSaverId = failSaver.userId
    const failListingId = randomUUID()
    created.failListingId = failListingId
    const { error: failListingErr } = await admin.from('listings').insert({
      id: failListingId,
      seller_id: failSeller.userId,
      category_id: categoryId,
      slug: `saved-email-fail-isolation-${runId}`,
      title: LISTING_TITLE,
      brand: 'Life Fitness',
      model: 'E5',
      description: `${MARKER} failure isolation listing — safe to delete`,
      price_pence: 10000,
      condition: 'good',
      location: 'Leeds, UK',
      collection_available: true,
      courier_available: false,
      status: 'active',
      source: 'manual',
      published_at: new Date().toISOString(),
    })
    if (failListingErr) throw failListingErr

    const failKey = idempotencyKey(failListingId, failSaver.userId)
    const failClient = await signedInClient(supabaseUrl, anonKey, failSaver.email, failSaver.password)
    const failSave = await failClient
      .from('saved_listings')
      .insert({ user_id: failSaver.userId, listing_id: failListingId })
      .select('id')
      .single()
    if (failSave.error) throw failSave.error

    const favouriteImmediately = await failClient
      .from('saved_listings')
      .select('id, listing_id')
      .eq('listing_id', failListingId)
      .maybeSingle()

    const failLog = await waitForEmailLog(admin, failKey)
    const favouriteAfterEmail = await failClient
      .from('saved_listings')
      .select('id')
      .eq('listing_id', failListingId)
      .maybeSingle()

    const brokenInvoke = await invokeMarketplaceEmail(supabaseUrl, webhookSecret, 'equipment_item_saved', {
      listingId: failListingId,
    })
    const favouriteAfterBrokenInvoke = await failClient
      .from('saved_listings')
      .select('id')
      .eq('listing_id', failListingId)
      .maybeSingle()

    if (failLog?.id && failLog.status === 'sent') {
      await admin
        .from('transactional_email_log')
        .update({
          status: 'failed',
          error_message: 'live_validation_forced_failed_for_retry_check',
          failed_at: new Date().toISOString(),
          sent_at: null,
        })
        .eq('id', failLog.id)
    }

    const retryAfterFailed = await invokeMarketplaceEmail(supabaseUrl, webhookSecret, 'equipment_item_saved', {
      listingId: failListingId,
      saverUserId: failSaver.userId,
    })
    const failLogAfterRetry = await admin
      .from('transactional_email_log')
      .select('id, status, error_message')
      .eq('idempotency_key', failKey)
      .maybeSingle()
    const failLogCount = await countEmailLogs(admin, failKey)
    const favouriteAfterRetry = await failClient
      .from('saved_listings')
      .select('id')
      .eq('listing_id', failListingId)
      .maybeSingle()

    results.push({
      test: 'failure_isolation',
      saveActionSucceeded: Boolean(failSave.data?.id) && !failSave.error,
      favouriteVisibleImmediately: Boolean(favouriteImmediately.data?.id),
      favouriteRemainedAfterEmail: Boolean(favouriteAfterEmail.data?.id),
      favouriteRemainedAfterBrokenInvoke: Boolean(favouriteAfterBrokenInvoke.data?.id),
      favouriteRemainedAfterFailedRetry: Boolean(favouriteAfterRetry.data?.id),
      brokenInvokeHttpStatus: brokenInvoke.httpStatus,
      initialEmailStatus: failLog?.status ?? 'missing',
      retryAfterFailedHttpStatus: retryAfterFailed.httpStatus,
      retryAfterFailedStatus: failLogAfterRetry.data?.status ?? null,
      failedLogsAreRetryable: failLogAfterRetry.data?.status === 'sent' || Boolean(retryAfterFailed.body?.ok),
      oneLogRow: failLogCount === 1,
    })

    log('results', { results })

    const failedCritical = results.filter((row) => {
      if (row.test === 'A_first_save') {
        return !(
          row.favouriteCreated &&
          row.emailLogStatus === 'sent' &&
          row.emailCountForKey === 1 &&
          row.recipientIsSeller &&
          row.saverDidNotReceive &&
          row.subjectMatches &&
          !row.subjectBlank &&
          !row.privacyLeakInInvoke
        )
      }
      if (row.test === 'B_unsave') return !(row.favouriteRemoved && row.noNewEmail)
      if (row.test === 'C_save_again') return !(row.favouriteCreated && row.noSecondEmail)
      if (row.test === 'D_different_saver') {
        return !(
          row.favouriteCreated &&
          row.emailLogStatus === 'sent' &&
          row.distinctIdempotencyKey &&
          row.genuineSaveCount === 2
        )
      }
      if (row.test === 'E_self_save') return !(row.clientInsertBlocked && row.noEmailLog)
      if (row.test === 'failure_isolation') {
        return !(
          row.saveActionSucceeded &&
          row.favouriteVisibleImmediately &&
          row.favouriteRemainedAfterEmail &&
          row.favouriteRemainedAfterBrokenInvoke &&
          row.favouriteRemainedAfterFailedRetry &&
          row.oneLogRow
        )
      }
      return true
    })

    if (failedCritical.length > 0) {
      log('validation_incomplete', {
        failedCount: failedCritical.length,
        failedTests: failedCritical.map((row) => row.test),
      })
      process.exitCode = 2
    } else {
      log('validation_ok', { tests: results.length })
    }
  } catch (error) {
    const detail =
      error && typeof error === 'object'
        ? {
            message: error.message ?? null,
            code: error.code ?? null,
            details: error.details ?? null,
            hint: error.hint ?? null,
          }
        : { message: String(error) }
    log('fatal', detail)
    process.exitCode = 1
  } finally {
    log('cleanup_start', {
      listingId: created.listingId,
      failListingId: created.failListingId,
    })

    for (const listingId of [created.listingId, created.failListingId].filter(Boolean)) {
      await admin.from('saved_listings').delete().eq('listing_id', listingId)
      await admin.from('listings').delete().eq('id', listingId)
    }
    for (const userId of [created.saverBId, created.saverCId, created.sellerId, created.failSaverId, created.failSellerId].filter(Boolean)) {
      await admin.from('profiles').delete().eq('id', userId)
      await admin.auth.admin.deleteUser(userId)
    }

    log('cleanup_done', {
      note: 'Email log rows retained for deployment evidence',
      digest: createHash('sha256').update(runId).digest('hex').slice(0, 12),
    })
  }
}

main()
