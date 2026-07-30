/**
 * Commercial Cardio Equipment landing page — content, SEO, and structured data.
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

export const COMMERCIAL_CARDIO_EQUIPMENT_PATH = '/commercial-cardio-equipment'

/** Cardio categories — every slug must exist in LISTING_CATEGORY_OPTIONS. */
export const COMMERCIAL_CARDIO_CATEGORY_SLUGS = Object.freeze([
  'treadmill',
  'crosstrainers',
  'upright-bikes',
  'recumbent-bikes',
  'spin-bikes',
  'stairclimbers',
  'upper-body-bikes',
  'assault-bike',
  'skierg',
  'rowers',
])

export const COMMERCIAL_CARDIO_BROWSE_PATH = buildBrowseNavPath({
  rating: 'full_commercial',
  categorySlugs: COMMERCIAL_CARDIO_CATEGORY_SLUGS,
})

/**
 * Parent and sibling landing paths are hardcoded rather than imported: those
 * modules link back to this page, and importing both ways would be circular.
 */
const COMMERCIAL_GYM_EQUIPMENT_LINK_PATH = '/commercial-gym-equipment'
const HOME_GYM_EQUIPMENT_LINK_PATH = '/home-gym-equipment'
const COMMERCIAL_STRENGTH_LINK_PATH = '/commercial-strength-equipment'
const REFURBISHED_COMMERCIAL_LINK_PATH = '/refurbished-commercial-gym-equipment'

export {
  BROWSE_PATH,
  BRANDS_PATH,
  BUYER_PROTECTION_PATH,
  BUY_USED_GYM_EQUIPMENT_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
  WEBPAGE_SCHEMA_KEY,
}

export const COMMERCIAL_CARDIO_META_TITLE =
  'Commercial Cardio Equipment for Sale Across the UK | Equipd'

export const COMMERCIAL_CARDIO_PAGE_TITLE = `${COMMERCIAL_CARDIO_META_TITLE}`

export const COMMERCIAL_CARDIO_META_DESCRIPTION =
  'Browse used commercial cardio equipment from sellers across the UK, including treadmills, bikes, cross trainers and rowers. Compare equipment and buy securely through Equipd.'

export const COMMERCIAL_CARDIO_H1 = 'Commercial Cardio Equipment'
export const COMMERCIAL_CARDIO_EYEBROW = 'Commercial cardio, made affordable'
export const COMMERCIAL_CARDIO_LEAD =
  'Buy and sell quality used commercial cardio machines across the UK. Equipd brings together gyms, dealers and refurbishers in one marketplace, with free equipment valuation and Buyer Protection on eligible purchases.'

export const COMMERCIAL_CARDIO_HERO_TRUST_ITEMS = Object.freeze([
  'Buyer Protection',
  'Secure payments',
  'Commercial specialists',
])

export const COMMERCIAL_CARDIO_OG_IMAGE = Object.freeze({
  ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
  alt: 'Equipd marketplace for buying and selling commercial cardio equipment in the UK',
})

export const COMMERCIAL_CARDIO_PRIMARY_CTA = {
  to: COMMERCIAL_CARDIO_BROWSE_PATH,
  label: 'Browse Commercial Cardio',
}

export const COMMERCIAL_CARDIO_SECONDARY_CTA = {
  to: VALUATION_PATH,
  label: 'Value Your Equipment',
}

export const COMMERCIAL_CARDIO_CATEGORY_NOTE = 'Browse by type'
export const COMMERCIAL_CARDIO_CATEGORY_HEADING = 'Browse commercial cardio equipment'
export const COMMERCIAL_CARDIO_CATEGORY_LEAD =
  'Explore used commercial cardio machines by category — treadmills, bikes, cross trainers, rowers, climbers and the conditioning kit that fills a busy floor.'

export const COMMERCIAL_CARDIO_CATEGORIES = Object.freeze([
  {
    id: 'treadmills',
    label: 'Commercial Treadmills',
    description: 'Facility-grade running decks and consoles',
    to: '/used-commercial-treadmills',
  },
  {
    id: 'bikes',
    label: 'Commercial Exercise Bikes',
    description: 'Upright bikes built for continuous use',
    to: '/used-commercial-exercise-bikes',
  },
  {
    id: 'cross-trainers',
    label: 'Commercial Cross Trainers',
    description: 'Ellipticals for high member throughput',
    to: '/used-commercial-cross-trainers',
  },
  {
    id: 'rowers',
    label: 'Commercial Rowing Machines',
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
    id: 'indoor-cycles',
    label: 'Indoor Cycles',
    description: 'Studio and spin bikes for group classes',
    to: '/used-commercial-indoor-cycles',
  },
  {
    id: 'upper-body',
    label: 'Upper Body Ergometers',
    description: 'Arm ergs for rehab and accessible cardio',
    to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'upper-body-bikes' }),
  },
  {
    id: 'assault-bikes',
    label: 'Assault Bikes',
    description: 'Air bikes for conditioning and intervals',
    to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'assault-bike' }),
  },
])

