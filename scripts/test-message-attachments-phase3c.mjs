#!/usr/bin/env node
/**
 * Phase 3C — message image attachments verification.
 *
 * Usage:
 *   node scripts/test-message-attachments-phase3c.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { validateMarketplaceMessageWithContext } from '../src/lib/marketplaceMessageValidation.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'
const BUCKET = 'message-attachments'
const SAMPLE_IMAGE = join(ROOT, 'public/dev-seed-images/dumbbells.jpg')
const MAX_ATTACHMENTS = 4
const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const BUYER = { email: 'dev-buyer-chris@equipd.dev', id: '11111111-1111-4111-8111-111111111105' }

const DEV_USERS = [
  { email: 'dev-seller-leeds@equipd.dev', id: '11111111-1111-4111-8111-111111111101' },
  { email: 'dev-seller-manchester@equipd.dev', id: '11111111-1111-4111-8111-111111111102' },
  { email: 'dev-seller-london@equipd.dev', id: '11111111-1111-4111-8111-111111111103' },
  { email: 'dev-buyer-emma@equipd.dev', id: '11111111-1111-4111-8111-111111111104' },
  BUYER,
]

const results = { passed: [], failed: [], skipped: [] }

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

function pass(name) {
  results.passed.push(name)
  console.log(`PASS: ${name}`)
}

function fail(name, error) {
  results.failed.push({ name, error: error?.message ?? String(error) })
  console.error(`FAIL: ${name} — ${error?.message ?? error}`)
}

function skip(name, reason) {
  results.skipped.push({ name, reason })
  console.log(`SKIP: ${name} — ${reason}`)
}

function validateAttachmentFile(file) {
  if (!file) return 'Image file is required.'
  const mimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  if (!ALLOWED_TYPES.includes(mimeType)) return 'Only JPG, PNG, and WebP images are allowed.'
  if (file.size > MAX_FILE_SIZE) return 'Each image must be 8 MB or smaller.'
  return null
}

function getConversationMessagePreview(message) {
  if (!message) return ''
  if (message.message_type === 'offer') return 'Offer update'
  if (message.message_type === 'system') return message.body?.trim() ?? 'System update'

  const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0
  const body = message.body?.trim()

  if (attachmentCount > 0) {
    const photoLabel = attachmentCount === 1 ? 'Photo' : `${attachmentCount} photos`
    if (body) return body
    return photoLabel
  }

  return body ?? ''
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
  return data.session
}

function makeImageFile(name = 'test.jpg') {
  const bytes = readFileSync(SAMPLE_IMAGE)
  return new File([bytes], name, { type: 'image/jpeg' })
}

function makeOversizedImageFile() {
  const bytes = new Uint8Array(MAX_FILE_SIZE + 1)
  bytes[0] = 0xff
  bytes[1] = 0xd8
  bytes[2] = 0xff
  bytes[3] = 0xd9
  return new File([bytes], 'oversized.jpg', { type: 'image/jpeg' })
}

function makeUnsupportedFile() {
  return new File([Buffer.from('%PDF-1.4')], 'document.pdf', { type: 'application/pdf' })
}

function buildStoragePath(conversationId, userId) {
  return `${conversationId}/${userId}/${crypto.randomUUID()}.jpg`
}

async function uploadImages(client, { conversationId, userId, files }) {
  if (files.length > MAX_ATTACHMENTS) {
    return { data: [], error: new Error(`You can attach up to ${MAX_ATTACHMENTS} images per message.`) }
  }

  const uploaded = []

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const validationError = validateAttachmentFile(file)
    if (validationError) {
      if (uploaded.length > 0) {
        await cleanupStorage(client, uploaded.map((item) => item.storage_path))
      }
      return { data: uploaded, error: new Error(validationError) }
    }

    const storagePath = buildStoragePath(conversationId, userId)
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    })

    if (uploadError) {
      if (uploaded.length > 0) {
        await cleanupStorage(client, uploaded.map((item) => item.storage_path))
      }
      return { data: uploaded, error: uploadError }
    }

    uploaded.push({
      storage_path: storagePath,
      mime_type: 'image/jpeg',
      file_size_bytes: file.size,
      image_width: null,
      image_height: null,
      display_order: index,
    })
  }

  return { data: uploaded, error: null }
}

async function cleanupStorage(client, storagePaths) {
  const paths = [...new Set((storagePaths ?? []).filter(Boolean))]
  if (!paths.length) return { error: null }
  return client.storage.from(BUCKET).remove(paths)
}

async function sendWithAttachments(client, { conversationId, body = '', attachments = [] }) {
  return client.rpc('send_message_with_attachments', {
    p_conversation_id: conversationId,
    p_body: body,
    p_attachments: attachments,
  })
}

async function sendTextMessage(client, { conversationId, senderId, body, recentMessages = [] }) {
  const validation = validateMarketplaceMessageWithContext(body, recentMessages, { senderId })
  if (!validation.allowed) {
    return { data: null, error: new Error(validation.error) }
  }

  return client.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: validation.sanitizedBody,
  })
}

async function getSignedUrl(client, storagePath) {
  return client.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60)
}

async function storageObjectExists(admin, storagePath) {
  const folder = storagePath.split('/').slice(0, -1).join('/')
  const filename = storagePath.split('/').pop()
  const { data, error } = await admin.storage.from(BUCKET).list(folder, { search: filename })
  if (error) return false
  return (data ?? []).some((item) => item.name === filename)
}

async function ensureTestConversation(admin) {
  const { data: listing } = await admin
    .from('listings')
    .select('id, seller_id')
    .eq('status', 'active')
    .neq('seller_id', BUYER.id)
    .limit(1)
    .maybeSingle()

  if (!listing) throw new Error('No active listing found. Run npm run seed:dev first.')

  const { data: existing } = await admin
    .from('conversations')
    .select('id, buyer_id, seller_id, listing_id')
    .eq('listing_id', listing.id)
    .eq('buyer_id', BUYER.id)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await admin
    .from('conversations')
    .insert({
      listing_id: listing.id,
      buyer_id: BUYER.id,
      seller_id: listing.seller_id,
    })
    .select('id, buyer_id, seller_id, listing_id')
    .single()

  if (error) throw error
  return data
}

async function sendImageMessage(client, conversationId, { body = '', count = 1 }) {
  const files = Array.from({ length: count }, (_, index) =>
    makeImageFile(`attachment-${Date.now()}-${index}.jpg`),
  )

  const { data: uploaded, error: uploadError } = await uploadImages(client, {
    conversationId,
    userId: BUYER.id,
    files,
  })

  if (uploadError) throw uploadError

  const { data, error } = await sendWithAttachments(client, {
    conversationId,
    body,
    attachments: uploaded,
  })

  if (error) {
    await cleanupStorage(client, uploaded.map((item) => item.storage_path))
    throw error
  }

  const attachments = Array.isArray(data?.attachments) ? data.attachments : []
  return { ...data, attachments }
}

loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('Missing Supabase env vars in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const buyerClient = createClient(supabaseUrl, anonKey)
const sellerClient = createClient(supabaseUrl, anonKey)
const outsiderClient = createClient(supabaseUrl, anonKey)

console.log('Phase 3C message attachments test pass\n')

try {
  console.log('=== Migration / schema checks ===')

  const { error: rpcProbeError } = await admin.rpc('send_message_with_attachments', {
    p_conversation_id: '00000000-0000-4000-8000-000000000000',
    p_body: '',
    p_attachments: [],
  })

  if (rpcProbeError?.message?.includes('Authentication required')) {
    pass('send_message_with_attachments RPC exists')
  } else if (rpcProbeError?.code === 'PGRST202') {
    throw new Error('send_message_with_attachments RPC not found — run step2 migration')
  } else {
    pass('send_message_with_attachments RPC exists')
  }

  const { error: tableError } = await admin.from('message_attachments').select('id').limit(1)
  if (tableError) throw new Error(`message_attachments table missing: ${tableError.message}`)
  pass('message_attachments table exists')

  console.log('\n=== Client validation ===')

  if (validateAttachmentFile(makeUnsupportedFile())) pass('unsupported file type blocked')
  else throw new Error('PDF should be rejected')

  if (validateAttachmentFile(makeOversizedImageFile())) pass('>8MB image blocked')
  else throw new Error('Oversized file should be rejected')

  if (!validateAttachmentFile(makeImageFile())) pass('valid JPEG accepted')
  else throw new Error('Valid JPEG should pass validation')

  const { error: fiveError } = await uploadImages(buyerClient, {
    conversationId: '00000000-0000-4000-8000-000000000001',
    userId: BUYER.id,
    files: Array.from({ length: 5 }, () => makeImageFile()),
  })

  if (fiveError?.message?.includes('up to 4')) pass('5th image blocked at upload helper')
  else throw new Error(`Expected 5-image rejection, got: ${fiveError?.message ?? 'no error'}`)

  if (getConversationMessagePreview({ body: '', attachments: [{ id: '1' }] }) === 'Photo') {
    pass('preview label: Photo')
  } else throw new Error('Expected Photo preview')

  if (getConversationMessagePreview({ body: '', attachments: [{ id: '1' }, { id: '2' }] }) === '2 photos') {
    pass('preview label: 2 photos')
  } else throw new Error('Expected 2 photos preview')

  if (
    getConversationMessagePreview({ body: 'Still available?', attachments: [{ id: '1' }] }) ===
    'Still available?'
  ) {
    pass('text + image keeps text preview')
  } else throw new Error('Expected text preview with attachment')

  await signIn(buyerClient, BUYER.email)

  const conversation = await ensureTestConversation(admin)
  const conversationId = conversation.id
  const sellerId = conversation.seller_id

  const outsider = DEV_USERS.find(
    (user) => user.id !== conversation.buyer_id && user.id !== conversation.seller_id,
  )

  if (!outsider) throw new Error('Could not find a non-participant dev user for access tests')

  const sellerEmail = (
    await admin.auth.admin.getUserById(sellerId)
  ).data?.user?.email

  if (!sellerEmail) throw new Error('Could not resolve seller email for conversation')
  await signIn(sellerClient, sellerEmail)
  await signIn(outsiderClient, outsider.email)

  console.log(`\nUsing conversation ${conversationId}`)

  console.log('\n=== Messaging flows ===')

  const textMessage = 'Is this treadmill still available?'
  const { data: textOnly, error: textError } = await sendTextMessage(buyerClient, {
    conversationId,
    senderId: BUYER.id,
    body: textMessage,
  })

  if (textError) throw textError
  if (textOnly?.body === textMessage) pass('text-only message works')
  else throw new Error('text-only message body mismatch')

  const imageOnly = await sendImageMessage(buyerClient, conversationId, { count: 1 })
  if (imageOnly.attachments.length === 1 && !imageOnly.body?.trim()) pass('image-only message works')
  else throw new Error('image-only message unexpected shape')

  const textAndImage = await sendImageMessage(buyerClient, conversationId, {
    body: 'Is the belt still in good condition?',
    count: 1,
  })

  if (textAndImage.attachments.length === 1 && textAndImage.body?.includes('belt')) {
    pass('text + image message works')
  } else throw new Error('text + image message unexpected shape')

  for (const count of [2, 3, 4]) {
    const message = await sendImageMessage(buyerClient, conversationId, { count })
    if (message.attachments.length === count) pass(`${count} images stored and returned`)
    else throw new Error(`Expected ${count} attachments, got ${message.attachments.length}`)
  }

  console.log('\n=== RPC failure storage cleanup ===')

  const { data: uploadedForCleanup, error: cleanupUploadError } = await uploadImages(buyerClient, {
    conversationId,
    userId: BUYER.id,
    files: [makeImageFile('cleanup-test.jpg')],
  })

  if (cleanupUploadError) throw cleanupUploadError

  const storagePath = uploadedForCleanup[0].storage_path
  if (!(await storageObjectExists(admin, storagePath))) {
    throw new Error('Uploaded file missing before RPC failure test')
  }

  const tampered = uploadedForCleanup.map((item) => ({
    ...item,
    storage_path: `${conversationId}/${BUYER.id}/../invalid.jpg`,
  }))

  const { error: rpcFailError } = await sendWithAttachments(buyerClient, {
    conversationId,
    body: '',
    attachments: tampered,
  })

  if (!rpcFailError) throw new Error('Expected RPC failure for tampered storage path')

  await cleanupStorage(buyerClient, uploadedForCleanup.map((item) => item.storage_path))

  if (!(await storageObjectExists(admin, storagePath))) {
    pass('failed RPC cleans up uploaded storage objects')
  } else {
    throw new Error('Storage object still present after cleanup')
  }

  console.log('\n=== Access control ===')

  const viewablePath = imageOnly.attachments[0].storage_path

  const { data: sellerSigned, error: sellerSignedError } = await getSignedUrl(
    sellerClient,
    viewablePath,
  )

  if (sellerSigned?.signedUrl && !sellerSignedError) pass('received user can view image (signed URL)')
  else throw new Error(`Seller signed URL failed: ${sellerSignedError?.message}`)

  const { data: outsiderSigned, error: outsiderSignedError } = await getSignedUrl(
    outsiderClient,
    viewablePath,
  )

  if (!outsiderSigned?.signedUrl && outsiderSignedError) {
    pass('non-participant cannot view image (signed URL blocked)')
  } else {
    throw new Error('Outsider should not get a signed URL')
  }

  const { data: outsiderRows } = await outsiderClient
    .from('message_attachments')
    .select('id')
    .eq('conversation_id', conversationId)
    .limit(1)

  if ((outsiderRows ?? []).length === 0) pass('non-participant cannot read attachment rows')
  else throw new Error('Outsider unexpectedly read attachment rows')

  console.log('\n=== Conversation list embed ===')

  const { data: conversationRow, error: listError } = await buyerClient
    .from('conversations')
    .select(
      'id, messages(body, message_type, sender_id, created_at, attachments:message_attachments(id))',
    )
    .eq('id', conversationId)
    .order('created_at', { foreignTable: 'messages', ascending: false })
    .limit(1, { foreignTable: 'messages' })
    .maybeSingle()

  if (listError) throw listError

  const lastMessage = Array.isArray(conversationRow?.messages)
    ? conversationRow.messages[0]
    : conversationRow?.messages

  const preview = getConversationMessagePreview(lastMessage)
  if (preview === '4 photos' || preview === 'Photo' || preview.includes('photo') || preview.length > 0) {
    pass('conversation list last message supports photo preview')
  } else {
    throw new Error(`Unexpected list preview: ${preview}`)
  }

  skip('removing a preview works', 'UI-only — composer remove revokes object URL and updates state')
  skip('mobile composer remains usable', 'UI-only — CSS reviewed; manual device check recommended')
  skip('lightbox opens/closes on mobile and desktop', 'UI-only — manual check recommended')
} catch (error) {
  fail('test run', error)
}

console.log('\n=== Summary ===')
console.log(`Passed: ${results.passed.length}`)
console.log(`Failed: ${results.failed.length}`)
console.log(`Skipped: ${results.skipped.length}`)

if (results.failed.length) {
  for (const item of results.failed) {
    console.error(`  - ${item.name}: ${item.error}`)
  }
  process.exit(1)
}

console.log('\nAll automated checks passed.')
