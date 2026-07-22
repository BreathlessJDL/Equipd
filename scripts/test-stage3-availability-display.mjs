// Stage 3 (Option A) verification: display-only availability.
// - Pure display-guard unit checks (quantity_available > 1 only).
// - Source assertions that card/detail surfaces select and render availability.
// - Anonymous production reads proving quantity_available is readable and
//   zero-available listings are never publicly visible.
// Read-only: no writes, no fixtures, no backend changes.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { getDisplayableAvailableQuantity } from '../src/lib/listingAvailability.js'

function loadEnvFile(path) {
  const content = readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, '')
    }
  }
}

loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) throw new Error('Missing Supabase env')

const anon = createClient(url, anonKey, { auth: { persistSession: false } })

let failures = 0

function check(name, ok, detail = '') {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}

// 1. Display guard: only quantity_available > 1 produces an availability line.
check('guard hides quantity 1', getDisplayableAvailableQuantity({ quantity_available: 1 }) === null)
check('guard hides quantity 0', getDisplayableAvailableQuantity({ quantity_available: 0 }) === null)
check('guard hides missing field', getDisplayableAvailableQuantity({}) === null)
check('guard hides null listing', getDisplayableAvailableQuantity(null) === null)
check('guard hides non-integer', getDisplayableAvailableQuantity({ quantity_available: 2.5 }) === null)
check('guard shows quantity 6', getDisplayableAvailableQuantity({ quantity_available: 6 }) === 6)
check(
  'guard uses quantity_available not quantity_total',
  getDisplayableAvailableQuantity({ quantity_total: 6, quantity_available: 1 }) === null,
)

// 2. Source assertions: the approved surfaces select and render availability.
const listingsLib = readFileSync('src/lib/listings.js', 'utf8')
const hydrateCalls = listingsLib.match(/await attachPublicAvailabilityToListings\(/g) ?? []
check(
  'browse/search, distance, recommended and seller-shop cards hydrate availability',
  hydrateCalls.length >= 4,
  `${hydrateCalls.length} hydration call sites`,
)

const brandCatalogueLib = readFileSync('src/lib/brandCatalogue.js', 'utf8')
check(
  'brand page listings hydrate availability',
  brandCatalogueLib.includes('attachPublicAvailabilityToListings'),
)

const listingCard = readFileSync('src/components/ListingCard.jsx', 'utf8')
check(
  'ListingCard renders availability via shared guard',
  listingCard.includes('getDisplayableAvailableQuantity')
    && listingCard.includes('listing-card__availability')
    && listingCard.includes('listing-row__availability'),
)

const itemSummary = readFileSync('src/components/listing/ListingItemSummary.jsx', 'utf8')
check(
  'ListingItemSummary renders availability via shared guard',
  itemSummary.includes('getDisplayableAvailableQuantity')
    && itemSummary.includes('listing-summary__availability'),
)

// 3. Anonymous production reads. The hydration source is the base listings
// table, whose anonymous RLS uses the canonical public-visibility predicate.
const { data: publicRows, error: publicError } = await anon
  .from('listings')
  .select('id, status, quantity_available')
  .limit(1000)

check(
  'anon can read quantity_available from the hydration source',
  !publicError,
  publicError?.message ?? '',
)

if (!publicError) {
  const rows = publicRows ?? []
  check(`anon sees at least one public listing (${rows.length} rows)`, rows.length > 0)

  const zeroAvailable = rows.filter((row) => !(Number(row.quantity_available) >= 1))
  check(
    'no zero-available listings publicly visible',
    zeroAvailable.length === 0,
    zeroAvailable.map((row) => row.id).join(', '),
  )
}

console.log(failures === 0 ? '\nAll Stage 3 display checks passed.' : `\n${failures} check(s) FAILED.`)
process.exitCode = failures === 0 ? 0 : 1
