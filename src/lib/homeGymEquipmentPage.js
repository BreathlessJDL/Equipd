/**
 * Home Gym Equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by the React page and build-time prerender.
 */

import { EQUIPD_SITE_ORIGIN, getBrandPagePath, getBrandLogoMeta } from './brandCatalogueCore.js'
import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { buildBreadcrumbSchema } from './breadcrumbStructuredData.js'
import {
  buildFaqPageSchemaNode,
  normalizeFaqItems,
  renderFaqPageScriptTag,
} from './faqPageStructuredData.js'
import { EQUIPD_ORGANIZATION_ID } from './siteStructuredData.js'
import {
  BROWSE_PATH,
  BRANDS_PATH,
  BUYER_PROTECTION_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
  WEBPAGE_SCHEMA_KEY,
} from './sellGymEquipmentPage.js'
import {
  BUY_USED_GYM_EQUIPMENT_PATH,
  BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
} from './buyUsedGymEquipmentPage.js'

export const HOME_GYM_EQUIPMENT_PATH = '/home-gym-equipment'
export const HOME_BROWSE_PATH = buildBrowseNavPath({ rating: 'home_use' })

/**
 * Commercial landing path is hardcoded rather than imported: the commercial
 * module links back to this page, and importing both ways would be circular.
 */
const COMMERCIAL_GYM_EQUIPMENT_LINK_PATH = '/commercial-gym-equipment'

/** Sibling SEO landing pages in the home gym hub. */
export const HOME_CARDIO_PATH = '/home-cardio-equipment'
export const HOME_STRENGTH_PATH = '/home-strength-equipment'
export const REFURBISHED_HOME_PATH = '/refurbished-home-gym-equipment'

export {
  BROWSE_PATH,
  BRANDS_PATH,
  BUYER_PROTECTION_PATH,
  BUY_USED_GYM_EQUIPMENT_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
  WEBPAGE_SCHEMA_KEY,
}

export const HOME_GYM_EQUIPMENT_META_TITLE =
  'Home Gym Equipment for Sale & Trade-In | Equipd'

export const HOME_GYM_EQUIPMENT_PAGE_TITLE = `${HOME_GYM_EQUIPMENT_META_TITLE}`

export const HOME_GYM_EQUIPMENT_META_DESCRIPTION =
  'Buy and sell used home gym equipment across the UK. Browse home fitness equipment, check market values and purchase securely with Buyer Protection on Equipd.'

export const HOME_GYM_EQUIPMENT_H1 = 'Home Gym Equipment'
export const HOME_GYM_EQUIPMENT_EYEBROW = 'Build your home gym'
export const HOME_GYM_EQUIPMENT_LEAD =
  'Buy and sell quality used home gym equipment across the UK through Equipd — the marketplace for home fitness equipment, secure payments and Buyer Protection.'

export const HOME_HERO_TRUST_ITEMS = Object.freeze([
  'Buyer Protection',
  'Secure payments',
  'Home gym specialists',
])

export const HOME_OG_IMAGE = Object.freeze({
  ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
  alt: 'Equipd marketplace for buying and selling home gym equipment in the UK',
})

export const HOME_PRIMARY_CTA = {
  to: HOME_BROWSE_PATH,
  label: 'Browse Home Equipment',
}

export const HOME_SECONDARY_CTA = {
  to: VALUATION_PATH,
  label: 'Value Your Equipment',
}

export const HOME_CATEGORY_NOTE = 'Browse by type'
export const HOME_CATEGORY_HEADING = 'Browse home gym equipment'
export const HOME_CATEGORY_LEAD =
  'Explore used home gym machines by category — from folding treadmills and exercise bikes to multi gyms, benches and adjustable dumbbells.'

