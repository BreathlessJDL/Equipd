/**
 * Refurbished Home Gym Equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by CategoryLandingPage and build-time prerender.
 */

import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { SELL_GYM_EQUIPMENT_PATH, VALUATION_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { BUY_USED_GYM_EQUIPMENT_PATH, BUY_USED_GYM_EQUIPMENT_OG_IMAGE } from './buyUsedGymEquipmentPage.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { buildCategoryLandingSeoDocument } from './categoryLandingSeo.js'

export const REFURBISHED_HOME_GYM_EQUIPMENT_PATH = LANDING_PATHS.refurbishedHome

export const REFURBISHED_HOME_BROWSE_PATH = buildBrowseNavPath({
  rating: 'home_use',
  search: 'refurbished',
})

export const REFURBISHED_HOME_CONTENT = Object.freeze({
  idPrefix: 'refurbished-home',
  prerenderId: 'refurbished-home-gym-equipment',
  path: REFURBISHED_HOME_GYM_EQUIPMENT_PATH,
  metaTitle: 'Refurbished Home Gym Equipment for Sale | Equipd',
  pageTitle: 'Refurbished Home Gym Equipment for Sale | Equipd',
  metaDescription:
    'Browse refurbished home gym equipment from UK sellers — serviced treadmills, bikes and strength kit with peace of mind and lower cost than new. Buy securely with Buyer Protection on Equipd.',
  ogImage: {
    ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
    alt: 'Equipd marketplace for refurbished home gym equipment in the UK',
  },
  breadcrumbs: [
    { name: 'Home Gym Equipment', item: LANDING_PATHS.homeGym },
    { name: 'Refurbished Home Gym Equipment', item: REFURBISHED_HOME_GYM_EQUIPMENT_PATH },
  ],
  schemaAbout: 'Refurbished home gym equipment',
  significantLinks: [
    LANDING_PATHS.homeGym,
    LANDING_PATHS.homeCardio,
    LANDING_PATHS.homeStrength,
    LANDING_PATHS.refurbishedCommercial,
    REFURBISHED_HOME_BROWSE_PATH,
    BUY_USED_GYM_EQUIPMENT_PATH,
    SELL_GYM_EQUIPMENT_PATH,
    VALUATION_PATH,
    BRANDS_PATH,
  ],
  eyebrow: 'Home fitness, professionally checked',
  h1: 'Refurbished Home Gym Equipment',
  lead:
    'Browse refurbished home gym equipment from sellers across the UK on Equipd — serviced treadmills, exercise bikes, multi gyms and strength kit that offers peace of mind and meaningful savings compared with new, plus free valuation and Buyer Protection on eligible purchases.',
  primaryCta: { to: REFURBISHED_HOME_BROWSE_PATH, label: 'Browse Refurbished Home Gym' },
  secondaryCta: { to: VALUATION_PATH, label: 'Value Your Equipment' },
  searchLabel: 'Search refurbished home gym equipment',
  heroTrustItems: ['Buyer Protection', 'Secure payments', 'Checked before resale'],
  listingFilter: { rating: 'home_use', search: 'refurbished' },
  browsePath: REFURBISHED_HOME_BROWSE_PATH,
  listingsNote: 'Live marketplace',
  listingsHeading: 'Latest Refurbished Home Gym Listings',
  listingsLead:
    'Live refurbished home gym equipment on Equipd — serviced treadmills, bikes and strength kit from sellers across the UK.',
  listingsCta: 'Browse all refurbished home gym',
  listingsEmpty:
    'Not many listings include the refurbished keyword today — browse all home gym equipment to find lightly used kit, ex-display stock and seller-serviced machines with detailed condition notes.',
  categoryNote: 'Browse by type',
  categoryHeading: 'Browse refurbished home gym equipment by category',
  categoryLead:
    'Explore home cardio and strength by category — refurbished treadmills, bikes, multi gyms and racks appear across Equipd even when keyword search is quiet.',
  categories: [
    {
      id: 'treadmills',
      label: 'Refurbished Home Treadmills',
      description: 'Serviced folding and compact decks',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'treadmill', search: 'refurbished' }),
    },
    {
      id: 'bikes',
      label: 'Refurbished Exercise Bikes',
      description: 'Upright, recumbent and spin bikes checked',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'upright-bikes', search: 'refurbished' }),
    },
    {
      id: 'cross-trainers',
      label: 'Refurbished Cross Trainers',
      description: 'Home ellipticals serviced and tested',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'crosstrainers', search: 'refurbished' }),
    },
    {
      id: 'multi-gyms',
      label: 'Refurbished Multi Gyms',
      description: 'All-in-one stations cleaned and tested',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'multi-gyms', search: 'refurbished' }),
    },
    {
      id: 'dumbbells',
      label: 'Refurbished Dumbbells',
      description: 'Adjustable and fixed sets inspected',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'dumbbells' }),
    },
    {
      id: 'benches',
      label: 'Refurbished Benches',
      description: 'Adjustable benches checked and cleaned',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'bench' }),
    },
    {
      id: 'rowers',
      label: 'Refurbished Rowers',
      description: 'Home rowing machines serviced',
      to: buildBrowseNavPath({ rating: 'home_use', categorySlug: 'rowers', search: 'refurbished' }),
    },
    {
      id: 'all-home',
      label: 'All Home Gym Equipment',
      description: 'Full home browse including ex-display stock',
      to: buildBrowseNavPath({ rating: 'home_use' }),
    },
  ],
  brandNote: 'Trusted manufacturers',
  brandHeading: 'Shop by brand',
  brandLead:
    'Explore refurbished home gym equipment from brands with strong home ranges — often the same models sold ex-display or after a light service programme.',
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
  benefitsHeading: 'Why buy refurbished home gym equipment on Equipd?',
  benefits: [
    {
      id: 'peace-of-mind',
      title: 'Peace of mind versus raw used',
      body: 'Refurbished home kit has usually been cleaned, tested and had obvious wear addressed — helpful if you want confidence without paying full retail for new.',
    },
    {
      id: 'savings',
      title: 'Meaningful savings on premium models',
      body: 'Ex-display, lightly used and professionally serviced home machines often sell well below new price while retaining features — connected consoles, incline decks and adjustable dumbbell systems included.',
    },
    {
      id: 'buyer-protection',
      title: 'Buyer Protection',
      body: 'Eligible purchases are protected after confirmed handover, giving you time to raise an issue if equipment is significantly different from the listing.',
    },
    {
      id: 'valuation',
      title: 'Secure payment and free valuation',
      body: 'Pay through Equipd with Stripe rather than social media transfers, and use the free valuation tool to compare refurbished asks against wider home listings.',
    },
  ],
  valuationEyebrow: 'Selling refurbished home gym kit?',
  valuationHeading: 'Value home equipment before you list',
  valuationCopy:
    'Buyers weigh refurbished pricing against ordinary used listings on the same model. Start with a free Equipd estimate, then add a clear premium only where you can document service work, ex-display status or remaining warranty.',
  valuationSteps: [
    { label: 'Search', body: 'Find the home model' },
    { label: 'Details', body: 'Service work and warranty' },
    { label: 'Estimate', body: 'See the market range' },
    { label: 'Decide', body: 'Price and list', emphasize: true },
  ],
  guideNote: 'Buying guide',
  guideHeading: 'Refurbished home gym equipment buying guide',
  guideIntro:
    'Refurbished home gym equipment sits in a sweet spot for many buyers — more reassurance than a casual used listing, less outlay than new. The catch is that refurbishment means different things from a retailer, a marketplace specialist or a private seller clearing a spare room. This guide covers what to expect from home refurbishments, ex-display versus serviced used, warranty realities for residential buyers, checking treadmills and adjustable dumbbells after service, when refurbished beats ordinary used, and how Equipd valuations and Buyer Protection help you buy with confidence.',
  guideSections: [
    {
      id: 'what-refurbished-means',
      heading: 'What refurbished means for home gym equipment',
      paragraphs: [
        'At home level, refurbished can mean a retailer ex-display unit, a return checked and repackaged, a specialist cleaning belts and lubricating a treadmill, or simply a thorough wipe-down — the word is not protected.',
        'Ask what was done in plain language: belt lubrication, new safety key, console reset, cable adjustment on a multi gym, or full replacement parts. The more specific the answer, the more meaningful the refurbished label.',
        'Ex-display is a common subset — minimal use in a shop but possible cosmetic marks from foot traffic. It is not the same as a machine that ran daily in someone\'s garage, but it may not include deep mechanical service either.',
        'Cosmetic grading matters at home. A treadmill with a scuffed side panel may be mechanically fine; decide what you can live with before you pay a refurbished premium for perfection you do not need.',
        'On Equipd, combine keyword search with category browse. Sellers sometimes describe service work in the body without tagging refurbished in the title.',
      ],
    },
    {
      id: 'refurbished-vs-used',
      heading: 'Refurbished versus ordinary used home kit',
      paragraphs: [
        'Ordinary used home equipment is often excellent value from owners upgrading or moving. The risk is neglected maintenance — dry treadmill belts, rusty adjustment pins, smart bikes with expired subscriptions.',
        'Refurbished asks for a modest premium when someone has already addressed those basics. Whether that premium is fair depends on the work list, not the label alone.',
        'If you are handy and enjoy servicing kit, ordinary used may beat refurbished on maths alone. If you want to train this week without ordering lubricant and spare keys, refurbished or ex-display can be rational.',
        'Compare the same model across both paths on Equipd. A lightly used ordinary listing near you can beat a refurbished unit plus courier from afar.',
        'Age and generation still matter. Refurbished last-year connected kit may beat new this year only if the features you want unchanged — valuation helps anchor that decision.',
      ],
    },
    {
      id: 'warranty-support',
      heading: 'Warranty and support for home buyers',
      paragraphs: [
        'Retailer refurbished or ex-display sometimes carries a shortened manufacturer or shop warranty — 30 days to a year depending on policy. Private sellers often offer none unless they are small refurb businesses.',
        'Manufacturer warranty may not transfer on all home lines. Ask explicitly and keep email confirmation with your receipt.',
        'Extended care plans from retailers rarely transfer to second owners. Do not assume cover continues because the machine looks shop-fresh.',
        'For small refurbishers, a written guarantee on specific components — motor, console, belt — beats a vague promise of support.',
        'Buyer Protection on Equipd is separate from seller warranty. It covers eligible significant listing discrepancies after handover; it is not a substitute for a mechanical warranty on wear items.',
      ],
    },
    {
      id: 'cardio-home',
      heading: 'Refurbished home treadmills and cardio',
      paragraphs: [
        'On treadmills, confirm belt lubrication, roller condition, safety key inclusion and incline function. Home decks wear faster when neglected — refurbishment should address belt feel, not only console brightness.',
        'On bikes and cross trainers, test resistance across the range and check for console errors after power cycle. Smart bikes need clarity on which app features work without subscription.',
        'Rowers are simpler mechanically but check chain or strap, rail scoring and monitor function. Concept2 and similar hold value when serviced honestly.',
        'Noise after service should be acceptable for your space. Refurbishment does not magically make a heavy treadmill quiet upstairs — manage expectations on impact noise.',
        'Fold mechanisms on treadmills must lock securely. Ex-display units sometimes have loose hinges from repeated folding in shops — test thoroughly.',
      ],
    },
    {
      id: 'strength-home',
      heading: 'Refurbished home strength equipment',
      paragraphs: [
        'Multi gyms need cable and stack checks at every station. Home units often sit idle then sell — cables can stiffen even with low hours.',
        'Adjustable dumbbell systems must click or lock at every weight. Missing trays or docks are costly; confirm completeness before you pay a refurbished premium.',
        'Benches need secure angle locks and intact upholstery. Home garage humidity cracks vinyl seams over time — acceptable if priced accordingly.',
        'Racks and barbells should be straight and rust-free enough for safe use. Light surface rust on stored bars is common; pitting or bent shafts are not.',
        'Ask if the seller calibrated or greased adjustment threads — small maintenance that signals care more than a deep clean alone.',
      ],
    },
    {
      id: 'ex-display',
      heading: 'Ex-display and open-box home equipment',
      paragraphs: [
        'Ex-display units from retailers appear on Equipd when shops clear floor models. They are often categorised or described as refurbished even when use was minimal.',
        'Inspect for cosmetic scuffs, missing manuals and whether original packaging remains. Missing boxes complicate courier claims if you ship nationally.',
        'Confirm the unit is complete — power cables, tools, heart-rate straps and tablet holders disappear easily on shop floors.',
        'Ex-display pricing should sit below new but above heavily used private stock unless full service was performed.',
        'Retail receipt or proof of ex-display status helps if you later sell or claim any remaining shop warranty.',
      ],
    },
    {
      id: 'delivery-setup',
      heading: 'Delivery, room placement and first session',
      paragraphs: [
        'Home equipment still needs access planning. Measure stairs and turns; folding treadmills are heavy even when compact.',
        'Seller delivery locally beats national courier for heavy kit when available — you can test on arrival before confirming handover.',
        'Allow time to level treadmills, tighten bolts after transit and register smart consoles if required.',
        'First workout should be a shakedown — listen for new rattles after transport that were not present in the seller\'s photos.',
        'Keep packaging briefly if courier-delivered in case return negotiation is needed on eligible purchases with documented issues.',
      ],
    },
    {
      id: 'inspect',
      heading: 'Inspect before you confirm handover',
      paragraphs: [
        'Run your normal workout, not a demo. Refurbished home kit should survive a realistic session without errors, slipping belts or sticky resistance.',
        'Photograph cosmetic flaws agreed in the listing so expectations match at handover.',
        'Test fold, unfold and storage if space drove your purchase.',
        'For remote buys, video call inspection beats trust alone — ask the seller to change adjustable dumbbells through the range on camera.',
        'Confirm handover on Equipd only when satisfied. Buyer Protection follows confirmation on eligible purchases.',
      ],
    },
    {
      id: 'valuation',
      heading: 'Using valuation to judge refurbished home pricing',
      paragraphs: [
        'Valuation on Equipd anchors ordinary used pricing for many named home models. Refurbished or ex-display should be explainably above that line.',
        'If refurbished price nears new retail during a sale event, compare new warranty and returns policy — sometimes new wins on total value.',
        'Bundle completeness affects value. A refurbished multi gym with all attachments worth more than body-only pricing suggests.',
        'Local collection saves money that improves the maths on slightly higher refurbished asks nearby.',
        'Sellers should value before listing — buyers searching refurbished home gym equipment compare aggressively against ordinary used stock on the same page.',
      ],
    },
  ],
  faqNote: 'Common questions',
  faqIntro:
    'Answers on refurbished home gym equipment, ex-display buying, warranties, valuations and Buyer Protection on Equipd.',
  faqItems: [
    {
      question: 'What is refurbished home gym equipment?',
      answer:
        'Refurbished home gym equipment is home-rated fitness kit that has been inspected, cleaned, serviced or sold as ex-display before resale. The scope varies — from a retailer return check to replaced belts and cables. Always ask what work was completed.',
    },
    {
      question: 'Is refurbished home gym equipment worth it?',
      answer:
        'Often yes if you want more confidence than a casual used listing without paying new retail. Compare the refurbished ask against Equipd valuation and similar ordinary used listings for the same model, and weigh any warranty included.',
    },
    {
      question: 'What is the difference between ex-display and refurbished?',
      answer:
        'Ex-display was a shop floor model with usually minimal use but possible cosmetic marks. Refurbished implies intentional service work, though retailers sometimes use both terms loosely. Read the description and ask what was tested or replaced.',
    },
    {
      question: 'Does refurbished home equipment come with a warranty?',
      answer:
        'Sometimes — retailer ex-display may include a limited shop or manufacturer warranty; private sellers often offer none. Get terms in writing. Equipd Buyer Protection is separate and covers eligible listing discrepancies after handover.',
    },
    {
      question: 'Why are refurbished home listings sometimes sparse?',
      answer:
        'Sellers do not always use the refurbished keyword even when kit was serviced or is ex-display. Browse home categories and read condition notes if search results are quiet today.',
    },
    {
      question: 'Can I buy refurbished treadmills for upstairs flats?',
      answer:
        'You can, but refurbishment does not remove impact noise from running. Consider bikes or rowers if neighbours are sensitive, use matting and test noise after delivery — regardless of refurbished status.',
    },
    {
      question: 'Are refurbished adjustable dumbbells reliable?',
      answer:
        'They can be if every weight setting locks correctly and trays or docks are included. Test all increments in person or on video before handover — missing parts on proprietary systems are expensive.',
    },
    {
      question: 'How much cheaper is refurbished than new?',
      answer:
        'Savings vary by brand, model and condition. Ex-display during retail events may sit closer to new; specialist-serviced used kit typically lands between ordinary used and retail. Valuation and live listing comparison beat rules of thumb.',
    },
    {
      question: 'Which home brands appear in refurbished listings?',
      answer:
        'NordicTrack, ProForm, Bowflex, Horizon, Schwinn, Sole, Concept2 and Nautilus appear often because they dominate home retail and ex-display clearance. Match brand to the product type you need.',
    },
    {
      question: 'Should I still test refurbished home equipment?',
      answer:
        'Yes. Run your intended workout, check fold mechanisms, resistance, consoles and completeness of accessories before confirming handover on Equipd.',
    },
    {
      question: 'How does Buyer Protection work on refurbished home purchases?',
      answer:
        'Pay through Equipd and confirm handover after inspection. Eligible purchases include Buyer Protection if equipment is significantly different from the listing. Seller warranties are additional promises documented between you and the seller.',
    },
    {
      question: 'Can I sell ex-display or serviced home gym kit on Equipd?',
      answer:
        'Yes. Describe service work or ex-display status clearly, value the model first, and photograph cosmetic marks honestly. Transparent refurbished listings attract buyers who want more certainty than raw used.',
    },
  ],
  midCtaHeading: 'Ready to browse refurbished home gym equipment?',
  midCtaLead:
    'See live refurbished home listings — or browse all home gym equipment if keyword matches are quiet today.',
  midCtaLabel: 'Browse Refurbished Home Gym',
  exploreNote: 'Keep exploring',
  exploreHeading: 'Explore more',
  exploreLead: 'Continue into related home, refurbished and marketplace pages on Equipd.',
  exploreLinks: [
    {
      label: 'Home Gym Equipment',
      description: 'All home-rated fitness kit in one place',
      to: LANDING_PATHS.homeGym,
    },
    {
      label: 'Home Cardio Equipment',
      description: 'Treadmills, bikes and rowers for home',
      to: LANDING_PATHS.homeCardio,
    },
    {
      label: 'Home Strength Equipment',
      description: 'Racks, benches and dumbbells',
      to: LANDING_PATHS.homeStrength,
    },
    {
      label: 'Refurbished Commercial Gym Equipment',
      description: 'Professionally refreshed facility-grade kit',
      to: LANDING_PATHS.refurbishedCommercial,
    },
    {
      label: 'Buy Used Gym Equipment',
      description: 'How buying on Equipd works',
      to: BUY_USED_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Sell Gym Equipment',
      description: 'List ex-display or serviced home kit',
      to: SELL_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Equipment Valuation',
      description: 'Free Instant Valuation tool',
      to: VALUATION_PATH,
    },
  ],
})

export function buildRefurbishedHomeGymEquipmentSeoDocument() {
  return buildCategoryLandingSeoDocument(REFURBISHED_HOME_CONTENT)
}
