#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const badgeJs = readFileSync(join(root, 'src/components/OfficialEquipdBadge.jsx'), 'utf8')
const badgeCss = readFileSync(join(root, 'src/components/OfficialEquipdBadge.css'), 'utf8')
const listingSeller = readFileSync(
  join(root, 'src/components/listing/ListingSummarySeller.jsx'),
  'utf8',
)
const threadHeader = readFileSync(
  join(root, 'src/components/messages/MessageThreadHeader.jsx'),
  'utf8',
)
const conversationList = readFileSync(
  join(root, 'src/components/messages/ConversationListItem.jsx'),
  'utf8',
)
const shopPage = readFileSync(join(root, 'src/pages/UserShopPage.jsx'), 'utf8')
const orderPage = readFileSync(join(root, 'src/pages/OrderDetailPage.jsx'), 'utf8')
const messagesLib = readFileSync(join(root, 'src/lib/messages.js'), 'utf8')
const profilesLib = readFileSync(join(root, 'src/lib/profiles.js'), 'utf8')

assert.match(badgeJs, /variant === 'compact'/)
assert.match(badgeJs, /OFFICIAL_EQUIPD_LABEL/)
assert.match(badgeJs, /aria-label=\{OFFICIAL_EQUIPD_LABEL\}/)
assert.match(badgeJs, /export function OfficialEquipdName/)
assert.match(badgeJs, /isOfficial/)
assert.doesNotMatch(badgeJs, /username === ['"]Equipd['"]/)
assert.doesNotMatch(badgeJs, /is_admin/)
assert.match(badgeCss, /official-equipd-badge--compact/)

assert.match(listingSeller, /OfficialEquipdName/)
assert.match(listingSeller, /is_official_equipd === true/)
assert.doesNotMatch(listingSeller, /username.*Equipd/)

assert.match(threadHeader, /OfficialEquipdName/)
assert.match(threadHeader, /is_official_equipd === true/)
assert.match(threadHeader, /variant="full"/)

assert.match(conversationList, /OfficialEquipdName/)
assert.match(conversationList, /is_official_equipd === true/)

assert.match(shopPage, /OfficialEquipdName/)
assert.match(shopPage, /variant="full"/)
assert.match(shopPage, /is_official_equipd === true/)

assert.match(orderPage, /OfficialEquipdName/)
assert.match(orderPage, /is_official_equipd === true/)

const hubOffer = readFileSync(join(root, 'src/components/hub/HubOfferCard.jsx'), 'utf8')
assert.match(hubOffer, /OfficialEquipdName/)
assert.match(hubOffer, /is_official_equipd === true/)

assert.match(messagesLib, /is_official_equipd/)
assert.match(profilesLib, /is_official_equipd/)

assert.ok(existsSync(join(root, 'src/components/OfficialEquipdBadge.jsx')))

console.log('test-official-equipd-identity-ui: ok')