export const HOME_CATEGORIES = Object.freeze([
  {
    id: 'treadmills',
    label: 'Home Treadmills',
    description: 'Folding and compact running decks',
    to: '/home-treadmills',
  },
  {
    id: 'bikes',
    label: 'Exercise Bikes',
    description: 'Upright, spin and connected bikes',
    to: '/home-exercise-bikes',
  },
  {
    id: 'cross-trainers',
    label: 'Cross Trainers',
    description: 'Low-impact ellipticals for home use',
    to: '/home-cross-trainers',
  },
  {
    id: 'rowers',
    label: 'Rowing Machines',
    description: 'Air, magnetic and water rowers',
    to: '/home-rowing-machines',
  },
  {
    id: 'multi-gyms',
    label: 'Multi Gyms',
    description: 'All-in-one home strength stations',
    to: '/home-multi-gyms',
  },
  {
    id: 'dumbbells',
    label: 'Adjustable Dumbbells',
    description: 'Space-saving free weight sets',
    to: '/home-dumbbells',
  },
  {
    id: 'benches',
    label: 'Benches',
    description: 'Flat, incline and folding benches',
    to: '/home-weight-benches',
  },
  {
    id: 'strength',
    label: 'Power Racks',
    description: 'Half racks and cages for home barbell work',
    to: '/home-power-racks',
  },
])

export const HOME_LISTINGS_NOTE = 'Live marketplace'
export const HOME_LISTINGS_HEADING = 'Latest home equipment listings'
export const HOME_LISTINGS_LEAD =
  'Recently listed used home gym equipment from sellers across the UK.'
export const HOME_LISTINGS_CTA = 'Browse all home equipment'

export const HOME_BRAND_NOTE = 'Trusted manufacturers'
export const HOME_BRAND_HEADING = 'Shop by brand'
export const HOME_BRAND_LEAD =
  'Explore home fitness equipment from the leading home fitness brands UK buyers know and trust.'

export const HOME_FEATURED_BRAND_SLUGS = Object.freeze([
  'nordictrack',
  'proform',
  'bowflex',
  'horizon-fitness',
  'sole-fitness',
  'reebok',
  'york-fitness',
  'bh-fitness',
])

export function buildHomeFeaturedBrands(directoryBrands = []) {
  const bySlug = new Map(
    (directoryBrands || []).map((brand) => [brand.slug, brand]),
  )

  return HOME_FEATURED_BRAND_SLUGS.map((slug) => {
    const fromDirectory = bySlug.get(slug)
    const logoMeta = getBrandLogoMeta(slug)
    return {
      slug,
      displayName: fromDirectory?.displayName || logoMeta?.displayName || slug,
      href: getBrandPagePath(slug),
      logoPath: fromDirectory?.logoPath || logoMeta?.logoPath || null,
      logoAlt: fromDirectory?.logoAlt || logoMeta?.logoAlt || null,
      logoScale: fromDirectory?.logoScale ?? logoMeta?.logoScale ?? 1,
      listingCount: fromDirectory?.listingCount ?? 0,
      productCount: fromDirectory?.productCount ?? 0,
    }
  })
}

export const HOME_BENEFITS_HEADING = 'Why buy home gym equipment on Equipd?'

export const HOME_BENEFITS = Object.freeze([
  {
    id: 'buyer-protection',
    title: 'Buyer Protection',
    body: 'Eligible purchases are protected after confirmed handover, giving you time to raise an issue if the machine is significantly different from the listing.',
  },
  {
    id: 'secure-payments',
    title: 'Secure payments',
    body: 'Pay through Equipd with Stripe. Funds are held until handover is confirmed — not sent as an unprotected bank transfer to a stranger.',
  },
  {
    id: 'equipment-valuation',
    title: 'Equipment valuation',
    body: 'Use free Equipd valuations, manufacture years and market context to check whether a home gym machine is fairly priced before you offer.',
  },
  {
    id: 'trusted-sellers',
    title: 'Trusted sellers',
    body: 'Message sellers on-platform, ask for extra photos and agree collection or delivery before any money changes hands.',
  },
])

export const HOME_VALUATION_EYEBROW = 'Selling home gym kit?'
export const HOME_VALUATION_HEADING = 'Value home gym equipment first'
export const HOME_VALUATION_COPY =
  'Get a free market estimate for used home gym equipment before you list or buy. Equipd helps you understand what similar home fitness equipment may be worth in the UK market today.'

export const HOME_VALUATION_STEPS = Object.freeze([
  { label: 'Search', body: 'Find the home model' },
  { label: 'Details', body: 'Year, condition and usage' },
  { label: 'Estimate', body: 'See the market range' },
  { label: 'Decide', body: 'Buy, sell or negotiate', emphasize: true },
])

