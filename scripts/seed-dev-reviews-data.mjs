/**
 * DEV SEED DATA — homepage review carousel samples.
 *
 * Not for production. Used only by scripts/seed-dev-reviews.mjs.
 */

import { DEV_SEED_PREFIX } from './seed-dev-data.mjs'

/** Fixed UUID namespace for idempotent upserts and cleanup. */
export const DEV_HOMEPAGE_REVIEW_SEED_MARKER = 'c0c0c0c0'

export const DEV_HOMEPAGE_REVIEW_PASSWORD = 'EquipdDevSeed123!'

/** Ten dev-only buyers with believable UK display names. */
export const DEV_HOMEPAGE_REVIEW_BUYERS = [
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000001`,
    email: 'dev-homepage-review-01@equipd.dev',
    displayName: 'Hannah Mitchell',
    location: 'Leeds, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000002`,
    email: 'dev-homepage-review-02@equipd.dev',
    displayName: 'Oliver Bennett',
    location: 'Manchester, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000003`,
    email: 'dev-homepage-review-03@equipd.dev',
    displayName: 'Sophie Turner',
    location: 'Bristol, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000004`,
    email: 'dev-homepage-review-04@equipd.dev',
    displayName: 'James Fletcher',
    location: 'Sheffield, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000005`,
    email: 'dev-homepage-review-05@equipd.dev',
    displayName: 'Emily Richardson',
    location: 'Birmingham, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000006`,
    email: 'dev-homepage-review-06@equipd.dev',
    displayName: 'Daniel Hughes',
    location: 'Cardiff, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000007`,
    email: 'dev-homepage-review-07@equipd.dev',
    displayName: 'Charlotte Webb',
    location: 'Edinburgh, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000008`,
    email: 'dev-homepage-review-08@equipd.dev',
    displayName: 'Matthew Clarke',
    location: 'Nottingham, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-000000000009`,
    email: 'dev-homepage-review-09@equipd.dev',
    displayName: 'Rebecca Shaw',
    location: 'Newcastle upon Tyne, UK',
  },
  {
    id: `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-0001-4001-8001-00000000000a`,
    email: 'dev-homepage-review-10@equipd.dev',
    displayName: 'Liam Parker',
    location: 'Glasgow, UK',
  },
]

function seedUuid(second, third, fourth, index) {
  const suffix = (index + 1).toString(16).padStart(12, '0')
  return `${DEV_HOMEPAGE_REVIEW_SEED_MARKER}-${second}-${third}-${fourth}-${suffix}`
}

/**
 * Spread across the last ~4 months (deterministic so re-runs match).
 * index 0–9 → days ago with varied hours.
 */
