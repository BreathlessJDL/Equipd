/**
 * Commercial Gym Equipment landing page — content, SEO, and structured data.
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

export const COMMERCIAL_GYM_EQUIPMENT_PATH = '/commercial-gym-equipment'
export const COMMERCIAL_BROWSE_PATH = buildBrowseNavPath({ rating: 'full_commercial' })

/** Sibling SEO landing pages in the commercial hub. */
export const COMMERCIAL_CARDIO_PATH = '/commercial-cardio-equipment'
export const COMMERCIAL_STRENGTH_PATH = '/commercial-strength-equipment'
export const REFURBISHED_COMMERCIAL_PATH = '/refurbished-commercial-gym-equipment'

export {
  BROWSE_PATH,
  BRANDS_PATH,
  BUYER_PROTECTION_PATH,
  BUY_USED_GYM_EQUIPMENT_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
  WEBPAGE_SCHEMA_KEY,
}

export const COMMERCIAL_GYM_EQUIPMENT_META_TITLE =
  'Commercial Gym Equipment for Sale & Trade-In | Equipd'

export const COMMERCIAL_GYM_EQUIPMENT_PAGE_TITLE =
  `${COMMERCIAL_GYM_EQUIPMENT_META_TITLE}`

export const COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION =
  'Buy and sell used commercial gym equipment across the UK. Browse commercial fitness machines, check market values and purchase securely with Buyer Protection on Equipd.'

export const COMMERCIAL_GYM_EQUIPMENT_H1 = 'Commercial Gym Equipment'
export const COMMERCIAL_GYM_EQUIPMENT_EYEBROW = 'Built for facilities'
export const COMMERCIAL_GYM_EQUIPMENT_LEAD =
  'Buy and sell professional commercial gym equipment through Equipd — the UK marketplace for commercial fitness machines, secure payments and Buyer Protection.'

export const COMMERCIAL_HERO_TRUST_ITEMS = Object.freeze([
  'Buyer Protection',
  'Secure payments',
  'Commercial specialists',
])

export const COMMERCIAL_OG_IMAGE = Object.freeze({
  ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
  alt: 'Equipd marketplace for buying and selling commercial gym equipment in the UK',
})

export const COMMERCIAL_PRIMARY_CTA = {
  to: COMMERCIAL_BROWSE_PATH,
  label: 'Browse Commercial Equipment',
}

export const COMMERCIAL_SECONDARY_CTA = {
  to: VALUATION_PATH,
  label: 'Value Your Equipment',
}

export const COMMERCIAL_CATEGORY_NOTE = 'Browse by type'
export const COMMERCIAL_CATEGORY_HEADING = 'Browse commercial equipment'
export const COMMERCIAL_CATEGORY_LEAD =
  'Explore used commercial gym machines by category — from commercial treadmills and bikes to functional trainers and strength equipment.'

export const COMMERCIAL_CATEGORIES = Object.freeze([
  {
    id: 'treadmills',
    label: 'Commercial Treadmills',
    description: 'Facility-grade running decks and consoles',
    to: '/used-commercial-treadmills',
  },
  {
    id: 'bikes',
    label: 'Commercial Exercise Bikes',
    description: 'Upright, recumbent and studio bikes',
    to: '/used-commercial-exercise-bikes',
  },
  {
    id: 'cross-trainers',
    label: 'Commercial Cross Trainers',
    description: 'Ellipticals built for high throughput',
    to: '/used-commercial-cross-trainers',
  },
  {
    id: 'rowers',
    label: 'Commercial Rowers',
    description: 'Air, magnetic and water rowers',
    to: '/used-commercial-rowing-machines',
  },
  {
    id: 'stair',
    label: 'Stair Climbers',
    description: 'Stepmills and climbing cardio',
    to: '/used-commercial-stair-climbers',
  },
  {
    id: 'functional',
    label: 'Functional Trainers',
    description: 'Cable stations and functional frames',
    to: '/used-functional-trainers',
  },
  {
    id: 'strength',
    label: 'Leg Press Machines',
    description: 'Plate-loaded and selectorised leg press',
    to: '/used-leg-press-machines',
  },
  {
    id: 'cables',
    label: 'Cable Machines',
    description: 'Dual cable pulleys and multi-stations',
    to: '/used-cable-machines',
  },
])