export const HOME_GUIDE_NOTE = 'Buying guide'
export const HOME_GUIDE_HEADING = 'Home gym equipment buying guide'
export const HOME_GUIDE_INTRO =
  'Building a home gym is mostly a series of trade-offs: space against capability, budget against longevity, and convenience against the temptation to buy everything at once. Used home gym equipment lets you get far more machine for your money, but only if you know what to check, how to move it and which pieces genuinely earn their footprint. This guide covers choosing home fitness equipment for your room, comparing cardio and strength, inspecting second-hand machines, arranging delivery and keeping kit running — and how Equipd helps you buy with a clearer, more protected process from first search through to confirmed handover.'

export const HOME_GUIDE_SECTIONS = Object.freeze([
  {
    id: 'why-buy',
    heading: 'Why buy used home gym equipment?',
    paragraphs: [
      'Home gym equipment depreciates quickly in its first couple of years, which is good news if you are buying rather than selling. A well-kept used treadmill, exercise bike or multi gym often costs a fraction of its original price while having plenty of usable life left.',
      'A large share of home fitness equipment is barely used. Machines bought during a burst of motivation frequently end up in spare rooms and garages with low mileage, then reach the second-hand market in genuinely good condition.',
      'Buying used also lets you move up a tier. The budget that buys an entry-level new treadmill will often buy a mid-range or premium used one from brands such as NordicTrack, ProForm, Sole Fitness or Horizon Fitness, with a stronger motor, better deck cushioning and a longer realistic lifespan.',
      'There is a practical advantage too: availability. Used home gym machines are already in the UK and ready to collect, so you avoid factory lead times and the long delivery windows that new orders sometimes carry.',
      'On Equipd you can browse home gym equipment for sale across the UK, compare models in Equipment Values, and pay securely with Buyer Protection on eligible purchases rather than handing over cash at the door.',
    ],
  },
  {
    id: 'space',
    heading: 'Choosing equipment for your space',
    paragraphs: [
      'Start with the room, not the wishlist. Measure the usable floor area, ceiling height and the width of doorways and stairs. Ceiling height matters more than people expect — treadmills raise you several inches, and overhead presses need clearance.',
      'Think in footprints rather than piece counts. A folding treadmill, an adjustable bench and a pair of adjustable dumbbells can cover far more training than three fixed machines that each occupy a permanent corner.',
      'Consider the surface underneath. Garages and lofts can flex, and hard floors transmit noise. Rubber matting protects both the floor and the machine, reduces vibration and keeps a shared house liveable when you train early or late.',
      'Check the practical details of the room: power sockets near where the machine will sit, temperature and damp (unheated garages are hard on electronics and upholstery), and whether you can leave equipment set up or must pack it away after every session.',
      'If space is genuinely tight, prioritise home gym machines that fold, stack or serve several purposes. Equipment that is awkward to store tends to be equipment that stops being used.',
    ],
  },
  {
    id: 'cardio-vs-strength',
    heading: 'Home cardio vs strength equipment',
    paragraphs: [
      'Home cardio equipment — treadmills, exercise bikes, cross trainers and rowing machines — carries the moving parts and electronics, so it needs the most inspection. Check belts, rails, pedals, resistance response and whether the console powers up and reads accurately.',
      'Home strength equipment — multi gyms, benches, racks, dumbbells and pin-loaded machines — is mechanically simpler and ages more gracefully. Cables, pulleys, upholstery and frame welds are the wear points; plates and frames rarely fail outright.',
      'Most home gyms end up mixed: one cardio machine you will actually use, plus adjustable weights and a bench. Buying one good cardio piece rather than two mediocre ones is usually the better call, since unused machines take up the same space as used ones.',
      'Free weights offer the best capability per pound and per square foot, but they need a bench and some technique. Machines guide movement and feel safer if you train alone, at the cost of footprint and adjustability.',
      'You can filter Equipd listings by category and home use rating to shortlist either side. Cardio moves faster in the second-hand market, so being ready to act quickly on a good treadmill or bike listing helps.',
    ],
  },
  {
    id: 'planning',
    heading: 'Home gym planning',
    paragraphs: [
      'Write down the training you will realistically do each week before you buy anything. A plan built around three sessions you enjoy beats a plan built around equipment you hope will motivate you.',
      'Buy in phases. Start with the one or two pieces that cover most of your sessions, train for a month, then fill the gaps you actually feel. Phasing spreads cost and stops you buying home gym machines you never touch.',
      'Budget for the extras, not just the listing price. Flooring, a mirror, decent lighting, a fan, delivery or van hire and possibly a first service all sit on top of the purchase price, and they materially affect whether the space gets used.',
      'Plan the layout on paper with real dimensions, including the clearance each machine needs around it. Manufacturers quote a footprint; usable training space is larger, especially behind treadmills and around any bar.',
      'Leave room to grow. If you expect to add a rack or a second cardio piece later, keep a wall or corner free rather than filling the room and having to rearrange everything in six months.',
    ],
  },
  {
    id: 'inspect',
    heading: 'What to inspect before buying',
    paragraphs: [
      'For cardio: power the machine on and run it. Listen for grinding or squealing, check the belt tracks centrally and does not slip, test incline and resistance through the range, and confirm the console reads speed, time and distance correctly.',
      'For strength: pull every cable through its full travel, check pulleys spin freely, look for fraying near end fittings, inspect upholstery for tears and press on the frame to check for movement at welds or bolts. Confirm selector pins, collars and adjustment pins are present.',
      'Ask for photos of the serial label, the underside or rear of the machine, and any damage. Photos of the room it currently sits in also tell you a lot — a dry spare bedroom is a better history than a damp garage.',
      'Ask direct questions before you offer: how old is it, how often was it used, has it been serviced, are there any faults or error codes, and is everything included. Vague answers on a machine that is easy to describe is itself a signal.',
      'On collection or seller delivery, inspect before confirming handover. Take a short video of the machine running as you received it — that record costs nothing and settles most disagreements.',
    ],
  },
  {
    id: 'delivery',
    heading: 'Delivery & getting it home',
    paragraphs: [
      'Equipd sellers may offer buyer collection, seller delivery or a buyer-arranged courier. Equipd does not operate a delivery fleet, so logistics are agreed directly between buyer and seller before payment.',
      'Home gym equipment is heavier and more awkward than it looks. A treadmill can exceed 100kg and a multi gym is worse. Plan for two people minimum, a suitable van or large estate, straps and a sack trolley for anything you cannot carry level.',
      'Ask whether the machine can be partly dismantled and whether the seller still has the manual or original bolts. Removing uprights, consoles or arms often turns an impossible doorway into an easy one.',
      'Measure the route end to end: doorway widths, stair turns, banister clearance and the space at the top. Measuring at the seller\'s house is pointless if the machine cannot get into your own room.',
      'Collection and seller delivery use Equipd\'s QR confirmation after inspection, while courier orders follow an evidence-based process. Pick the fulfilment method that matches your access and how much lifting you are prepared to do.',
    ],
  },
  {
    id: 'maintenance',
    heading: 'Maintenance & care',
    paragraphs: [
      'Most home gym equipment failures come from neglect rather than age. Wiping sweat off frames and consoles after sessions prevents the corrosion that quietly ruins otherwise healthy machines.',
      'Learn the few tasks your machine needs. Treadmills want belt tension and alignment checked and, on many models, deck lubrication. Bikes and cross trainers need pedal and crank bolts kept tight. Cable machines need cables inspected and pivots lightly lubricated.',
      'Keep the machine somewhere sensible. Unheated, damp garages shorten the life of electronics, bearings and upholstery faster than heavy use does. If a garage is your only option, a cover and a dehumidifier help considerably.',
      'Note the model and serial number when you buy, and check parts availability for older machines. Equipd Equipment Values pages help you confirm model identity and typical production years so you order the right belt, cable or console later.',
      'Keep receipts, service notes and the manual together. When you eventually sell, that small folder of evidence is one of the easiest ways to justify a higher price for used home gym equipment.',
    ],
  },
  {
    id: 'mistakes',
    heading: 'Common buying mistakes',
    paragraphs: [
      'Paying outside the platform. Bank transfers and cash remove Equipd checkout safeguards and Buyer Protection eligibility entirely, and there is no record if the machine is not as described.',
      'Buying more than the space allows. Machines that block a doorway or cannot be folded away get resold within a year, usually at a loss once you have paid to move them twice.',
      'Skipping the running test on cardio. A treadmill or bike that has never been switched on during your visit is an unknown quantity, however clean it looks in photos.',
      'Ignoring the move. Underestimating weight, doorways and stairs is the most common reason home gym purchases go wrong, and it turns a bargain into a hire van plus two helpers.',
      'Chasing the cheapest listing. Condition, completeness and how the machine was stored matter more than a small price gap — and a serviced, well-kept machine from a careful owner is usually the better buy.',
      'Buying on brand alone. A well-known badge does not guarantee condition. Always check age, usage and physical wear on that specific unit before you commit.',
    ],
  },
  {
    id: 'why-equipd',
    heading: 'Why buy through Equipd',
    paragraphs: [
      'Equipd is a specialist marketplace for home and commercial gym equipment — not a general classifieds board. Listings are structured around real equipment data, so you can compare models rather than guessing from a blurry photo and a one-line description.',
      'You get on-platform messaging, Stripe checkout and Buyer Protection on eligible orders. Funds are held until handover is confirmed, which removes most of the risk that makes buying second-hand fitness equipment stressful.',
      'Pair browsing with Instant Valuation and brand Equipment Values pages to buy used home gym equipment with clearer market context, and to spot when an asking price is well above or below the going rate.',
      'Selling works the same way. If you are replacing a machine or reclaiming a room, you can list home fitness equipment, reach buyers who are specifically looking for it, and take payment without chasing informal transfers.',
      'If you are new to the marketplace, start with the Buy Gym Equipment guide, then come back here when you are ready to focus on home gym machines specifically. Refurbished home gym equipment is worth asking about too — some sellers service machines before listing.',
    ],
  },
])

