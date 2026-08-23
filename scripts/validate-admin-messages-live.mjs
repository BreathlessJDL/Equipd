#!/usr/bin/env node
/**
 * Live production validation for admin conversation RPCs.
 * Never logs emails, passwords, keys, or message bodies.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MARKER = 'admin-msg-live'
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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

function payloadHasEmail(payload, emails) {
  const raw = JSON.stringify(payload)
  return emails.some((email) => email && raw.includes(email))
}

function payloadHasPrivateKeys(payload) {
  return /"email"\s*:/i.test(JSON.stringify(payload))
}

function isDenied(error) {
  if (!error) return false
  const text = `${error.message || ''} ${error.code || ''}`.toLowerCase()
  return (
    text.includes('admin access required') ||
    text.includes('not authenticated') ||
    text.includes('permission denied') ||
    text.includes('not authorized') ||
    text.includes('row-level security') ||
    error.code === '42501' ||
    error.code === 'PGRST301'
  )
}

function makeClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function createTempUser(admin, email, username, { isAdmin = false } = {}) {
  const password = `EquipdLive_${randomUUID().slice(0, 12)}!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: username },
  })
  if (error) throw error
  const userId = data.user.id
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    username,
    display_name: username,
    is_admin: isAdmin,
  })
  if (profileError) throw profileError
  return { userId, email, username, password }
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL?.trim()
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  if (!supabaseUrl || !anonKey || !serviceKey || !adminEmail) {
    throw new Error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or ADMIN_TEST_EMAIL')
  }

  const service = makeClient(supabaseUrl, serviceKey)
  const anon = makeClient(supabaseUrl, anonKey)
  const results = []
  const created = {
    userIds: [],
    listingIds: [],
    conversationIds: [],
    storagePaths: [],
    usedExistingAdmin: false,
  }

  function record(name, ok, detail = {}) {
    results.push({ name, ok, ...detail })
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`)
  }

  const runId = randomUUID().slice(0, 8)
  let adminSession = makeClient(supabaseUrl, anonKey)
  let adminUserId = null

  try {
    if (adminPassword) {
      const existing = await adminSession.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      })
      if (!existing.error) {
        adminUserId = existing.data.user.id
        created.usedExistingAdmin = true
      }
    }

    if (!adminUserId) {
      const tempAdmin = await createTempUser(
        service,
        plusAddress(adminEmail, `${MARKER}-admin-${runId}`),
        `admmsgadm_${runId}`,
        { isAdmin: true },
      )
      created.userIds.push(tempAdmin.userId)
      const signed = await adminSession.auth.signInWithPassword({
        email: tempAdmin.email,
        password: tempAdmin.password,
      })
      if (signed.error) throw new Error(`Temporary admin sign-in failed: ${signed.error.message}`)
      adminUserId = tempAdmin.userId
    }

    const buyer = await createTempUser(service, plusAddress(adminEmail, `${MARKER}-b-${runId}`), `admmsgb_${runId}`)
    const seller = await createTempUser(service, plusAddress(adminEmail, `${MARKER}-s-${runId}`), `admmsgs_${runId}`)
    const stranger = await createTempUser(service, plusAddress(adminEmail, `${MARKER}-x-${runId}`), `admmsgx_${runId}`)
    created.userIds.push(buyer.userId, seller.userId, stranger.userId)

    const { data: category, error: categoryError } = await service.from('categories').select('id').limit(1).maybeSingle()
    if (categoryError || !category?.id) throw new Error('No category for listing fixture')

    async function insertListing(titleSuffix, status = 'active') {
      const listingId = randomUUID()
      const { error } = await service.from('listings').insert({
        id: listingId,
        seller_id: seller.userId,
        category_id: category.id,
        slug: `${MARKER}-${titleSuffix}-${runId}`,
        title: `[TEST] Admin messages ${titleSuffix} ${runId}`,
        brand: 'Equipd',
        model: 'Validation',
        description: `${MARKER} temporary listing`,
        price_pence: 10000,
        condition: 'good',
        location: 'Leeds, UK',
        collection_available: true,
        courier_available: false,
        status,
        source: 'manual',
        published_at: new Date().toISOString(),
      })
      if (error) throw error
      created.listingIds.push(listingId)
      return listingId
    }

    const listingId = await insertListing('primary')
    const listingTwoId = await insertListing('secondary')

    const { data: conversation, error: conversationError } = await service
      .from('conversations')
      .insert({ listing_id: listingId, buyer_id: buyer.userId, seller_id: seller.userId })
      .select('id')
      .single()
    if (conversationError) throw conversationError
    created.conversationIds.push(conversation.id)

    const { data: conversationTwo, error: conversationTwoError } = await service
      .from('conversations')
      .insert({ listing_id: listingTwoId, buyer_id: buyer.userId, seller_id: seller.userId })
      .select('id')
      .single()
    if (conversationTwoError) throw conversationTwoError
    created.conversationIds.push(conversationTwo.id)

    const { error: readError } = await service.from('conversation_reads').insert([
      {
        conversation_id: conversation.id,
        user_id: buyer.userId,
        last_read_at: '2020-01-01T00:00:00.000Z',
        unread_count: 2,
      },
      {
        conversation_id: conversation.id,
        user_id: seller.userId,
        last_read_at: '2020-02-02T00:00:00.000Z',
        unread_count: 3,
      },
    ])
    if (readError) throw readError

    const { data: firstMessage, error: msg1Error } = await service
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: buyer.userId,
        body: `Buyer hello ${runId}`,
        message_type: 'text',
        created_at: '2026-08-23T09:00:00.000Z',
      })
      .select('id')
      .single()
    if (msg1Error) throw msg1Error

    const { error: msg2Error } = await service.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: seller.userId,
      body: `Seller reply ${runId}`,
      message_type: 'text',
      created_at: '2026-08-23T09:01:00.000Z',
    })
    if (msg2Error) throw msg2Error

    let photoMessageId = firstMessage.id
    const photoInsert = await service
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: buyer.userId,
        body: `Photo ${runId}`,
        message_type: 'text',
        created_at: '2026-08-23T09:02:00.000Z',
      })
      .select('id')
      .single()
    if (photoInsert.error) throw photoInsert.error
    photoMessageId = photoInsert.data.id

    const attachmentId = randomUUID()
    const storagePath = `${conversation.id}/${buyer.userId}/${attachmentId}.png`
    const { error: uploadError } = await service.storage
      .from('message-attachments')
      .upload(storagePath, PNG_1X1, { contentType: 'image/png', upsert: true })
    if (uploadError) throw uploadError
    created.storagePaths.push(storagePath)

    const { error: attError } = await service.from('message_attachments').insert({
      id: attachmentId,
      message_id: photoMessageId,
      conversation_id: conversation.id,
      uploader_id: buyer.userId,
      storage_path: storagePath,
      mime_type: 'image/png',
      file_size_bytes: PNG_1X1.length,
      image_width: 1,
      image_height: 1,
      display_order: 0,
    })
    if (attError) throw attError

    const listed = await adminSession.rpc('admin_list_conversations', {
      p_query: null,
      p_limit: 5,
      p_offset: 0,
    })
    record('admin_list_conversations', !listed.error && Array.isArray(listed.data?.items), {
      error: listed.error?.message,
    })
    const found = listed.data?.items?.find((item) => item.id === conversation.id)
    record('admin can list non-participant conversation', Boolean(found))
    record(
      'list ordered by latest activity',
      (listed.data?.items || []).every((item, index, items) => {
        if (index === 0) return true
        return new Date(items[index - 1].updatedAt) >= new Date(item.updatedAt)
      }),
    )
    record('buyer/seller names present', Boolean(found?.buyer?.username && found?.seller?.username))
    record('listing title present', Boolean(found?.listing?.title?.includes('Admin messages')))
    record('latest message preview present', Boolean(found?.lastMessage))
    record(
      'list payload has no emails',
      !payloadHasEmail(listed.data, [buyer.email, seller.email]) && !payloadHasPrivateKeys(listed.data),
    )

    const page1 = await adminSession.rpc('admin_list_conversations', { p_query: null, p_limit: 1, p_offset: 0 })
    const page2 = await adminSession.rpc('admin_list_conversations', { p_query: null, p_limit: 1, p_offset: 1 })
    record(
      'list pagination',
      !page1.error &&
        !page2.error &&
        page1.data.items[0]?.id &&
        page2.data.items[0]?.id &&
        page1.data.items[0].id !== page2.data.items[0].id,
    )

    const byUsername = await adminSession.rpc('admin_list_conversations', {
      p_query: buyer.username,
      p_limit: 20,
      p_offset: 0,
    })
    record('search by username', !byUsername.error && byUsername.data.items.some((item) => item.id === conversation.id))

    const byTitle = await adminSession.rpc('admin_list_conversations', {
      p_query: `[TEST] Admin messages primary ${runId}`,
      p_limit: 20,
      p_offset: 0,
    })
    record('search by listing title', !byTitle.error && byTitle.data.items.some((item) => item.id === conversation.id))

    const byId = await adminSession.rpc('admin_list_conversations', {
      p_query: conversation.id,
      p_limit: 10,
      p_offset: 0,
    })
    record('search by conversation UUID', !byId.error && byId.data.items.some((item) => item.id === conversation.id))

    const byEmail = await adminSession.rpc('admin_list_conversations', {
      p_query: buyer.email,
      p_limit: 20,
      p_offset: 0,
    })
    record(
      'search by email without returning email',
      !byEmail.error &&
        byEmail.data.items.some((item) => item.id === conversation.id) &&
        !payloadHasEmail(byEmail.data, [buyer.email, seller.email]) &&
        !payloadHasPrivateKeys(byEmail.data),
    )

    const { data: readsBefore } = await service
      .from('conversation_reads')
      .select('user_id, last_read_at, unread_count')
      .eq('conversation_id', conversation.id)
      .order('user_id')

    const { data: auditBefore } = await service
      .from('admin_conversation_access_log')
      .select('id')
      .eq('conversation_id', conversation.id)

    const detail = await adminSession.rpc('admin_get_conversation', {
      p_conversation_id: conversation.id,
      p_limit: 2,
    })
    record('admin_get_conversation', !detail.error && detail.data?.conversation?.id === conversation.id, {
      error: detail.error?.message,
    })
    const messages = detail.data?.messages || []
    record(
      'messages chronological',
      messages.length > 0 &&
        messages.every((message, index) => {
          if (index === 0) return true
          return new Date(messages[index - 1].createdAt) <= new Date(message.createdAt)
        }),
    )
    record(
      'buyer/seller attribution',
      messages.some((message) => message.senderId === buyer.userId) &&
        messages.some((message) => message.senderId === seller.userId),
    )
    record('attachments in viewer payload', messages.some((message) => (message.attachments || []).length > 0))
    record(
      'get payload has no emails',
      !payloadHasEmail(detail.data, [buyer.email, seller.email]) && !payloadHasPrivateKeys(detail.data),
    )
    record('hasMore pagination flag', detail.data?.hasMore === true)

    const older = await adminSession.rpc('admin_get_conversation', {
      p_conversation_id: conversation.id,
      p_before: messages[0]?.createdAt,
      p_limit: 2,
    })
    record('load older with p_before', !older.error, { error: older.error?.message })

    const { data: readsAfter } = await service
      .from('conversation_reads')
      .select('user_id, last_read_at, unread_count')
      .eq('conversation_id', conversation.id)
      .order('user_id')
    record('read state unchanged', JSON.stringify(readsBefore) === JSON.stringify(readsAfter))

    const { data: auditAfter } = await service
      .from('admin_conversation_access_log')
      .select('id, admin_user_id, conversation_id, action, created_at')
      .eq('conversation_id', conversation.id)
      .eq('action', 'conversation_viewed')
    record(
      'one audit row on first open',
      (auditAfter?.length || 0) - (auditBefore?.length || 0) === 1 &&
        auditAfter.some((row) => row.admin_user_id === adminUserId && row.conversation_id === conversation.id),
    )

    const secondOpen = await adminSession.rpc('admin_get_conversation', {
      p_conversation_id: conversationTwo.id,
    })
    const { data: auditTwo } = await service
      .from('admin_conversation_access_log')
      .select('id, conversation_id')
      .eq('conversation_id', conversationTwo.id)
      .eq('action', 'conversation_viewed')
    record('second conversation gets its own audit row', !secondOpen.error && (auditTwo?.length || 0) >= 1)

    await service.from('listings').update({ status: 'archived' }).eq('id', listingId)
    const archived = await adminSession.rpc('admin_get_conversation', { p_conversation_id: conversation.id })
    record(
      'archived listing still inspectable',
      !archived.error &&
        archived.data?.conversation?.id === conversation.id &&
        archived.data.conversation.listing?.public === false,
    )

    const adminSigned = await adminSession.storage.from('message-attachments').createSignedUrl(storagePath, 60)
    record('admin can sign attachment', Boolean(adminSigned.data?.signedUrl) && !adminSigned.error, {
      error: adminSigned.error?.message,
    })

    const buyerSession = makeClient(supabaseUrl, anonKey)
    await buyerSession.auth.signInWithPassword({ email: buyer.email, password: buyer.password })
    const buyerSigned = await buyerSession.storage.from('message-attachments').createSignedUrl(storagePath, 60)
    record('participant can still sign attachment', Boolean(buyerSigned.data?.signedUrl) && !buyerSigned.error)

    const strangerSession = makeClient(supabaseUrl, anonKey)
    await strangerSession.auth.signInWithPassword({ email: stranger.email, password: stranger.password })
    const strangerList = await strangerSession.rpc('admin_list_conversations', { p_query: null, p_limit: 1, p_offset: 0 })
    const strangerGet = await strangerSession.rpc('admin_get_conversation', { p_conversation_id: conversation.id })
    const strangerLog = await strangerSession.from('admin_conversation_access_log').select('id').limit(1)
    const strangerSigned = await strangerSession.storage.from('message-attachments').createSignedUrl(storagePath, 60)
    record('non-admin list blocked', isDenied(strangerList.error))
    record('non-admin get blocked', isDenied(strangerGet.error))
    record('non-admin audit table blocked', Boolean(strangerLog.error) || !(strangerLog.data || []).length)
    record('unrelated user attachment blocked', Boolean(strangerSigned.error) || !strangerSigned.data?.signedUrl)

    const anonList = await anon.rpc('admin_list_conversations', { p_query: null, p_limit: 1, p_offset: 0 })
    const anonGet = await anon.rpc('admin_get_conversation', { p_conversation_id: conversation.id })
    const anonLog = await anon.from('admin_conversation_access_log').select('id').limit(1)
    const anonSigned = await anon.storage.from('message-attachments').createSignedUrl(storagePath, 60)
    record('anonymous list blocked', isDenied(anonList.error))
    record('anonymous get blocked', isDenied(anonGet.error))
    record('anonymous audit table blocked', Boolean(anonLog.error) || !(anonLog.data || []).length)
    record('anonymous attachment blocked', Boolean(anonSigned.error) || !anonSigned.data?.signedUrl)

    const adminLog = await adminSession.from('admin_conversation_access_log').select('id').limit(1)
    record('authenticated admin cannot read audit table directly', Boolean(adminLog.error) || !(adminLog.data || []).length)
  } finally {
    for (const path of created.storagePaths) {
      await service.storage.from('message-attachments').remove([path])
    }
    if (created.conversationIds.length) {
      await service.from('admin_conversation_access_log').delete().in('conversation_id', created.conversationIds)
      await service.from('message_attachments').delete().in('conversation_id', created.conversationIds)
      await service.from('messages').delete().in('conversation_id', created.conversationIds)
      await service.from('conversation_reads').delete().in('conversation_id', created.conversationIds)
      await service.from('conversations').delete().in('id', created.conversationIds)
    }
    if (created.listingIds.length) {
      await service.from('listings').delete().in('id', created.listingIds)
    }
    for (const userId of created.userIds) {
      await service.from('profiles').delete().eq('id', userId)
      await service.auth.admin.deleteUser(userId)
    }
  }

  const failed = results.filter((row) => !row.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    for (const row of failed) {
      console.log(` - ${row.name}${row.error ? `: ${row.error}` : ''}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
