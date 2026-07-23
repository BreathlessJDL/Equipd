/**
 * Merchant feed identity: stable product IDs, external seller IDs, UPI policy.
 */

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Immutable Merchant item id for the lifetime of a listing row.
 * Format: listing_<uuid-without-dashes>
 * Does not change when title, slug, price or images change.
 */
export function buildMerchantProductId(listing) {
  const id = normalizeWhitespace(listing?.id).toLowerCase()
  if (!id) return null
  if (!/^[0-9a-f-]{36}$/i.test(id) && !/^[0-9a-f]{32}$/i.test(id)) {
    // Still accept non-uuid fixtures in tests if non-empty and safe
    if (!/^[a-z0-9_-]{8,64}$/i.test(id)) return null
  }
  const compact = id.replace(/-/g, '')
  return `listing_${compact}`
}

/**
 * Marketplace multi-seller external_seller_id — seller UUID, no PII.
 */
export function buildMerchantExternalSellerId(listingOrSellerId) {
  const raw = typeof listingOrSellerId === 'string'
    ? listingOrSellerId
    : listingOrSellerId?.seller_id
  const id = normalizeWhitespace(raw).toLowerCase()
  if (!id) return null
  const compact = id.replace(/-/g, '')
  if (!/^[a-z0-9]{8,64}$/i.test(compact)) return null
  return `seller_${compact}`
}

/**
 * Identifier policy:
 * - Never invent GTIN/MPN from Equipd keys or listing IDs
 * - Submit brand when known
 * - Do not auto-set identifier_exists=false for branded commercial equipment
 *   (those products usually have manufacturer GTINs we simply do not store yet)
 * - identifier_exists=no only when brand/gtin/mpn are all absent
 */
export function resolveMerchantIdentifierDecision(listing, equipmentProduct = null) {
  const brand = normalizeWhitespace(listing?.brand)
    || normalizeWhitespace(equipmentProduct?.brand)
    || null

  // Future-ready hooks — no current catalogue columns store these.
  const gtin = normalizeWhitespace(listing?.gtin || equipmentProduct?.gtin) || null
  const mpn = normalizeWhitespace(listing?.mpn || equipmentProduct?.mpn) || null

  if (gtin) {
    return {
      blocked: false,
      decision: 'has_gtin',
      brand,
      gtin,
      mpn: mpn || null,
      identifierExists: null, // omit — default yes
    }
  }

  if (mpn && brand) {
    return {
      blocked: false,
      decision: 'brand_and_mpn',
      brand,
      gtin: null,
      mpn,
      identifierExists: null,
    }
  }

  if (brand) {
    return {
      blocked: false,
      decision: 'brand_only',
      brand,
      gtin: null,
      mpn: null,
      // Manufactured gym equipment typically has a GTIN we do not hold.
      // Do not claim identifier_exists=no.
      identifierExists: null,
    }
  }

  return {
    blocked: false,
    decision: 'no_reliable_identifier',
    brand: null,
    gtin: null,
    mpn: null,
    identifierExists: 'no',
  }
}