export const HOME_FAQ_NOTE = 'Common questions'
export const HOME_FAQ_INTRO =
  'Answers on buying and selling used home gym equipment, Buyer Protection, delivery and valuations on Equipd.'

export const HOME_FAQ_ITEMS = Object.freeze([
  {
    question: 'What counts as home gym equipment on Equipd?',
    answer:
      'Home gym equipment is kit designed for household use rather than continuous facility duty — including folding treadmills, exercise bikes, cross trainers, rowing machines, multi gyms, benches, adjustable dumbbells and home strength machines. On Equipd, filter by the home use rating to focus on home fitness equipment listings.',
  },
  {
    question: 'Is used home gym equipment worth buying?',
    answer:
      'Usually yes. Home fitness equipment depreciates fast, and a lot of it is lightly used, so a well-kept second-hand machine often costs far less than new while offering a higher specification for the same budget. The key is inspecting condition and confirming the model before you offer.',
  },
  {
    question: 'How much can I save buying used home gym equipment?',
    answer:
      'Savings vary by brand, age and condition, but buyers commonly pay noticeably less than new retail for equivalent home gym machines. Use the free Equipd valuation tool to check the typical market range for a specific model before making an offer.',
  },
  {
    question: 'What home gym equipment should I buy first?',
    answer:
      'Start with the pieces that cover most of your planned sessions — often one cardio machine plus adjustable dumbbells and a bench. Buying in phases avoids filling your space with home gym machines you rarely use, and lets you spend more on the items you do.',
  },
  {
    question: 'How much space do I need for a home gym?',
    answer:
      'A useful home gym can fit in a corner of a spare room, but check ceiling height, usable floor area and clearance around each machine — not just its footprint. Folding treadmills, adjustable dumbbells and multi-purpose benches are the most space-efficient options.',
  },
  {
    question: 'How do I browse home gym equipment only?',
    answer:
      'Open Browse and apply the home use filter, or start from this page’s category cards. You can combine brand and category filters to narrow home fitness equipment results to exactly what you want.',
  },
  {
    question: 'Is refurbished home gym equipment available?',
    answer:
      'Some sellers list refurbished or recently serviced home gym equipment. Always ask what work was done, which parts were replaced and whether any private warranty is offered. “Refurbished” is described by the seller, so verify the details in Equipd messages before you buy.',
  },
  {
    question: 'What should I check before buying a used treadmill or bike?',
    answer:
      'Run the machine before you commit. Listen for unusual noise, check the belt tracks centrally, test incline and resistance through the range, confirm the console powers up and reads correctly, and ask about age, usage and any service history.',
  },
  {
    question: 'How does Buyer Protection work for home equipment purchases?',
    answer:
      'When you pay through Equipd, funds are held until handover is confirmed. After confirmation, eligible purchases have a 24-hour Buyer Protection period to raise a significant issue with evidence for Equipd to review.',
  },
  {
    question: 'Does Equipd deliver home gym equipment?',
    answer:
      'No. Fulfilment is agreed between buyer and seller — collection, seller delivery or a buyer-arranged courier. Equipd provides the marketplace workflow, messaging and secure checkout, not a delivery fleet.',
  },
  {
    question: 'How do I move heavy home gym equipment?',
    answer:
      'Plan for at least two people, a suitable van, straps and a sack trolley. Ask whether the machine can be partly dismantled, and measure doorways, stair turns and the destination room before collection day rather than on it.',
  },
  {
    question: 'Which brands are best for home gym equipment?',
    answer:
      'Popular home fitness brands on Equipd include NordicTrack, ProForm, BowFlex, Horizon Fitness, Sole Fitness, Reebok, York Fitness and BH Fitness. The right brand depends on your budget, the space you have and parts availability for older models.',
  },
  {
    question: 'Can I sell my home gym equipment on Equipd?',
    answer:
      'Yes. You can list used home gym equipment, message buyers and complete checkout through Equipd. Value the machine first with Instant Valuation, then start from Sell Gym Equipment or create a listing from your hub.',
  },
  {
    question: 'Is Equipd the seller of the equipment?',
    answer:
      'No. Equipd is the marketplace. Listings are offered by independent sellers. Equipd provides messaging, secure checkout, handover confirmation and Buyer Protection for eligible purchases.',
  },
])

