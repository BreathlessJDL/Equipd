#!/usr/bin/env node
/**
 * Stage 0: read-only production inventory backfill dry run.
 *
 * Reads listings, offers, payments and orders (SELECT only — no writes, no RPC
 * calls that mutate state, no DDL) and produces:
 *   - reports/inventory-backfill-dry-run/audit-latest.json   (machine readable)
 *   - reports/inventory-backfill-dry-run/audit-latest.md     (human readable)
 * plus timestamped copies of both.
 *
 * For every listing it proposes quantity_total / quantity_available /
 * quantity_reserved / quantity_sold and (per linked order) a proposed
 * inventory_state, verifying available + reserved + sold = total.
 * Records that cannot be classified deterministically are listed for manual
 * review with resolution options; nothing is guessed and nothing is applied.
 *
 * Env (from .env.local / .env): VITE_SUPABASE_URL (or SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'reports', 'inventory-backfill-dry-run')

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

const PAGE_SIZE = 1000

async function fetchAll(client, table, columns, orderColumn = 'created_at') {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`SELECT ${table} failed: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// Status vocabularies (must match supabase/*.sql enums)
// ---------------------------------------------------------------------------

const LISTING_STATUSES = ['draft', 'active', 'reserved', 'in_progress', 'sold', 'archived']
const OFFER_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn', 'countered', 'cancelled']
const PAYMENT_STATUSES = ['awaiting_seller_setup', 'pending', 'paid', 'expired', 'cancelled', 'refunded']
const ORDER_FULFILMENT_STATUSES = [
  'awaiting_payment', 'paid', 'in_progress', 'awaiting_collection', 'awaiting_courier_collection',
  'awaiting_seller_delivery', 'collected', 'in_transit', 'delivered', 'awaiting_payout',
  'buyer_confirmed', 'completed', 'cancelled', 'disputed', 'refund_pending', 'refunded',
]

// Payments still holding (or purporting to hold) a reservation.
const OPEN_PAYMENT_STATUSES = ['awaiting_seller_setup', 'pending']

// Order fulfilment statuses meaning "a unit is sold and with (or owed to) the buyer".
const SOLD_ORDER_STATUSES = [
  'paid', 'in_progress', 'awaiting_collection', 'awaiting_courier_collection',
  'awaiting_seller_delivery', 'collected', 'in_transit', 'delivered', 'awaiting_payout',
  'buyer_confirmed', 'completed', 'disputed', 'refund_pending',
]
const COMPLETED_ORDER_STATUSES = ['completed']
const REFUNDED_ORDER_STATUSES = ['refunded']
const CANCELLED_ORDER_STATUSES = ['cancelled']
const AWAITING_PAYMENT_STATUSES = ['awaiting_payment']

function hasHandoverEvidence(order) {
  return Boolean(
    order.collected_at ||
    order.delivered_at ||
    order.courier_collected_at ||
    order.courier_delivered_at ||
    order.collection_confirmed_at ||
    order.buyer_confirmed_at ||
    order.payout_released_at,
  )
}

// ---------------------------------------------------------------------------
// Deterministic classification table (documented in the report verbatim)
// ---------------------------------------------------------------------------

const CLASSIFICATION_TABLE = [
  {
    rule: 'L1',
    legacyState: 'Listing (any status) with no orders and no open payments; not sold-status',
    mapping: 'total=1 available=1 reserved=0 sold=0; no order state',
  },
  {
    rule: 'L2',
    legacyState: 'Listing status=sold with no orders (legacy/manual sale outside payment flow)',
    mapping: 'total=1 available=0 reserved=0 sold=1; no order state',
  },
  {
    rule: 'O1',
    legacyState: 'Order awaiting_payment + payment open (awaiting_seller_setup|pending)',
    mapping: 'listing 1/0/1/0; order inventory_state=reserved',
  },
  {
    rule: 'O2',
    legacyState: 'Order in paid/in-progress fulfilment (paid…awaiting_payout, disputed, refund_pending) or buyer_confirmed',
    mapping: 'listing 1/0/0/1; order inventory_state=sold',
  },
  {
    rule: 'O3',
    legacyState: 'Order completed',
    mapping: 'listing 1/0/0/1; order inventory_state=sold',
  },
  {
    rule: 'O4',
    legacyState: 'Order cancelled (payment expired/cancelled, never paid) or awaiting_payment with terminal payment',
    mapping: 'listing 1/1/0/0; order inventory_state=released',
  },
  {
    rule: 'O5',
    legacyState: 'Order refunded with NO handover evidence (no collected/delivered/QR-confirmed/buyer-confirmed/payout timestamps)',
    mapping: 'listing 1/1/0/0; order inventory_state=restocked',
  },
  {
    rule: 'O6',
    legacyState: 'Order refunded WITH handover evidence (post-handover/completion refund)',
    mapping: 'listing 1/0/0/1; order inventory_state=no_restock',
  },
  {
    rule: 'X',
    legacyState: 'Anything else (multiple concurrent holds, missing links, contradictory statuses, unknown enum values)',
    mapping: 'AMBIGUOUS — blocked pending manual resolution; no mapping proposed',
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — cannot run audit.')
    process.exit(1)
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const generatedAt = new Date().toISOString()
  console.log(`Stage 0 inventory backfill dry run — ${generatedAt}`)
  console.log(`Target: ${url}`)
  console.log('Mode: strictly read-only (SELECT only)\n')

  const { error: inventoryProbeError } = await client
    .from('listings')
    .select('id, quantity_total, quantity_available, quantity_reserved, quantity_sold, inventory_version')
    .limit(1)
  const inventorySchemaPresent = !inventoryProbeError

  const [listings, offers, payments, orders] = await Promise.all([
    fetchAll(client, 'listings', inventorySchemaPresent
      ? 'id, status, seller_id, price_pence, quantity_total, quantity_available, quantity_reserved, quantity_sold, inventory_version, created_at, published_at, updated_at'
      : 'id, status, seller_id, price_pence, created_at, published_at, updated_at'),
    fetchAll(client, 'offers', inventorySchemaPresent
      ? 'id, listing_id, buyer_id, seller_id, status, direction, parent_offer_id, amount_pence, quantity, created_at, updated_at'
      : 'id, listing_id, buyer_id, seller_id, status, direction, parent_offer_id, amount_pence, created_at, updated_at'),
    fetchAll(client, 'payments', inventorySchemaPresent
      ? 'id, offer_id, listing_id, buyer_id, seller_id, status, amount_pence, quantity, listing_unit_price_pence, agreed_unit_price_pence, item_subtotal_pence, expires_at, paid_at, created_at, updated_at'
      : 'id, offer_id, listing_id, buyer_id, seller_id, status, amount_pence, expires_at, paid_at, created_at, updated_at'),
    fetchAll(client, 'orders', inventorySchemaPresent
      ? 'id, offer_id, payment_id, listing_id, buyer_id, seller_id, fulfilment_status, payout_status, protection_status, order_type, amount_pence, quantity, listing_unit_price_pence, agreed_unit_price_pence, item_subtotal_pence, inventory_state, inventory_reserved_at, inventory_sold_at, inventory_released_at, inventory_restocked_at, inventory_no_restock_at, collected_at, delivered_at, courier_collected_at, courier_delivered_at, collection_confirmed_at, buyer_confirmed_at, payout_released_at, created_at, updated_at'
      : 'id, offer_id, payment_id, listing_id, buyer_id, seller_id, fulfilment_status, payout_status, protection_status, order_type, amount_pence, collected_at, delivered_at, courier_collected_at, courier_delivered_at, collection_confirmed_at, buyer_confirmed_at, payout_released_at, created_at, updated_at'),
  ])

  console.log(`Inventory schema present: ${inventorySchemaPresent ? 'yes' : 'no (pre-migration)'}`)
  console.log(`Fetched: ${listings.length} listings, ${offers.length} offers, ${payments.length} payments, ${orders.length} orders\n`)

  // Indexes
  const offersByListing = groupBy(offers, (o) => o.listing_id)
  const paymentsByListing = groupBy(payments, (p) => p.listing_id)
  const ordersByListing = groupBy(orders, (o) => o.listing_id)
  const paymentsByOffer = groupBy(payments, (p) => p.offer_id)
  const ordersByOffer = groupBy(orders, (o) => o.offer_id)
  const ordersByPayment = groupBy(orders, (o) => o.payment_id)
  const paymentById = new Map(payments.map((p) => [p.id, p]))
  const offerById = new Map(offers.map((o) => [o.id, o]))
  const listingById = new Map(listings.map((l) => [l.id, l]))

  const now = Date.now()

  // -------------------------------------------------------------------------
  // Global relationship integrity checks (independent of listing classification)
  // -------------------------------------------------------------------------
  const inconsistencies = []
  const warnings = []

  for (const p of payments) {
    if (!offerById.has(p.offer_id)) {
      inconsistencies.push({ type: 'payment_without_offer', payment_id: p.id, listing_id: p.listing_id, payment_status: p.status })
    }
    if (!listingById.has(p.listing_id)) {
      inconsistencies.push({ type: 'payment_without_listing', payment_id: p.id, listing_id: p.listing_id, payment_status: p.status })
    }
  }
  for (const o of orders) {
    if (!paymentById.has(o.payment_id)) {
      inconsistencies.push({ type: 'order_without_payment', order_id: o.id, listing_id: o.listing_id, fulfilment_status: o.fulfilment_status })
    }
    if (!offerById.has(o.offer_id)) {
      inconsistencies.push({ type: 'order_without_offer', order_id: o.id, listing_id: o.listing_id, fulfilment_status: o.fulfilment_status })
    }
    if (!listingById.has(o.listing_id)) {
      inconsistencies.push({ type: 'order_without_listing', order_id: o.id, listing_id: o.listing_id, fulfilment_status: o.fulfilment_status })
    }
  }
  // Payments with no order at all (payment created but order insert missing)
  for (const p of payments) {
    if (!(ordersByPayment.get(p.id) || []).length) {
      inconsistencies.push({ type: 'payment_without_order', payment_id: p.id, offer_id: p.offer_id, listing_id: p.listing_id, payment_status: p.status })
    }
  }
  // Accepted offers with no payment/order
  for (const o of offers) {
    if (o.status === 'accepted') {
      const ps = paymentsByOffer.get(o.id) || []
      if (!ps.length) {
        inconsistencies.push({ type: 'accepted_offer_without_payment', offer_id: o.id, listing_id: o.listing_id })
      }
    }
    if (!OFFER_STATUSES.includes(o.status)) {
      inconsistencies.push({ type: 'unknown_offer_status', offer_id: o.id, listing_id: o.listing_id, status: o.status })
    }
  }
  for (const p of payments) {
    if (!PAYMENT_STATUSES.includes(p.status)) {
      inconsistencies.push({ type: 'unknown_payment_status', payment_id: p.id, listing_id: p.listing_id, status: p.status })
    }
  }
  for (const o of orders) {
    if (!ORDER_FULFILMENT_STATUSES.includes(o.fulfilment_status)) {
      inconsistencies.push({ type: 'unknown_order_fulfilment_status', order_id: o.id, listing_id: o.listing_id, status: o.fulfilment_status })
    }
  }
  for (const l of listings) {
    if (!LISTING_STATUSES.includes(l.status)) {
      inconsistencies.push({ type: 'unknown_listing_status', listing_id: l.id, status: l.status })
    }
  }

  // Payment/order status coherence
  for (const o of orders) {
    const p = paymentById.get(o.payment_id)
    if (!p) continue
    if (o.fulfilment_status === 'awaiting_payment' && p.status === 'paid') {
      inconsistencies.push({ type: 'paid_payment_with_awaiting_payment_order', order_id: o.id, payment_id: p.id, listing_id: o.listing_id })
    }
    if (SOLD_ORDER_STATUSES.includes(o.fulfilment_status) && OPEN_PAYMENT_STATUSES.includes(p.status)) {
      inconsistencies.push({ type: 'sold_order_with_open_payment', order_id: o.id, payment_id: p.id, listing_id: o.listing_id, order_status: o.fulfilment_status, payment_status: p.status })
    }
  }

  // Stale open payments past deadline (cron not scheduled — expected legacy condition, deterministic: still reserved)
  for (const p of payments) {
    if (OPEN_PAYMENT_STATUSES.includes(p.status) && p.expires_at && new Date(p.expires_at).getTime() <= now) {
      warnings.push({
        type: 'open_payment_past_expiry',
        payment_id: p.id,
        offer_id: p.offer_id,
        listing_id: p.listing_id,
        expires_at: p.expires_at,
        note: 'Payment still open past expires_at (release_expired_payments not scheduled). Deterministically mapped as reserved; the Stage 1 expiry worker will release it after migration.',
      })
    }
  }

  // -------------------------------------------------------------------------
  // Per-listing classification
  // -------------------------------------------------------------------------
  const proposals = []
  const ambiguous = []
  const categoryCounts = initCategories()

  for (const listing of listings) {
    const lOffers = offersByListing.get(listing.id) || []
    const lPayments = paymentsByListing.get(listing.id) || []
    const lOrders = ordersByListing.get(listing.id) || []

    const acceptedOffers = lOffers.filter((o) => o.status === 'accepted')
    const openPayments = lPayments.filter((p) => OPEN_PAYMENT_STATUSES.includes(p.status))

    if (acceptedOffers.length > 1) {
      addId(categoryCounts, 'listings_with_multiple_accepted_offers', listing.id)
    }
    if (openPayments.length > 1) {
      addId(categoryCounts, 'listings_with_multiple_open_payments', listing.id)
    }

    // Classify each order on this listing.
    const orderStates = []
    const problems = []
    for (const order of lOrders) {
      const payment = paymentById.get(order.payment_id) || null
      const cls = classifyOrder(order, payment)
      orderStates.push(cls)
      if (cls.state === 'ambiguous') {
        problems.push(cls)
      }
    }

    const reservedCount = orderStates.filter((s) => s.state === 'reserved').length
    // no_restock = refunded after handover; the unit stays counted as sold.
    const soldCount = orderStates.filter((s) => s.state === 'sold' || s.state === 'no_restock').length
    const ambiguousOrders = orderStates.filter((s) => s.state === 'ambiguous')

    // Category tallies from order states
    for (const s of orderStates) {
      if (s.category) addId(categoryCounts, s.category, s.order_id)
    }

    let quantity = null
    let ambiguityReasons = []
    let resolutionOptions = []

    if (ambiguousOrders.length > 0) {
      ambiguityReasons.push(...ambiguousOrders.map((s) => s.reason))
      resolutionOptions.push(...ambiguousOrders.flatMap((s) => s.options))
    } else if (reservedCount + soldCount > 1) {
      ambiguityReasons.push(`Listing has ${reservedCount} reserved + ${soldCount} sold concurrent holds but legacy listings are single-unit (total=1). Multiple concurrent transactions cannot be mapped deterministically.`)
      resolutionOptions.push(
        'Manually determine which transaction genuinely holds/sold the unit and cancel/refund the other(s) before migration.',
        'If the seller genuinely sold multiple physical units through duplicate transactions, set quantity_total to the number of legitimate sales during a supervised manual backfill.',
      )
    } else {
      // Deterministic mapping
      const reserved = reservedCount
      const sold = soldCount > 0 ? 1 : (listing.status === 'sold' && soldCount === 0 && reservedCount === 0 ? 1 : 0)
      if (listing.status === 'sold' && soldCount === 0 && reservedCount === 0) {
        if (lOrders.length === 0) {
          addId(categoryCounts, 'sold_listings_without_orders_legacy_manual', listing.id)
        } else {
          // sold listing whose only orders are cancelled/released/restocked — contradictory
          ambiguityReasons.push(`Listing status is 'sold' but every linked order is released/restocked/cancelled (no order ever completed). Listing and order histories contradict each other.`)
          resolutionOptions.push(
            "Set listing status back to 'active' or 'archived' if the sale never happened, then map 1/1/0/0.",
            'If the item was actually sold off-platform, keep status sold and map 1/0/0/1 with no order marked sold.',
          )
        }
      }
      if (!ambiguityReasons.length) {
        const available = 1 - reserved - sold
        if (available < 0) {
          ambiguityReasons.push(`Computed quantity_available would be ${available} (reserved=${reserved}, sold=${sold}) which violates the invariant.`)
          resolutionOptions.push('Manually resolve the duplicate holds before migration.')
        } else {
          quantity = { quantity_total: 1, quantity_available: available, quantity_reserved: reserved, quantity_sold: sold }
        }
      }

      // Cross-check listing status vs computed state (contradiction detection)
      if (quantity) {
        const contradiction = detectStatusContradiction(listing, quantity, lOrders, openPayments)
        if (contradiction) {
          quantity = null
          ambiguityReasons.push(contradiction.reason)
          resolutionOptions.push(...contradiction.options)
        }
      }
    }

    if (quantity) {
      const sum = quantity.quantity_available + quantity.quantity_reserved + quantity.quantity_sold
      const invariantOk = sum === quantity.quantity_total
      const actualInventory = inventorySchemaPresent
        ? {
            quantity_total: listing.quantity_total,
            quantity_available: listing.quantity_available,
            quantity_reserved: listing.quantity_reserved,
            quantity_sold: listing.quantity_sold,
            inventory_version: listing.inventory_version,
          }
        : null
      const actualInvariantOk = !actualInventory || (
        actualInventory.quantity_total >= 1
        && actualInventory.quantity_available >= 0
        && actualInventory.quantity_reserved >= 0
        && actualInventory.quantity_sold >= 0
        && actualInventory.quantity_available
          + actualInventory.quantity_reserved
          + actualInventory.quantity_sold === actualInventory.quantity_total
      )
      const backfillMatchesProposal = !actualInventory || (
        actualInventory.quantity_total === quantity.quantity_total
        && actualInventory.quantity_available === quantity.quantity_available
        && actualInventory.quantity_reserved === quantity.quantity_reserved
        && actualInventory.quantity_sold === quantity.quantity_sold
        && orderStates.every((state) => {
          const actualOrder = lOrders.find((order) => order.id === state.order_id)
          return actualOrder?.inventory_state === state.state
        })
      )
      proposals.push({
        listing_id: listing.id,
        listing_status: listing.status,
        ...quantity,
        invariant_ok: invariantOk,
        actual_inventory: actualInventory,
        actual_invariant_ok: actualInvariantOk,
        backfill_matches_proposal: backfillMatchesProposal,
        orders: orderStates.map((s) => ({
          order_id: s.order_id,
          proposed_inventory_state: s.state,
          actual_inventory_state: inventorySchemaPresent
            ? lOrders.find((order) => order.id === s.order_id)?.inventory_state
            : null,
          rule: s.rule,
        })),
      })
      if (!invariantOk) {
        inconsistencies.push({ type: 'invariant_violation', listing_id: listing.id, ...quantity })
      }
      if (!actualInvariantOk) {
        inconsistencies.push({
          type: 'actual_inventory_invariant_violation',
          listing_id: listing.id,
          ...actualInventory,
        })
      }
      if (!backfillMatchesProposal) {
        inconsistencies.push({
          type: 'actual_inventory_does_not_match_deterministic_mapping',
          listing_id: listing.id,
          proposed: quantity,
          actual: actualInventory,
        })
      }
      if (listing.status === 'active' && lOrders.length === 0 && openPayments.length === 0) {
        addId(categoryCounts, 'active_listings_no_transaction', listing.id)
      }
    } else {
      ambiguous.push({
        listing_id: listing.id,
        listing_status: listing.status,
        offer_ids: lOffers.map((o) => `${o.id} (${o.status})`),
        payment_ids: lPayments.map((p) => `${p.id} (${p.status})`),
        order_ids: lOrders.map((o) => `${o.id} (${o.fulfilment_status})`),
        reasons: [...new Set(ambiguityReasons)],
        resolution_options: [...new Set(resolutionOptions)],
      })
    }
  }

  // Deduplicate inconsistency-driven ambiguity: orphan payments/orders whose listing does not exist
  // are already in `inconsistencies` and block Stage 1 on their own.

  // -------------------------------------------------------------------------
  // Verdict
  // -------------------------------------------------------------------------
  const blockedByAmbiguous = ambiguous.length > 0
  const blockedByInconsistencies = inconsistencies.length > 0
  const verdict = blockedByAmbiguous
    ? 'BLOCKED_BY_AMBIGUOUS_RECORDS'
    : blockedByInconsistencies
      ? 'BLOCKED_BY_DATA_INCONSISTENCIES'
      : 'SAFE_TO_PROCEED'

  const report = {
    generated_at: generatedAt,
    mode: 'read-only dry run (SELECT only; no writes, no RPCs, no DDL)',
    target: url,
    inventory_schema_present: inventorySchemaPresent,
    row_counts: {
      listings: listings.length,
      offers: offers.length,
      payments: payments.length,
      orders: orders.length,
    },
    status_distributions: {
      listings: countBy(listings, (l) => l.status),
      offers: countBy(offers, (o) => o.status),
      payments: countBy(payments, (p) => p.status),
      orders_fulfilment: countBy(orders, (o) => o.fulfilment_status),
    },
    categories: finalizeCategories(categoryCounts),
    classification_table: CLASSIFICATION_TABLE,
    proposals: {
      count: proposals.length,
      invariant_failures: proposals.filter((p) => !p.invariant_ok).length,
      actual_invariant_failures: proposals.filter((p) => !p.actual_invariant_ok).length,
      backfill_mismatches: proposals.filter((p) => !p.backfill_matches_proposal).length,
      rows: proposals,
    },
    ambiguous_records: ambiguous,
    data_inconsistencies: inconsistencies,
    warnings,
    stage_1_verdict: verdict,
  }

  mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = generatedAt.replace(/[:.]/g, '-')
  const jsonPath = join(REPORT_DIR, `audit-${stamp}.json`)
  const mdPath = join(REPORT_DIR, `audit-${stamp}.md`)
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(join(REPORT_DIR, 'audit-latest.json'), JSON.stringify(report, null, 2))
  const md = renderMarkdown(report)
  writeFileSync(mdPath, md)
  writeFileSync(join(REPORT_DIR, 'audit-latest.md'), md)

  console.log(`JSON report:  ${jsonPath}`)
  console.log(`Human report: ${mdPath}`)
  console.log(`\nListings proposed deterministically: ${proposals.length}/${listings.length}`)
  console.log(`Invariant failures: ${report.proposals.invariant_failures}`)
  if (inventorySchemaPresent) {
    console.log(`Actual inventory invariant failures: ${report.proposals.actual_invariant_failures}`)
    console.log(`Backfill mismatches: ${report.proposals.backfill_mismatches}`)
  }
  console.log(`Ambiguous records: ${ambiguous.length}`)
  console.log(`Data inconsistencies: ${inconsistencies.length}`)
  console.log(`Warnings: ${warnings.length}`)
  console.log(`\nStage 1 verdict: ${verdict}`)
}

// ---------------------------------------------------------------------------
// Order classification
// ---------------------------------------------------------------------------

function classifyOrder(order, payment) {
  const base = { order_id: order.id, payment_id: order.payment_id, offer_id: order.offer_id }
  const fs = order.fulfilment_status

  if (AWAITING_PAYMENT_STATUSES.includes(fs)) {
    if (payment && OPEN_PAYMENT_STATUSES.includes(payment.status)) {
      return { ...base, state: 'reserved', rule: 'O1', category: 'accepted_unpaid_orders' }
    }
    if (payment && ['expired', 'cancelled'].includes(payment.status)) {
      // Order not yet synced to cancelled but payment is terminal — released.
      return { ...base, state: 'released', rule: 'O4', category: 'cancelled_or_expired_unpaid_orders' }
    }
    return {
      ...base,
      state: 'ambiguous',
      reason: `Order ${order.id} is awaiting_payment but its payment is ${payment ? payment.status : 'missing'} — cannot determine whether a reservation is live.`,
      options: [
        'If the payment record is missing, cancel the order manually and map it as released.',
        'If the payment was paid out-of-band, reconcile with Stripe and mark the order paid before migration.',
      ],
    }
  }

  if (CANCELLED_ORDER_STATUSES.includes(fs)) {
    if (payment && payment.status === 'paid') {
      return {
        ...base,
        state: 'ambiguous',
        reason: `Order ${order.id} is cancelled but its payment is paid — a paid-then-cancelled order without a refund trail cannot be mapped deterministically.`,
        options: [
          'If money was refunded manually, record the refund and map as restocked (pre-handover) or no_restock (post-handover).',
          'If the cancellation was made before capture and the payment status is wrong, correct the payment to cancelled and map as released.',
        ],
      }
    }
    return { ...base, state: 'released', rule: 'O4', category: 'cancelled_or_expired_unpaid_orders' }
  }

  if (REFUNDED_ORDER_STATUSES.includes(fs)) {
    if (hasHandoverEvidence(order)) {
      return { ...base, state: 'no_restock', rule: 'O6', category: 'refunded_after_handover_orders' }
    }
    return { ...base, state: 'restocked', rule: 'O5', category: 'refunded_before_fulfilment_orders' }
  }

  if (COMPLETED_ORDER_STATUSES.includes(fs)) {
    return { ...base, state: 'sold', rule: 'O3', category: 'completed_orders' }
  }

  if (SOLD_ORDER_STATUSES.includes(fs)) {
    if (payment && payment.status !== 'paid' && payment.status !== 'refunded') {
      return {
        ...base,
        state: 'ambiguous',
        reason: `Order ${order.id} has fulfilment_status ${fs} (implies paid) but payment status is ${payment.status}.`,
        options: [
          'Reconcile with Stripe: if the charge exists, correct payment to paid and map order as sold.',
          'If no charge exists, cancel the order and map as released.',
        ],
      }
    }
    return { ...base, state: 'sold', rule: 'O2', category: 'paid_or_in_progress_orders' }
  }

  return {
    ...base,
    state: 'ambiguous',
    reason: `Order ${order.id} has unrecognised fulfilment_status '${fs}'.`,
    options: ['Investigate the unknown status value and extend the classification table explicitly before migration.'],
  }
}

function detectStatusContradiction(listing, quantity, lOrders, openPayments) {
  const { quantity_available: avail, quantity_reserved: res, quantity_sold: sold } = quantity
  switch (listing.status) {
    case 'active':
      if (res > 0 || sold > 0) {
        return {
          reason: `Listing status is 'active' but computed inventory shows reserved=${res}, sold=${sold}. An active listing should not have live holds or completed sales in the single-unit model.`,
          options: [
            "If the transaction is genuine, correct the listing status (reserved/in_progress/sold) and map from the order.",
            'If the transaction record is stale, cancel it and map the listing as 1/1/0/0.',
          ],
        }
      }
      return null
    case 'reserved':
      if (res !== 1) {
        return {
          reason: `Listing status is 'reserved' but there is no open reservation (computed reserved=${res}, sold=${sold}, open payments=${openPayments.length}).`,
          options: [
            "If the hold ended, set listing back to 'active' and map from the orders (released/restocked).",
            'If a reservation exists but its payment/order rows are missing, recreate or repair the transaction rows first.',
          ],
        }
      }
      return null
    case 'in_progress':
      if (sold !== 1) {
        return {
          reason: `Listing status is 'in_progress' but no paid order was found (computed sold=${sold}, reserved=${res}).`,
          options: [
            'Reconcile with Stripe; if paid, repair the order/payment rows then map as sold.',
            "If payment never completed, set the listing back to 'active'/'reserved' consistently with its transaction and re-run the audit.",
          ],
        }
      }
      return null
    case 'sold':
      if (sold !== 1) {
        return {
          reason: `Listing status is 'sold' but computed sold=${sold}.`,
          options: [
            'Confirm whether the sale genuinely completed; repair order rows or listing status accordingly.',
          ],
        }
      }
      return null
    case 'draft':
    case 'archived':
      if (res > 0) {
        return {
          reason: `Listing status is '${listing.status}' but a live reservation exists (reserved=${res}). A hidden listing should not have an open unpaid transaction.`,
          options: [
            'Cancel the open transaction and map as released, or restore the listing to reserved status.',
          ],
        }
      }
      // sold units on archived listings are plausible history (seller archived after completion)
      return null
    default:
      return {
        reason: `Listing has unknown status '${listing.status}'.`,
        options: ['Extend the classification table explicitly for this status before migration.'],
      }
  }
}

// ---------------------------------------------------------------------------
// Category bookkeeping / rendering
// ---------------------------------------------------------------------------

const CATEGORY_KEYS = [
  'active_listings_no_transaction',
  'accepted_unpaid_orders',
  'paid_or_in_progress_orders',
  'completed_orders',
  'cancelled_or_expired_unpaid_orders',
  'refunded_before_fulfilment_orders',
  'refunded_after_handover_orders',
  'sold_listings_without_orders_legacy_manual',
  'listings_with_multiple_accepted_offers',
  'listings_with_multiple_open_payments',
]

function initCategories() {
  const map = {}
  for (const key of CATEGORY_KEYS) map[key] = new Set()
  return map
}

function addId(categories, key, id) {
  if (!categories[key]) categories[key] = new Set()
  categories[key].add(id)
}

function finalizeCategories(categories) {
  const out = {}
  for (const [key, ids] of Object.entries(categories)) {
    out[key] = { count: ids.size, ids: [...ids] }
  }
  return out
}

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

function countBy(rows, keyFn) {
  const out = {}
  for (const row of rows) {
    const key = keyFn(row)
    out[key] = (out[key] || 0) + 1
  }
  return out
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Stage 0: Inventory Backfill Dry Run')
  lines.push('')
  lines.push(`- Generated: ${report.generated_at}`)
  lines.push(`- Target: ${report.target}`)
  lines.push(`- Mode: ${report.mode}`)
  lines.push(`- Inventory schema present: ${report.inventory_schema_present ? 'yes' : 'no (pre-migration)'}`)
  lines.push('')
  lines.push('## Row counts')
  lines.push('')
  for (const [table, count] of Object.entries(report.row_counts)) {
    lines.push(`- ${table}: ${count}`)
  }
  lines.push('')
  lines.push('## Status distributions')
  lines.push('')
  for (const [entity, dist] of Object.entries(report.status_distributions)) {
    lines.push(`### ${entity}`)
    lines.push('')
    const entries = Object.entries(dist)
    if (!entries.length) lines.push('_none_')
    for (const [status, count] of entries) lines.push(`- ${status}: ${count}`)
    lines.push('')
  }
  lines.push('## Category counts')
  lines.push('')
  lines.push('| Category | Count | IDs |')
  lines.push('| --- | --- | --- |')
  for (const [key, { count, ids }] of Object.entries(report.categories)) {
    lines.push(`| ${key} | ${count} | ${ids.length ? ids.join(', ') : '—'} |`)
  }
  lines.push('')
  lines.push('## Deterministic classification table')
  lines.push('')
  lines.push('| Rule | Legacy state | Proposed mapping |')
  lines.push('| --- | --- | --- |')
  for (const row of report.classification_table) {
    lines.push(`| ${row.rule} | ${row.legacyState} | ${row.mapping} |`)
  }
  lines.push('')
  lines.push('## Proposed listing inventory values')
  lines.push('')
  lines.push(`Deterministic proposals: ${report.proposals.count} of ${report.row_counts.listings} listings. Invariant failures: ${report.proposals.invariant_failures}.`)
  if (report.inventory_schema_present) {
    lines.push(`Actual inventory invariant failures: ${report.proposals.actual_invariant_failures}. Backfill mismatches: ${report.proposals.backfill_mismatches}.`)
  }
  lines.push('')
  lines.push('| Listing | Status | proposed total/available/reserved/sold | actual total/available/reserved/sold | Invariant | Mapping | Order states |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const p of report.proposals.rows) {
    const orderStates = p.orders.length
      ? p.orders.map((o) => `${o.order_id}: ${o.proposed_inventory_state}${o.actual_inventory_state ? ` / actual ${o.actual_inventory_state}` : ''} (${o.rule})`).join('<br>')
      : '—'
    const proposed = `${p.quantity_total}/${p.quantity_available}/${p.quantity_reserved}/${p.quantity_sold}`
    const actual = p.actual_inventory
      ? `${p.actual_inventory.quantity_total}/${p.actual_inventory.quantity_available}/${p.actual_inventory.quantity_reserved}/${p.actual_inventory.quantity_sold}`
      : 'pre-migration'
    lines.push(`| ${p.listing_id} | ${p.listing_status} | ${proposed} | ${actual} | ${p.actual_invariant_ok ? 'OK' : 'FAIL'} | ${p.backfill_matches_proposal ? 'MATCH' : 'MISMATCH'} | ${orderStates} |`)
  }
  lines.push('')
  lines.push('## Ambiguous records (manual review required — nothing applied)')
  lines.push('')
  if (!report.ambiguous_records.length) {
    lines.push('_None._')
  } else {
    for (const rec of report.ambiguous_records) {
      lines.push(`### Listing ${rec.listing_id} (${rec.listing_status})`)
      lines.push('')
      lines.push(`- Offers: ${rec.offer_ids.length ? rec.offer_ids.join(', ') : 'none'}`)
      lines.push(`- Payments: ${rec.payment_ids.length ? rec.payment_ids.join(', ') : 'none'}`)
      lines.push(`- Orders: ${rec.order_ids.length ? rec.order_ids.join(', ') : 'none'}`)
      lines.push('- Why ambiguous:')
      for (const reason of rec.reasons) lines.push(`  - ${reason}`)
      lines.push('- Possible resolutions (not applied):')
      for (const option of rec.resolution_options) lines.push(`  - ${option}`)
      lines.push('')
    }
  }
  lines.push('## Data inconsistencies')
  lines.push('')
  if (!report.data_inconsistencies.length) {
    lines.push('_None._')
  } else {
    for (const item of report.data_inconsistencies) {
      lines.push(`- ${JSON.stringify(item)}`)
    }
  }
  lines.push('')
  lines.push('## Warnings (deterministic, non-blocking)')
  lines.push('')
  if (!report.warnings.length) {
    lines.push('_None._')
  } else {
    for (const item of report.warnings) {
      lines.push(`- ${JSON.stringify(item)}`)
    }
  }
  lines.push('')
  lines.push('## Stage 1 verdict')
  lines.push('')
  lines.push(`**${report.stage_1_verdict}**`)
  lines.push('')
  if (report.stage_1_verdict === 'SAFE_TO_PROCEED') {
    lines.push('All listings map deterministically, every proposal satisfies available + reserved + sold = total, and no relationship inconsistencies were found. The Stage 1 migration may proceed, and must re-run equivalent precondition checks transactionally at apply time.')
  } else if (report.stage_1_verdict === 'BLOCKED_BY_AMBIGUOUS_RECORDS') {
    lines.push('One or more records cannot be classified deterministically. Resolve each item in the manual-review section, then re-run this audit. The migration must not proceed until this report returns SAFE_TO_PROCEED.')
  } else {
    lines.push('Relationship or status inconsistencies were found. Resolve each item in the data-inconsistencies section, then re-run this audit. The migration must not proceed until this report returns SAFE_TO_PROCEED.')
  }
  lines.push('')
  return lines.join('\n')
}

main().catch((error) => {
  console.error('Audit failed:', error.message)
  process.exit(1)
})
