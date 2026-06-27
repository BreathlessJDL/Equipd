/**
 * QA CAROUSEL SEED DATA — homepage review carousel (live-domain / staging QA only).
 *
 * Fixed UUID namespace for idempotent upserts and targeted cleanup.
 * Not a Supabase migration. Do not deploy automatically.
 */

export const QA_CAROUSEL_REVIEW_SEED_MARKER = 'f4f4f4f4'

export const QA_CAROUSEL_OFFER_MESSAGE =
  'QA CAROUSEL SEED — synthetic completed order for homepage carousel testing. Not a real transaction.'

export const QA_CAROUSEL_REVIEW_PASSWORD = 'EquipdQaCarouselSeed123!'

export const QA_CAROUSEL_DEFAULT_ADMIN_EMAIL = 'jlinnell95@gmail.com'

/** Twenty QA-only buyers with believable UK display names. */
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

/** 20 homepage QA reviews: 14× five-star, 6× four-star. */
export const QA_CAROUSEL_REVIEWS = [
  {
    index: 0,
    reviewText:
      'Exactly as described. Collection was straightforward and the seller helped load it into the van. Really pleased with the purchase.',
    preferredTitlePatterns: ['%Life Fitness Treadmill%SE Console%', '%Treadmill with SE Console%'],
    looseTitlePatterns: ['%Life Fitness%Treadmill%'],
    preferAdminSeller: true,
    purchaseType: 'commercial',
  },
  {
    index: 1,
    reviewText:
      'Great communication from start to finish. Machine was in excellent condition and everything worked perfectly.',
    preferredTitlePatterns: ['%Concept 2 rowing machine with PM5%', '%Concept%rowing%PM5%', '%Concept2%rower%PM5%'],
    looseTitlePatterns: ['%Rowing Machine%', '%rower%PM5%', '%Concept%row%'],
    preferAdminSeller: true,
    purchaseType: 'commercial',
  },
  {
    index: 2,
    reviewText:
      "Very happy overall. A couple of small cosmetic marks that weren't obvious in the photos, but nothing unexpected for used commercial equipment.",
    preferredTitlePatterns: ['%Technogym%Crossover%', '%Technogym Commercial Crossover%'],
    looseTitlePatterns: ['%Technogym%Crossover%', '%Crossover%'],
    preferAdminSeller: true,
    purchaseType: 'commercial',
  },
  {
    index: 3,
    reviewText:
      'Collected the treadmill over the weekend. Seller was friendly, had it ready to go and even showed it working before I left.',
    preferredTitlePatterns: ['%Sole F63%folding%treadmill%', '%Sole F63%'],
    looseTitlePatterns: ['%Sole%treadmill%', '%F63%'],
    preferAdminSeller: true,
    purchaseType: 'home',
  },
  {
    index: 4,
    reviewText:
      "Couldn't have asked for a smoother transaction. Equipment was spotless and exactly as listed.",
    preferredTitlePatterns: ['%Gymgear%Multi Gym%', '%GymGear%Multi%'],
    looseTitlePatterns: ['%Multi Gym%', '%multi-gym%'],
    preferAdminSeller: false,
    purchaseType: 'commercial',
  },
  {
    index: 5,
    reviewText:
      'Excellent seller. Quick responses, easy collection and the rower feels almost new.',
    preferredTitlePatterns: ['%Concept C2 Rowing machine with PM4%', '%Concept%rower%PM4%', '%Concept 2 rowing machine with PM5 monitor%'],
    looseTitlePatterns: ['%rower%', '%Rowing Machine%'],
    preferAdminSeller: true,
    purchaseType: 'home',
  },
  {
    index: 6,
    reviewText:
      'Good experience overall. Delivery was arranged quickly and the machine arrived exactly when agreed.',
    preferredTitlePatterns: ['%WaterRower%S4%', '%WaterRower%Performance Monitor%'],
    looseTitlePatterns: ['%WaterRower%', '%delivery%', '%Pallet%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 7,
    reviewText:
      'Really impressed with the quality considering the price. Would happily buy through Equipd again.',
    preferredTitlePatterns: ['%Pulse Fitness%U-Cycle%', '%U-Cycle%'],
    looseTitlePatterns: ['%Pulse Fitness%', '%Indoor Cycle%', '%spin bike%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 8,
    reviewText:
      'Everything went exactly as expected. Secure payment, simple collection and a great piece of kit.',
    preferredTitlePatterns: ['%Nautilus Nitro%Leg Press%', '%Nautilus%Leg Press%'],
    looseTitlePatterns: ['%Nautilus%', '%Leg Press%'],
    preferAdminSeller: true,
    purchaseType: 'commercial',
  },
  {
    index: 9,
    reviewText:
      'Seller answered all my questions before purchase. Very straightforward process and happy with the equipment.',
    preferredTitlePatterns: ['%Powertec%Leverage%', '%Powertec Leverage%'],
    looseTitlePatterns: ['%Powertec%', '%Leverage Gym%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 10,
    reviewText:
      'Spin bike was well packaged for collection and ran smoothly on first test. Seller was helpful and punctual.',
    preferredTitlePatterns: ['%Keiser%M3%', '%Keiser%spin%', '%spin bike%'],
    looseTitlePatterns: ['%Keiser%', '%Indoor Cycle%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 11,
    reviewText:
      'Solid squat rack — sturdy, clean and exactly what I needed for my garage gym. Collection was quick and easy.',
    preferredTitlePatterns: ['%squat rack%', '%power rack%', '%Rack%'],
    looseTitlePatterns: ['%squat%', '%rack%'],
    preferAdminSeller: true,
    purchaseType: 'home',
  },
  {
    index: 12,
    reviewText:
      'Happy with the dumbbell set. A little wear on the rubber as expected for used kit, but weights are accurate and balanced.',
    preferredTitlePatterns: ['%dumbbell%', '%Dumbbells%'],
    looseTitlePatterns: ['%dumbbell%', '%hex%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 13,
    reviewText:
      'Brilliant experience. Seller demonstrated the cable machine before handover and it has been flawless since.',
    preferredTitlePatterns: ['%cable%pulley%', '%dual cable%', '%functional trainer%'],
    looseTitlePatterns: ['%cable%', '%pulley%'],
    preferAdminSeller: false,
    purchaseType: 'commercial',
  },
  {
    index: 14,
    reviewText:
      'Plate-loaded kit arrived as described. Great value for commercial-grade equipment and very professional seller.',
    preferredTitlePatterns: ['%plate loaded%', '%Plate Loaded%', '%hammer strength%'],
    looseTitlePatterns: ['%plate loaded%', '%leg press%'],
    preferAdminSeller: true,
    purchaseType: 'commercial',
  },
  {
    index: 15,
    reviewText:
      'Overall a positive purchase. Treadmill belt and deck are in good shape; just needed a quick wipe down after collection.',
    preferredTitlePatterns: ['%treadmill%', '%Treadmill%'],
    looseTitlePatterns: ['%treadmill%', '%running machine%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 16,
    reviewText:
      'Multi-gym was already partially dismantled which made loading easier. Clear instructions from the seller throughout.',
    preferredTitlePatterns: ['%multi gym%', '%Multi Gym%', '%home gym%'],
    looseTitlePatterns: ['%multi%', '%gym station%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 17,
    reviewText:
      'Top service. Bench was in great nick and the seller even lent a hand getting it into my car. Would recommend.',
    preferredTitlePatterns: ['%bench%', '%Bench%'],
    looseTitlePatterns: ['%adjustable bench%', '%utility bench%'],
    preferAdminSeller: true,
    purchaseType: 'home',
  },
  {
    index: 18,
    reviewText:
      'Good deal on a used upright bike. Console works fine and the frame is solid — minor scuffs only.',
    preferredTitlePatterns: ['%upright bike%', '%Upright Bike%', '%Lifecycle%'],
    looseTitlePatterns: ['%upright%', '%bike%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
  {
    index: 19,
    reviewText:
      'Smooth from offer to collection. Weight plates matched the listing and the seller had everything ready at the agreed time.',
    preferredTitlePatterns: ['%weight plate%', '%Weight Plates%', '%bumper%'],
    looseTitlePatterns: ['%plates%', '%olympic%'],
    preferAdminSeller: false,
    purchaseType: 'home',
  },
].map((row) => ({
  ...row,
  rating: FOUR_STAR_INDICES.has(row.index) ? 4 : 5,
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
  buyerIds: QA_CAROUSEL_REVIEW_BUYERS.map((b) => b.id),
}

/** Claim specialised listings before broader pattern matches. */
export const QA_CAROUSEL_REVIEW_SEED_ORDER = [
  0, 5, 6, 1, 2, 3, 4, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
]