export const HOME_EXPLORE_NOTE = 'Keep exploring'
export const HOME_EXPLORE_HEADING = 'Explore more'
export const HOME_EXPLORE_LEAD =
  'Continue into related home gym and marketplace pages on Equipd.'

export const HOME_EXPLORE_LINKS = Object.freeze([
  {
    label: 'Commercial Gym Equipment',
    description: 'Facility-grade machines for clubs and studios',
    to: COMMERCIAL_GYM_EQUIPMENT_LINK_PATH,
  },
  {
    label: 'Commercial Cardio Equipment',
    description: 'Commercial treadmills, bikes and cross trainers',
    to: '/commercial-cardio-equipment',
  },
  {
    label: 'Home Cardio Equipment',
    description: 'Treadmills, bikes, cross trainers and rowers',
    to: HOME_CARDIO_PATH,
  },
  {
    label: 'Home Strength Equipment',
    description: 'Dumbbells, benches and multi gyms',
    to: HOME_STRENGTH_PATH,
  },
  {
    label: 'Refurbished Home Gym Equipment',
    description: 'Refurbished home kit with clearer expectations',
    to: REFURBISHED_HOME_PATH,
  },
  {
    label: 'Buy Gym Equipment',
    description: 'How buying on Equipd works',
    to: BUY_USED_GYM_EQUIPMENT_PATH,
  },
  {
    label: 'Sell Gym Equipment',
    description: 'List home gym equipment for sale',
    to: SELL_GYM_EQUIPMENT_PATH,
  },
  {
    label: 'Equipment Valuation',
    description: 'Free Instant Valuation tool',
    to: VALUATION_PATH,
  },
])