export const COMMERCIAL_LISTINGS_NOTE = 'Live marketplace'
export const COMMERCIAL_LISTINGS_HEADING = 'Latest commercial listings'
export const COMMERCIAL_LISTINGS_LEAD =
  'Recently listed used commercial gym equipment from sellers across the UK.'
export const COMMERCIAL_LISTINGS_CTA = 'Browse all commercial equipment'

export const COMMERCIAL_BRAND_NOTE = 'Trusted manufacturers'
export const COMMERCIAL_BRAND_HEADING = 'Shop by brand'
export const COMMERCIAL_BRAND_LEAD =
  'Explore commercial fitness equipment from the brands gyms and studios rely on.'

export const COMMERCIAL_FEATURED_BRAND_SLUGS = Object.freeze([
  'technogym',
  'life-fitness',
  'matrix-fitness',
  'precor',
  'concept2',
  'stairmaster',
  'cybex',
  'hammer-strength',
])

export function buildCommercialFeaturedBrands(directoryBrands = []) {
  const bySlug = new Map(
    (directoryBrands || []).map((brand) => [brand.slug, brand]),
  )

  return COMMERCIAL_FEATURED_BRAND_SLUGS.map((slug) => {
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

export const COMMERCIAL_BENEFITS_HEADING = 'Why buy commercial gym equipment on Equipd?'

export const COMMERCIAL_BENEFITS = Object.freeze([
  {
    id: 'buyer-protection',
    title: 'Buyer Protection',
    body: 'Eligible purchases are protected after confirmed handover, giving your facility time to raise an issue if something is significantly wrong.',
  },
  {
    id: 'secure-payments',
    title: 'Secure payments',
    body: 'Pay through Equipd with Stripe. Funds are held until handover is confirmed — not sent as an unprotected bank transfer.',
  },
  {
    id: 'equipment-intelligence',
    title: 'Equipment Intelligence',
    body: 'Use Equipd valuation guides, manufacture years and market context to compare commercial gym machines before you offer.',
  },
  {
    id: 'verified-sellers',
    title: 'Verified sellers',
    body: 'Message independent sellers on-platform, review listing details and agree collection or delivery before you pay.',
  },
])

export const COMMERCIAL_VALUATION_EYEBROW = 'Selling commercial kit?'
export const COMMERCIAL_VALUATION_HEADING = 'Value commercial gym equipment first'
export const COMMERCIAL_VALUATION_COPY =
  'Get a free market estimate for used commercial gym machines before you list or buy. Equipd helps you understand what similar commercial fitness equipment may be worth in the UK market.'

export const COMMERCIAL_VALUATION_STEPS = Object.freeze([
  { label: 'Search', body: 'Find the commercial model' },
  { label: 'Details', body: 'Year, console and condition' },
  { label: 'Estimate', body: 'See the market range' },
  { label: 'Decide', body: 'Buy, sell or negotiate', emphasize: true },
])

export const COMMERCIAL_GUIDE_NOTE = 'Buying guide'
export const COMMERCIAL_GUIDE_HEADING = 'Commercial gym equipment buying guide'
export const COMMERCIAL_GUIDE_INTRO =
  'Buying used commercial gym equipment is different from shopping for home gym kit. Facility-grade machines are built for long duty cycles, but age, service history, access and installation still decide whether a deal is right for your club, studio or workplace gym. This guide walks through how to choose, inspect, move and maintain commercial fitness equipment — and how Equipd helps you buy with a clearer, more protected process from first search through to confirmed handover.'

export const COMMERCIAL_GUIDE_SECTIONS = Object.freeze([
  {
    id: 'why-buy',
    heading: 'Why buy commercial gym equipment?',
    paragraphs: [
      'Commercial gym equipment is designed for higher usage than most home machines. Buying used commercial fitness equipment can reduce capital cost while still delivering the durability clubs expect from brands such as Technogym, Life Fitness, Matrix and Precor.',
      'Many facilities refresh floors every few years. That creates a steady supply of used commercial gym machines with remaining life — treadmills, bikes, cross trainers, rowers, stair climbers and strength stations that can be redeployed elsewhere.',
      'For independent gyms, boutique studios, hotels and workplace wellness rooms, second-hand commercial kit is often the practical way to open or expand without paying full new list prices. The key is matching the machine to your duty cycle, not chasing the lowest headline number.',
      'Used commercial gym equipment can also shorten lead times. Instead of waiting on factory orders, you can secure machines that are already in the UK and ready to move once inspection and payment are complete.',
      'On Equipd you can browse commercial gym equipment for sale across the UK, compare models in Equipment Values, and pay securely with Buyer Protection on eligible purchases.',
    ],
  },
  {
    id: 'choosing',
    heading: 'Choosing the right equipment',
    paragraphs: [
      'Start with the job the machine needs to do. A busy commercial floor needs different throughput, footprint and console features from a small boutique studio or corporate wellness room.',
      'Confirm the exact brand, model and manufacture year. Small naming differences matter for parts, consoles and resale value. Use Equipd product guides and the free valuation tool to understand typical market ranges before you offer.',
      'Measure doorways, corridors, lifts and plant-room routes before you commit. Commercial treadmills and plate-loaded frames are heavy and awkward — access planning saves cancelled collections.',
      'Also decide your must-haves early: heart-rate compatibility, entertainment consoles, accessible designs, power requirements and whether staff can service the unit locally. A clear brief stops you overpaying for features you will never use.',
      'Set a budget range that includes moving, installation and first service — not only the listing price. Commercial purchases often fail late when logistics costs were never modelled.',
    ],
  },
  {
    id: 'cardio-vs-strength',
    heading: 'Commercial cardio vs strength equipment',
    paragraphs: [
      'Commercial cardio equipment — treadmills, bikes, ellipticals, rowers and climbers — usually needs more electrical checks, belt or rail inspection and console verification. Hours of use and service records are especially useful here.',
      'Commercial strength equipment — pin-loaded machines, plate-loaded stations, racks, cable machines and functional trainers — often ages more gracefully if cables, pulleys, upholstery and weight stacks are sound.',
      'Many buyers mix both: high-demand cardio for member traffic, plus a curated strength bay. Filter Equipd listings by category and full commercial rating to shortlist the right commercial gym machines.',
      'If you are replacing a full circuit, buy for consistency where you can — matching brands or series can simplify staff training, spare parts and the look of the floor.',
      'Cardio tends to turn over faster in the secondary market. Strength frames can hold value longer when the mechanicals are intact. That difference should shape how aggressively you negotiate.',
    ],
  },
  {
    id: 'refurbished-vs-used',
    heading: 'Refurbished vs used equipment',
    paragraphs: [
      'Used commercial gym equipment varies widely. Some listings are well maintained ex-club machines; others need servicing before they are floor-ready. Ask for photos of wear points, error codes and any recent work.',
      'Refurbished commercial gym equipment typically implies parts replacement, cosmetic refresh or technician sign-off. Confirm what “refurbished” means for that seller — which parts were replaced, and whether any private warranty is offered outside Equipd.',
      'A fair price should reflect condition honestly. A cheaper “as seen” treadmill may still be the right buy if you have an in-house technician. A higher-priced refurbished unit may suit a hotel or studio that needs plug-and-play reliability.',
      'Ask for invoices or service notes where possible. Documentation does not replace inspection, but it helps you judge whether the asking price matches the work already completed.',
      'Whether you buy refurbished or used, keep negotiation and paperwork in Equipd messages so the conversation stays with the listing.',
    ],
  },
  {
    id: 'inspect',
    heading: 'What to inspect before buying',
    paragraphs: [
      'For cardio: listen for unusual noise, check emergency stops, incline/resistance response, belt tracking and console boot behaviour. Ask about operating hours where available.',
      'For strength: inspect cables, pulleys, guide rods, upholstery tears, frame welds and missing selector pins. Test the full weight stack or plate path if you can inspect on collection.',
      'Always review listing photos carefully and request extras for serial labels, power sockets and any damage. On collection or seller delivery, inspect before confirming handover.',
      'Bring a simple checklist: power-on test, safety stops, unusual vibration, missing bolts, cracked plastics and evidence of water or corrosion around bases. Photograph the machine as received so you have a clear record.',
      'If a seller cannot provide basic evidence of condition, treat that as a risk signal. Serious commercial sellers usually expect detailed questions and can answer them.',
    ],
  },
  {
    id: 'delivery',
    heading: 'Delivery & installation',
    paragraphs: [
      'Equipd sellers may offer buyer collection, seller delivery or a buyer-arranged courier. Equipd does not operate a nationwide delivery fleet — logistics stay between buyer and seller.',
      'Budget for specialist movers on large commercial machines. Confirm floor loading, power supply (including dedicated circuits), and whether the seller can disconnect and palletise equipment.',
      'Collection and seller delivery use Equipd’s QR confirmation after inspection. Courier flows use evidence and delivery confirmation instead. Choose the fulfilment method that matches your site access.',
      'Plan installation slots with your electrician or facilities team before the machine arrives. Waiting for power works or doorway alterations after purchase is one of the most common delays for commercial kit.',
      'For multi-site operators, standardise how machines are collected and booked in. A repeatable process reduces downtime when you buy commercial gym equipment regularly.',
    ],
  },
  {
    id: 'maintenance',
    heading: 'Maintenance & servicing',
    paragraphs: [
      'Commercial fitness equipment lasts longer with scheduled servicing. Ask sellers for maintenance history, and plan onboarding with your usual technician after purchase.',
      'Keep consumables in mind: treadmill belts and decks, bike pedals and seats, cable assemblies and console batteries. Factor parts availability for older model years.',
      'Equipd Equipment Values pages can help you verify model identity and typical production years so you order the right parts later.',
      'Build a simple asset log for each machine — serial number, purchase date, service dates and known issues. That record protects resale value when you refresh the floor again.',
      'Preventive maintenance is usually cheaper than emergency call-outs. Schedule the first service soon after installation, especially on high-hour cardio.',
    ],
  },
  {
    id: 'mistakes',
    heading: 'Common buying mistakes',
    paragraphs: [
      'Paying outside the platform. Unprotected bank transfers remove Equipd checkout safeguards and Buyer Protection eligibility.',
      'Skipping model verification. Similar-looking commercial gym machines can have very different consoles, drive systems and parts costs.',
      'Ignoring access and power. A “good deal” that cannot fit through your entrance, or needs a different power feed, quickly becomes expensive.',
      'Rushing handover confirmation. Inspect carefully before you confirm — confirmation starts the post-handover protection window.',
      'Buying on brand reputation alone. A premium badge does not guarantee condition. Always validate hours, service history and physical wear for that specific unit.',
      'Assuming every listing is facility-ready. Some commercial machines need servicing, parts or cleaning before members should use them. Price that work into your decision.',
    ],
  },
  {
    id: 'why-equipd',
    heading: 'Why buy through Equipd',
    paragraphs: [
      'Equipd is a specialist marketplace for commercial and home gym equipment — not a general classifieds board. You get structured listings, on-platform messaging, Stripe checkout and Buyer Protection on eligible orders.',
      'Pair browsing with Instant Valuation and brand Equipment Values pages to buy used commercial gym equipment with clearer market context.',
      'Whether you are equipping a new studio floor or replacing a single commercial treadmill, Equipd helps you buy commercial gym equipment with a clearer process from search to handover.',
      'Sellers benefit too: facilities can list surplus commercial machines, reach serious buyers and complete payment without chasing informal transfers. That keeps both sides in one accountable workflow.',
      'If you are new to the marketplace, start with the Buy Gym Equipment guide, then return here when you are ready to focus on commercial gym machines specifically.',
    ],
  },
  {
    id: 'budgeting',
    heading: 'Budgeting for commercial purchases',
    paragraphs: [
      'A realistic commercial budget includes the purchase price, specialist moving, installation, first service and a contingency for consumables. Missing those extras is how “savings versus new” disappear.',
      'Compare asking prices against Equipd valuations and recent similar listings, not only against original RRP. Market value for used commercial gym equipment depends on condition and demand as much as age.',
      'If you are equipping multiple stations, phase purchases. Securing core cardio first, then strength, often keeps a floor usable while you continue buying commercial fitness equipment.',
      'Finally, leave room to walk away. The best commercial buy is the one that fits your space, usage and maintenance plan — not the listing that merely looks cheapest on the day.',
      'When in doubt, value the machine first, message the seller with a short inspection list, and only then make an offer. That sequence keeps commercial buying decisions calm, comparable and easier to justify to owners or finance teams.',
    ],
  },
])

export const COMMERCIAL_FAQ_NOTE = 'Common questions'
export const COMMERCIAL_FAQ_INTRO =
  'Answers on buying and selling used commercial gym equipment, Buyer Protection, delivery and valuations on Equipd.'

export const COMMERCIAL_FAQ_ITEMS = Object.freeze([
  {
    question: 'What counts as commercial gym equipment on Equipd?',
    answer:
      'Commercial gym equipment is facility-grade kit built for higher usage than typical home machines — including commercial treadmills, bikes, cross trainers, rowers, climbers, cable machines and strength stations. On Equipd, filter by full commercial rating to focus on commercial fitness equipment listings.',
  },
  {
    question: 'Can I buy used commercial gym equipment for a home gym?',
    answer:
      'Yes, if you have the space, power and access. Commercial machines are heavier and larger, so check dimensions and installation needs carefully before you offer. If you are shopping for home-rated kit instead, see the Home Gym Equipment page.',
  },
  {
    question: 'How do I browse commercial gym machines only?',
    answer:
      'Open Browse and apply the full commercial usage filter, or start from this page’s category cards. You can combine brand and category filters to narrow commercial fitness equipment results.',
  },
  {
    question: 'Is refurbished commercial gym equipment available?',
    answer:
      'Some sellers list refurbished or recently serviced machines. Always ask what work was completed, which parts were replaced, and request clear photos. “Refurbished” is described by the seller — verify details in Equipd messages.',
  },
  {
    question: 'How does Buyer Protection work for commercial purchases?',
    answer:
      'When you pay through Equipd, funds are held until handover is confirmed. After confirmation, eligible purchases have a 24-hour Buyer Protection period to raise a significant issue with evidence for Equipd to review.',
  },
  {
    question: 'Can I inspect commercial equipment before confirming handover?',
    answer:
      'For collection and seller delivery, inspect and test before confirming with Equipd’s QR flow. Confirm only when you are satisfied. Courier orders follow an evidence-based process because you are not present at collection.',
  },
  {
    question: 'Does Equipd deliver commercial gym equipment?',
    answer:
      'No. Fulfilment is agreed between buyer and seller — collection, seller delivery or a buyer-arranged courier. Equipd provides the marketplace workflow, not a national delivery fleet.',
  },
  {
    question: 'How should I value commercial gym equipment before buying or selling?',
    answer:
      'Use Equipd’s free Instant Valuation tool and Equipment Values product pages. Estimates are market guidance based on similar equipment — not a guaranteed price.',
  },
  {
    question: 'Which brands are best for commercial gym equipment?',
    answer:
      'Popular commercial brands on Equipd include Technogym, Life Fitness, Matrix, Precor, Concept2, StairMaster, Cybex and Hammer Strength. The right brand depends on your programming, parts access and budget.',
  },
  {
    question: 'Can gyms and studios sell commercial equipment on Equipd?',
    answer:
      'Yes. Facilities can list used commercial gym equipment, message buyers and complete checkout through Equipd. Start from Sell Gym Equipment or create a listing from your hub.',
  },
  {
    question: 'What should I ask the seller before offering?',
    answer:
      'Ask about age, usage hours where known, service history, faults, missing parts, power requirements and collection access. Request extra photos of serial labels and wear points, and keep the chat in Equipd.',
  },
  {
    question: 'Are prices negotiable on commercial listings?',
    answer:
      'Often yes. You can message the seller and make an offer. The seller may accept, decline or counter. Agree the price in Equipd before you pay.',
  },
  {
    question: 'Is Equipd the seller of the equipment?',
    answer:
      'No. Equipd is the marketplace. Listings are offered by independent sellers. Equipd provides messaging, secure checkout, handover confirmation and Buyer Protection for eligible purchases.',
  },
  {
    question: 'Can I buy commercial cardio and strength equipment in one place?',
    answer:
      'Yes. Equipd lists commercial cardio and strength categories side by side. Use category filters or the browse cards on this page to jump into treadmills, bikes, rowers, cable machines and more.',
  },
])

export const COMMERCIAL_EXPLORE_NOTE = 'Keep exploring'
export const COMMERCIAL_EXPLORE_HEADING = 'Explore more'
export const COMMERCIAL_EXPLORE_LEAD =
  'Continue into related commercial and marketplace pages on Equipd.'

export const COMMERCIAL_EXPLORE_LINKS = Object.freeze([
  {
    label: 'Home Gym Equipment',
    description: 'Folding treadmills, bikes, dumbbells and more',
    to: '/home-gym-equipment',
  },
  {
    label: 'Commercial Cardio Equipment',
    description: 'Treadmills, bikes, cross trainers and rowers',
    to: COMMERCIAL_CARDIO_PATH,
  },
  {
    label: 'Commercial Strength Equipment',
    description: 'Pin-loaded, plate-loaded and cable strength',
    to: COMMERCIAL_STRENGTH_PATH,
  },
  {
    label: 'Refurbished Commercial Gym Equipment',
    description: 'Professionally refurbished commercial kit',
    to: REFURBISHED_COMMERCIAL_PATH,
  },
  {
    label: 'Buy Gym Equipment',
    description: 'How buying on Equipd works',
    to: BUY_USED_GYM_EQUIPMENT_PATH,
  },
  {
    label: 'Sell Gym Equipment',
    description: 'List commercial machines for sale',
    to: SELL_GYM_EQUIPMENT_PATH,
  },
  {
    label: 'Equipment Valuation',
    description: 'Free Instant Valuation tool',
    to: VALUATION_PATH,
  },
  {
    label: 'Commercial Brands',
    description: 'Equipment Values by brand',
    to: BRANDS_PATH,
  },
])

export const COMMERCIAL_MID_CTA_HEADING = 'Ready to browse commercial gym equipment?'
export const COMMERCIAL_MID_CTA_LEAD =
  'See live used commercial fitness equipment listed by sellers across the UK.'
export const COMMERCIAL_MID_CTA_LABEL = 'Browse Commercial Equipment'

export function buildCommercialGymEquipmentOpenGraph() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_OG_IMAGE.src}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': COMMERCIAL_GYM_EQUIPMENT_PAGE_TITLE,
    'og:description': COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
    'og:image': imageUrl,
    'og:image:width': String(COMMERCIAL_OG_IMAGE.width),
    'og:image:height': String(COMMERCIAL_OG_IMAGE.height),
    'og:image:alt': COMMERCIAL_OG_IMAGE.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': COMMERCIAL_GYM_EQUIPMENT_PAGE_TITLE,
    'twitter:description': COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
    'twitter:image': imageUrl,
  }
}

export function buildCommercialGymEquipmentBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', item: '/' },
      { name: 'Commercial Gym Equipment', item: COMMERCIAL_GYM_EQUIPMENT_PATH },
    ],
    { canonicalUrl: COMMERCIAL_GYM_EQUIPMENT_PATH },
  )
}

export function buildCommercialGymEquipmentWebPageSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_OG_IMAGE.src}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: COMMERCIAL_GYM_EQUIPMENT_PAGE_TITLE,
    headline: COMMERCIAL_GYM_EQUIPMENT_H1,
    description: COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
    about: {
      '@type': 'Thing',
      name: 'Commercial gym equipment',
    },
    significantLink: [
      `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_BROWSE_PATH.split('?')[0]}`,
      `${EQUIPD_SITE_ORIGIN}${VALUATION_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BRANDS_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${SELL_GYM_EQUIPMENT_PATH}`,
      `${EQUIPD_SITE_ORIGIN}/home-gym-equipment`,
      `${EQUIPD_SITE_ORIGIN}/commercial-cardio-equipment`,
      `${EQUIPD_SITE_ORIGIN}/commercial-strength-equipment`,
      `${EQUIPD_SITE_ORIGIN}/refurbished-commercial-gym-equipment`,
    ],
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: COMMERCIAL_OG_IMAGE.width,
      height: COMMERCIAL_OG_IMAGE.height,
    },
    image: [imageUrl],
    publisher: { '@id': EQUIPD_ORGANIZATION_ID },
  }
}

export function buildCommercialGymEquipmentCollectionSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_GYM_EQUIPMENT_PATH}`
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: COMMERCIAL_GYM_EQUIPMENT_H1,
    description: COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
    isPartOf: { '@id': `${pageUrl}#webpage` },
    about: {
      '@type': 'Thing',
      name: 'Used commercial gym equipment',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: COMMERCIAL_CATEGORIES.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category.label,
        url: `${EQUIPD_SITE_ORIGIN}${category.to}`,
      })),
    },
  }
}

export function buildCommercialGymEquipmentFaqSchema() {
  return buildFaqPageSchemaNode([...COMMERCIAL_FAQ_ITEMS], {
    canonicalUrl: COMMERCIAL_GYM_EQUIPMENT_PATH,
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
  const sections = COMMERCIAL_GUIDE_SECTIONS.map((section) => {
    const paragraphs = section.paragraphs
      .map((text) => `<p>${escapeHtml(text)}</p>`)
      .join('\n      ')
    return `<section aria-labelledby="seo-commercial-guide-${escapeHtml(section.id)}">
      <h3 id="seo-commercial-guide-${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h3>
      ${paragraphs}
    </section>`
  }).join('\n    ')

  return `<section aria-labelledby="seo-commercial-guide-heading">
    <p>${escapeHtml(COMMERCIAL_GUIDE_NOTE)}</p>
    <h2 id="seo-commercial-guide-heading">${escapeHtml(COMMERCIAL_GUIDE_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_GUIDE_INTRO)}</p>
    ${sections}
  </section>`
}

/**
 * Build SEO document for build-time prerender.
 */
export function buildCommercialGymEquipmentSeoDocument() {
  const categoryLinks = COMMERCIAL_CATEGORIES.map(
    (category) =>
      `<li><a href="${escapeHtml(category.to)}">${escapeHtml(category.label)}</a> — ${escapeHtml(category.description)}</li>`,
  ).join('')

  const brandLinks = COMMERCIAL_FEATURED_BRAND_SLUGS.map((slug) => {
    const meta = getBrandLogoMeta(slug)
    const name = meta?.displayName || slug
    return `<li><a href="${escapeHtml(getBrandPagePath(slug))}">${escapeHtml(name)}</a></li>`
  }).join('')

  const exploreLinks = COMMERCIAL_EXPLORE_LINKS.map(
    (link) =>
      `<li><a href="${escapeHtml(link.to)}">${escapeHtml(link.label)}</a> — ${escapeHtml(link.description)}</li>`,
  ).join('')

  const benefits = COMMERCIAL_BENEFITS.map(
    (item) => `<li><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></li>`,
  ).join('')

  const faqHtml = renderFaqSectionHtml(COMMERCIAL_FAQ_ITEMS)
  const { items: faqItems } = normalizeFaqItems([...COMMERCIAL_FAQ_ITEMS])

  const bodyHtml = `
<article class="seo-prerender commercial-gym-equipment-seo" data-equipd-seo-prerender="commercial-gym-equipment">
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li>Commercial Gym Equipment</li>
    </ol>
  </nav>
  <header>
    <p>${escapeHtml(COMMERCIAL_GYM_EQUIPMENT_EYEBROW)}</p>
    <h1>${escapeHtml(COMMERCIAL_GYM_EQUIPMENT_H1)}</h1>
    <p>${escapeHtml(COMMERCIAL_GYM_EQUIPMENT_LEAD)}</p>
    <p>
      <a href="${escapeHtml(COMMERCIAL_BROWSE_PATH)}">${escapeHtml(COMMERCIAL_PRIMARY_CTA.label)}</a>
      · <a href="${escapeHtml(VALUATION_PATH)}">${escapeHtml(COMMERCIAL_SECONDARY_CTA.label)}</a>
    </p>
  </header>
  <section aria-labelledby="seo-commercial-listings-heading">
    <h2 id="seo-commercial-listings-heading">${escapeHtml(COMMERCIAL_LISTINGS_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_LISTINGS_LEAD)}</p>
    <p><a href="${escapeHtml(COMMERCIAL_BROWSE_PATH)}">${escapeHtml(COMMERCIAL_LISTINGS_CTA)}</a></p>
  </section>
  <section aria-labelledby="seo-commercial-categories-heading">
    <h2 id="seo-commercial-categories-heading">${escapeHtml(COMMERCIAL_CATEGORY_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_CATEGORY_LEAD)}</p>
    <ul>${categoryLinks}</ul>
  </section>
  <section aria-labelledby="seo-commercial-brands-heading">
    <h2 id="seo-commercial-brands-heading">${escapeHtml(COMMERCIAL_BRAND_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_BRAND_LEAD)}</p>
    <ul>${brandLinks}</ul>
  </section>
  <section aria-labelledby="seo-commercial-benefits-heading">
    <h2 id="seo-commercial-benefits-heading">${escapeHtml(COMMERCIAL_BENEFITS_HEADING)}</h2>
    <ul>${benefits}</ul>
  </section>
  <section aria-labelledby="seo-commercial-valuation-heading">
    <h2 id="seo-commercial-valuation-heading">${escapeHtml(COMMERCIAL_VALUATION_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_VALUATION_COPY)}</p>
    <p><a href="${escapeHtml(VALUATION_PATH)}">Get a free valuation</a></p>
  </section>
  ${renderGuideSectionHtml()}
  <section aria-labelledby="seo-commercial-faq-heading">
    <h2 id="seo-commercial-faq-heading">Frequently asked questions</h2>
    <p>${escapeHtml(COMMERCIAL_FAQ_INTRO)}</p>
    ${faqHtml}
  </section>
  <section aria-labelledby="seo-commercial-explore-heading">
    <h2 id="seo-commercial-explore-heading">${escapeHtml(COMMERCIAL_EXPLORE_HEADING)}</h2>
    <ul>${exploreLinks}</ul>
  </section>
</article>`.trim()

  return {
    path: COMMERCIAL_GYM_EQUIPMENT_PATH,
    title: COMMERCIAL_GYM_EQUIPMENT_PAGE_TITLE,
    description: COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: COMMERCIAL_GYM_EQUIPMENT_PATH,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildCommercialGymEquipmentOpenGraph(),
    jsonLd: [
      buildCommercialGymEquipmentBreadcrumbSchema(),
      buildCommercialGymEquipmentWebPageSchema(),
      buildCommercialGymEquipmentCollectionSchema(),
      buildFaqPageSchemaNode(faqItems, {
        canonicalUrl: `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_GYM_EQUIPMENT_PATH}`,
      }),
    ].filter(Boolean),
    bodyHtml,
  }
}

export function renderCommercialGymEquipmentFaqScriptTag() {
  return renderFaqPageScriptTag(COMMERCIAL_FAQ_ITEMS, {
    canonicalUrl: COMMERCIAL_GYM_EQUIPMENT_PATH,
  })
}
