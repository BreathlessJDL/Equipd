#!/usr/bin/env node
/**
 * Notification lifecycle: stale actionable notifications marked read.
 *
 * Usage:
 *   node scripts/test-notification-lifecycle-read-marking.mjs
 *
 * Requires .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Run supabase/notification-lifecycle-read-marking.sql on Supabase first.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEV_PASSWORD = 'EquipdDevSeed123!'

const SELLER = { email: 'dev-seller-leeds@equipd.dev' }
const BUYER = { email: 'dev-buyer-chris@equipd.dev' }

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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logStep(title) {
  console.log(`\n=== ${title} ===`)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

function hubOfferLink(offerId) {
  return `/hub?section=offers&offerId=${offerId}`
}

function orderLink(orderId) {
  return `/orders/${orderId}`
}

async function signIn(client, email) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  })

  if (error) {
    throw new Error(`Sign in failed for ${email}: ${error.message}`)
  }

  return data.session
}

async function getNotificationReadState(admin, { userId, type, linkUrl }) {
  const { data, error } = await admin
    .from('notifications')
    .select('id, is_read')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('link_url', linkUrl)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getNotificationReadState failed: ${error.message}`)
  }

  return data
}

async function createTestNotification(admin, { userId, type, title, body, linkUrl }) {
  const { data, error } = await admin.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_link_url: linkUrl,
  })

  if (error) {
    throw new Error(`create_notification failed: ${error.message}`)
  }

  return data
}

async function ensureRpcExists(admin) {
  const { error } = await admin.rpc('mark_related_notifications_read', {
    p_user_id: '00000000-0000-0000-0000-000000000001',
    p_types: ['offer_received'],
    p_offer_id: null,
    p_order_id: null,
    p_listing_id: null,
    p_exact_link_url: null,
  })

  if (error?.message?.includes('Could not find the function')) {
    throw new Error(
      'Missing mark_related_notifications_read. Run supabase/notification-lifecycle-read-marking.sql first.',
    )
  }
}

async function findPendingBuyerOffer(admin) {
  const { data } = await admin
    .from('offers')
    .select('id, listing_id, buyer_id, seller_id, status, direction')
    .eq('status', 'pending')
    .eq('direction', 'buyer_to_seller')
    .order('created_at', { ascending: false })
    .limit(10)

  for (const offer of data ?? []) {
    const { data: listing } = await admin
      .from('listings')
      .select('status')
      .eq('id', offer.listing_id)
      .single()

    if (listing?.status === 'active') {
      return offer
    }
  }

  return null
}

async function findPendingCounterOffer(admin) {
  const { data } = await admin
    .from('offers')
    .select('id, listing_id, buyer_id, seller_id, status, direction')
    .eq('status', 'pending')
    .eq('direction', 'seller_to_buyer')
    .order('created_at', { ascending: false })
    .limit(10)

  return data?.[0] ?? null
}

async function main() {
  loadEnvFile('.env.local')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await ensureRpcExists(admin)

  const sellerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const buyerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  logStep('Offer notification becomes read after accept from Hub')
  const pendingOffer = await findPendingBuyerOffer(admin)

  if (!pendingOffer) {
    console.log('SKIP: No pending buyer_to_seller offer on active listing.')
  } else {
    const offerLink = hubOfferLink(pendingOffer.id)

    await createTestNotification(admin, {
      userId: pendingOffer.seller_id,
      type: 'offer_received',
      title: 'New offer (test)',
      body: 'Test offer notification for lifecycle cleanup.',
      linkUrl: offerLink,
    })

    const unrelatedOfferId = '00000000-0000-0000-0000-000000000099'
    await createTestNotification(admin, {
      userId: pendingOffer.seller_id,
      type: 'offer_received',
      title: 'Unrelated offer (test)',
      body: 'Should stay unread.',
      linkUrl: hubOfferLink(unrelatedOfferId),
    })

    const beforeAccept = await getNotificationReadState(admin, {
      userId: pendingOffer.seller_id,
      type: 'offer_received',
      linkUrl: offerLink,
    })
    assert(beforeAccept?.is_read === false, 'Expected unread offer notification before accept')

    await signIn(sellerClient, SELLER.email)
    const { error: acceptError } = await sellerClient.rpc('accept_offer', {
      p_offer_id: pendingOffer.id,
    })

    if (acceptError) {
      throw new Error(`accept_offer failed: ${acceptError.message}`)
    }

    const afterAccept = await getNotificationReadState(admin, {
      userId: pendingOffer.seller_id,
      type: 'offer_received',
      linkUrl: offerLink,
    })
    assert(afterAccept?.is_read === true, 'Expected offer notification read after accept')

    const unrelatedAfter = await getNotificationReadState(admin, {
      userId: pendingOffer.seller_id,
      type: 'offer_received',
      linkUrl: hubOfferLink(unrelatedOfferId),
    })
    assert(unrelatedAfter?.is_read === false, 'Unrelated offer notification should stay unread')
    logPass('Offer notification marked read; unrelated notification preserved')
  }

  logStep('Counter-offer notification becomes read after buyer decline')
  const counterOffer = await findPendingCounterOffer(admin)

  if (!counterOffer) {
    console.log('SKIP: No pending seller_to_buyer counter-offer found.')
  } else {
    const counterLink = hubOfferLink(counterOffer.id)

    await createTestNotification(admin, {
      userId: counterOffer.buyer_id,
      type: 'counter_offer_received',
      title: 'Counter-offer received (test)',
      body: 'Test counter-offer notification.',
      linkUrl: counterLink,
    })

    await signIn(buyerClient, BUYER.email)
    const { error: declineError } = await buyerClient.rpc('decline_offer', {
      p_offer_id: counterOffer.id,
    })

    if (declineError) {
      throw new Error(`decline_offer failed: ${declineError.message}`)
    }

    const afterDecline = await getNotificationReadState(admin, {
      userId: counterOffer.buyer_id,
      type: 'counter_offer_received',
      linkUrl: counterLink,
    })
    assert(afterDecline?.is_read === true, 'Expected counter-offer notification read after decline')
    logPass('Counter-offer notification marked read after response')
  }

  logStep('Buyer review reminder becomes read once review submitted')
  const { data: reviewOrder } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, fulfilment_status, protection_status')
    .eq('fulfilment_status', 'completed')
    .eq('protection_status', 'released')
    .order('created_at', { ascending: false })
    .limit(5)
    .maybeSingle()

  if (!reviewOrder?.id) {
    console.log('SKIP: No completed order found for review reminder test.')
  } else {
    const { data: existingReview } = await admin
      .from('reviews')
      .select('id')
      .eq('order_id', reviewOrder.id)
      .eq('reviewer_user_id', reviewOrder.buyer_id)
      .maybeSingle()

    if (existingReview?.id) {
      await admin
        .from('reviews')
        .delete()
        .eq('id', existingReview.id)
    }

    await createTestNotification(admin, {
      userId: reviewOrder.buyer_id,
      type: 'buyer_review_reminder',
      title: 'Leave a review (test)',
      body: 'Your order is complete — leave a review for the seller.',
      linkUrl: orderLink(reviewOrder.id),
    })

    const { error: reviewError } = await admin.from('reviews').insert({
      order_id: reviewOrder.id,
      reviewer_user_id: reviewOrder.buyer_id,
      reviewed_user_id: reviewOrder.seller_id,
      rating: 5,
      review_text: 'Lifecycle test review',
    })

    if (reviewError) {
      throw new Error(`Review insert failed: ${reviewError.message}`)
    }

    const afterReview = await getNotificationReadState(admin, {
      userId: reviewOrder.buyer_id,
      type: 'buyer_review_reminder',
      linkUrl: orderLink(reviewOrder.id),
    })
    assert(afterReview?.is_read === true, 'Expected buyer review reminder read after review')
    logPass('Buyer review reminder marked read after review submitted')
  }

  logStep('Seller payout complete notification stays unread (informational)')
  const { data: payoutOrder } = await admin
    .from('orders')
    .select('id, seller_id, fulfilment_status')
    .eq('payout_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payoutOrder?.id) {
    console.log('SKIP: No paid payout order found.')
  } else {
    const payoutLink = orderLink(payoutOrder.id)

    await createTestNotification(admin, {
      userId: payoutOrder.seller_id,
      type: 'seller_payout_complete',
      title: 'Payout released (test)',
      body: 'Your payout has been released and the order is complete.',
      linkUrl: payoutLink,
    })

    const { error: fulfilmentTouchError } = await admin
      .from('orders')
      .update({ fulfilment_status: payoutOrder.fulfilment_status })
      .eq('id', payoutOrder.id)

    if (fulfilmentTouchError) {
      throw new Error(`Order touch failed: ${fulfilmentTouchError.message}`)
    }

    const payoutNotification = await getNotificationReadState(admin, {
      userId: payoutOrder.seller_id,
      type: 'seller_payout_complete',
      linkUrl: payoutLink,
    })
    assert(
      payoutNotification?.is_read === false,
      'Seller payout complete should remain unread unless user dismisses it',
    )
    logPass('Seller payout complete notification not auto-cleared by fulfilment cleanup')
  }

  console.log('\nAll notification lifecycle read-marking checks passed.')
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
