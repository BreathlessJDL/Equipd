#!/usr/bin/env node
/**
 * Equipment item saved seller email: trigger wiring, compose, privacy,
 * idempotency, self-save, and SendGrid-failure isolation.
 *
 * Usage:
 *   node scripts/test-equipment-item-saved-email.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EMAIL_TEMPLATE_KEYS } from '../supabase/functions/_shared/emailTemplateConfig.js'
import {
  MARKETPLACE_EMAIL_EVENT_KEYS,
  buildMarketplaceEmailIdempotencyKey,
  composeEquipmentItemSavedDynamicData,
  composeMarketplaceEmailDynamicData,
  composeMarketplaceEmailSubject,
  formatListingSaveCountText,
  normalizeMarketplaceEmailPayload,
  reserveEmailLog,
  sendMarketplaceEmail,
} from '../supabase/functions/_shared/marketplaceEmailCore.js'
import { buildSendGridPayload } from '../supabase/functions/_shared/transactionalEmailCore.js'
import { equipmentItemSavedTemplate } from '../emails/templates/equipmentItemSaved.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(
  join(root, 'supabase/migrations/20260808210000_equipment_item_saved_email.sql'),
  'utf8',
)
const savedListingsClient = readFileSync(join(root, 'src/lib/savedListings.js'), 'utf8')
const sendFnSource = readFileSync(
  join(root, 'supabase/functions/send-marketplace-email/index.ts'),
  'utf8',
)

assert.match(sql, /create or replace function public\.notify_listing_saved_email/i)
assert.match(sql, /saved_listings_notify_listing_saved_email/)
assert.match(sql, /after insert on public\.saved_listings/i)
assert.doesNotMatch(sql, /after delete on public\.saved_listings/i)
assert.match(sql, /notify_marketplace_email\(\s*'equipment_item_saved'/i)
assert.match(sql, /'equipment_item_saved'/)
assert.match(sql, /new\.user_id = v_seller_id/)
assert.match(sql, /exception/i)
assert.equal(EMAIL_TEMPLATE_KEYS.equipment_item_saved, 'SENDGRID_TEMPLATE_EQUIPMENT_ITEM_SAVED')
assert.ok(MARKETPLACE_EMAIL_EVENT_KEYS.includes('equipment_item_saved'))
assert.match(sendFnSource, /equipment_item_saved/)
assert.match(sendFnSource, /saverUserId is required/)
assert.match(savedListingsClient, /from\('saved_listings'\)/)
assert.match(savedListingsClient, /You can't save your own listing/)
assert.doesNotMatch(savedListingsClient, /SENDGRID/)
assert.doesNotMatch(savedListingsClient, /d-556d326a6dfc471aa7bce6a064de85ca/)

assert.equal(formatListingSaveCountText(1), '1 person has saved this item')
assert.equal(formatListingSaveCountText(2), '2 people have saved this item')
assert.equal(formatListingSaveCountText(10), '10 people have saved this item')

const listing = {
  id: 'list-1',
  slug: 'life-fitness-e5-cross-trainer',
  title: 'Life Fitness E5 Cross-Trainer',
  seller_id: 'seller-1',
}
const sellerProfile = { id: 'seller-1', username: 'sarahlifts', display_name: 'Sarah Mitchell' }

const dynamicData = composeEquipmentItemSavedDynamicData({
  baseUrl: 'https://equipd.co.uk',
  listing,
  sellerProfile,
  saveCount: 1,
})

assert.equal(
  dynamicData.subject,
  'Someone saved your Life Fitness E5 Cross-Trainer',
  'subject uses actual listing title',
)
assert.equal(
  composeMarketplaceEmailSubject('equipment_item_saved', listing.title),
  'Someone saved your Life Fitness E5 Cross-Trainer',
)
assert.doesNotMatch(dynamicData.subject, /\{\{/)
assert.equal(dynamicData.title, 'Someone saved your listing')
assert.equal(dynamicData.subtitle, 'Your equipment is getting noticed on Equipd.')
assert.equal(dynamicData.preheader, 'Someone has saved your Life Fitness E5 Cross-Trainer on Equipd.')
assert.equal(dynamicData.first_name, 'sarahlifts')
assert.equal(dynamicData.listing_title, listing.title)
assert.equal(dynamicData.save_count_text, '1 person has saved this item')
assert.equal(dynamicData.cta_text, 'View your listing')
assert.equal(dynamicData.cta_url, 'https://equipd.co.uk/listings/life-fitness-e5-cross-trainer')
assert.equal(dynamicData.tagline, 'The UK marketplace for used gym equipment.')
assert.equal(dynamicData.secondary_text, 'Visit the Help Centre')
assert.match(dynamicData.secondary_url, /\/help$/)

const serialized = JSON.stringify(dynamicData)
assert.doesNotMatch(serialized, /jamesgym|saver-1|buyer@|jlinnell95|avatar|user_id|saverUserId/)
assert.ok(!('saver_name' in dynamicData))
assert.ok(!('saver_email' in dynamicData))
assert.ok(!('sender_name' in dynamicData))

const twoSaves = composeEquipmentItemSavedDynamicData({
  baseUrl: 'https://equipd.co.uk',
  listing,
  sellerProfile,
  saveCount: 2,
})
assert.equal(twoSaves.save_count_text, '2 people have saved this item')

const sendGridPayload = buildSendGridPayload({
  recipients: ['seller@example.com'],
  templateId: 'd-test-equipment-item-saved',
  dynamicTemplateData: dynamicData,
  from: { email: 'notifications@equipd.co.uk', name: 'Equipd' },
})
assert.equal(sendGridPayload.subject, dynamicData.subject)
assert.equal(sendGridPayload.personalizations[0].subject, dynamicData.subject)
assert.equal(
  sendGridPayload.personalizations[0].dynamic_template_data.subject,
  dynamicData.subject,
)

assert.equal(
  buildMarketplaceEmailIdempotencyKey('equipment_item_saved', {
    listingId: 'list-1',
    saverUserId: 'saver-1',
  }),
  'equipment_item_saved:list-1:saver-1',
)
assert.equal(
  normalizeMarketplaceEmailPayload({ listing_id: 'list-1', saver_user_id: 'saver-1' }).saverUserId,
  'saver-1',
)

const preview = equipmentItemSavedTemplate.buildPreviewData('https://equipd.co.uk')
assert.equal(preview.subject, 'Someone saved your Life Fitness E5 Cross-Trainer')
assert.equal(equipmentItemSavedTemplate.sendGridEnvVar, 'SENDGRID_TEMPLATE_EQUIPMENT_ITEM_SAVED')

function createListingSavedAdmin({
  listing: listingRow = listing,
  saveRow = { id: 'saved-1' },
  saveCount = 1,
  sellerProfile: profileRow = sellerProfile,
  sellerEmail = 'seller@example.com',
} = {}) {
  const logs = new Map()
  let nextLogId = 1
  const writes = []

  function chain(table) {
    const filters = {}
    const api = {
      select(_columns, options = {}) {
        api._count = Boolean(options.count)
        api._head = Boolean(options.head)
        return api
      },
      eq(column, value) {
        filters[column] = value
        return api
      },
      async maybeSingle() {
        if (table === 'listings') {
          return { data: listingRow, error: null }
        }
        if (table === 'saved_listings') {
          if (filters.user_id && filters.listing_id) {
            return { data: saveRow, error: null }
          }
          return { data: saveRow, error: null }
        }
        if (table === 'profiles') {
          return { data: profileRow, error: null }
        }
        return { data: null, error: null }
      },
      then(resolve, reject) {
        if (table === 'saved_listings' && api._count) {
          return Promise.resolve({ count: saveCount, error: null }).then(resolve, reject)
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      },
      insert(row) {
        writes.push({ table, op: 'insert', row })
        if (table === 'transactional_email_log') {
          if (logs.has(row.idempotency_key)) {
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: null, error: { code: '23505', message: 'duplicate' } }
                  },
                }
              },
            }
          }
          const id = `log-${nextLogId++}`
          logs.set(row.idempotency_key, { id, ...row })
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: { id, status: row.status }, error: null }
                },
              }
            },
          }
        }
        return {
          select() {
            return { async maybeSingle() { return { data: row, error: null } } }
          },
        }
      },
      update(patch) {
        writes.push({ table, op: 'update', patch })
        return {
          async eq(column, value) {
            if (table === 'transactional_email_log') {
              for (const [key, row] of logs) {
                if (row.id === value || row[column] === value) {
                  logs.set(key, { ...row, ...patch })
                }
              }
            }
            return { error: null }
          },
        }
      },
    }
    return api
  }

  return {
    logs,
    writes,
    auth: {
      admin: {
        async getUserById(userId) {
          if (userId === listingRow?.seller_id) {
            return { data: { user: { id: userId, email: sellerEmail } }, error: null }
          }
          return { data: { user: { id: userId, email: 'other@example.com' } }, error: null }
        },
      },
    },
    from(table) {
      return chain(table)
    },
  }
}

const getEnv = (key) => {
  if (key === 'APP_BASE_URL') return 'https://equipd.co.uk'
  if (key === 'SENDGRID_TEMPLATE_EQUIPMENT_ITEM_SAVED') return 'd-test-template'
  if (key === 'SENDGRID_API_KEY') return 'SG.test'
  if (key === 'SENDGRID_FROM_EMAIL') return 'notifications@equipd.co.uk'
  return ''
}

const successAdmin = createListingSavedAdmin({ saveCount: 1 })
const composed = await composeMarketplaceEmailDynamicData(
  'equipment_item_saved',
  { listingId: 'list-1', saverUserId: 'saver-1', admin: successAdmin },
  getEnv,
)
assert.equal(composed.ok, true)
assert.equal(composed.recipientUserId, 'seller-1')
assert.notEqual(composed.recipientUserId, 'saver-1')
assert.equal(composed.dynamicData.save_count_text, '1 person has saved this item')
assert.doesNotMatch(JSON.stringify(composed.dynamicData), /saver-1/)

const selfSave = await composeMarketplaceEmailDynamicData(
  'equipment_item_saved',
  { listingId: 'list-1', saverUserId: 'seller-1', admin: createListingSavedAdmin() },
  getEnv,
)
assert.equal(selfSave.skip, true)
assert.equal(selfSave.reason, 'self_save')

const unsaved = await composeMarketplaceEmailDynamicData(
  'equipment_item_saved',
  {
    listingId: 'list-1',
    saverUserId: 'saver-1',
    admin: createListingSavedAdmin({ saveRow: null }),
  },
  getEnv,
)
assert.equal(unsaved.skip, true)
assert.equal(unsaved.reason, 'favourite_removed')

const sent = await sendMarketplaceEmail(
  'equipment_item_saved',
  { listingId: 'list-1', saverUserId: 'saver-1' },
  {
    getEnv,
    admin: createListingSavedAdmin({ saveCount: 2 }),
    sendTransactionalEmailFn: async () => ({ ok: true, messageId: 'sg-1' }),
  },
)
assert.equal(sent.ok, true)
assert.equal(sent.skipped, undefined)
assert.equal(sent.idempotencyKey, 'equipment_item_saved:list-1:saver-1')

const duplicateAdmin = createListingSavedAdmin({ saveCount: 2 })
const firstSend = await sendMarketplaceEmail(
  'equipment_item_saved',
  { listingId: 'list-1', saverUserId: 'saver-1' },
  {
    getEnv,
    admin: duplicateAdmin,
    sendTransactionalEmailFn: async () => ({ ok: true, messageId: 'sg-1' }),
  },
)
const secondSend = await sendMarketplaceEmail(
  'equipment_item_saved',
  { listingId: 'list-1', saverUserId: 'saver-1' },
  {
    getEnv,
    admin: duplicateAdmin,
    sendTransactionalEmailFn: async () => {
      throw new Error('should not send a second email')
    },
  },
)
assert.equal(firstSend.ok, true)
assert.equal(secondSend.ok, true)
assert.equal(secondSend.skipped, true)

const failAdmin = createListingSavedAdmin({ saveCount: 1 })
const failedSend = await sendMarketplaceEmail(
  'equipment_item_saved',
  { listingId: 'list-1', saverUserId: 'saver-1' },
  {
    getEnv,
    admin: failAdmin,
    log() {},
    sendTransactionalEmailFn: async () => ({ ok: false, error: 'SendGrid 500' }),
  },
)
assert.equal(failedSend.ok, false)
assert.ok(!failAdmin.writes.some((write) => write.table === 'saved_listings'))
assert.ok(
  failAdmin.writes.every((write) => write.table === 'transactional_email_log'),
  'SendGrid failure only updates the email log, never favourites',
)

const reservationFirst = await reserveEmailLog(duplicateAdmin, {
  template_key: 'equipment_item_saved',
  idempotency_key: 'equipment_item_saved:list-1:saver-2',
  status: 'pending',
})
assert.equal(reservationFirst.action, 'send')
const reservationSecond = await reserveEmailLog(duplicateAdmin, {
  template_key: 'equipment_item_saved',
  idempotency_key: 'equipment_item_saved:list-1:saver-2',
  status: 'pending',
})
assert.equal(reservationSecond.action, 'skip')

console.log('test-equipment-item-saved-email: ok')
