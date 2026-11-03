/**
 * Buyer conversion GA4 events, consent reuse, and PII guards.
 * Run: node scripts/test-buyer-conversion-analytics.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmpDir = join(root, 'scripts', '.tmp-buyer-conversion-tests')
const moduleSource = readFileSync(join(root, 'src/lib/buyerConversionAnalytics.js'), 'utf8')

const files = {
  analytics: readFileSync(join(root, 'src/lib/analytics.js'), 'utf8'),
  listingCard: readFileSync(join(root, 'src/components/ListingCard.jsx'), 'utf8'),
  listingDetail: readFileSync(join(root, 'src/pages/ListingDetailPage.jsx'), 'utf8'),
  messages: readFileSync(join(root, 'src/lib/messages.js'), 'utf8'),
  messagesPage: readFileSync(join(root, 'src/pages/MessagesPage.jsx'), 'utf8'),
  makeOffer: readFileSync(join(root, 'src/components/listing/MakeOfferModal.jsx'), 'utf8'),
  listingOffers: readFileSync(join(root, 'src/components/ListingOffersSection.jsx'), 'utf8'),
  payNow: readFileSync(join(root, 'src/components/PayNowWithFulfilment.jsx'), 'utf8'),
  orderDetail: readFileSync(join(root, 'src/pages/OrderDetailPage.jsx'), 'utf8'),
  hub: readFileSync(join(root, 'src/pages/HubPage.jsx'), 'utf8'),
  hubContent: readFileSync(join(root, 'src/components/hub/HubSectionContent.jsx'), 'utf8'),
  myListings: readFileSync(join(root, 'src/pages/MyListingsPage.jsx'), 'utf8'),
  shop: readFileSync(join(root, 'src/pages/UserShopPage.jsx'), 'utf8'),
  cookieConsent: readFileSync(join(root, 'src/lib/cookieConsent.js'), 'utf8'),
}

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

async function checkAsync(name, fn) {
  try {
    await fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

check('reuses trackEvent from analytics.js (no extra pixels)', () => {
  assert.match(moduleSource, /import \{ trackEvent \} from '\.\/analytics\.js'/)
  assert.doesNotMatch(moduleSource, /facebook|meta pixel|gtm-|clarity|tiktok|linkedin/i)
  assert.doesNotMatch(files.analytics, /fbq\(|clarity\(/)
})

check('purchase requires paid payment and buyer role', () => {
  assert.match(moduleSource, /payment\?\.status !== 'paid'/)
  assert.match(moduleSource, /viewerRole !== 'buyer'/)
  assert.match(moduleSource, /hasTrackedPurchase/)
  assert.doesNotMatch(files.orderDetail, /trackPurchase\(\{[\s\S]*payment:\s*'success'/)
  assert.match(files.orderDetail, /isPaymentComplete\(order\.payment\)/)
  assert.match(files.orderDetail, /viewerRole !== 'buyer'/)
})

check('begin_checkout fires only after checkout URL is returned', () => {
  const proceedStart = files.payNow.indexOf('async function proceedToCheckout')
  const trackIndex = files.payNow.indexOf('trackBeginCheckout({ listing, payment, isBuyer: true })')
  const assignIndex = files.payNow.indexOf('globalThis.location.assign(url)')
  const beforeTrack = files.payNow.slice(proceedStart, trackIndex)
  assert.match(beforeTrack, /if \(!url\)/)
  assert.match(beforeTrack, /if \(checkoutError\)/)
  assert.doesNotMatch(beforeTrack, /trackBeginCheckout/)
  assert.ok(trackIndex > proceedStart && assignIndex > trackIndex)
})

check('contact_seller is tied to newly created conversations', () => {
  assert.match(files.messages, /created: true/)
  assert.match(files.messages, /created: false/)
  assert.match(files.messagesPage, /if \(created && user\?\.id === selectedConversation\.buyer_id\)/)
  assert.match(files.makeOffer, /conversationCreated/)
  assert.match(files.listingOffers, /conversationCreated/)
})

check('select_item is list-context only; hub and my listings stay uninstrumented', () => {
  assert.match(files.listingCard, /useListingAnalyticsList/)
  assert.doesNotMatch(files.hubContent, /ListingAnalyticsList/)
  assert.doesNotMatch(files.myListings, /ListingAnalyticsList/)
  assert.match(files.shop, /enabled={!isOwnShop}/)
})

check('view_item skips listing owners', () => {
  assert.match(files.listingDetail, /isListingOwner\(listing, user\?\.id\)/)
  assert.match(files.listingDetail, /trackViewItem\(listing\)/)
})

check('analytics consent still defaults off', () => {
  assert.match(files.cookieConsent, /analytics:\s*false/)
})

check('does not send listing titles, emails, or payment credentials', () => {
  assert.doesNotMatch(moduleSource, /item_name/)
  assert.match(moduleSource, /email\|phone/)
  assert.doesNotMatch(moduleSource, /stripe_session|client_secret|seller_net/)
  assert.doesNotMatch(moduleSource, /stripe_checkout_session_id|stripe_payment_intent_id|stripe_charge_id/)
})

check('documents that contact_seller and submit_offer are not unique buyer counts', () => {
  assert.match(moduleSource, /Do not add them[\s\S]*together as unique buyer counts/)
  assert.match(moduleSource, /CONTACT_SELLER: 'contact_seller'/)
  assert.match(moduleSource, /SUBMIT_OFFER: 'submit_offer'/)
})

check('purchase transaction_id is the Equipd payment id', () => {
  assert.match(moduleSource, /transaction_id: String\(paymentId\)/)
  assert.match(moduleSource, /marketplace payment UUID, not a Stripe identifier/)
})

function installStorage() {
  const store = new Map()
  globalThis.window = {
    location: { pathname: '/listings/demo-listing' },
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null
      },
      setItem(key, value) {
        store.set(String(key), String(value))
      },
      removeItem(key) {
        store.delete(key)
      },
      key(index) {
        return [...store.keys()][index] ?? null
      },
      get length() {
        return store.size
      },
    },
  }
  globalThis.__gaEvents = []
}

async function loadConversionModule() {
  mkdirSync(tmpDir, { recursive: true })
  const outfile = join(tmpDir, `buyer-conversion-${Date.now()}-${Math.random()}.mjs`)
  const rewritten = moduleSource.replace(
    /import \{ trackEvent \} from '\.\/analytics\.js'/,
    `function trackEvent(eventName, params) {
      globalThis.__gaEvents.push({ eventName, params })
      return true
    }`,
  )
  if (rewritten === moduleSource) {
    throw new Error('Failed to stub trackEvent for conversion tests')
  }
  writeFileSync(outfile, rewritten, 'utf8')
  return import(`${pathToFileURL(outfile).href}`)
}

const listing = {
  id: 'listing-1',
  brand: 'Concept2',
  category: { name: 'Rowers' },
  price_pence: 125000,
  city: 'Manchester',
  title: 'Should never be sent',
  seller_id: 'user-secret',
}

await checkAsync('view_item, search, and list events include safe properties only', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  analytics.resetPurchaseDedupeForTesting()
  analytics.trackViewItem(listing)
  analytics.trackViewItemList({
    listings: [listing],
    itemListId: 'browse',
    itemListName: 'Browse listings',
  })
  analytics.trackSelectItem(listing, { itemListId: 'browse', itemListName: 'Browse listings' })
  analytics.trackEquipmentSearch('concept2 rower')

  const names = globalThis.__gaEvents.map((event) => event.eventName)
  assert.deepEqual(names, ['view_item', 'view_item_list', 'select_item', 'search'])

  for (const event of globalThis.__gaEvents) {
    const serialized = JSON.stringify(event.params)
    assert.doesNotMatch(serialized, /Should never be sent/)
    assert.doesNotMatch(serialized, /user-secret/)
    assert.doesNotMatch(serialized, /@/)
    assert.equal(event.params.email, undefined)
    assert.equal(event.params.buyer_id, undefined)
    assert.equal(event.params.seller_id, undefined)
  }

  const viewItem = globalThis.__gaEvents[0].params
  assert.equal(viewItem.currency, 'GBP')
  assert.equal(viewItem.value, 1250)
  assert.equal(viewItem.items[0].item_id, 'listing-1')
  assert.equal(viewItem.items[0].item_brand, 'Concept2')
  assert.equal(viewItem.items[0].item_category, 'Rowers')
  assert.equal(viewItem.location_city, 'Manchester')
  assert.equal(viewItem.page_type, 'listing')
  assert.equal(globalThis.__gaEvents[3].params.search_term, 'concept2 rower')

  const listEvent = globalThis.__gaEvents[1].params
  assert.equal(listEvent.item_list_id, 'browse')
  assert.equal(listEvent.item_list_name, 'Browse listings')
  assert.equal(listEvent.items[0].item_list_id, 'browse')
  assert.equal(listEvent.items[0].index, 0)
  assert.equal(globalThis.__gaEvents[2].params.items[0].item_list_id, 'browse')
})

await checkAsync('search rejects empty and email-like terms', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  assert.equal(analytics.trackEquipmentSearch('  '), false)
  assert.equal(analytics.trackEquipmentSearch('buyer@example.com'), false)
  assert.equal(globalThis.__gaEvents.length, 0)
})

await checkAsync('sanitizeEventParams strips blocked keys including item_list_name exception', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  const sanitized = analytics.sanitizeEventParams({
    item_list_name: 'Browse listings',
    email: 'a@b.com',
    buyer_id: 'abc',
    listing_id: 'listing-1',
    message: 'hello',
  })
  assert.equal(sanitized.item_list_name, 'Browse listings')
  assert.equal(sanitized.listing_id, 'listing-1')
  assert.equal(sanitized.email, undefined)
  assert.equal(sanitized.buyer_id, undefined)
  assert.equal(sanitized.message, undefined)
})

await checkAsync('listingCityOnly keeps city names and drops addresses', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  assert.equal(analytics.listingCityOnly({ city: 'Leeds' }), 'Leeds')
  assert.equal(analytics.listingCityOnly({ city: '12 High Street' }), undefined)
  assert.equal(analytics.listingCityOnly({ city: 'Leeds, LS1 1AA' }), undefined)
})

await checkAsync('purchase fires once per paid payment and ignores seller/unpaid', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  analytics.resetPurchaseDedupeForTesting()
  const payment = {
    id: 'pay-1',
    status: 'paid',
    buyer_total_pence: 130000,
    agreed_unit_price_pence: 125000,
    buyer_protection_fee_pence: 5000,
    quantity: 1,
  }

  assert.equal(analytics.trackPurchase({
    payment: { ...payment, status: 'pending' },
    listing,
    viewerRole: 'buyer',
  }), false)
  assert.equal(analytics.trackPurchase({
    payment,
    listing,
    viewerRole: 'seller',
  }), false)
  assert.equal(analytics.trackPurchase({
    payment,
    listing,
    viewerRole: 'buyer',
  }), true)
  assert.equal(analytics.trackPurchase({
    payment,
    listing,
    viewerRole: 'buyer',
  }), false)

  assert.equal(globalThis.__gaEvents.length, 1)
  assert.equal(globalThis.__gaEvents[0].eventName, 'purchase')
  assert.equal(globalThis.__gaEvents[0].params.transaction_id, 'pay-1')
  assert.equal(globalThis.__gaEvents[0].params.currency, 'GBP')
  assert.equal(globalThis.__gaEvents[0].params.value, 1250)
  assert.equal(globalThis.__gaEvents[0].params.tax, 50)
  assert.equal(globalThis.__gaEvents[0].params.items[0].item_id, 'listing-1')
  assert.equal(globalThis.__gaEvents[0].params.items[0].price, 1250)
  assert.equal(globalThis.__gaEvents[0].params.items[0].quantity, 1)
  assert.equal(globalThis.__gaEvents[0].params.stripe_checkout_session_id, undefined)
})

await checkAsync('failed purchase send is not marked so it can retry after consent', async () => {
  installStorage()
  mkdirSync(tmpDir, { recursive: true })
  const outfile = join(tmpDir, `buyer-conversion-false-${Date.now()}.mjs`)
  const rewritten = moduleSource.replace(
    /import \{ trackEvent \} from '\.\/analytics\.js'/,
    `function trackEvent() { return false }`,
  )
  writeFileSync(outfile, rewritten, 'utf8')
  const blocked = await import(`${pathToFileURL(outfile).href}`)
  blocked.resetPurchaseDedupeForTesting()
  assert.equal(blocked.trackPurchase({
    payment: { id: 'pay-consent', status: 'paid', agreed_unit_price_pence: 1000 },
    listing,
    viewerRole: 'buyer',
  }), false)
  assert.equal(blocked.hasTrackedPurchase('pay-consent'), false)
})

await checkAsync('seller-facing events are skipped for non-buyers', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  assert.equal(analytics.trackContactSeller(listing, { isBuyer: false }), false)
  assert.equal(analytics.trackSubmitOffer(listing, { amountPence: 1000, isBuyer: false }), false)
  assert.equal(analytics.trackBeginCheckout({ listing, payment: {}, isBuyer: false }), false)
  assert.equal(globalThis.__gaEvents.length, 0)
})

await checkAsync('tracking failure does not throw', async () => {
  installStorage()
  mkdirSync(tmpDir, { recursive: true })
  const outfile = join(tmpDir, `buyer-conversion-throw-${Date.now()}.mjs`)
  const rewritten = moduleSource.replace(
    /import \{ trackEvent \} from '\.\/analytics\.js'/,
    `function trackEvent() { throw new Error('gtag down') }`,
  )
  writeFileSync(outfile, rewritten, 'utf8')
  const analytics = await import(`${pathToFileURL(outfile).href}`)
  assert.equal(analytics.trackViewItem(listing), false)
  assert.equal(analytics.trackPurchase({
    payment: { id: 'pay-throw', status: 'paid', buyer_total_pence: 100 },
    listing,
    viewerRole: 'buyer',
  }), false)
  assert.equal(analytics.hasTrackedPurchase('pay-throw'), false)
})

await checkAsync('view_item and view_item_list are session-deduped', async () => {
  installStorage()
  const analytics = await loadConversionModule()
  analytics.resetPurchaseDedupeForTesting()
  assert.equal(analytics.trackViewItem(listing), true)
  assert.equal(analytics.trackViewItem(listing), false)
  assert.equal(analytics.trackViewItemList({
    listings: [listing],
    itemListId: 'browse',
    itemListName: 'Browse listings',
  }), true)
  assert.equal(analytics.trackViewItemList({
    listings: [listing],
    itemListId: 'browse',
    itemListName: 'Browse listings',
  }), false)
})

const failed = checks.filter((item) => !item.ok)
for (const item of checks) {
  console.log(`${item.ok ? 'ok' : 'FAIL'}  ${item.name}${item.ok ? '' : ` — ${item.error}`}`)
}

rmSync(tmpDir, { recursive: true, force: true })

if (failed.length) {
  console.error(`\n${failed.length} failed`)
  process.exit(1)
}

console.log(`\n${checks.length} passed`)
