/**
 * Home Cardio Equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by CategoryLandingPage and build-time prerender.
 */

import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { SELL_GYM_EQUIPMENT_PATH, VALUATION_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { BUY_USED_GYM_EQUIPMENT_PATH, BUY_USED_GYM_EQUIPMENT_OG_IMAGE } from './buyUsedGymEquipmentPage.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { HOME_CARDIO_CATEGORY_SLUGS } from './landingCategorySlugs.js'
import { buildCategoryLandingSeoDocument } from './categoryLandingSeo.js'

export const HOME_CARDIO_EQUIPMENT_PATH = LANDING_PATHS.homeCardio

export const HOME_CARDIO_BROWSE_PATH = buildBrowseNavPath({
  rating: 'home_use',
  categorySlugs: HOME_CARDIO_CATEGORY_SLUGS,
})

export { HOME_CARDIO_CATEGORY_SLUGS }

export const HOME_CARDIO_CONTENT = Object.freeze({
  idPrefix: 'home-cardio',
  prerenderId: 'home-cardio-equipment',
  path: HOME_CARDIO_EQUIPMENT_PATH,
  metaTitle: 'Home Cardio Equipment for Sale Across the UK | Equipd',
  pageTitle: 'Home Cardio Equipment for Sale Across the UK | Equipd',
  metaDescription:
    'Browse used home cardio equipment from UK sellers — treadmills, exercise bikes, cross trainers and rowers. Compare home fitness listings and buy securely with Buyer Protection on Equipd.',
  ogImage: {
    ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
    alt: 'Equipd marketplace for buying and selling home cardio equipment in the UK',
  },
  breadcrumbs: [
    { name: 'Home Gym Equipment', item: LANDING_PATHS.homeGym },
    { name: 'Home Cardio Equipment', item: HOME_CARDIO_EQUIPMENT_PATH },
  ],
  schemaAbout: 'Home cardio equipment',
  significantLinks: [
    LANDING_PATHS.homeGym,
    LANDING_PATHS.homeStrength,
    LANDING_PATHS.refurbishedHome,
    LANDING_PATHS.commercialCardio,
    HOME_CARDIO_BROWSE_PATH,
    BUY_USED_GYM_EQUIPMENT_PATH,
    SELL_GYM_EQUIPMENT_PATH,
    VALUATION_PATH,
    BRANDS_PATH,
  ],
  eyebrow: 'Cardio for your space',
  h1: 'Home Cardio Equipment',
  lead:
    'Buy and sell used home cardio equipment across the UK on Equipd — folding treadmills, exercise bikes, cross trainers and rowers from private sellers and home gym upgraders, with free valuation and Buyer Protection on eligible purchases.',
  primaryCta: { to: HOME_CARDIO_BROWSE_PATH, label: 'Browse Home Cardio' },
  secondaryCta: { to: VALUATION_PATH, label: 'Value Your Equipment' },
  searchLabel: 'Search home cardio equipment',
  heroTrustItems: ['Buyer Protection', 'Secure payments', 'Home gym specialists'],
  listingFilter: { rating: 'home_use', categorySlugs: HOME_CARDIO_CATEGORY_SLUGS },
  browsePath: HOME_CARDIO_BROWSE_PATH,
  listingsNote: 'Live marketplace',
  listingsHeading: 'Latest Home Cardio Listings',
  listingsLead:
    'Live used home cardio equipment on Equipd — treadmills, bikes, cross trainers and rowers listed by sellers across the UK.',
  listingsCta: 'Browse all home cardio',
  categoryNote: 'Browse by type',
  categoryHeading: 'Browse home cardio equipment',
  categoryLead:
    'Explore used home cardio machines by category — folding treadmills, upright and recumbent bikes, cross trainers, rowers and conditioning kit sized for home use.',
  categories: [
    {
      id: 'treadmills',
      label: 'Home Treadmills',
      description: 'Folding and compact running decks',
      to: '/home-treadmills',
    },
    {
      id: 'upright-bikes',
      label: 'Upright Exercise Bikes',
      description: 'Space-efficient bikes for steady cardio',
      to: '/home-exercise-bikes',
    },
    {
      id: 'recumbent-bikes',
      label: 'Recumbent Bikes',
      description: 'Supported seating for comfortable sessions',
      to: '/home-exercise-bikes',
    },
    {
      id: 'spin-bikes',
      label: 'Indoor Cycles',
      description: 'Spin and studio-style home bikes',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'spin-bikes' }),
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
      id: 'assault-bike',
      label: 'Air Bikes',
      description: 'Fan bikes for HIIT and conditioning',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'assault-bike' }),
    },
    {
      id: 'skierg',
      label: 'Ski Ergs',
      description: 'Upper-body and full-body conditioning',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'skierg' }),
    },
  ],
  brandNote: 'Trusted manufacturers',
  brandHeading: 'Shop by brand',
  brandLead:
    'Explore home cardio equipment from the brands home gym owners choose for connected training, reliability and value.',
  featuredBrandSlugs: [
    'nordictrack',
    'proform',
    'bowflex',
    'horizon-fitness',
    'schwinn',
    'sole-fitness',
    'concept2',
    'nautilus',
  ],
  benefitsHeading: 'Why buy home cardio on Equipd?',
  benefits: [
    {
      id: 'supply',
      title: 'Kit from home gym owners and upgraders',
      body: 'Equipd brings together lightly used treadmills, bikes and rowers from people upgrading or clearing space — often well-maintained kit that cost far more new than the asking price today.',
    },
    {
      id: 'value',
      title: 'Better spec for your budget',
      body: 'Used home cardio usually costs well below retail, which can mean a folding treadmill with incline or a connected bike instead of a basic new model at the same price.',
    },
    {
      id: 'buyer-protection',
      title: 'Buyer Protection',
      body: 'Eligible purchases are protected after confirmed handover, giving you time to raise an issue if equipment is significantly different from the listing.',
    },
    {
      id: 'valuation',
      title: 'Secure payment and free valuation',
      body: 'Pay through Equipd with Stripe rather than cash or an unprotected bank transfer, and use the free valuation tool to sense-check an asking price before you commit.',
    },
  ],
  valuationEyebrow: 'Selling home cardio?',
  valuationHeading: 'Value home cardio equipment first',
  valuationCopy:
    'Get a free market estimate for used treadmills, exercise bikes, cross trainers and rowers before you list or make an offer. Equipd uses the model, year and condition to show what similar home cardio machines are worth in the UK.',
  valuationSteps: [
    { label: 'Search', body: 'Find the cardio model' },
    { label: 'Details', body: 'Year, console and usage' },
    { label: 'Estimate', body: 'See the market range' },
    { label: 'Decide', body: 'Buy, sell or negotiate', emphasize: true },
  ],
  guideNote: 'Buying guide',
  guideHeading: 'Home cardio buying guide',
  guideIntro:
    'Home cardio is where most home gyms start — and where the wrong purchase wastes space, annoys neighbours or sits unused within months. The used market is full of treadmills someone upgraded from and bikes that outlasted a subscription. This guide covers choosing the right machine for your room, noise and power realities, folding versus fixed footprints, checking belts and consoles, delivery into tight spaces, and using Equipd valuations to decide whether a listing is fairly priced.',
  guideSections: [
    {
      id: 'choosing-type',
      heading: 'Choosing the right home cardio machine',
      paragraphs: [
        'Start with what you will actually do, not what looks best in a showroom. Runners who train seriously need a treadmill with a decent deck and motor; casual walkers may be fine with a compact folding model. Honest self-assessment saves money and floor space.',
        'Exercise bikes suit smaller rooms and lower noise levels. Upright bikes feel closest to road cycling; recumbent bikes support the back and suit longer, easier sessions; spin-style indoor cycles suit interval training and Peloton-style setups without the subscription.',
        'Cross trainers offer low-impact full-body work but need ceiling height and swing clearance. Rowers fold or stand upright and suit garages and spare rooms where a treadmill would dominate.',
        'Air bikes and ski ergs are the specialist choice for HIIT and conditioning. They are loud compared with magnetic bikes but take less space than a treadmill and deliver intense sessions in short windows.',
        'One good machine you use beats three that clutter the room. If you are unsure, try the type at a gym or hire before committing budget on the used market.',
      ],
    },
    {
      id: 'space-footprint',
      heading: 'Room size, folding and storage',
      paragraphs: [
        'Measure twice. Treadmills need length for the deck plus clear space behind in case of a stumble. Cross trainers need height as well as width — low ceilings and sloped eaves catch handlebars sooner than you expect.',
        'Folding treadmills save space when stored but still need room when deployed. Check folded dimensions if you plan to slide one under a bed or stand it against a wall — some are genuinely compact, others merely less enormous.',
        'Bikes and rowers usually win on footprint. A good upright bike fits a bedroom corner; a rower can stand vertically against a wall between sessions. That flexibility matters in flats and shared houses.',
        'Think about doorways on the route in. A treadmill that fits the room but not the stairwell is a costly mistake. Measure every turn on the delivery path before you buy.',
        'Leave space for a mat, a fan and somewhere to put a phone or tablet. The usable footprint is always larger than the manufacturer diagram suggests.',
      ],
    },
    {
      id: 'noise-neighbours',
      heading: 'Noise, vibration and neighbours',
      paragraphs: [
        'Impact noise is the main issue with treadmills — footfall transmits through floors more than motor hum. Upstairs installations in flats need extra care: matting, timing sessions thoughtfully and sometimes choosing a bike or rower instead.',
        'Magnetic resistance bikes and rowers are generally quieter than treadmills and air bikes. Air bikes and fan rowers move a lot of air and can dominate a small room acoustically even when motor noise is low.',
        'Vibration isolation mats help but do not eliminate impact. If you share walls or floors, talk to neighbours before installing a treadmill above them — goodwill matters more than any product claim.',
        'Garages and outbuildings solve noise for many home gym owners but introduce temperature and humidity swings that affect electronics and belts over time.',
        'Test run where possible. A ten-minute session reveals squeaks, rattles and bearing noise that a quick switch-on in a seller\'s garage will not.',
      ],
    },
    {
      id: 'power-connectivity',
      heading: 'Power, consoles and connected features',
      paragraphs: [
        'Most home treadmills need a nearby socket; many bikes and rowers are self-powered or need only a small plug for the console. Confirm before you position a machine permanently away from an outlet.',
        'Connected consoles and subscription apps are attractive when new but check what still works without an active account. Some machines remain useful offline; others lose most of their appeal when the app tier lapses.',
        'Screen size and tablet holders matter if you follow apps or video sessions. A dead integrated screen can sometimes be replaced, but on home models parts availability varies — price that risk on older units.',
        'Bluetooth and heart-rate pairing are nice when they work. Test pairing with your own strap or watch during inspection rather than assuming compatibility from a spec sheet.',
        'Update firmware only when the seller confirms the machine is stable on current software — a failed update can brick a console on some home lines.',
      ],
    },
    {
      id: 'treadmill-checks',
      heading: 'Checking used treadmills at home',
      paragraphs: [
        'Run the belt at walking and running speeds with someone on the deck. Listen for slipping, thumping or grinding from the motor or rollers. Feel the belt for glazing or rough patches in the walking zone.',
        'Test incline through its full range if fitted. Home incline motors can fail gradually — a deck that sticks at mid-incline is a repair waiting to happen.',
        'Check the safety key and emergency stop. Fold and unfold if it is a folding model, watching for smooth operation and secure locking.',
        'Ask about total use rather than age alone. A ten-year-old treadmill in a spare room may have fewer miles than a three-year-old one that served a family of runners.',
        'Confirm whether lubrication and belt tension have been maintained. Neglected home treadmills often need a service kit early in your ownership.',
      ],
    },
    {
      id: 'bikes-rowers',
      heading: 'Checking bikes, cross trainers and rowers',
      paragraphs: [
        'On bikes, spin the pedals and test resistance through every level. Listen for bearing noise and check for lateral play in the bottom bracket area. Saddle and handlebar adjustments should lock firmly.',
        'Recumbent bikes need seat rail checks — a slipping seat during a session is dangerous. Test the console and pulse grips if you rely on heart-rate readouts.',
        'Cross trainers should run smoothly with even resistance and no knocking from the ramp mechanism. Grab the arms and load the machine; loose pivots show up under body weight.',
        'Rowers need a clean chain or strap, smooth seat travel on the rail and a damper that adjusts predictably. Inspect the rail for scoring that could wear rollers.',
        'Ask for any original tools, spare parts or maintenance logs. Home owners rarely keep them, but when they exist they save time on first service.',
      ],
    },
    {
      id: 'delivery-access',
      heading: 'Delivery, access and assembly',
      paragraphs: [
        'Equipd sellers may offer collection, local delivery or courier shipment. Logistics are agreed between buyer and seller — Equipd provides the marketplace workflow, not a delivery fleet.',
        'Treadmills are awkward even when folded. Two strong people, a stair climber dolly and a clear plan beat improvisation on narrow stairs.',
        'Some home cardio arrives partially assembled; others need full setup. Confirm what the seller expects you to do and whether they have the original tools and manual.',
        'For courier delivery, use an evidence-based handover process and inspect packaging damage immediately. Collection lets you test before you pay and confirm on the spot.',
        'Book delivery when you have time to test, not five minutes before work. Rushed handovers lead to missed faults and regret.',
      ],
    },
    {
      id: 'inspect',
      heading: 'Inspect before you pay',
      paragraphs: [
        'Inspect in person when you can. Home cardio faults — slipping belts, sticky resistance, cracked consoles — rarely show in three photographs.',
        'Run your intended workout, not a token ten seconds. If you plan to jog, jog; if you row hard, row hard. Intermittent faults appear under load.',
        'Photograph serial numbers, wear areas and any damage. It protects both sides if a dispute arises after handover.',
        'If buying remotely, ask for a video call while the seller runs the machine through your typical session. It is not as good as being there but beats stills alone.',
        'Confirm handover only when satisfied. Buyer Protection on eligible purchases starts after confirmation, so test first.',
      ],
    },
    {
      id: 'valuation',
      heading: 'Using valuation to price a deal',
      paragraphs: [
        'Run the model through Equipd\'s free valuation tool before you offer. Home cardio depreciates quickly when new models launch, so list price from three years ago is a poor guide.',
        'Compare against similar live listings nearby. Local collection often beats a distant bargain once transport is included.',
        'Adjust for wear and missing parts. A treadmill without a safety key or a bike with a worn saddle are small costs individually but signal how the owner maintained the machine.',
        'Factor subscription savings into connected kit. A bike that works offline may be worth more to you than one tied to an expired account — but less to someone who wanted the full app experience.',
        'Valuation helps sellers set realistic prices when upgrading. A fair ask sells faster and attracts serious buyers on Equipd.',
      ],
    },
  ],
  faqNote: 'Common questions',
  faqIntro:
    'Answers on buying used home cardio equipment, space and noise, delivery, valuations and Buyer Protection on Equipd.',
  faqItems: [
    {
      question: 'What counts as home cardio equipment?',
      answer:
        'Home cardio equipment is built for residential use — treadmills, exercise bikes, cross trainers, rowers, air bikes and ski ergs rated for home rather than continuous commercial duty. On Equipd, filter by the home use rating and cardio categories to focus on home listings.',
    },
    {
      question: 'How much does used home cardio equipment cost?',
      answer:
        'Prices range from under £100 for basic older bikes to several thousand for premium treadmills and connected bikes. Use the free Equipd valuation tool on the specific model and compare similar live listings rather than working from generic averages.',
    },
    {
      question: 'Is a folding treadmill worth it for a home gym?',
      answer:
        'Folding treadmills save space when stored and suit rooms that serve multiple purposes. They can be heavier to move daily and may have slightly smaller decks than fixed models. If you run regularly, check deck length and motor size rather than fold alone.',
    },
    {
      question: 'Which home cardio machine is quietest for a flat?',
      answer:
        'Magnetic upright or recumbent bikes and magnetic rowers are usually quieter than treadmills and air bikes. Impact noise from running transmits through floors, so upstairs flats often favour bikes or rowers unless you can mitigate with matting and timing.',
    },
    {
      question: 'Do I need a special power supply for home treadmills?',
      answer:
        'Most home treadmills use a standard UK plug on a dedicated socket. Avoid extension reels for permanent setup. Confirm the seller includes the correct cable and that the socket you plan to use is easily reachable.',
    },
    {
      question: 'Can I use commercial cardio equipment at home?',
      answer:
        'Sometimes, if you have space, access and power. Commercial machines are larger, heavier and louder than home equivalents. The Commercial Cardio Equipment page covers facility-grade kit; most home buyers are better served by home-rated listings on Equipd.',
    },
    {
      question: 'What should I check when buying a used exercise bike?',
      answer:
        'Test resistance at every level, listen for bearing noise, check saddle and handlebar adjustments lock securely, and confirm the console works. On smart bikes, verify which app features work without an active subscription if that matters to you.',
    },
    {
      question: 'How do I get a treadmill upstairs or into a garage?',
      answer:
        'Measure every doorway and stair turn first. Many treadmills fold or split partially for transit. Use an appliance dolly and at least two people, or hire specialist movers for difficult access. Confirm logistics with the seller before payment.',
    },
    {
      question: 'Are connected fitness subscriptions required?',
      answer:
        'Depends on the machine. Some work fully offline; others lock features behind a subscription. Ask the seller what still functions without an account and test during inspection if connectivity matters to your training.',
    },
    {
      question: 'Which brands make good home cardio equipment?',
      answer:
        'Equipd lists home cardio from NordicTrack, ProForm, Bowflex, Horizon, Schwinn, Sole, Concept2, Nautilus and others. Match brand to the type you want — Concept2 dominates rowing, for example, while NordicTrack and ProForm cover treadmills and bikes.',
    },
    {
      question: 'How does Buyer Protection work on home cardio purchases?',
      answer:
        'When you pay through Equipd, funds are held until handover is confirmed. After confirmation, eligible purchases have a Buyer Protection period to raise significant issues with evidence. Inspect and test before confirming handover.',
    },
    {
      question: 'Can I sell my old treadmill or bike on Equipd?',
      answer:
        'Yes. List used home cardio from your seller hub, value it first with the free tool, and take payment through Equipd when a buyer commits. Clear photos and honest condition notes help home cardio sell quickly.',
    },
  ],
  midCtaHeading: 'Ready to browse home cardio equipment?',
  midCtaLead:
    'See live used treadmills, bikes, cross trainers and rowers listed by sellers across the UK.',
  midCtaLabel: 'Browse Home Cardio',
  exploreNote: 'Keep exploring',
  exploreHeading: 'Explore more',
  exploreLead: 'Continue into related home, cardio and marketplace pages on Equipd.',
  exploreLinks: [
    {
      label: 'Home Gym Equipment',
      description: 'All home-rated fitness kit in one place',
      to: LANDING_PATHS.homeGym,
    },
    {
      label: 'Home Treadmills',
      description: 'Folding and compact running decks',
      to: '/home-treadmills',
    },
    {
      label: 'Home Exercise Bikes',
      description: 'Upright and recumbent bikes for home',
      to: '/home-exercise-bikes',
    },
    {
      label: 'Home Strength Equipment',
      description: 'Racks, benches, dumbbells and multi gyms',
      to: LANDING_PATHS.homeStrength,
    },
    {
      label: 'Refurbished Home Gym Equipment',
      description: 'Professionally refurbished home fitness kit',
      to: LANDING_PATHS.refurbishedHome,
    },
    {
      label: 'Commercial Cardio Equipment',
      description: 'Facility-grade treadmills, bikes and rowers',
      to: LANDING_PATHS.commercialCardio,
    },
    {
      label: 'Buy Used Gym Equipment',
      description: 'How buying on Equipd works',
      to: BUY_USED_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Sell Gym Equipment',
      description: 'List home cardio you no longer use',
      to: SELL_GYM_EQUIPMENT_PATH,
    },
  ],
})

export function buildHomeCardioEquipmentSeoDocument() {
  return buildCategoryLandingSeoDocument(HOME_CARDIO_CONTENT)
}