export const HOME_MID_CTA_HEADING = 'Ready to browse home gym equipment?'
export const HOME_MID_CTA_LEAD =
  'See live used home fitness equipment listed by sellers across the UK.'
export const HOME_MID_CTA_LABEL = 'Browse Home Equipment'

export function buildHomeGymEquipmentOpenGraph() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${HOME_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${HOME_OG_IMAGE.src}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': HOME_GYM_EQUIPMENT_PAGE_TITLE,
    'og:description': HOME_GYM_EQUIPMENT_META_DESCRIPTION,
    'og:image': imageUrl,
    'og:image:width': String(HOME_OG_IMAGE.width),
    'og:image:height': String(HOME_OG_IMAGE.height),
    'og:image:alt': HOME_OG_IMAGE.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': HOME_GYM_EQUIPMENT_PAGE_TITLE,
    'twitter:description': HOME_GYM_EQUIPMENT_META_DESCRIPTION,
    'twitter:image': imageUrl,
  }
}

export function buildHomeGymEquipmentBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', item: '/' },
      { name: 'Home Gym Equipment', item: HOME_GYM_EQUIPMENT_PATH },
    ],
    { canonicalUrl: HOME_GYM_EQUIPMENT_PATH },
  )
}

export function buildHomeGymEquipmentWebPageSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${HOME_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${HOME_OG_IMAGE.src}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: HOME_GYM_EQUIPMENT_PAGE_TITLE,
    headline: HOME_GYM_EQUIPMENT_H1,
    description: HOME_GYM_EQUIPMENT_META_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
    about: {
      '@type': 'Thing',
      name: 'Home gym equipment',
    },
    significantLink: [
      `${EQUIPD_SITE_ORIGIN}${HOME_BROWSE_PATH.split('?')[0]}`,
      `${EQUIPD_SITE_ORIGIN}${VALUATION_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BRANDS_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${SELL_GYM_EQUIPMENT_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_GYM_EQUIPMENT_LINK_PATH}`,
      `${EQUIPD_SITE_ORIGIN}/home-cardio-equipment`,
      `${EQUIPD_SITE_ORIGIN}/home-strength-equipment`,
      `${EQUIPD_SITE_ORIGIN}/refurbished-home-gym-equipment`,
    ],
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: HOME_OG_IMAGE.width,
      height: HOME_OG_IMAGE.height,
    },
    image: [imageUrl],
    publisher: { '@id': EQUIPD_ORGANIZATION_ID },
  }
}

export function buildHomeGymEquipmentCollectionSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${HOME_GYM_EQUIPMENT_PATH}`
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: HOME_GYM_EQUIPMENT_H1,
    description: HOME_GYM_EQUIPMENT_META_DESCRIPTION,
    isPartOf: { '@id': `${pageUrl}#webpage` },
    about: {
      '@type': 'Thing',
      name: 'Used home gym equipment',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: HOME_CATEGORIES.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category.label,
        url: `${EQUIPD_SITE_ORIGIN}${category.to}`,
      })),
    },
  }
}

export function buildHomeGymEquipmentFaqSchema() {
  return buildFaqPageSchemaNode([...HOME_FAQ_ITEMS], {
    canonicalUrl: HOME_GYM_EQUIPMENT_PATH,
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderFaqSectionHtml(faqs = []) {
  const { items } = normalizeFaqItems(faqs)
  if (!items.length) return ''
  return items
    .map(
      (entry) => `<details>
      <summary>${escapeHtml(entry.question)}</summary>
      <p>${escapeHtml(entry.answer)}</p>
    </details>`,
    )
    .join('\n    ')
}

function renderGuideSectionHtml() {
  const sections = HOME_GUIDE_SECTIONS.map((section) => {
    const paragraphs = section.paragraphs
      .map((text) => `<p>${escapeHtml(text)}</p>`)
      .join('\n      ')
    return `<section aria-labelledby="seo-home-guide-${escapeHtml(section.id)}">
      <h3 id="seo-home-guide-${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h3>
      ${paragraphs}
    </section>`
  }).join('\n    ')

  return `<section aria-labelledby="seo-home-guide-heading">
    <p>${escapeHtml(HOME_GUIDE_NOTE)}</p>
    <h2 id="seo-home-guide-heading">${escapeHtml(HOME_GUIDE_HEADING)}</h2>
    <p>${escapeHtml(HOME_GUIDE_INTRO)}</p>
    ${sections}
  </section>`
}

/**
 * Build SEO document for build-time prerender.
 */
export function buildHomeGymEquipmentSeoDocument() {
  const categoryLinks = HOME_CATEGORIES.map(
    (category) =>
      `<li><a href="${escapeHtml(category.to)}">${escapeHtml(category.label)}</a> — ${escapeHtml(category.description)}</li>`,
  ).join('')

  const brandLinks = HOME_FEATURED_BRAND_SLUGS.map((slug) => {
    const meta = getBrandLogoMeta(slug)
    const name = meta?.displayName || slug
    return `<li><a href="${escapeHtml(getBrandPagePath(slug))}">${escapeHtml(name)}</a></li>`
  }).join('')

  const exploreLinks = HOME_EXPLORE_LINKS.map(
    (link) =>
      `<li><a href="${escapeHtml(link.to)}">${escapeHtml(link.label)}</a> — ${escapeHtml(link.description)}</li>`,
  ).join('')

  const benefits = HOME_BENEFITS.map(
    (item) => `<li><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></li>`,
  ).join('')

  const faqHtml = renderFaqSectionHtml(HOME_FAQ_ITEMS)
  const { items: faqItems } = normalizeFaqItems([...HOME_FAQ_ITEMS])

  const bodyHtml = `
<article class="seo-prerender home-gym-equipment-seo" data-equipd-seo-prerender="home-gym-equipment">
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li>Home Gym Equipment</li>
    </ol>
  </nav>
  <header>
    <p>${escapeHtml(HOME_GYM_EQUIPMENT_EYEBROW)}</p>
    <h1>${escapeHtml(HOME_GYM_EQUIPMENT_H1)}</h1>
    <p>${escapeHtml(HOME_GYM_EQUIPMENT_LEAD)}</p>
    <p>
      <a href="${escapeHtml(HOME_BROWSE_PATH)}">${escapeHtml(HOME_PRIMARY_CTA.label)}</a>
      · <a href="${escapeHtml(VALUATION_PATH)}">${escapeHtml(HOME_SECONDARY_CTA.label)}</a>
    </p>
  </header>
  <section aria-labelledby="seo-home-listings-heading">
    <h2 id="seo-home-listings-heading">${escapeHtml(HOME_LISTINGS_HEADING)}</h2>
    <p>${escapeHtml(HOME_LISTINGS_LEAD)}</p>
    <p><a href="${escapeHtml(HOME_BROWSE_PATH)}">${escapeHtml(HOME_LISTINGS_CTA)}</a></p>
  </section>
  <section aria-labelledby="seo-home-categories-heading">
    <h2 id="seo-home-categories-heading">${escapeHtml(HOME_CATEGORY_HEADING)}</h2>
    <p>${escapeHtml(HOME_CATEGORY_LEAD)}</p>
    <ul>${categoryLinks}</ul>
  </section>
  <section aria-labelledby="seo-home-brands-heading">
    <h2 id="seo-home-brands-heading">${escapeHtml(HOME_BRAND_HEADING)}</h2>
    <p>${escapeHtml(HOME_BRAND_LEAD)}</p>
    <ul>${brandLinks}</ul>
  </section>
  <section aria-labelledby="seo-home-benefits-heading">
    <h2 id="seo-home-benefits-heading">${escapeHtml(HOME_BENEFITS_HEADING)}</h2>
    <ul>${benefits}</ul>
  </section>
  <section aria-labelledby="seo-home-valuation-heading">
    <h2 id="seo-home-valuation-heading">${escapeHtml(HOME_VALUATION_HEADING)}</h2>
    <p>${escapeHtml(HOME_VALUATION_COPY)}</p>
    <p><a href="${escapeHtml(VALUATION_PATH)}">Get a free valuation</a></p>
  </section>
  ${renderGuideSectionHtml()}
  <section aria-labelledby="seo-home-faq-heading">
    <h2 id="seo-home-faq-heading">Frequently asked questions</h2>
    <p>${escapeHtml(HOME_FAQ_INTRO)}</p>
    ${faqHtml}
  </section>
  <section aria-labelledby="seo-home-explore-heading">
    <h2 id="seo-home-explore-heading">${escapeHtml(HOME_EXPLORE_HEADING)}</h2>
    <ul>${exploreLinks}</ul>
  </section>
</article>`.trim()

  return {
    path: HOME_GYM_EQUIPMENT_PATH,
    title: HOME_GYM_EQUIPMENT_PAGE_TITLE,
    description: HOME_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: HOME_GYM_EQUIPMENT_PATH,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildHomeGymEquipmentOpenGraph(),
    jsonLd: [
      buildHomeGymEquipmentBreadcrumbSchema(),
      buildHomeGymEquipmentWebPageSchema(),
      buildHomeGymEquipmentCollectionSchema(),
      buildFaqPageSchemaNode(faqItems, {
        canonicalUrl: `${EQUIPD_SITE_ORIGIN}${HOME_GYM_EQUIPMENT_PATH}`,
      }),
    ].filter(Boolean),
    bodyHtml,
  }
}

export function renderHomeGymEquipmentFaqScriptTag() {
  return renderFaqPageScriptTag(HOME_FAQ_ITEMS, {
    canonicalUrl: HOME_GYM_EQUIPMENT_PATH,
  })
}
