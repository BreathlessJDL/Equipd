/**
 * QA REVIEW SEED DATA ONLY — DO NOT RUN FOR REAL PRODUCTION REVIEWS
 *
 * Homepage review carousel test data (live-domain / staging QA only).
 * Fixed UUID namespace for idempotent upserts and targeted cleanup.
 * Not a Supabase migration. Do not deploy or run automatically in CI.
 */

export const QA_CAROUSEL_REVIEW_SEED_MARKER = 'f4f4f4f4'

export const QA_CAROUSEL_LISTING_SLUG_PREFIX = 'qa-carousel-seed-'

export const QA_CAROUSEL_OFFER_MESSAGE =
  'QA REVIEW SEED DATA ONLY — synthetic completed order for homepage carousel testing. Not a real transaction.'

export const QA_CAROUSEL_REVIEW_PASSWORD = 'EquipdQaCarouselSeed123!'

export const QA_CAROUSEL_DEFAULT_ADMIN_EMAIL = 'jlinnell95@gmail.com'

export const QA_CAROUSEL_LISTING_DESCRIPTION =
  'QA REVIEW SEED DATA ONLY — synthetic sold listing for homepage carousel testing. Not visible in browse.'

/** Twenty QA-only buyers with believable UK display names (not shown on homepage). */
export const QA_CAROUSEL_REVIEW_BUYERS = [
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000001`, email: 'qa-carousel-review-01@equipd.dev', displayName: 'Hannah Mitchell', location: 'Leeds, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000002`, email: 'qa-carousel-review-02@equipd.dev', displayName: 'Oliver Bennett', location: 'Manchester, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000003`, email: 'qa-carousel-review-03@equipd.dev', displayName: 'Sophie Turner', location: 'Bristol, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000004`, email: 'qa-carousel-review-04@equipd.dev', displayName: 'James Fletcher', location: 'Sheffield, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000005`, email: 'qa-carousel-review-05@equipd.dev', displayName: 'Emily Richardson', location: 'Birmingham, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000006`, email: 'qa-carousel-review-06@equipd.dev', displayName: 'Daniel Hughes', location: 'Cardiff, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000007`, email: 'qa-carousel-review-07@equipd.dev', displayName: 'Charlotte Webb', location: 'Edinburgh, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000008`, email: 'qa-carousel-review-08@equipd.dev', displayName: 'Matthew Clarke', location: 'Nottingham, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000009`, email: 'qa-carousel-review-09@equipd.dev', displayName: 'Rebecca Shaw', location: 'Newcastle upon Tyne, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000a`, email: 'qa-carousel-review-10@equipd.dev', displayName: 'Liam Parker', location: 'Glasgow, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000b`, email: 'qa-carousel-review-11@equipd.dev', displayName: 'Thomas Wright', location: 'Liverpool, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000c`, email: 'qa-carousel-review-12@equipd.dev', displayName: 'Amelia Cooper', location: 'Leicester, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000d`, email: 'qa-carousel-review-13@equipd.dev', displayName: 'George Murphy', location: 'Southampton, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000e`, email: 'qa-carousel-review-14@equipd.dev', displayName: 'Isla Campbell', location: 'Brighton, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000f`, email: 'qa-carousel-review-15@equipd.dev', displayName: 'Noah Sullivan', location: 'Cambridge, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000010`, email: 'qa-carousel-review-16@equipd.dev', displayName: 'Grace Morrison', location: 'Oxford, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000011`, email: 'qa-carousel-review-17@equipd.dev', displayName: 'Ethan Fraser', location: 'York, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000012`, email: 'qa-carousel-review-18@equipd.dev', displayName: 'Poppy Hughes', location: 'Norwich, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000013`, email: 'qa-carousel-review-19@equipd.dev', displayName: 'Jacob Reid', location: 'Reading, UK' },
  { id: `${QA_CAROUSEL_REVIEW_SEED_MARKER}-0001-4001-8001-000000000014`, email: 'qa-carousel-review-20@equipd.dev', displayName: 'Lily Watson', location: 'Bath, UK' },
]

function seedUuid(second, third, fourth, index) {
  const suffix = (index + 1).toString(16).padStart(12, '0')
  return `${QA_CAROUSEL_REVIEW_SEED_MARKER}-${second}-${third}-${fourth}-${suffix}`
}

function qaListingSlug(index, title) {
  const slugBody = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `${QA_CAROUSEL_LISTING_SLUG_PREFIX}${String(index + 1).padStart(2, '0')}-${slugBody}`
}

/** Spread across the last ~4 months (deterministic on re-run). */
export function qaReviewCreatedAtForIndex(index) {
  const daysAgo = [
    9, 17, 24, 31, 38, 45, 52, 59, 66, 73,
    80, 87, 94, 101, 108, 112, 115, 117, 119, 121,
  ][index]
  const hours = [
    14, 9, 18, 11, 16, 8, 19, 13, 10, 17,
    12, 15, 9, 18, 11, 16, 8, 14, 19, 10,
  ][index]
  const minutes = [
    23, 41, 7, 55, 32, 18, 49, 3, 28, 44,
    21, 36, 12, 58, 27, 9, 41, 16, 33, 51,
  ][index]
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

const FOUR_STAR_INDICES = new Set([2, 6, 9, 12, 15, 18])

/** 20 homepage QA reviews: 14× five-star, 6× four-star. Titles are QA-only stub listings. */
const QA_CAROUSEL_REVIEW_ROWS = [
  {
    index: 0,
    listingTitle: 'Technogym Skillmill',
    categorySlug: 'treadmill',
    pricePence: 420000,
    purchaseType: 'commercial',
    reviewText:
      'Collected from a gym that was closing down. Belt felt smooth straight away and the seller had it running before I left. Heavier than I expected, but proper kit.',
  },
  {
    index: 1,
    listingTitle: 'Hammer Strength Iso-Lateral Chest Press',
    categorySlug: 'plate-loaded-machine',
    pricePence: 185000,
    purchaseType: 'commercial',
    reviewText:
      'Exactly as photographed. Plates loaded fine and both arms move evenly — no wobble on the frame at all.',
  },
  {
    index: 2,
    listingTitle: 'Concept2 SkiErg',
    categorySlug: 'skierg',
    pricePence: 65000,
    purchaseType: 'home',
    reviewText:
      'Really pleased with it. Monitor cable was a bit frayed near the plug but works fine, and the fan resistance is spot on.',
  },
  {
    index: 3,
    listingTitle: 'Rogue Echo Bike',
    categorySlug: 'assault-bike',
    pricePence: 55000,
    purchaseType: 'home',
    reviewText:
      'Turned up on time and the seller helped me wheel it to the car. Console battery was flat but they’d warned me — sorted in two minutes.',
  },
  {
    index: 4,
    listingTitle: 'AssaultRunner Pro',
    categorySlug: 'treadmill',
    pricePence: 310000,
    purchaseType: 'commercial',
    reviewText:
      'Mint condition for ex-commercial use. Took a proper workout on collection day and it’s as brutal as everyone says.',
  },
  {
    index: 5,
    listingTitle: 'Nautilus Nitro Leg Press',
    categorySlug: 'pin-loaded-machine',
    pricePence: 220000,
    purchaseType: 'commercial',
    reviewText:
      'Smooth transaction. Machine was already partially stripped which made loading easier than I feared.',
  },
  {
    index: 6,
    listingTitle: 'Eleiko Competition Bar',
    categorySlug: 'barbells',
    pricePence: 32000,
    purchaseType: 'home',
    reviewText:
      'Bar spins well and the knurling is still sharp. Tiny rust spot on one sleeve — came off with a quick wire brush.',
  },
  {
    index: 7,
    listingTitle: 'Watson Dumbbell Rack',
    categorySlug: 'dumbbells',
    pricePence: 48000,
    purchaseType: 'commercial',
    reviewText:
      'Rack is sturdy and all the labels were still readable. Collection from a storage unit; seller was dead helpful.',
  },
  {
    index: 8,
    listingTitle: 'Life Fitness Integrity Treadmill',
    categorySlug: 'treadmill',
    pricePence: 275000,
    purchaseType: 'commercial',
    reviewText:
      'Console fired up first go. Deck had clearly been cleaned recently — you can tell it was looked after.',
  },
  {
    index: 9,
    listingTitle: 'Precor AMT',
    categorySlug: 'crosstrainers',
    pricePence: 195000,
    purchaseType: 'commercial',
    reviewText:
      'Happy with the buy overall. Left pedal had a squeak that vanished after a spray of silicone. Otherwise brilliant.',
  },
  {
    index: 10,
    listingTitle: 'Matrix Magnum Leg Press',
    categorySlug: 'plate-loaded-machine',
    pricePence: 240000,
    purchaseType: 'commercial',
    reviewText:
      'Commercial leg press at a fair price. Seller knew their stuff and talked me through the safety catches before handover.',
  },
  {
    index: 11,
    listingTitle: 'Cybex Eagle Chest Press',
    categorySlug: 'pin-loaded-machine',
    pricePence: 165000,
    purchaseType: 'commercial',
    reviewText:
      'Pads are tired cosmetically but the movement is silky. Would happily buy from this seller again.',
  },
  {
    index: 12,
    listingTitle: 'Wattbike AtomX',
    categorySlug: 'spin-bikes',
    pricePence: 72000,
    purchaseType: 'home',
    reviewText:
      'Good comms throughout. One cradle bolt was missing but they posted it out next day without any fuss.',
  },
  {
    index: 13,
    listingTitle: 'StairMaster Gauntlet',
    categorySlug: 'stairclimbers',
    pricePence: 350000,
    purchaseType: 'commercial',
    reviewText:
      'Beast of a machine. Seller demoed it working and even had spare drive belts in the van, just in case.',
  },
  {
    index: 14,
    listingTitle: 'Life Fitness IC7 Bike',
    categorySlug: 'spin-bikes',
    pricePence: 89000,
    purchaseType: 'commercial',
    reviewText:
      'IC7 console paired with my app no bother. Collection was quick — in and out in about twenty minutes.',
  },
  {
    index: 15,
    listingTitle: 'Technogym Skillrow',
    categorySlug: 'rowers',
    pricePence: 78000,
    purchaseType: 'home',
    reviewText:
      'Rowing feels great. Seat rail had a small scratch that wasn’t obvious in the photos, but nothing that affects use.',
  },
  {
    index: 16,
    listingTitle: 'Rogue Monster Lite Rack',
    categorySlug: 'squat-rack',
    pricePence: 52000,
    purchaseType: 'home',
    reviewText:
      'All hardware accounted for and the uprights had no dents. Built it the same evening without any missing parts.',
  },
  {
    index: 17,
    listingTitle: 'Jordan Urethane Dumbbell Set',
    categorySlug: 'dumbbells',
    pricePence: 95000,
    purchaseType: 'home',
    reviewText:
      'Weights match the listing. A couple of dumbbells have scuffs on the urethane — expected at this price, to be fair.',
  },
  {
    index: 18,
    listingTitle: 'Matrix Connexus Rig',
    categorySlug: 'multi-gyms',
    pricePence: 410000,
    purchaseType: 'commercial',
    reviewText:
      'Big item but the seller had it broken down already. Labelling on the parts saved me a headache rebuilding it.',
  },
  {
    index: 19,
    listingTitle: 'Concept2 BikeErg',
    categorySlug: 'upright-bikes',
    pricePence: 68000,
    purchaseType: 'home',
    reviewText:
      'Paid on Tuesday, collected Thursday. Flywheel is quiet and resistance feels crisp. Proper chuffed.',
  },
]

export const QA_CAROUSEL_REVIEWS = QA_CAROUSEL_REVIEW_ROWS.map((row) => ({
  ...row,
  rating: FOUR_STAR_INDICES.has(row.index) ? 4 : 5,
  listingId: seedUuid('0006', '4006', '8006', row.index),
  listingSlug: qaListingSlug(row.index, row.listingTitle),
  reviewId: seedUuid('0005', '4005', '8005', row.index),
  orderId: seedUuid('0004', '4004', '8004', row.index),
  paymentId: seedUuid('0003', '4003', '8003', row.index),
  offerId: seedUuid('0002', '4002', '8002', row.index),
  buyerId: QA_CAROUSEL_REVIEW_BUYERS[row.index].id,
  createdAt: qaReviewCreatedAtForIndex(row.index),
}))

export const QA_CAROUSEL_REVIEW_IDS = {
  reviewIds: QA_CAROUSEL_REVIEWS.map((r) => r.reviewId),
  orderIds: QA_CAROUSEL_REVIEWS.map((r) => r.orderId),
  paymentIds: QA_CAROUSEL_REVIEWS.map((r) => r.paymentId),
  offerIds: QA_CAROUSEL_REVIEWS.map((r) => r.offerId),
  listingIds: QA_CAROUSEL_REVIEWS.map((r) => r.listingId),
  buyerIds: QA_CAROUSEL_REVIEW_BUYERS.map((b) => b.id),
}

/** Seed in index order — each review uses its own QA stub listing. */
export const QA_CAROUSEL_REVIEW_SEED_ORDER = QA_CAROUSEL_REVIEWS.map((row) => row.index)