export function reviewCreatedAtForIndex(index) {
  const daysAgo = [11, 24, 38, 52, 67, 79, 91, 103, 112, 118][index]
  const hours = [14, 9, 18, 11, 16, 8, 19, 13, 10, 17][index]
  const minutes = [23, 41, 7, 55, 32, 18, 49, 3, 28, 44][index]
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

/**
 * 10 homepage sample reviews: 7× five-star, 3× four-star.
 * preferredTitlePatterns tried in order against imported listings;
 * fallbackDevSlug uses dev-seed listings when imports are absent.
 */
export const DEV_HOMEPAGE_REVIEWS = [
  {
    index: 0,
    rating: 5,
    reviewText:
      'Exactly as described. Collection was straightforward and the seller helped load it into the van. Really pleased with the purchase.',
    preferredTitlePatterns: ['%Life Fitness Treadmill%SE Console%', '%Treadmill with SE Console%'],
    looseTitlePatterns: ['%Life Fitness%Treadmill%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}precor-trm-885-treadmill-sheffield`,
    purchaseType: 'commercial',
  },
  {
    index: 1,
    rating: 5,
    reviewText:
      'Great communication from start to finish. Machine was in excellent condition and everything worked perfectly.',
    preferredTitlePatterns: [
      '%Concept 2 rowing machine with PM5%',
      '%Concept%rowing%PM5%',
      '%Concept2%rower%PM5%',
      '%Concept%2%row%',
    ],
    looseTitlePatterns: ['%Rowing Machine%', '%rower%PM5%', '%Concept%row%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}concept2-bikeerg-bristol`,
    purchaseType: 'commercial',
  },
  {
    index: 2,
    rating: 4,
    reviewText:
      "Very happy overall. A couple of small cosmetic marks that weren't obvious in the photos, but nothing unexpected for used commercial equipment.",
    preferredTitlePatterns: ['%Technogym%Crossover%', '%Technogym Commercial Crossover%'],
    looseTitlePatterns: ['%Technogym%Crossover%', '%Crossover%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}technogym-crosstrainer-sheffield`,
    purchaseType: 'commercial',
  },
  {
    index: 3,
    rating: 5,
    reviewText:
      'Collected the treadmill over the weekend. Seller was friendly, had it ready to go and even showed it working before I left.',
    preferredTitlePatterns: ['%Sole F63%folding%treadmill%', '%Sole F63%'],
    looseTitlePatterns: ['%Sole%treadmill%', '%F63%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}life-fitness-t5-treadmill-leeds`,
    purchaseType: 'home',
  },
  {
    index: 4,
    rating: 5,
    reviewText:
      "Couldn't have asked for a smoother transaction. Equipment was spotless and exactly as listed.",
    preferredTitlePatterns: ['%Gymgear%Multi Gym%', '%GymGear%Multi%'],
    looseTitlePatterns: ['%Multi Gym%', '%multi-gym%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}force-usa-multi-gym-london`,
    purchaseType: 'commercial',
  },
  {
    index: 5,
    rating: 5,
    reviewText:
      'Excellent seller. Quick responses, easy collection and the rower feels almost new.',
    preferredTitlePatterns: [
      '%Concept C2 Rowing machine with PM4%',
      '%Concept%rower%PM4%',
      '%Concept 2 rowing machine with PM5 monitor%',
      '%Concept%2%row%',
    ],
    looseTitlePatterns: ['%rower%', '%Rowing Machine%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}assault-airbike-birmingham`,
    purchaseType: 'home',
  },
  {
    index: 6,
    rating: 4,
    reviewText:
      'Good experience overall. Delivery was arranged quickly and the machine arrived exactly when agreed.',
    preferredTitlePatterns: ['%WaterRower%S4%', '%WaterRower%Performance Monitor%'],
    looseTitlePatterns: ['%WaterRower%', '%delivery%', '%Pallet%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}matrix-treadmill-birmingham`,
    purchaseType: 'home',
  },
  {
    index: 7,
    rating: 5,
    reviewText:
      'Really impressed with the quality considering the price. Would happily buy through Equipd again.',
    preferredTitlePatterns: ['%Pulse Fitness%U-Cycle%', '%U-Cycle%'],
    looseTitlePatterns: ['%Pulse Fitness%', '%Indoor Cycle%', '%spin bike%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}keiser-m3i-leeds`,
    purchaseType: 'home',
  },
  {
    index: 8,
    rating: 5,
    reviewText:
      'Everything went exactly as expected. Secure payment, simple collection and a great piece of kit.',
    preferredTitlePatterns: ['%Nautilus Nitro%Leg Press%', '%Nautilus%Leg Press%'],
    looseTitlePatterns: ['%Nautilus%', '%Leg Press%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}hammer-strength-leg-press-birmingham`,
    purchaseType: 'commercial',
  },
  {
    index: 9,
    rating: 4,
    reviewText:
      'Seller answered all my questions before purchase. Very straightforward process and happy with the equipment.',
    preferredTitlePatterns: ['%Powertec%Leverage%', '%Powertec Leverage%'],
    looseTitlePatterns: ['%Powertec%', '%Leverage Gym%'],
    fallbackDevSlug: `${DEV_SEED_PREFIX}marcy-multi-gym-sheffield`,
    purchaseType: 'home',
  },
].map((row) => ({
  ...row,
  reviewId: seedUuid('0005', '4005', '8005', row.index),
  orderId: seedUuid('0004', '4004', '8004', row.index),
  paymentId: seedUuid('0003', '4003', '8003', row.index),
  offerId: seedUuid('0002', '4002', '8002', row.index),
  buyerId: DEV_HOMEPAGE_REVIEW_BUYERS[row.index].id,
  createdAt: reviewCreatedAtForIndex(row.index),
}))

export const DEV_HOMEPAGE_REVIEW_IDS = {
  reviewIds: DEV_HOMEPAGE_REVIEWS.map((r) => r.reviewId),
  orderIds: DEV_HOMEPAGE_REVIEWS.map((r) => r.orderId),
  paymentIds: DEV_HOMEPAGE_REVIEWS.map((r) => r.paymentId),
  offerIds: DEV_HOMEPAGE_REVIEWS.map((r) => r.offerId),
  buyerIds: DEV_HOMEPAGE_REVIEW_BUYERS.map((b) => b.id),
}

/** Claim specialised listings (rower, WaterRower) before broader pattern matches. */
export const DEV_HOMEPAGE_REVIEW_SEED_ORDER = [0, 5, 6, 1, 2, 3, 4, 7, 8, 9]
