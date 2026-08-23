#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  formatAdminConversationParticipantName,
  formatAdminConversationPreview,
  getAdminConversationAuditHasMessageContent,
  getAdminListingPublicPath,
  parseAdminConversationDetail,
  parseAdminConversationList,
} from '../src/lib/adminConversationsFormat.js'

const root = process.cwd()
const sql = readFileSync(join(root, 'supabase/migrations/20260823120000_admin_conversation_viewer.sql'), 'utf8')
const appSrc = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const listSrc = readFileSync(join(root, 'src/pages/AdminMessagesPage.jsx'), 'utf8')
const detailSrc = readFileSync(join(root, 'src/pages/AdminConversationPage.jsx'), 'utf8')
const threadSrc = readFileSync(join(root, 'src/components/admin/AdminConversationThread.jsx'), 'utf8')
const offerSrc = readFileSync(join(root, 'src/components/admin/AdminConversationOfferCard.jsx'), 'utf8')
const libSrc = readFileSync(join(root, 'src/lib/adminConversations.js'), 'utf8')
const protectedSrc = readFileSync(join(root, 'src/components/AdminProtectedRoute.jsx'), 'utf8')

assert.match(appSrc, /path="messages" element=\{<AdminMessagesPage \/>\}/)
assert.match(appSrc, /path="messages\/:conversationId" element=\{<AdminConversationPage \/>\}/)
assert.match(appSrc, /path="admin" element=\{<AdminProtectedRoute \/>\}/)
assert.match(protectedSrc, /isAdmin/)
assert.match(listSrc, /Conversation access is provided for support/)
assert.match(detailSrc, /Read-only inspection/)

for (const src of [listSrc, detailSrc, threadSrc, offerSrc, libSrc]) {
  assert.doesNotMatch(src, /markConversationRead/)
  assert.doesNotMatch(src, /sendMessage\b/)
  assert.doesNotMatch(src, /sendMessageWithAttachments/)
  assert.doesNotMatch(src, /MessageOfferCard/)
}

assert.match(sql, /if not public\.is_admin\(\)/)
assert.match(sql, /admin_conversation_access_log/)
assert.match(sql, /conversation_viewed/)
assert.match(sql, /admin_list_conversations/)
assert.match(sql, /admin_get_conversation/)
assert.doesNotMatch(sql, /create policy .* on public\.conversations/i)
assert.doesNotMatch(sql, /create policy .* on public\.messages/i)
assert.match(sql, /revoke all on table public\.admin_conversation_access_log/)

assert.equal(formatAdminConversationParticipantName({ deleted: true, username: 'old' }), 'Deleted user')
assert.equal(formatAdminConversationParticipantName(null), 'Deleted user')
assert.equal(formatAdminConversationParticipantName({ username: 'jordan', displayName: 'Jordan' }), 'jordan')
assert.equal(formatAdminConversationParticipantName({ username: '', displayName: 'Jordan' }), 'Jordan')
assert.equal(formatAdminConversationPreview({ messageType: 'offer' }), 'Offer update')
assert.equal(formatAdminConversationPreview({ messageType: 'text', body: 'Hello there' }), 'Hello there')
assert.equal(formatAdminConversationPreview({ messageType: 'text', attachmentCount: 1 }), 'Photo')
assert.equal(getAdminListingPublicPath({ public: true, slug: 'rower' }), '/listings/rower')
assert.equal(getAdminListingPublicPath({ public: false, slug: 'rower' }), null)

const parsed = parseAdminConversationList({
  items: [
    {
      id: 'c1',
      listing: { title: 'Treadmill', public: true, slug: 'treadmill' },
      buyer: { username: 'buyer1', deleted: false },
      seller: { deleted: true },
      lastMessage: { body: 'Still available?', messageType: 'text' },
    },
  ],
  total: 1,
  limit: 40,
  offset: 0,
})
assert.equal(parsed.items[0].seller.deleted, true)
assert.equal(formatAdminConversationParticipantName(parsed.items[0].seller), 'Deleted user')

const detail = parseAdminConversationDetail({
  conversation: {
    id: 'c1',
    buyer: { id: 'b1', username: 'buyer1' },
    seller: { id: 's1', username: 'seller1' },
    listing: { title: 'Treadmill', public: false, slug: 'hidden' },
  },
  messages: [
    { id: 'm1', body: 'Hi', messageType: 'text', createdAt: '2026-08-23T09:00:00.000Z', senderId: 'b1' },
    { id: 'm2', body: 'Yes', messageType: 'text', createdAt: '2026-08-23T09:01:00.000Z', senderId: 's1' },
  ],
  hasMore: false,
})
assert.equal(detail.messages[0].senderId, 'b1')
assert.equal(detail.messages[1].senderId, 's1')
assert.equal(getAdminListingPublicPath(detail.conversation.listing), null)

assert.equal(
  getAdminConversationAuditHasMessageContent({
    admin_user_id: 'a1',
    conversation_id: 'c1',
    action: 'conversation_viewed',
    created_at: '2026-08-23T10:00:00.000Z',
  }),
  false,
)
assert.equal(
  getAdminConversationAuditHasMessageContent({
    conversation_id: 'c1',
    body: 'secret message',
  }),
  true,
)

console.log('test-admin-messages: ok')
