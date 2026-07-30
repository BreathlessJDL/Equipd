/**
 * Home Strength Equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by CategoryLandingPage and build-time prerender.
 */

import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { SELL_GYM_EQUIPMENT_PATH, VALUATION_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { BUY_USED_GYM_EQUIPMENT_PATH, BUY_USED_GYM_EQUIPMENT_OG_IMAGE } from './buyUsedGymEquipmentPage.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { HOME_STRENGTH_CATEGORY_SLUGS } from './landingCategorySlugs.js'
import { buildCategoryLandingSeoDocument } from './categoryLandingSeo.js'

export const HOME_STRENGTH_EQUIPMENT_PATH = LANDING_PATHS.homeStrength

export const HOME_STRENGTH_BROWSE_PATH = buildBrowseNavPath({
  rating: 'home_use',
  categorySlugs: HOME_STRENGTH_CATEGORY_SLUGS,
})

export { HOME_STRENGTH_CATEGORY_SLUGS }

export const HOME_STRENGTH_CONTENT = Object.freeze({
  idPrefix: 'home-strength',
  prerenderId: 'home-strength-equipment',
  path: HOME_STRENGTH_EQUIPMENT_PATH,
  metaTitle: 'Home Strength Equipment for Sale Across the UK | Equipd',
  pageTitle: 'Home Strength Equipment for Sale Across the UK | Equipd',
  metaDescription:
    'Browse used home strength equipment from UK sellers — dumbbells, benches, multi gyms, power racks and adjustable weights. Compare listings and buy securely on Equipd.',
  ogImage: {
    ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
    alt: 'Equipd marketplace for buying and selling home strength equipment in the UK',
  },
  breadcrumbs: [
    { name: 'Home Gym Equipment', item: LANDING_PATHS.homeGym },
    { name: 'Home Strength Equipment', item: HOME_STRENGTH_EQUIPMENT_PATH },
  ],
  schemaAbout: 'Home strength equipment',
  significantLinks: [
    LANDING_PATHS.homeGym,
    LANDING_PATHS.homeCardio,
    LANDING_PATHS.refurbishedHome,
    LANDING_PATHS.commercialStrength,
    HOME_STRENGTH_BROWSE_PATH,
    BUY_USED_GYM_EQUIPMENT_PATH,
    SELL_GYM_EQUIPMENT_PATH,
    VALUATION_PATH,
    BRANDS_PATH,
  ],
  eyebrow: 'Strength at home',
  h1: 'Home Strength Equipment',
  lead:
    'Buy and sell used home strength equipment across the UK on Equipd — dumbbells, benches, multi gyms, power racks and adjustable weights from home gym owners and upgraders, with free valuation and Buyer Protection on eligible purchases.',
  primaryCta: { to: HOME_STRENGTH_BROWSE_PATH, label: 'Browse Home Strength' },
  secondaryCta: { to: VALUATION_PATH, label: 'Value Your Equipment' },
  searchLabel: 'Search home strength equipment',
  heroTrustItems: ['Buyer Protection', 'Secure payments', 'Home gym specialists'],
  listingFilter: { rating: 'home_use', categorySlugs: HOME_STRENGTH_CATEGORY_SLUGS },
  browsePath: HOME_STRENGTH_BROWSE_PATH,
  listingsNote: 'Live marketplace',
  listingsHeading: 'Latest Home Strength Listings',
  listingsLead:
    'Live used home strength equipment on Equipd — racks, benches, dumbbells, multi gyms and cable kit from sellers across the UK.',
  listingsCta: 'Browse all home strength',
  categoryNote: 'Browse by type',
  categoryHeading: 'Browse home strength equipment',
  categoryLead:
    'Explore used home strength kit by category — dumbbells and plates, benches, multi gyms, squat racks, functional trainers and selectorised machines sized for home use.',
  categories: [
    {
      id: 'dumbbells',
      label: 'Dumbbells',
      description: 'Fixed, pro-style and adjustable sets',
      to: '/home-dumbbells',
    },
    {
      id: 'benches',
      label: 'Weight Benches',
      description: 'Flat, incline and adjustable benches',
      to: '/home-weight-benches',
    },
    {
      id: 'multi-gyms',
      label: 'Multi Gyms',
      description: 'All-in-one home strength stations',
      to: '/home-multi-gyms',
    },
    {
      id: 'squat-racks',
      label: 'Power Racks',
      description: 'Half racks and full cages for barbell work',
      to: '/home-power-racks',
    },
    {
      id: 'functional',
      label: 'Functional Trainers',
      description: 'Cable stations for versatile home training',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'functional' }),
    },
    {
      id: 'pin-loaded',
      label: 'Home Gym Machines',
      description: 'Selectorised machines for home use',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'pin-loaded-machine' }),
    },
    {
      id: 'barbells',
      label: 'Barbells & Plates',
      description: 'Olympic bars and weight plates',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'barbells' }),
    },
    {
      id: 'cables',
      label: 'Cable Machines',
      description: 'Dual pulley systems for home gyms',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'dual-cable-pulley' }),
    },
  ],
  brandNote: 'Trusted manufacturers',
  brandHeading: 'Shop by brand',
  brandLead:
    'Explore home strength equipment from brands known for compact multi gyms, racks and adjustable dumbbell systems.',
  featuredBrandSlugs: [
    'bowflex',
    'body-solid',
    'york-fitness',
    'rogue-fitness',
    'nautilus',
    'nordictrack',
    'proform',
    'eleiko',
  ],
  benefitsHeading: 'Why buy home strength on Equipd?',
  benefits: [
    {
      id: 'supply',
      title: 'Quality kit from home gym owners',
      body: 'Many listings come from people upgrading to a rack, downsizing or moving — often well-kept dumbbells, benches and multi gyms that cost far more new than today\'s asking price.',
    },
    {
      id: 'value',
      title: 'Build a proper setup for less',
      body: 'Used home strength lets you assemble a rack, bar, plates and bench for less than a single premium multi gym new — or pick up adjustable dumbbells without retail markup.',
    },
    {
      id: 'buyer-protection',
      title: 'Buyer Protection',
      body: 'Eligible purchases are protected after confirmed handover, giving you time to raise an issue if equipment is significantly different from the listing.',
    },
    {
      id: 'valuation',
      title: 'Secure payment and free valuation',
      body: 'Pay through Equipd with Stripe rather than cash in a car park, and use the free valuation tool to check whether an asking price matches the wider market.',
    },
  ],
  valuationEyebrow: 'Selling home strength kit?',
  valuationHeading: 'Value home strength equipment first',
  valuationCopy:
    'Get a free market estimate for used racks, benches, dumbbells and multi gyms before you list or make an offer. Equipd uses the model, year and condition to show what similar home strength kit is worth in the UK.',
  valuationSteps: [
    { label: 'Search', body: 'Find the strength model' },
    { label: 'Details', body: 'Weights, wear and extras' },
    { label: 'Estimate', body: 'See the market range' },
    { label: 'Decide', body: 'Buy, sell or negotiate', emphasize: true },
  ],
  guideNote: 'Buying guide',
  guideHeading: 'Home strength buying guide',
  guideIntro:
    'Home strength can mean anything from a pair of adjustable dumbbells in a corner to a full rack, bar and plate setup in a garage. The used market rewards buyers who know what fits their space and training style — and punishes impulse buys that never fit through the door. This guide covers choosing between multi gyms and free weights, ceiling height and floor loading, checking racks and benches, buying adjustable dumbbell systems second-hand, moving heavy kit safely, and using Equipd valuations to negotiate fairly.',
  guideSections: [
    {
      id: 'choosing-setup',
      heading: 'Choosing your home strength setup',
      paragraphs: [
        'Decide whether you want an all-in-one multi gym or a free-weight zone. Multi gyms suit beginners and small spaces — one footprint covers several movements without loading plates. Racks, bars and dumbbells suit progressive lifters who want flexibility and room to grow.',
        'Hybrid setups are common: a rack and bench for barbell work plus a cable station or adjustable dumbbells for accessories. Plan the whole room before buying piecemeal; otherwise you end up with a bench that does not fit inside your rack.',
        'Selectorised home machines — lat pulldowns, leg extensions and similar — fill gaps when you do not want plates swinging in a spare room. They are heavier than they look and need stable flooring.',
        'Match kit to your programme. Powerlifting needs a solid rack and bar; general fitness may be fine with dumbbells and a bench; bodybuilding often wants more angles and isolation options.',
        'Start with what you will use weekly. A perfect rack nobody squats in is wasted space; a modest setup you train in four times a week is a good buy at any budget.',
      ],
    },
    {
      id: 'space-height',
      heading: 'Ceiling height, floor space and storage',
      paragraphs: [
        'Racks need ceiling height for pull-ups, bar paths and safeties. Measure at the highest point of your floor — sloped garage roofs catch barbells sooner than you expect.',
        'Multi gyms have fixed footprints that cannot shrink. Compare manufacturer dimensions plus clearance for handles at full extension before you assume it fits.',
        'Dumbbells need a rack or storage tray unless you enjoy tripping over weights. Ask if storage is included in the listing; proprietary trays matter for adjustable systems.',
        'Doorways and stairs dominate delivery planning. A rack that flat-packs helps, but assembled weight still matters on narrow turns.',
        'Wall-mounted folding racks and fold-away benches exist for tight spaces. They trade convenience for setup time each session — know yourself before optimising for floor area alone.',
      ],
    },
    {
      id: 'racks-bars',
      heading: 'Power racks, bars and safeties',
      paragraphs: [
        'Inspect rack welds, upright straightness and safety pin or strap operation. Pull on the frame — home racks should not wobble noticeably when anchored or weighted.',
        'Check hole spacing and brand compatibility for attachments you may add later. 50 mm and 25 mm standards are common; mixing without adapters frustrates upgrades.',
        'Barbells should roll true on a flat floor. Inspect knurling for excessive wear and spin sleeves for smooth rotation. Rust on stored garage bars is common but should not pit the shaft.',
        'Confirm weight capacity ratings if you lift heavy. Home racks from reputable brands exceed most residential needs; unknown imports may not.',
        'Ask whether j-cups, spotter arms and pegs are included. Missing accessories add up quickly on the used market.',
      ],
    },
    {
      id: 'benches-dumbbells',
      heading: 'Benches and dumbbell systems',
      paragraphs: [
        'Adjustable benches should lock firmly at every angle. Test the mechanism under your body weight, not just with a hand — cheap ratchets slip when loaded.',
        'Flat benches are simpler and often more stable for heavy pressing. Incline mechanisms are the first thing to wear on older home benches.',
        'Fixed dumbbell sets are straightforward: check handle tightness, coating damage and whether the set is complete. Missing pairs are tedious to replace matched.',
        'Adjustable dumbbell systems — dial, pin or lever types — need a full function test at every weight increment. Missing trays or locking mechanisms can be expensive to replace.',
        'Compare total weight range against your programme. A system that jumps in large increments may frustrate progressive overload.',
      ],
    },
    {
      id: 'multi-gyms',
      heading: 'Multi gyms and cable stations',
      paragraphs: [
        'Run every station on a multi gym: press, pull, leg extension, curl and any mid pulley. Listen for cable fraying and feel for sticky weight stacks.',
        'Check that the stack pin selects smoothly and that cables route without rubbing shrouds. Home multi gyms often sit unused for months — cables can stiffen even with low hours.',
        'Upholstery on pads should be intact; home garages and sheds expose vinyl to temperature swings that crack seams over time.',
        'Confirm the weight stack maximum matches your strength. Home stacks sometimes top out lower than gym machines you are used to.',
        'Ask for the manual and bolt keys. Reassembly after delivery without instructions is painful on complex multi gyms.',
      ],
    },
    {
      id: 'flooring-loading',
      heading: 'Flooring, noise and floor loading',
      paragraphs: [
        'Rubber matting or platform tiles protect concrete and reduce noise when dropping light weights — not heavy deadlifts on poorly supported slabs in upstairs rooms.',
        'Impact noise from dropped weights travels through structures. If you train above neighbours, consider bumper plates, controlled lowering and session timing.',
        'Point loads from rack feet and multi gyms matter on suspended floors. Spread load with appropriate matting and avoid placing racks on weak mezzanine boards without advice.',
        'Garage gyms introduce damp and temperature cycles. Metal rusts faster; lubricate adjustment threads and store bars sensibly.',
        'Anchor racks where manufacturer guidance recommends it, especially if children or pets share the space.',
      ],
    },
    {
      id: 'delivery',
      heading: 'Collection, delivery and assembly',
      paragraphs: [
        'Equipd sellers arrange collection, local delivery or courier shipment directly with buyers. Plan access before you agree — strength kit is heavy and rarely fits in a hatchback.',
        'Disassembly helps on multi gyms and large racks. Photograph cable routing before you strip anything if you are moving kit yourself.',
        'Two people minimum for racks and plate sets. Appliance dollies and lifting straps beat brute force on stairs.',
        'Inspect on delivery before confirming handover. Missing bolts discovered after the seller has left are awkward for everyone.',
        'Allow time to rebuild and test. A rushed evening assembly before work leads to loose fixings and unsafe setups.',
      ],
    },
    {
      id: 'inspect',
      heading: 'Inspect before you pay',
      paragraphs: [
        'Test with the movements you actually train. Rack a bar, bench press, row on a cable station, change adjustable dumbbells through their range.',
        'Look for rust at welds, bent uprights and repaired frames. Strength equipment fails visibly if you look carefully.',
        'Count plates and dumbbells if sold as a set. Sellers sometimes split sets across listings or forget odd weights.',
        'Photograph wear, serial labels and any modifications. It clarifies what you agreed to buy.',
        'Confirm handover only when satisfied. Buyer Protection on eligible purchases follows confirmation, not first glance.',
      ],
    },
    {
      id: 'valuation',
      heading: 'Using valuation to price a deal',
      paragraphs: [
        'Valuation on Equipd gives a market range for many popular home strength products — especially branded multi gyms and adjustable dumbbell systems with clear model names.',
        'Compare complete setups versus piecing together rack, bar and plates. Bundles can be good value or hide weak components; itemise before you offer.',
        'Adjust for rust, missing parts and incomplete weight sets. Replacing a single dumbbell pair or stack pin adds cost quickly.',
        'Local collection often beats distant bargains once fuel and hire are counted.',
        'Sellers who value before listing attract serious buyers and reduce time-wasting low offers on Equipd.',
      ],
    },
  ],
  faqNote: 'Common questions',
  faqIntro:
    'Answers on buying used home strength equipment, space planning, delivery, valuations and Buyer Protection on Equipd.',
  faqItems: [
    {
      question: 'What counts as home strength equipment?',
      answer:
        'Home strength equipment is built for residential use — dumbbells, benches, multi gyms, squat racks, barbells, weight plates, functional trainers and home-rated selectorised machines. Filter by home use rating and strength categories on Equipd to focus on home listings.',
    },
    {
      question: 'Should I buy a multi gym or a power rack for home?',
      answer:
        'Multi gyms suit beginners and tight spaces with one fixed footprint. Power racks with a bar and plates suit progressive barbell training and upgrades over time. Many home gyms combine both eventually — start with what matches your current programme and room.',
    },
    {
      question: 'How much ceiling height do I need for a power rack?',
      answer:
        'Most full racks need roughly 2.2 m or more for pull-ups and overhead work, but measure your exact floor and bar combination. Low-ceiling garages may need a half rack or squat stands instead of a full cage.',
    },
    {
      question: 'Are adjustable dumbbells worth buying used?',
      answer:
        'They can be excellent value if every weight setting locks correctly and trays or docks are included. Test all increments during inspection and confirm replacement parts availability for that generation before you buy.',
    },
    {
      question: 'How much does used home strength equipment cost?',
      answer:
        'Prices span from small plate sets under £100 to full rack setups over £1,000. Use the free Equipd valuation tool on named models and compare similar live listings rather than guessing from retail prices.',
    },
    {
      question: 'Can I put a home gym upstairs?',
      answer:
        'Sometimes, with care. Consider floor loading, impact noise and access for delivery. Heavy multi gyms and large plate sets concentrate load on small feet — matting and structural awareness matter in flats and older houses.',
    },
    {
      question: 'What should I check on a used weight bench?',
      answer:
        'Lock every angle adjustment under body weight, inspect upholstery tears, check feet for stability and look for bent frames. Cheap home benches often fail at the incline ratchet before the pad wears out.',
    },
    {
      question: 'Do listings include barbells and plates?',
      answer:
        'Not always. Some sell rack only; others bundle bar, plates and accessories. Read descriptions and ask in Equipd messages if photos do not show everything included.',
    },
    {
      question: 'Which brands make good home strength equipment?',
      answer:
        'Equipd lists home strength from Bowflex, Body-Solid, York, Rogue, Nautilus, NordicTrack, ProForm, Eleiko and others. Match brand to product type — Rogue and Eleiko excel in bars and racks; Bowflex and Body-Solid cover multi gyms and home stations.',
    },
    {
      question: 'How do I move a multi gym or rack safely?',
      answer:
        'Disassemble where possible, label bags of bolts, use two or more people and an appliance dolly on stairs. Specialist movers are worth the cost for heavy one-piece multi gyms in difficult access properties.',
    },
    {
      question: 'How does Buyer Protection work on home strength purchases?',
      answer:
        'Pay through Equipd and confirm handover only after inspection. Eligible purchases include a Buyer Protection period after confirmation to raise significant issues with evidence. Test racks, benches and stacks before you confirm.',
    },
    {
      question: 'Can I sell home gym equipment I no longer use?',
      answer:
        'Yes. Value it with the free tool, photograph clearly including any wear, and list from Sell Gym Equipment. Honest condition notes and complete accessory lists help home strength sell faster on Equipd.',
    },
  ],
  midCtaHeading: 'Ready to browse home strength equipment?',
  midCtaLead:
    'See live used racks, benches, dumbbells and multi gyms listed by sellers across the UK.',
  midCtaLabel: 'Browse Home Strength',
  exploreNote: 'Keep exploring',
  exploreHeading: 'Explore more',
  exploreLead: 'Continue into related home, strength and marketplace pages on Equipd.',
  exploreLinks: [
    {
      label: 'Home Gym Equipment',
      description: 'All home-rated fitness kit in one place',
      to: LANDING_PATHS.homeGym,
    },
    {
      label: 'Home Multi Gyms',
      description: 'All-in-one home strength stations',
      to: '/home-multi-gyms',
    },
    {
      label: 'Home Power Racks',
      description: 'Half racks and cages for home barbell work',
      to: '/home-power-racks',
    },
    {
      label: 'Home Cardio Equipment',
      description: 'Treadmills, bikes and rowers for home',
      to: LANDING_PATHS.homeCardio,
    },
    {
      label: 'Refurbished Home Gym Equipment',
      description: 'Professionally refurbished home fitness kit',
      to: LANDING_PATHS.refurbishedHome,
    },
    {
      label: 'Commercial Strength Equipment',
      description: 'Facility-grade racks and strength machines',
      to: LANDING_PATHS.commercialStrength,
    },
    {
      label: 'Buy Used Gym Equipment',
      description: 'How buying on Equipd works',
      to: BUY_USED_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Sell Gym Equipment',
      description: 'List home strength kit you no longer need',
      to: SELL_GYM_EQUIPMENT_PATH,
    },
  ],
})

export function buildHomeStrengthEquipmentSeoDocument() {
  return buildCategoryLandingSeoDocument(HOME_STRENGTH_CONTENT)
}