export const COMMERCIAL_CARDIO_LISTINGS_NOTE = 'Live marketplace'
export const COMMERCIAL_CARDIO_LISTINGS_HEADING = 'Latest Commercial Cardio Listings'
export const COMMERCIAL_CARDIO_LISTINGS_LEAD =
  'Live commercial cardio listings on Equipd, from gyms, dealers and refurbishers across the UK.'
export const COMMERCIAL_CARDIO_LISTINGS_CTA = 'Browse all commercial cardio'

export const COMMERCIAL_CARDIO_BRAND_NOTE = 'Trusted manufacturers'
export const COMMERCIAL_CARDIO_BRAND_HEADING = 'Shop by brand'
export const COMMERCIAL_CARDIO_BRAND_LEAD =
  'Explore commercial cardio equipment from the brands gyms, studios and leisure operators rely on.'

export const COMMERCIAL_CARDIO_FEATURED_BRAND_SLUGS = Object.freeze([
  'life-fitness',
  'technogym',
  'matrix-fitness',
  'precor',
  'cybex',
  'stairmaster',
  'concept2',
  'wattbike',
])

export function buildCommercialCardioFeaturedBrands(directoryBrands = []) {
  const bySlug = new Map(
    (directoryBrands || []).map((brand) => [brand.slug, brand]),
  )

  return COMMERCIAL_CARDIO_FEATURED_BRAND_SLUGS.map((slug) => {
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

export const COMMERCIAL_CARDIO_BENEFITS_HEADING = 'Why buy commercial cardio on Equipd?'

export const COMMERCIAL_CARDIO_BENEFITS = Object.freeze([
  {
    id: 'supply',
    title: 'Kit from gyms, dealers and refurbishers',
    body: 'Equipd brings ex-facility cardio, dealer stock and refurbished machines into one place, so you can compare what is actually available in the UK instead of watching several sites at once.',
  },
  {
    id: 'value',
    title: 'Lower cost than buying new',
    body: 'Used commercial cardio usually costs well below new list price, which lets a fixed budget cover more stations or a higher specification. How much you save depends on the model, age and condition.',
  },
  {
    id: 'buyer-protection',
    title: 'Buyer Protection',
    body: 'Eligible purchases are protected after confirmed handover, giving your facility time to raise an issue if a machine is significantly different from the listing.',
  },
  {
    id: 'valuation',
    title: 'Secure payment and free valuation',
    body: 'Pay through Equipd with Stripe rather than an unprotected bank transfer, and use the free valuation tool to check an asking price against the wider market before you offer.',
  },
])

export const COMMERCIAL_CARDIO_VALUATION_EYEBROW = 'Selling commercial cardio?'
export const COMMERCIAL_CARDIO_VALUATION_HEADING = 'Value commercial cardio equipment first'
export const COMMERCIAL_CARDIO_VALUATION_COPY =
  'Get a free market estimate for used commercial treadmills, bikes, cross trainers and rowers before you list or make an offer. Equipd uses the model, year and condition to show what similar commercial cardio machines are worth in the UK market.'

export const COMMERCIAL_CARDIO_VALUATION_STEPS = Object.freeze([
  { label: 'Search', body: 'Find the cardio model' },
  { label: 'Details', body: 'Year, console and hours' },
  { label: 'Estimate', body: 'See the market range' },
  { label: 'Decide', body: 'Buy, sell or negotiate', emphasize: true },
])

export const COMMERCIAL_CARDIO_GUIDE_NOTE = 'Buying guide'
export const COMMERCIAL_CARDIO_GUIDE_HEADING = 'Commercial cardio buying guide'
export const COMMERCIAL_CARDIO_GUIDE_INTRO =
  'Cardio is the hardest-working equipment on most gym floors, and it is also where used buying gets you the most machine for your money. It is where the most can go wrong, too: a treadmill with a worn deck, a console nobody can source parts for, or a stepmill that cannot reach the first floor are all expensive lessons. This guide covers choosing the right mix of machines, judging age and usage honestly, checking consoles and wear parts, planning power and access, moving and installing kit, and using Equipd valuations to work out whether an asking price makes sense for your facility.'

export const COMMERCIAL_CARDIO_GUIDE_SECTIONS = Object.freeze([
  {
    id: 'choosing-type',
    heading: 'Choosing the right type of cardio equipment',
    paragraphs: [
      'Start with how the floor is actually used rather than what looks impressive. Treadmills draw the most traffic in most gyms and are the first thing members complain about when one is out of service, so they usually justify the largest share of a cardio budget and the highest specification you can afford.',
      'Bikes are the low-maintenance workhorses. Upright and recumbent bikes have fewer wear parts than treadmills, cost less to run, and suit older members, rehab clients and anyone who wants a quieter session. Recumbents in particular earn their space in facilities with an older membership or a physiotherapy relationship.',
      'Cross trainers sit between the two. They are popular with members who want low-impact work, they are heavier to move than bikes, and their wear points are the ramps, rollers and pivots rather than a belt and deck. Rowers, ski ergs and air bikes cover conditioning and class use, take up less permanent space, and are usually the cheapest way to add stations.',
      'Stair climbers and stepmills are the specialist buy. They are popular where they exist, but they are tall, heavy and demanding to service, so most facilities run one or two rather than a bank of them. Upper body ergometers are similarly niche but valuable if you run rehab, accessible or seated programming.',
      'A reasonable starting mix for a general gym is a block of treadmills, a slightly smaller block of bikes split between upright and recumbent, a few cross trainers and a couple of rowers, then specialist pieces once the basics are covered. Adjust from your own usage data if you have it — that will beat any generic ratio.',
    ],
  },
  {
    id: 'commercial-vs-home',
    heading: 'Commercial versus home cardio equipment',
    paragraphs: [
      'The difference is duty cycle. Commercial cardio is engineered to run for many hours a day, every day, with frames, motors, bearings and electronics specified accordingly. Home machines are built for a few hours a week, and putting one on a paying gym floor tends to end in early failure and warranty arguments.',
      'You can see the difference in the components. Commercial treadmills use larger continuous-duty motors, thicker reversible decks, heavier rollers and stronger frames. Commercial bikes and cross trainers use sealed industrial bearings and heavier flywheels. The parts cost more, but they are also designed to be replaced rather than to make the machine disposable.',
      'Serviceability is the other divide. Commercial manufacturers publish parts catalogues, keep spares available for years and support independent engineers. Home brands often do not, which means a failed console or a snapped belt can write off an otherwise fine machine.',
      'This matters for used buying because a well-used commercial machine is frequently a better purchase than a lightly used home one at the same price. The commercial unit was built for the work, and you can still get parts for it in five years.',
      'If you are equipping a home gym, garage or small private studio rather than a staffed facility, the Home Gym Equipment page covers home-rated kit — including where lighter machines make more sense on space, noise and power.',
    ],
  },
  {
    id: 'age-usage',
    heading: 'Age, hours and usage history',
    paragraphs: [
      'Hours matter far more than years. A treadmill from a quiet hotel gym can be a decade old with modest hours, while one from a busy city-centre club can be three years old and thoroughly worked. Ask for the hours or distance reading, which most commercial consoles display in a service or engineer menu.',
      'Ask where the machine has lived and how hard it worked. Hotels, corporate gyms, schools and rehab clinics are typically gentler environments than 24-hour budget chains or university sports centres. That context tells you more about remaining life than the year of manufacture alone.',
      'Model year still matters for parts and consoles. Older units may have discontinued screens, obsolete connectivity or superseded control boards, so check parts availability for the specific generation before you commit rather than assuming the brand will cover it.',
      'Be sceptical of a machine with no history at all. Serious commercial sellers can usually say where kit came from, roughly how long it ran and what has been done to it. Vague answers on an easily documented question are worth pricing in.',
      'Use age and hours as negotiating information rather than automatic disqualifiers. A high-hour machine that has been serviced on schedule is often a safer buy than a low-hour one that has sat unused in a damp store for two years.',
    ],
  },
  {
    id: 'consoles',
    heading: 'Consoles, screens and connectivity',
    paragraphs: [
      'Consoles are the most common reason a used cardio machine disappoints. Test that the display powers up, that every key and the quick-select buttons respond, that speed, incline and resistance actually change the machine, and that heart-rate contacts or receivers read something sensible.',
      'Screen type drives cost. Basic LED consoles are cheap to replace and rarely fail in interesting ways. Touchscreen entertainment consoles are far more expensive, may need software licences, and can lose streaming or TV functionality when a manufacturer retires a platform. Confirm what still works today, not what worked when the unit was new.',
      'Ask about connectivity if it matters to you. Some facilities need equipment that reports into a management or member app; others genuinely do not care. Do not pay a premium for asset-management features you will never configure, and do not assume an older console will integrate with a modern platform.',
      'Check for burn-in, dead pixels, cracked overlays and worn key membranes. These are cosmetic until they are not — a failing membrane is a repair, and a cracked overlay lets sweat into the electronics behind it.',
      'If a console is faulty, price the replacement before you buy rather than after. On some models a replacement console approaches a meaningful share of the machine\'s used value, which can turn an apparent bargain into a poor deal.',
    ],
  },
  {
    id: 'service-history',
    heading: 'Service history and parts availability',
    paragraphs: [
      'Documented servicing is the single most useful thing a commercial seller can provide. Regular preventive maintenance — belt tensioning, deck checks, drive belt inspection, bearing lubrication and electrical testing — genuinely extends machine life, and evidence of it justifies a higher price.',
      'Ask what has been replaced and when. Belts, decks, rollers, motors, control boards, pedals and bearings all have finite lives. A machine with a recently replaced deck and belt may be a better buy than a younger one still running original consumables.',
      'Check parts availability for the specific model before you commit. Major commercial brands support equipment for years, but individual generations do get discontinued. A quick call to a parts supplier or independent engineer will tell you whether spares are still stocked.',
      'Line up a service relationship early. Whether you use the manufacturer, a national service company or a local independent engineer, knowing who will maintain the machine and roughly what a call-out costs should inform what you are prepared to pay.',
      'Budget for a first service after installation, particularly on high-hour cardio. It is the cheapest way to find problems while you still have the option to raise them, and it gives you a documented baseline for the asset going forward.',
    ],
  },
  {
    id: 'wear-parts',
    heading: 'Belts, decks, bearings and drive systems',
    paragraphs: [
      'On treadmills, the belt and deck are the main consumables. Feel the belt surface for glazing, fraying or a rough patch in the walking zone, and check that it tracks centrally and does not slip when someone stands on it and pushes. Many commercial decks are reversible, so ask whether the deck has already been flipped.',
      'Listen while the machine runs. Grinding suggests bearings or rollers, a rhythmic slap often means a belt joint or a worn roller, and a squeal can indicate the drive belt. Run it at several speeds and at incline, since some faults only appear under load.',
      'On bikes and cross trainers, check the flywheel and drive. Spin the pedals and listen for bearing noise, check for lateral play in cranks and pedal arms, test resistance through its full range, and look for wear in ramps, rollers and pivot points on ellipticals.',
      'On rowers and ski ergs, inspect the chain or belt, the damper mechanism, the seat rollers and the rail. These are simple machines and most faults are cheap to fix, but a scored rail or worn rollers will annoy users every session.',
      'Corrosion is the quiet killer across all cardio. Sweat attacks fixings, frames and electronics, so look under consoles, around the base and behind covers. Surface rust on a frame is cosmetic; corrosion around electrical connections is a genuine warning sign.',
    ],
  },
  {
    id: 'power',
    heading: 'Power requirements and electrical setup',
    paragraphs: [
      'Treadmills are the equipment most likely to cause an electrical problem. Commercial units draw meaningful current under load, and a bank of them on one shared circuit will trip breakers as soon as the floor gets busy. Confirm the power draw for each model and check what your circuits can actually support.',
      'Some commercial cardio is self-powered. Many bikes, rowers, cross trainers, air bikes and ski ergs generate their own console power from user effort, which removes the socket entirely and makes them far easier to place. That flexibility is worth weighing when you plan the layout.',
      'Check the supply type carefully on imported or older machines. Most UK commercial cardio runs on a standard single-phase supply, but some equipment expects a different voltage or a dedicated circuit, and an adapter is not a substitute for the correct installation.',
      'Plan socket positions before delivery, not after. Trailing extension leads across a gym floor are a trip hazard and usually a compliance problem, and retro-fitting sockets once the machines are in place is disruptive and more expensive.',
      'Have an electrician confirm the load if you are adding several machines at once. It is a small cost against the alternative of a floor that trips out during peak hours, and it gives you a documented position if you are leasing the space.',
    ],
  },
  {
    id: 'space-access',
    heading: 'Dimensions, floor space and site access',
    paragraphs: [
      'Get the exact dimensions of the specific model rather than a family average, and remember that the manufacturer footprint is not the usable footprint. Treadmills need clear run-off behind them, cross trainers need swing clearance, and members need room to get on and off without colliding.',
      'Measure the whole route in before you buy: doorway widths, corridor turns, stair angles, lift dimensions and weight limits, and any thresholds or ramps. The tightest point on the route decides whether the machine arrives, and it is rarely the front door.',
      'Ask what can be removed for transit. Consoles, uprights, handrails and side rails often come off, and a machine that will not fit assembled frequently will once it is partly stripped. Check that the seller has the fixings and, ideally, the manual.',
      'Consider floor loading and surface, particularly above ground level. A row of commercial treadmills is a serious point load, and mezzanine or upper-floor installations sometimes need a structural opinion. Suitable matting protects the floor, reduces vibration and cuts noise transfer.',
      'Plan ceiling height too. Stepmills and stair climbers raise the user well above floor level, and a machine that fits the floor plan perfectly can still be unusable in a room with a low ceiling or exposed services overhead.',
    ],
  },
  {
    id: 'transport',
    heading: 'Transport, delivery and installation',
    paragraphs: [
      'Equipd sellers may offer buyer collection, seller delivery or a buyer-arranged courier. Equipd does not run a delivery fleet, so logistics are agreed directly between buyer and seller before payment — settle who is moving what, and when, before you commit.',
      'Use specialist movers for anything heavy. Commercial treadmills and stepmills are awkward, top-heavy and easy to damage, and gym equipment movers bring the right trolleys, straps and experience. The cost is usually modest against the value of the kit and the risk of a damaged frame or a hurt back.',
      'Agree who disconnects, dismantles and palletises at the seller\'s end, and who reassembles at yours. Half-finished handovers are a common source of disputes, and a machine that arrives in pieces without its fixings is a problem for both sides.',
      'Book installation to match delivery. Have the space cleared, matting down, sockets live and someone available to check machines in and run them before the movers leave. Finding a fault while the vehicle is still outside is much easier than a week later.',
      'For collection and seller delivery, use Equipd\'s QR confirmation after you have inspected. Courier orders follow an evidence-based process instead, because you are not present when the equipment is loaded — choose the fulfilment route that fits your access and how much lifting you can handle.',
    ],
  },
  {
    id: 'refurbished-vs-used',
    heading: 'Refurbished versus as-seen used cardio',
    paragraphs: [
      'Refurbished usually means a technician has been through the machine: consumables replaced, mechanical faults fixed, the unit cleaned and tested, and often new upholstery or shrouds. As-seen means you are buying it as it stands, working or otherwise.',
      'Ask exactly what a refurbishment included, because the word is not regulated. A list of replaced parts and a test report is meaningful; "fully refurbished" on its own is marketing. Get the detail in Equipd messages so the description sits with the listing.',
      'Refurbished kit costs more and should. You are paying for parts, labour and reduced risk, which is usually the right trade for a hotel, a small studio or any site without in-house maintenance where downtime is disproportionately painful.',
      'As-seen suits buyers with technical capability. If you have an engineer on call or on staff, buying a machine that needs a belt and a bearing can be significantly cheaper overall — provided you have priced the work honestly rather than optimistically.',
      'Whichever route you take, confirm whether any warranty is offered directly by the seller. Private warranties are agreements between you and that seller, so get the terms in writing before you pay.',
    ],
  },
  {
    id: 'inspect',
    heading: 'Inspect before you pay',
    paragraphs: [
      'Inspect in person wherever the value justifies the trip. Photographs will not tell you about a bearing rumble, a slipping belt or a console that resets under load, and those are exactly the faults that cost money after the sale.',
      'Run every machine properly. Take treadmills through their speed and incline range with someone on the belt, cycle bikes and cross trainers through full resistance, pull rowers hard enough to load the damper, and let each unit run for a few minutes rather than a token ten seconds.',
      'Work through a consistent checklist: power-on and console function, emergency stop and safety key, belt tracking and tension, unusual noise or vibration, resistance and incline response, frame condition and corrosion, upholstery, missing bolts or covers, and the serial label. Photograph each machine as you find it.',
      'If you cannot attend, ask for a video of the machine running rather than more still photos, with the console visible and the serial number in shot. A seller who is confident in the equipment will not object.',
      'Only confirm handover once you are satisfied. Confirmation is what starts the post-handover Buyer Protection window on eligible purchases, so inspect first and confirm second — never the other way round because someone is in a hurry.',
    ],
  },
  {
    id: 'valuation',
    heading: 'Using valuation to price a deal',
    paragraphs: [
      'Before you offer, run the model through Equipd\'s free valuation tool. It gives you a market range based on the model, year and condition, which is a far better reference point than the original list price of a machine that has since done thousands of hours.',
      'Compare the asking price against that range and against similar live listings. Commercial cardio prices vary widely with condition, hours and how quickly the seller needs the floor cleared, so a single listing tells you much less than a handful.',
      'Adjust for what you have found. A worn deck, a failing console or a missing safety key are all costs you will carry, and quantifying them turns a vague sense that something is overpriced into a specific, defensible offer.',
      'Include the full landed cost in your comparison: transport, installation, first service and any parts. A cheaper machine two hundred miles away with a console fault can easily end up costing more than the local unit that is ready to run.',
      'Valuation helps on the way out as well. If you are clearing a floor, valuing equipment before listing sets a realistic asking price, and listing on Equipd puts it in front of buyers who are specifically looking for commercial cardio rather than passing classifieds traffic.',
    ],
  },
])

export const COMMERCIAL_CARDIO_FAQ_NOTE = 'Common questions'
export const COMMERCIAL_CARDIO_FAQ_INTRO =
  'Answers on buying used commercial cardio equipment, condition checks, delivery, valuations and Buyer Protection on Equipd.'

export const COMMERCIAL_CARDIO_FAQ_ITEMS = Object.freeze([
  {
    question: 'What counts as commercial cardio equipment?',
    answer:
      'Commercial cardio equipment is cardio machinery built for continuous facility use rather than occasional home use — treadmills, upright and recumbent bikes, indoor cycles, cross trainers, rowing machines, stair climbers, ski ergs, air bikes and upper body ergometers. On Equipd, filter by the full commercial rating to focus on facility-grade cardio listings.',
  },
  {
    question: 'How much does used commercial cardio equipment cost?',
    answer:
      'Prices vary widely by brand, model, age, hours and condition, and a refurbished machine costs more than the same unit sold as seen. Rather than working from a generic figure, use the free Equipd valuation tool on the specific model and compare it against similar live listings before you make an offer.',
  },
  {
    question: 'Can I use commercial cardio equipment in a home gym?',
    answer:
      'Yes, if you have the space, access and power for it. Commercial machines are heavier and larger than home equipment, treadmills in particular can draw significant current, and getting one upstairs or into a garage is often the hardest part. Check dimensions, weight and the route in before you buy.',
  },
  {
    question: 'How do I check the condition of a used treadmill?',
    answer:
      'Run it with someone on the belt through its full speed and incline range. Check that the belt tracks centrally and does not slip, listen for grinding or rhythmic noise from rollers and bearings, feel the belt for glazing or wear in the walking zone, ask whether the deck has been flipped, and confirm the console, keys and emergency stop all work.',
  },
  {
    question: 'What should I ask about hours and service history?',
    answer:
      'Ask for the hours or distance reading from the console service menu, where the machine has been used, and what has been replaced and when. Belts, decks, rollers, bearings and control boards all have finite lives, so a documented service record and recent consumable replacement can matter more than the year of manufacture.',
  },
  {
    question: 'Do commercial cardio machines need special power supply?',
    answer:
      'Treadmills draw the most and can trip shared circuits when several run at once, so confirm each model\'s power requirement and have an electrician check your circuits if you are adding a bank of them. Many bikes, rowers, cross trainers and air bikes are self-powered and need no socket at all.',
  },
  {
    question: 'Is refurbished commercial cardio worth the extra cost?',
    answer:
      'It usually is for sites without in-house maintenance, because you are paying for replaced consumables, fixed faults and a tested machine. If you have an engineer available, as-seen equipment can be cheaper overall. Either way, ask exactly which parts were replaced rather than relying on the word "refurbished".',
  },
  {
    question: 'How do I get commercial cardio equipment delivered?',
    answer:
      'Fulfilment is agreed between buyer and seller — buyer collection, seller delivery or a buyer-arranged courier. Equipd provides the marketplace workflow rather than a delivery fleet. For heavy machines such as treadmills and stepmills, specialist gym equipment movers are usually worth the cost.',
  },
  {
    question: 'What size and clearance do commercial cardio machines need?',
    answer:
      'Get the exact dimensions for the specific model and add clearance on top of the footprint — run-off space behind treadmills, swing room around cross trainers and headroom above stair climbers. Also measure doorways, corridor turns, stairs and lifts, since the tightest point on the route decides whether the machine can be delivered.',
  },
  {
    question: 'Which brands make the best commercial cardio equipment?',
    answer:
      'Commercial cardio brands listed on Equipd include Life Fitness, Technogym, Matrix, Precor, Cybex, StairMaster, Concept2 and Wattbike. The right choice depends on your programming, budget and, importantly, which brands your local service engineers support and can get parts for.',
  },
  {
    question: 'How does Buyer Protection work on commercial cardio purchases?',
    answer:
      'When you pay through Equipd, funds are held until handover is confirmed. After confirmation, eligible purchases have a 24-hour Buyer Protection period in which you can raise a significant issue with supporting evidence for Equipd to review. Inspect the equipment before confirming handover.',
  },
  {
    question: 'Can gyms sell their old cardio equipment on Equipd?',
    answer:
      'Yes. Gyms, dealers and refurbishers can list used commercial cardio, message buyers and take payment through Equipd. Value the equipment first with the free valuation tool to set a realistic asking price, then list from Sell Gym Equipment or your seller hub.',
  },
])

export const COMMERCIAL_CARDIO_EXPLORE_NOTE = 'Keep exploring'
export const COMMERCIAL_CARDIO_EXPLORE_HEADING = 'Explore more'
export const COMMERCIAL_CARDIO_EXPLORE_LEAD =
  'Continue into related commercial, cardio and marketplace pages on Equipd.'

export const COMMERCIAL_CARDIO_EXPLORE_LINKS = Object.freeze([
  {
    label: 'Commercial Gym Equipment',
    description: 'All facility-grade kit for clubs and studios',
    to: COMMERCIAL_GYM_EQUIPMENT_LINK_PATH,
  },
  {
    label: 'Home Gym Equipment',
    description: 'Home-rated treadmills, bikes and strength kit',
    to: HOME_GYM_EQUIPMENT_LINK_PATH,
  },
  {
    label: 'Commercial Strength Equipment',
    description: 'Pin-loaded, plate-loaded and cable strength',
    to: COMMERCIAL_STRENGTH_LINK_PATH,
  },
  {
    label: 'Refurbished Commercial Gym Equipment',
    description: 'Dealer and refurbished commercial stock',
    to: REFURBISHED_COMMERCIAL_LINK_PATH,
  },
  {
    label: 'Buy Used Gym Equipment',
    description: 'How buying on Equipd works',
    to: BUY_USED_GYM_EQUIPMENT_PATH,
  },
  {
    label: 'Sell Gym Equipment',
    description: 'List surplus cardio machines for sale',
    to: SELL_GYM_EQUIPMENT_PATH,
  },
  {
    label: 'Equipment Valuation',
    description: 'Free Instant Valuation tool',
    to: VALUATION_PATH,
  },
  {
    label: 'Commercial Treadmills',
    description: 'Used facility-grade running decks',
    to: '/used-commercial-treadmills',
  },
  {
    label: 'Commercial Indoor Cycles',
    description: 'Studio and spin bikes for group classes',
    to: '/used-commercial-indoor-cycles',
  },
  {
    label: 'Life Fitness',
    description: 'Equipment Values and model guides',
    to: getBrandPagePath('life-fitness'),
  },
])

export const COMMERCIAL_CARDIO_MID_CTA_HEADING = 'Ready to browse commercial cardio equipment?'
export const COMMERCIAL_CARDIO_MID_CTA_LEAD =
  'See live used commercial cardio machines listed by gyms, dealers and refurbishers across the UK.'
export const COMMERCIAL_CARDIO_MID_CTA_LABEL = 'Browse Commercial Cardio'

export function buildCommercialCardioEquipmentOpenGraph() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_OG_IMAGE.src}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': COMMERCIAL_CARDIO_PAGE_TITLE,
    'og:description': COMMERCIAL_CARDIO_META_DESCRIPTION,
    'og:image': imageUrl,
    'og:image:width': String(COMMERCIAL_CARDIO_OG_IMAGE.width),
    'og:image:height': String(COMMERCIAL_CARDIO_OG_IMAGE.height),
    'og:image:alt': COMMERCIAL_CARDIO_OG_IMAGE.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': COMMERCIAL_CARDIO_PAGE_TITLE,
    'twitter:description': COMMERCIAL_CARDIO_META_DESCRIPTION,
    'twitter:image': imageUrl,
  }
}

export function buildCommercialCardioEquipmentBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', item: '/' },
      { name: 'Commercial Gym Equipment', item: COMMERCIAL_GYM_EQUIPMENT_LINK_PATH },
      { name: 'Commercial Cardio Equipment', item: COMMERCIAL_CARDIO_EQUIPMENT_PATH },
    ],
    { canonicalUrl: COMMERCIAL_CARDIO_EQUIPMENT_PATH },
  )
}

export function buildCommercialCardioEquipmentWebPageSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_OG_IMAGE.src}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: COMMERCIAL_CARDIO_PAGE_TITLE,
    headline: COMMERCIAL_CARDIO_H1,
    description: COMMERCIAL_CARDIO_META_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
    about: {
      '@type': 'Thing',
      name: 'Commercial cardio equipment',
    },
    significantLink: [
      `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_GYM_EQUIPMENT_LINK_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${HOME_GYM_EQUIPMENT_LINK_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_STRENGTH_LINK_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${REFURBISHED_COMMERCIAL_LINK_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_BROWSE_PATH.split('?')[0]}`,
      `${EQUIPD_SITE_ORIGIN}${VALUATION_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BRANDS_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${SELL_GYM_EQUIPMENT_PATH}`,
    ],
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: COMMERCIAL_CARDIO_OG_IMAGE.width,
      height: COMMERCIAL_CARDIO_OG_IMAGE.height,
    },
    image: [imageUrl],
    publisher: { '@id': EQUIPD_ORGANIZATION_ID },
  }
}

export function buildCommercialCardioEquipmentCollectionSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_EQUIPMENT_PATH}`
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: COMMERCIAL_CARDIO_H1,
    description: COMMERCIAL_CARDIO_META_DESCRIPTION,
    isPartOf: { '@id': `${pageUrl}#webpage` },
    about: {
      '@type': 'Thing',
      name: 'Used commercial cardio equipment',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: COMMERCIAL_CARDIO_CATEGORIES.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category.label,
        url: `${EQUIPD_SITE_ORIGIN}${category.to}`,
      })),
    },
  }
}

export function buildCommercialCardioEquipmentFaqSchema() {
  return buildFaqPageSchemaNode([...COMMERCIAL_CARDIO_FAQ_ITEMS], {
    canonicalUrl: COMMERCIAL_CARDIO_EQUIPMENT_PATH,
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
  const sections = COMMERCIAL_CARDIO_GUIDE_SECTIONS.map((section) => {
    const paragraphs = section.paragraphs
      .map((text) => `<p>${escapeHtml(text)}</p>`)
      .join('\n      ')
    return `<section aria-labelledby="seo-commercial-cardio-guide-${escapeHtml(section.id)}">
      <h3 id="seo-commercial-cardio-guide-${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h3>
      ${paragraphs}
    </section>`
  }).join('\n    ')

  return `<section aria-labelledby="seo-commercial-cardio-guide-heading">
    <p>${escapeHtml(COMMERCIAL_CARDIO_GUIDE_NOTE)}</p>
    <h2 id="seo-commercial-cardio-guide-heading">${escapeHtml(COMMERCIAL_CARDIO_GUIDE_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_CARDIO_GUIDE_INTRO)}</p>
    ${sections}
  </section>`
}

/**
 * Build SEO document for build-time prerender.
 */
export function buildCommercialCardioEquipmentSeoDocument() {
  const categoryLinks = COMMERCIAL_CARDIO_CATEGORIES.map(
    (category) =>
      `<li><a href="${escapeHtml(category.to)}">${escapeHtml(category.label)}</a> — ${escapeHtml(category.description)}</li>`,
  ).join('')

  const brandLinks = COMMERCIAL_CARDIO_FEATURED_BRAND_SLUGS.map((slug) => {
    const meta = getBrandLogoMeta(slug)
    const name = meta?.displayName || slug
    return `<li><a href="${escapeHtml(getBrandPagePath(slug))}">${escapeHtml(name)}</a></li>`
  }).join('')

  const exploreLinks = COMMERCIAL_CARDIO_EXPLORE_LINKS.map(
    (link) =>
      `<li><a href="${escapeHtml(link.to)}">${escapeHtml(link.label)}</a> — ${escapeHtml(link.description)}</li>`,
  ).join('')

  const benefits = COMMERCIAL_CARDIO_BENEFITS.map(
    (item) => `<li><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></li>`,
  ).join('')

  const faqHtml = renderFaqSectionHtml(COMMERCIAL_CARDIO_FAQ_ITEMS)
  const { items: faqItems } = normalizeFaqItems([...COMMERCIAL_CARDIO_FAQ_ITEMS])

  const bodyHtml = `
<article class="seo-prerender commercial-cardio-equipment-seo" data-equipd-seo-prerender="commercial-cardio-equipment">
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="${escapeHtml(COMMERCIAL_GYM_EQUIPMENT_LINK_PATH)}">Commercial Gym Equipment</a></li>
      <li>Commercial Cardio Equipment</li>
    </ol>
  </nav>
  <header>
    <p>${escapeHtml(COMMERCIAL_CARDIO_EYEBROW)}</p>
    <h1>${escapeHtml(COMMERCIAL_CARDIO_H1)}</h1>
    <p>${escapeHtml(COMMERCIAL_CARDIO_LEAD)}</p>
    <p>
      <a href="${escapeHtml(COMMERCIAL_CARDIO_BROWSE_PATH)}">${escapeHtml(COMMERCIAL_CARDIO_PRIMARY_CTA.label)}</a>
      · <a href="${escapeHtml(VALUATION_PATH)}">${escapeHtml(COMMERCIAL_CARDIO_SECONDARY_CTA.label)}</a>
    </p>
  </header>
  <section aria-labelledby="seo-commercial-cardio-listings-heading">
    <h2 id="seo-commercial-cardio-listings-heading">${escapeHtml(COMMERCIAL_CARDIO_LISTINGS_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_CARDIO_LISTINGS_LEAD)}</p>
    <p><a href="${escapeHtml(COMMERCIAL_CARDIO_BROWSE_PATH)}">${escapeHtml(COMMERCIAL_CARDIO_LISTINGS_CTA)}</a></p>
  </section>
  <section aria-labelledby="seo-commercial-cardio-categories-heading">
    <h2 id="seo-commercial-cardio-categories-heading">${escapeHtml(COMMERCIAL_CARDIO_CATEGORY_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_CARDIO_CATEGORY_LEAD)}</p>
    <ul>${categoryLinks}</ul>
  </section>
  <section aria-labelledby="seo-commercial-cardio-brands-heading">
    <h2 id="seo-commercial-cardio-brands-heading">${escapeHtml(COMMERCIAL_CARDIO_BRAND_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_CARDIO_BRAND_LEAD)}</p>
    <ul>${brandLinks}</ul>
  </section>
  <section aria-labelledby="seo-commercial-cardio-benefits-heading">
    <h2 id="seo-commercial-cardio-benefits-heading">${escapeHtml(COMMERCIAL_CARDIO_BENEFITS_HEADING)}</h2>
    <ul>${benefits}</ul>
  </section>
  <section aria-labelledby="seo-commercial-cardio-valuation-heading">
    <h2 id="seo-commercial-cardio-valuation-heading">${escapeHtml(COMMERCIAL_CARDIO_VALUATION_HEADING)}</h2>
    <p>${escapeHtml(COMMERCIAL_CARDIO_VALUATION_COPY)}</p>
    <p><a href="${escapeHtml(VALUATION_PATH)}">Get a free valuation</a></p>
  </section>
  ${renderGuideSectionHtml()}
  <section aria-labelledby="seo-commercial-cardio-faq-heading">
    <h2 id="seo-commercial-cardio-faq-heading">Frequently asked questions</h2>
    <p>${escapeHtml(COMMERCIAL_CARDIO_FAQ_INTRO)}</p>
    ${faqHtml}
  </section>
  <section aria-labelledby="seo-commercial-cardio-explore-heading">
    <h2 id="seo-commercial-cardio-explore-heading">${escapeHtml(COMMERCIAL_CARDIO_EXPLORE_HEADING)}</h2>
    <ul>${exploreLinks}</ul>
  </section>
</article>`.trim()

  return {
    path: COMMERCIAL_CARDIO_EQUIPMENT_PATH,
    title: COMMERCIAL_CARDIO_PAGE_TITLE,
    description: COMMERCIAL_CARDIO_META_DESCRIPTION,
    canonicalPath: COMMERCIAL_CARDIO_EQUIPMENT_PATH,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildCommercialCardioEquipmentOpenGraph(),
    jsonLd: [
      buildCommercialCardioEquipmentBreadcrumbSchema(),
      buildCommercialCardioEquipmentWebPageSchema(),
      buildCommercialCardioEquipmentCollectionSchema(),
      buildFaqPageSchemaNode(faqItems, {
        canonicalUrl: `${EQUIPD_SITE_ORIGIN}${COMMERCIAL_CARDIO_EQUIPMENT_PATH}`,
      }),
    ].filter(Boolean),
    bodyHtml,
  }
}

export function renderCommercialCardioEquipmentFaqScriptTag() {
  return renderFaqPageScriptTag(COMMERCIAL_CARDIO_FAQ_ITEMS, {
    canonicalUrl: COMMERCIAL_CARDIO_EQUIPMENT_PATH,
  })
}
