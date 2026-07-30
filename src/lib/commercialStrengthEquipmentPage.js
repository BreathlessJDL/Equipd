/**
 * Commercial Strength Equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by CategoryLandingPage and build-time prerender.
 */

import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { SELL_GYM_EQUIPMENT_PATH, VALUATION_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { BUY_USED_GYM_EQUIPMENT_PATH, BUY_USED_GYM_EQUIPMENT_OG_IMAGE } from './buyUsedGymEquipmentPage.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { STRENGTH_CATEGORY_SLUGS } from './landingCategorySlugs.js'
import { buildCategoryLandingSeoDocument } from './categoryLandingSeo.js'

export const COMMERCIAL_STRENGTH_EQUIPMENT_PATH = LANDING_PATHS.commercialStrength

export const COMMERCIAL_STRENGTH_BROWSE_PATH = buildBrowseNavPath({
  rating: 'full_commercial',
  categorySlugs: STRENGTH_CATEGORY_SLUGS,
})

export { STRENGTH_CATEGORY_SLUGS as COMMERCIAL_STRENGTH_CATEGORY_SLUGS }

export const COMMERCIAL_STRENGTH_CONTENT = Object.freeze({
  idPrefix: 'commercial-strength',
  prerenderId: 'commercial-strength-equipment',
  path: COMMERCIAL_STRENGTH_EQUIPMENT_PATH,
  metaTitle: 'Commercial Strength Equipment for Sale Across the UK | Equipd',
  pageTitle: 'Commercial Strength Equipment for Sale Across the UK | Equipd',
  metaDescription:
    'Browse used commercial strength equipment from UK sellers — plate-loaded and pin-loaded machines, racks, benches and free weights. Compare listings and buy securely on Equipd.',
  ogImage: {
    ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
    alt: 'Equipd marketplace for buying and selling commercial strength equipment in the UK',
  },
  breadcrumbs: [
    { name: 'Commercial Gym Equipment', item: LANDING_PATHS.commercialGym },
    { name: 'Commercial Strength Equipment', item: COMMERCIAL_STRENGTH_EQUIPMENT_PATH },
  ],
  schemaAbout: 'Commercial strength equipment',
  significantLinks: [
    LANDING_PATHS.commercialGym,
    LANDING_PATHS.commercialCardio,
    LANDING_PATHS.refurbishedCommercial,
    LANDING_PATHS.homeStrength,
    COMMERCIAL_STRENGTH_BROWSE_PATH,
    BUY_USED_GYM_EQUIPMENT_PATH,
    SELL_GYM_EQUIPMENT_PATH,
    VALUATION_PATH,
    BRANDS_PATH,
  ],
  eyebrow: 'Strength for serious floors',
  h1: 'Commercial Strength Equipment',
  lead:
    'Buy and sell used commercial strength equipment across the UK through Equipd — plate-loaded and pin-loaded machines, racks, functional trainers, benches and free weights from gyms, dealers and refurbishers, with free valuation and Buyer Protection on eligible purchases.',
  primaryCta: { to: COMMERCIAL_STRENGTH_BROWSE_PATH, label: 'Browse Commercial Strength' },
  secondaryCta: { to: VALUATION_PATH, label: 'Value Your Equipment' },
  searchLabel: 'Search commercial strength equipment',
  heroTrustItems: ['Buyer Protection', 'Secure payments', 'Commercial specialists'],
  listingFilter: { rating: 'full_commercial', categorySlugs: STRENGTH_CATEGORY_SLUGS },
  browsePath: COMMERCIAL_STRENGTH_BROWSE_PATH,
  listingsNote: 'Live marketplace',
  listingsHeading: 'Latest Commercial Strength Listings',
  listingsLead:
    'Live used commercial strength equipment on Equipd — pin-loaded and plate-loaded machines, racks, benches and free weights from sellers across the UK.',
  listingsCta: 'Browse all commercial strength',
  categoryNote: 'Browse by type',
  categoryHeading: 'Browse commercial strength equipment',
  categoryLead:
    'Explore used commercial strength kit by category — from plate-loaded and pin-loaded machines to squat racks, functional trainers, benches and free weights.',
  categories: [
    {
      id: 'plate-loaded',
      label: 'Plate-Loaded Machines',
      description: 'Hammer-style and plate-loaded strength stations',
      to: '/used-plate-loaded-machines',
    },
    {
      id: 'pin-loaded',
      label: 'Pin-Loaded Machines',
      description: 'Selectorised machines for member-friendly training',
      to: '/used-pin-loaded-machines',
    },
    {
      id: 'squat-racks',
      label: 'Squat Racks & Rigs',
      description: 'Half racks, power racks and training rigs',
      to: '/used-power-racks',
    },
    {
      id: 'functional',
      label: 'Functional Trainers',
      description: 'Dual-cable and functional training stations',
      to: '/used-functional-trainers',
    },
    {
      id: 'cables',
      label: 'Cable Machines',
      description: 'Dual pulley and multi-station cable units',
      to: '/used-cable-machines',
    },
    {
      id: 'benches',
      label: 'Commercial Benches',
      description: 'Flat, incline and adjustable benches',
      to: '/used-commercial-benches',
    },
    {
      id: 'dumbbells',
      label: 'Dumbbells & Free Weights',
      description: 'Fixed and pro-style dumbbell sets',
      to: '/used-commercial-dumbbells',
    },
    {
      id: 'barbells',
      label: 'Barbells & Plates',
      description: 'Olympic bars, plates and storage',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'barbells' }),
    },
  ],
  brandNote: 'Trusted manufacturers',
  brandHeading: 'Shop by brand',
  brandLead:
    'Explore commercial strength equipment from the brands gyms, studios and performance facilities rely on.',
  featuredBrandSlugs: [
    'hammer-strength',
    'life-fitness',
    'technogym',
    'cybex',
    'matrix-fitness',
    'rogue-fitness',
    'eleiko',
    'body-solid',
  ],
  benefitsHeading: 'Why buy commercial strength on Equipd?',
  benefits: [
    {
      id: 'supply',
      title: 'Kit from gyms, dealers and refurbishers',
      body: 'Equipd brings ex-facility strength equipment, dealer stock and refurbished machines into one marketplace, so you can compare what is actually available in the UK rather than chasing several sites.',
    },
    {
      id: 'value',
      title: 'More floor for your budget',
      body: 'Used commercial strength usually costs well below new list price, which lets a fixed budget cover more stations or higher-specification kit. Savings depend on brand, age and condition.',
    },
    {
      id: 'buyer-protection',
      title: 'Buyer Protection',
      body: 'Eligible purchases are protected after confirmed handover, giving your facility time to raise an issue if equipment is significantly different from the listing.',
    },
    {
      id: 'valuation',
      title: 'Secure payment and free valuation',
      body: 'Pay through Equipd with Stripe rather than an unprotected bank transfer, and use the free valuation tool to check an asking price against the wider market before you offer.',
    },
  ],
  valuationEyebrow: 'Selling commercial strength?',
  valuationHeading: 'Value commercial strength equipment first',
  valuationCopy:
    'Get a free market estimate for used plate-loaded machines, pin-loaded stations, racks and benches before you list or make an offer. Equipd uses the model, year and condition to show what similar commercial strength kit is worth in the UK.',
  valuationSteps: [
    { label: 'Search', body: 'Find the strength model' },
    { label: 'Details', body: 'Year, wear and configuration' },
    { label: 'Estimate', body: 'See the market range' },
    { label: 'Decide', body: 'Buy, sell or negotiate', emphasize: true },
  ],
  guideNote: 'Buying guide',
  guideHeading: 'Commercial strength buying guide',
  guideIntro:
    'Strength equipment defines how a gym feels and how much maintenance it demands. Used buying can unlock serious kit for a fraction of new cost, but frames, cables, bearings and upholstery all tell a story about remaining life. This guide covers choosing the right mix of plate-loaded, pin-loaded and free-weight kit, judging wear and service history, planning space and floor loading, moving heavy machines safely, and using Equipd valuations to decide whether an asking price makes sense for your facility.',
  guideSections: [
    {
      id: 'choosing-type',
      heading: 'Choosing the right type of commercial strength equipment',
      paragraphs: [
        'Start with how members actually train rather than what looks impressive on a brochure. Plate-loaded machines suit facilities where experienced lifters want natural movement paths and heavy loads — Hammer Strength and similar lines dominate this space and hold value well on the used market.',
        'Pin-loaded selectorised machines are the member-friendly backbone of most gyms. They need less coaching, reset quickly between users and cover the standard push, pull and leg patterns. A sensible floor usually mixes both: plate-loaded for signature pieces and pin-loaded for volume.',
        'Free-weight zones — racks, benches, barbells and dumbbells — remain the heart of serious training spaces. Even a cardio-heavy club needs at least one squat rack, a flat bench and enough plates to serve beginners and intermediates without queues.',
        'Functional trainers and dual-cable pulleys fill the gap between fixed machines and free weights. They suit small studios, physiotherapy spaces and any floor that needs versatile cable work without dedicating metres to a full multi-station.',
        'Match the mix to your membership. A budget 24-hour gym needs durable selectorised kit and plenty of benches; a performance facility may justify more plate-loaded stations and competition-grade bars. Usage data beats generic ratios if you have it.',
      ],
    },
    {
      id: 'plate-vs-pin',
      heading: 'Plate-loaded versus pin-loaded machines',
      paragraphs: [
        'Plate-loaded machines use standard weight plates rather than an internal stack. They feel closer to free weights, often allow heavier loading and tend to suit lifters who already know what they are doing. Wear points are bearings, pivots and upholstery rather than a stack mechanism.',
        'Pin-loaded machines use an internal weight stack selected with a pin. They are quicker to use, easier for beginners and usually lighter to move. The stack, guide rods and cables are the main service items, and a sticking pin or worn guide rods are common reasons a machine feels rough.',
        'On the used market, plate-loaded kit from major brands often retains value because facilities recognise the name and parts remain available. Pin-loaded lines from the same manufacturers can be excellent buys when stacks and cables have been maintained.',
        'Do not assume one type is universally better. A pin-loaded lat pulldown that members actually use beats a plate-loaded row that nobody touches. Walk your floor or talk to your trainers before you commit budget to a category.',
        'When comparing listings, note whether plates are included. Some sellers list the machine only; others include a full plate set that may represent a meaningful share of the total cost if you had to buy separately.',
      ],
    },
    {
      id: 'frames-wear',
      heading: 'Frames, welds, cables and wear points',
      paragraphs: [
        'Inspect the frame first. Commercial strength should feel solid with no flex under load, no cracked paint hiding rust at welds, and no missing bolt covers or shrouds that leave pinch points exposed. Surface scratches are cosmetic; structural damage is not.',
        'On cable machines, run every pulley and check for fraying, flat spots on cables and smooth travel through the full range. Listen for grinding bearings and feel for slack in handles or attachments. Cable replacements are manageable on most commercial units if you know the part number.',
        'On pin-loaded machines, move the stack through its full range with the pin set at several positions. Sticking, uneven travel or a stack that drops when the pin is removed suggests guide rod or bush wear that should be priced in.',
        'Upholstery tells you about environment and care. Commercial vinyl should be intact, with no tears at seams where sweat collects. Reupholstering is possible but adds cost and downtime — factor it in on heavily worn seats and back pads.',
        'Check that safety catches, foot plates and adjustment levers work. A leg press with a sticky seat adjustment or a bench whose incline ratchet slips is a repair waiting to happen on a busy floor.',
      ],
    },
    {
      id: 'racks-benches',
      heading: 'Racks, benches and free-weight kit',
      paragraphs: [
        'Squat racks and rigs need straight uprights, secure safeties and fixings that have not been over-tightened to the point of stripped threads. Pull on the rack and watch for wobble — a little movement may be acceptable on a modular rig, but a power rack that shifts under load is a safety issue.',
        'Measure hole spacing and compatibility if you are mixing brands. Most commercial racks use standard 50 mm or 25 mm hole spacing, but attachments from one line may not fit another without adapters.',
        'Benches should lock firmly at every angle, with stable feet and upholstery that supports heavy use. Test the incline mechanism under load rather than with an empty bar. Commercial flat benches see enormous volume and worn hinges are common on older units.',
        'Barbells and dumbbells need straight shafts, secure knurling and collars that spin smoothly on rotating sleeves. Roll bars on a flat surface to check for bend. Rubber-coated plates should have intact coating; cast iron should not show cracks.',
        'Ask how free weights were stored. Dumbbells left on cold concrete or bars stored without rotation can develop corrosion that affects resale and feel. A complete set with a rack often saves you buying storage separately.',
      ],
    },
    {
      id: 'space-loading',
      heading: 'Floor space, layout and loading',
      paragraphs: [
        'Strength equipment needs more space than the footprint on the spec sheet. Plate-loaded machines need room for plates on both horns; cable stations need clearance for handles at full extension; racks need space for a bar path and safeties.',
        'Plan aisles for traffic and cleaning. A cramped strength zone frustrates members and makes it harder to maintain kit. Most operators allow at least a metre between fixed stations, more around racks and dumbbell areas.',
        'Floor loading matters on mezzanines and upper levels. A row of plate-loaded leg presses and hack squats is a significant point load. If you are above ground floor, confirm with your landlord or a structural engineer before you commit.',
        'Rubber flooring or heavy-duty matting protects the slab and reduces noise transfer. It is cheaper to install before machines arrive than to work around installed kit.',
        'Consider sight lines and coaching. Personal trainers need to see clients across the free-weight area; mirrors help but are not a substitute for sensible layout. Place high-traffic pieces where staff can supervise without standing in a thoroughfare.',
      ],
    },
    {
      id: 'service-parts',
      heading: 'Service history and parts availability',
      paragraphs: [
        'Documented servicing on strength equipment is less common than on cardio, but sellers who can describe what has been replaced — cables, upholstery, bearings, stack liners — are usually more reliable than those who cannot.',
        'Check parts availability for the specific model and generation before you buy. Major commercial brands support equipment for years, but individual lines get discontinued. A quick enquiry to a parts supplier saves expensive surprises.',
        'Line up who will maintain the kit. Independent gym engineers often specialise in one or two brands. Knowing who can service your purchase locally should influence which listings you take seriously.',
        'Budget for a post-install inspection on high-use kit. Tightening fixings, lubricating guide rods and checking cable tension after a move is cheap insurance against early failures.',
        'If you are buying from a gym closure, ask whether maintenance records exist for the whole floor or just individual items. A closure sale can be excellent value when kit was serviced on schedule until the last week.',
      ],
    },
    {
      id: 'transport',
      heading: 'Transport, delivery and installation',
      paragraphs: [
        'Equipd sellers may offer buyer collection, seller delivery or a buyer-arranged courier. Equipd does not run a delivery fleet, so logistics are agreed directly between buyer and seller before payment.',
        'Commercial strength is heavy and awkward. Plate-loaded machines and multi-stations often need partial dismantling to fit through doors. Confirm what the seller will strip down and whether fixings and manuals are included.',
        'Use specialist gym equipment movers for anything you cannot safely handle in-house. The cost is usually modest against damaged frames, injured staff and machines that arrive without critical bolts.',
        'Have the space cleared, flooring down and a plan for reassembly before delivery. Finding a missing cable routing clip after the engineer has left is frustrating and expensive.',
        'Inspect on arrival before confirming handover. Eligible Buyer Protection starts after confirmation, so check frames, stacks and cables while the movers are still on site.',
      ],
    },
    {
      id: 'inspect',
      heading: 'Inspect before you pay',
      paragraphs: [
        'Inspect in person when the value justifies the trip. Photographs rarely show cable wear, stack stickiness or a frame that flexes under load.',
        'Use every machine properly. Load plate-loaded units sensibly, run pin-loaded stacks through their range, rack a bar and bench press on adjustable benches, and pull cables through full travel on functional trainers.',
        'Photograph serial labels, wear points and any damage as you find it. A consistent checklist makes comparison between several listings much easier.',
        'If you cannot attend, ask for video of each machine under load with serial numbers visible. Sellers confident in their kit usually comply.',
        'Only confirm handover once you are satisfied. Confirmation starts the post-handover Buyer Protection window on eligible purchases — inspect first, confirm second.',
      ],
    },
    {
      id: 'valuation',
      heading: 'Using valuation to price a deal',
      paragraphs: [
        'Run the model through Equipd\'s free valuation tool before you offer. It gives a market range based on model, year and condition — a better reference than original list price on kit that may have done years of commercial use.',
        'Compare the asking price against similar live listings. Strength prices vary with brand prestige, configuration and how quickly a seller needs the floor cleared.',
        'Adjust for what you have found. Worn cables, torn upholstery and missing attachments are costs you will carry — quantify them before you negotiate.',
        'Include transport, installation and first service in your total. A cheaper machine two hundred miles away with a frayed cable can cost more than a local unit ready to run.',
        'Valuation helps sellers too. If you are clearing a strength zone, valuing equipment before listing sets a realistic asking price and puts it in front of buyers searching specifically for commercial strength.',
      ],
    },
  ],
  faqNote: 'Common questions',
  faqIntro:
    'Answers on buying used commercial strength equipment, condition checks, delivery, valuations and Buyer Protection on Equipd.',
  faqItems: [
    {
      question: 'What counts as commercial strength equipment?',
      answer:
        'Commercial strength equipment is built for continuous facility use — plate-loaded and pin-loaded machines, squat racks, functional trainers, cable stations, benches, barbells, dumbbells and weight plates. On Equipd, filter by the full commercial rating and strength categories to focus on facility-grade listings.',
    },
    {
      question: 'How much does used commercial strength equipment cost?',
      answer:
        'Prices vary widely by brand, type, age and condition. A single pin-loaded machine might cost a few hundred pounds while a full plate-loaded line runs to tens of thousands. Use the free Equipd valuation tool on the specific model and compare against similar live listings before you offer.',
    },
    {
      question: 'Is plate-loaded or pin-loaded better for a commercial gym?',
      answer:
        'Most facilities run both. Pin-loaded machines suit high-volume, member-friendly training; plate-loaded kit suits experienced lifters and signature stations. The right mix depends on your membership and programming rather than a single correct answer.',
    },
    {
      question: 'What should I check on a used cable machine?',
      answer:
        'Run every pulley and attachment through full travel. Look for frayed cables, worn pulleys, grinding bearings and slack in handles. Confirm the weight stack moves smoothly on pin-loaded variants integrated into cable stations, and ask when cables were last replaced.',
    },
    {
      question: 'Do I need special flooring for commercial strength equipment?',
      answer:
        'Heavy-duty rubber flooring or matting protects the slab, reduces noise and improves safety. It is especially important under racks, dumbbell areas and plate-loaded machines. Plan flooring before delivery rather than retrofitting around installed kit.',
    },
    {
      question: 'Can I mix brands on a commercial strength floor?',
      answer:
        'Yes, most facilities do. Match rack hole spacing if you plan to share attachments, and keep a consistent feel in each zone where possible. Buyers often assemble a floor from several closure sales — condition and parts support matter more than a single brand badge.',
    },
    {
      question: 'How do I move heavy strength machines safely?',
      answer:
        'Use specialist gym equipment movers for plate-loaded units and multi-stations. Many machines dismantle partially for transit — confirm what the seller will strip down and whether fixings are included. Never rush a heavy move; frame damage from a bad lift is expensive.',
    },
    {
      question: 'Are dumbbells and barbells sold separately from machines?',
      answer:
        'Often yes. Listings may include the machine only, or a full package with plates and bars. Read the description carefully and ask in Equipd messages if weight is not shown in photos. Missing plates can represent a significant extra cost.',
    },
    {
      question: 'Which brands make the best commercial strength equipment?',
      answer:
        'Equipd lists commercial strength from Hammer Strength, Life Fitness, Technogym, Cybex, Matrix, Rogue, Eleiko, Body-Solid and others. The best choice depends on your programming, budget and which brands local engineers can service and supply parts for.',
    },
    {
      question: 'How does Buyer Protection work on strength purchases?',
      answer:
        'When you pay through Equipd, funds are held until handover is confirmed. After confirmation, eligible purchases have a Buyer Protection period in which you can raise a significant issue with supporting evidence for Equipd to review. Inspect equipment before confirming handover.',
    },
    {
      question: 'Can gyms sell surplus strength equipment on Equipd?',
      answer:
        'Yes. Gyms, dealers and refurbishers can list used commercial strength equipment, message buyers and take payment through Equipd. Value the kit first with the free valuation tool, then list from Sell Gym Equipment or your seller hub.',
    },
    {
      question: 'Should I buy refurbished commercial strength equipment?',
      answer:
        'Refurbished can mean replaced cables, upholstery and consumables with testing — often a good fit if you lack in-house maintenance. Ask exactly what was done rather than relying on the word alone. Browse refurbished commercial listings or filter commercial strength and compare both routes.',
    },
  ],
  midCtaHeading: 'Ready to browse commercial strength equipment?',
  midCtaLead:
    'See live used commercial strength machines listed by gyms, dealers and refurbishers across the UK.',
  midCtaLabel: 'Browse Commercial Strength',
  exploreNote: 'Keep exploring',
  exploreHeading: 'Explore more',
  exploreLead: 'Continue into related commercial, strength and marketplace pages on Equipd.',
  exploreLinks: [
    {
      label: 'Commercial Gym Equipment',
      description: 'All facility-grade kit for clubs and studios',
      to: LANDING_PATHS.commercialGym,
    },
    {
      label: 'Commercial Cardio Equipment',
      description: 'Treadmills, bikes, cross trainers and rowers',
      to: LANDING_PATHS.commercialCardio,
    },
    {
      label: 'Used Functional Trainers',
      description: 'Dual adjustable pulley systems for facilities',
      to: '/used-functional-trainers',
    },
    {
      label: 'Used Power Racks',
      description: 'Commercial racks and cages',
      to: '/used-power-racks',
    },
    {
      label: 'Refurbished Commercial Gym Equipment',
      description: 'Professionally refurbished facility-grade kit',
      to: LANDING_PATHS.refurbishedCommercial,
    },
    {
      label: 'Home Strength Equipment',
      description: 'Racks, benches and home-rated strength kit',
      to: LANDING_PATHS.homeStrength,
    },
    {
      label: 'Buy Used Gym Equipment',
      description: 'How buying on Equipd works',
      to: BUY_USED_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Sell Gym Equipment',
      description: 'List surplus strength machines for sale',
      to: SELL_GYM_EQUIPMENT_PATH,
    },
  ],
})

export function buildCommercialStrengthEquipmentSeoDocument() {
  return buildCategoryLandingSeoDocument(COMMERCIAL_STRENGTH_CONTENT)
}
