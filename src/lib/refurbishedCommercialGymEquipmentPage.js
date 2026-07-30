/**
 * Refurbished Commercial Gym Equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by CategoryLandingPage and build-time prerender.
 */

import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { SELL_GYM_EQUIPMENT_PATH, VALUATION_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { BUY_USED_GYM_EQUIPMENT_PATH, BUY_USED_GYM_EQUIPMENT_OG_IMAGE } from './buyUsedGymEquipmentPage.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { buildCategoryLandingSeoDocument } from './categoryLandingSeo.js'

export const REFURBISHED_COMMERCIAL_GYM_EQUIPMENT_PATH = LANDING_PATHS.refurbishedCommercial

export const REFURBISHED_COMMERCIAL_BROWSE_PATH = buildBrowseNavPath({
  rating: 'full_commercial',
  search: 'refurbished',
})

export const REFURBISHED_COMMERCIAL_CONTENT = Object.freeze({
  idPrefix: 'refurbished-commercial',
  prerenderId: 'refurbished-commercial-gym-equipment',
  path: REFURBISHED_COMMERCIAL_GYM_EQUIPMENT_PATH,
  metaTitle: 'Refurbished Commercial Gym Equipment for Sale | Equipd',
  pageTitle: 'Refurbished Commercial Gym Equipment for Sale | Equipd',
  metaDescription:
    'Browse refurbished commercial gym equipment from UK dealers and sellers — professionally serviced cardio and strength kit with facility-grade spec at lower cost. Buy securely on Equipd.',
  ogImage: {
    ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
    alt: 'Equipd marketplace for refurbished commercial gym equipment in the UK',
  },
  breadcrumbs: [
    { name: 'Commercial Gym Equipment', item: LANDING_PATHS.commercialGym },
    { name: 'Refurbished Commercial Gym Equipment', item: REFURBISHED_COMMERCIAL_GYM_EQUIPMENT_PATH },
  ],
  schemaAbout: 'Refurbished commercial gym equipment',
  significantLinks: [
    LANDING_PATHS.commercialGym,
    LANDING_PATHS.commercialCardio,
    LANDING_PATHS.commercialStrength,
    LANDING_PATHS.refurbishedHome,
    REFURBISHED_COMMERCIAL_BROWSE_PATH,
    BUY_USED_GYM_EQUIPMENT_PATH,
    SELL_GYM_EQUIPMENT_PATH,
    VALUATION_PATH,
    BRANDS_PATH,
  ],
  eyebrow: 'Facility-grade, professionally refreshed',
  h1: 'Refurbished Commercial Gym Equipment',
  lead:
    'Browse refurbished commercial gym equipment from dealers and sellers across the UK on Equipd — professionally serviced treadmills, bikes, strength machines and functional kit with facility-grade specification at lower cost than new, plus free valuation and Buyer Protection on eligible purchases.',
  primaryCta: { to: REFURBISHED_COMMERCIAL_BROWSE_PATH, label: 'Browse Refurbished Commercial' },
  secondaryCta: { to: VALUATION_PATH, label: 'Value Your Equipment' },
  searchLabel: 'Search refurbished commercial equipment',
  heroTrustItems: ['Buyer Protection', 'Secure payments', 'Dealer and gym stock'],
  listingFilter: { rating: 'full_commercial', search: 'refurbished' },
  browsePath: REFURBISHED_COMMERCIAL_BROWSE_PATH,
  listingsNote: 'Live marketplace',
  listingsHeading: 'Latest Refurbished Commercial Listings',
  listingsLead:
    'Live refurbished commercial gym equipment on Equipd — dealer stock and professionally refreshed machines from sellers across the UK.',
  listingsCta: 'Browse all refurbished commercial',
  listingsEmpty:
    'Few listings match the refurbished keyword right now — that is normal on a live marketplace. Browse all commercial equipment to see dealer stock, ex-gym kit and as-seen listings you can still service locally.',
  categoryNote: 'Browse by type',
  categoryHeading: 'Browse refurbished commercial equipment by category',
  categoryLead:
    'Explore facility-grade cardio and strength by category — many dealers list refurbished treadmills, bikes, pin-loaded machines and functional trainers even when the keyword search is quiet.',
  categories: [
    {
      id: 'treadmills',
      label: 'Refurbished Treadmills',
      description: 'Serviced running decks and consoles',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'treadmill', search: 'refurbished' }),
    },
    {
      id: 'bikes',
      label: 'Refurbished Exercise Bikes',
      description: 'Upright and recumbent commercial bikes',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'upright-bikes', search: 'refurbished' }),
    },
    {
      id: 'cross-trainers',
      label: 'Refurbished Cross Trainers',
      description: 'Ellipticals refreshed for facility use',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'crosstrainers', search: 'refurbished' }),
    },
    {
      id: 'pin-loaded',
      label: 'Refurbished Pin-Loaded Machines',
      description: 'Selectorised strength stations serviced',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'pin-loaded-machine', search: 'refurbished' }),
    },
    {
      id: 'plate-loaded',
      label: 'Refurbished Plate-Loaded Machines',
      description: 'Hammer-style lines cleaned and tested',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'plate-loaded-machine' }),
    },
    {
      id: 'functional',
      label: 'Refurbished Functional Trainers',
      description: 'Cable stations rewired and tested',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'functional', search: 'refurbished' }),
    },
    {
      id: 'rowers',
      label: 'Refurbished Rowers',
      description: 'Commercial rowing machines serviced',
      to: buildBrowseNavPath({ rating: 'full_commercial', categorySlug: 'rowers' }),
    },
    {
      id: 'all-commercial',
      label: 'All Commercial Equipment',
      description: 'Full commercial browse including dealer stock',
      to: buildBrowseNavPath({ rating: 'full_commercial' }),
    },
  ],
  brandNote: 'Trusted manufacturers',
  brandHeading: 'Shop by brand',
  brandLead:
    'Explore refurbished commercial equipment from the brands dealers and facilities refresh most often — with parts support that keeps refurbished kit viable long term.',
  featuredBrandSlugs: [
    'life-fitness',
    'technogym',
    'matrix-fitness',
    'precor',
    'cybex',
    'hammer-strength',
    'stairmaster',
    'concept2',
  ],
  benefitsHeading: 'Why buy refurbished commercial on Equipd?',
  benefits: [
    {
      id: 'savings',
      title: 'Facility spec at lower cost than new',
      body: 'Refurbished commercial kit typically sits between as-seen used and new list price — you get major-brand machines with replaced consumables and testing without paying full retail.',
    },
    {
      id: 'dealers',
      title: 'Dealer and refurbisher stock in one place',
      body: 'Equipd lists dealer inventory alongside gym closures and private sellers, so you can compare refurbished treadmills, bikes and strength stations without ringing every refurbisher separately.',
    },
    {
      id: 'buyer-protection',
      title: 'Buyer Protection',
      body: 'Eligible purchases are protected after confirmed handover, giving your organisation time to raise an issue if equipment is significantly different from the listing.',
    },
    {
      id: 'valuation',
      title: 'Secure payment and free valuation',
      body: 'Pay through Equipd with Stripe rather than unprotected transfers, and use the free valuation tool to sense-check refurbished pricing against as-seen alternatives before you commit.',
    },
  ],
  valuationEyebrow: 'Selling refurbished commercial kit?',
  valuationHeading: 'Value commercial equipment before you list',
  valuationCopy:
    'Whether you sell as refurbished or as-seen ex-gym stock, start with a free market estimate on Equipd. Buyers compare refurbished asks against wider commercial listings — anchoring your price to the model and condition keeps deals moving.',
  valuationSteps: [
    { label: 'Search', body: 'Find the machine model' },
    { label: 'Details', body: 'Work done and warranty' },
    { label: 'Estimate', body: 'See the market range' },
    { label: 'Decide', body: 'Price and list', emphasize: true },
  ],
  guideNote: 'Buying guide',
  guideHeading: 'Refurbished commercial gym equipment buying guide',
  guideIntro:
    'Refurbished commercial equipment promises facility-grade specification with lower risk than buying ex-gym kit as seen — but the word is not regulated, and two refurbishments can mean very different things. This guide explains what professional refurbishment usually includes, how to compare dealer warranties, when refurbished beats as-seen, what to ask about parts and labour, how Equipd Buyer Protection fits dealer sales, and how to use valuations to judge whether the premium over raw used stock is justified for your club, hotel or studio.',
  guideSections: [
    {
      id: 'what-refurbished-means',
      heading: 'What refurbished commercial equipment actually means',
      paragraphs: [
        'On the used market, refurbished usually means a technician has inspected the machine, replaced worn consumables, repaired known faults, cleaned the unit and tested it before sale. It should arrive ready to install — not as a project.',
        'The detail matters because refurbishment is not a legal standard. One seller replaces belts, decks, cables and upholstery; another wipes down an ex-gym treadmill and calls it refurbished. Always ask for a written list of work completed.',
        'Dealer refurbishments often include cosmetic refresh — new shrouds, decals or paint — while gym-as-seen sales rarely do. Cosmetic work does not replace mechanical service but improves member perception on a visible floor.',
        'Some dealers grade stock — Grade A, B or similar — with different warranty lengths. Understand the grade before you compare prices between listings.',
        'On Equipd, read descriptions carefully and ask follow-up questions in messages. Good refurbishers welcome specific enquiries; vague answers on a premium-priced listing are a warning sign.',
      ],
    },
    {
      id: 'refurbished-vs-used',
      heading: 'Refurbished versus as-seen ex-gym equipment',
      paragraphs: [
        'As-seen ex-gym kit is usually cheaper upfront. You inherit whatever hours and wear the machine accumulated, minus whatever the seller fixed to make it sellable. It suits buyers with in-house maintenance or a trusted engineer on call.',
        'Refurbished costs more because someone else absorbed parts and labour. You pay for reduced downtime risk — valuable when opening on a deadline or replacing a failed unit on a busy floor.',
        'Break-even depends on what the as-seen machine would have needed anyway. If you would have replaced the deck and belts immediately, refurbished pricing that includes that work may be rational even at a higher sticker price.',
        'Compare like for like on brand, model generation and remaining warranty. A refurbished older console generation may be worse value than a younger as-seen unit with low hours.',
        'Equipd lets you browse refurbished keyword matches and wider commercial stock side by side — use both views before you decide.',
      ],
    },
    {
      id: 'warranty-expectations',
      heading: 'Warranty and after-sales support',
      paragraphs: [
        'Dealer refurbished stock often includes a limited labour or parts warranty — commonly 30 to 90 days, sometimes longer on major components. Private sellers may offer none. Get warranty terms in writing before payment.',
        'Understand what voids coverage: self-moving the machine, using non-approved engineers or operating outside commercial environment may exclude claims. Read the fine print if your insurer or landlord also imposes conditions.',
        'Ask who honours the warranty — the refurbisher, an third-party service partner or the seller only. National dealers sometimes cover multiple sites; small refurbishers may be local.',
        'Warranty is not a substitute for inspection. It covers unexpected failure after install; it does not excuse skipping a pre-handover test because someone promised 60 days cover.',
        'Keep service records from day one. They support warranty claims and help if you sell the machine later as maintained stock.',
      ],
    },
    {
      id: 'cardio-refurb',
      heading: 'Refurbished commercial cardio checks',
      paragraphs: [
        'On treadmills, confirm deck and belt replacement dates, motor testing and console function. Refurbished should mean consumables addressed, not merely polished.',
        'On bikes and cross trainers, ask about bearings, drive belts, ramps and resistance mechanisms. Cardio refurb quality shows up under load more than at idle.',
        'Hours readings still matter after refurbishment. Lower hours on a serviced unit is ideal; high hours with full consumable replacement can still be fine if documented.',
        'Entertainment consoles remain the weak point. Confirm streaming, TV or app features still work if you pay for them — refurbished mechanicals with a failing screen are a poor member experience.',
        'Run the machine as members will — several minutes at working speed, not a token switch-on in a warehouse.',
      ],
    },
    {
      id: 'strength-refurb',
      heading: 'Refurbished commercial strength checks',
      paragraphs: [
        'On pin-loaded machines, stacks should travel smoothly with cables and guide rods serviced. Ask whether stack liners, cables and upholstery were replaced or merely adjusted.',
        'Plate-loaded units need bearing and pivot inspection. Refurbished should address play in moving arms and foot plates, not just paint.',
        'Functional trainers need full cable runs checked at every height setting. Dealers often reterminate cables — confirm routing matches manufacturer guidance.',
        'Frames should be structurally sound. Refurbishment rarely fixes a bent main frame; walk away from structural damage regardless of cosmetic refresh.',
        'Missing attachments reduce value. Confirm handles, pegs and cams are included or priced separately before you compare refurbished asks.',
      ],
    },
    {
      id: 'dealer-vs-private',
      heading: 'Buying from dealers versus private refurbishers',
      paragraphs: [
        'Established dealers offer volume, consistent grading, delivery options and warranty infrastructure. They may cost more but reduce uncertainty for multi-site operators and first-time used buyers.',
        'Private refurbishers — ex-engineers, small gym owners — can offer sharp pricing on one-off pieces. Due diligence matters more: inspect thoroughly and verify what was actually done.',
        'Dealer stock sometimes includes trade-ins not yet listed with full detail. Message sellers if you need a specific configuration; inventory turns quickly in refurbishment businesses.',
        'Equipd is a marketplace, not the refurbisher. Payment and Buyer Protection apply to eligible transactions; warranty promises are between you and the seller — document them on-platform.',
        'Compare dealer refurbished pricing to Equipd valuation ranges for the same model in as-seen condition to see whether the premium is proportionate.',
      ],
    },
    {
      id: 'logistics',
      heading: 'Delivery, installation and lead times',
      paragraphs: [
        'Dealers often offer delivery and install as an add-on — agree scope and price before you pay. Half-installed cardio causes disputes nobody wants.',
        'Lead times vary. Popular refurbished treadmills sell quickly; bespoke strength lines may wait on parts. Confirm availability and expected dispatch date for project planning.',
        'Site access rules apply whether kit is new or refurbished. Measure routes and confirm power before the lorry arrives.',
        'For buyer collection, inspect in the dealer warehouse with time to test properly. Warehouse lighting hides little if you run the machine properly.',
        'Confirm handover through Equipd once satisfied on eligible purchases — it triggers Buyer Protection and completes the payment workflow cleanly.',
      ],
    },
    {
      id: 'inspect',
      heading: 'Inspect and document before handover',
      paragraphs: [
        'Refurbished should reduce risk, not eliminate inspection. Test every function, photograph serial numbers and note cosmetic flaws that remain after refresh.',
        'Compare the machine against the written refurbishment list. If promised work is missing, resolve it before confirmation — not after.',
        'Ask for test reports or checklists if the dealer produces them. They support warranty claims and internal asset records.',
        'For remote purchases with dealer delivery, agree what happens if the machine fails on first member use — some dealers will return; others warranty only.',
        'Only confirm handover when the unit meets the agreed specification. Buyer Protection covers eligible significant discrepancies after confirmation, not buyer remorse on a fairly described B-grade cosmetic finish.',
      ],
    },
    {
      id: 'valuation',
      heading: 'Using valuation to judge refurbished pricing',
      paragraphs: [
        'Start with Equipd valuation on the base model in typical used condition. Refurbished should sit above that range by a clear, explainable margin reflecting parts and labour.',
        'If refurbished pricing approaches new list for an old generation, pause. You may be better served by newer as-seen stock or a different model entirely.',
        'Include delivery, install and any extended warranty in your total comparison. A slightly higher machine price with included delivery can beat a cheaper unit you must move yourself.',
        'Sellers listing refurbished stock should value first too — overpriced refurbished units sit while as-seen alternatives sell around them.',
        'When keyword search is quiet, browse all commercial equipment and filter by seller type in messages. Not every dealer tags listings refurbished even when the work was done.',
      ],
    },
  ],
  faqNote: 'Common questions',
  faqIntro:
    'Answers on refurbished commercial gym equipment, warranties, dealer buying, valuations and Buyer Protection on Equipd.',
  faqItems: [
    {
      question: 'What is refurbished commercial gym equipment?',
      answer:
        'Refurbished commercial gym equipment is facility-grade kit that has been professionally inspected, serviced and often cosmetically refreshed before resale — typically with replaced consumables such as belts, cables or upholstery and functional testing. The exact work varies by seller, so always ask for details.',
    },
    {
      question: 'Is refurbished commercial equipment worth the extra cost?',
      answer:
        'It often is for operators without in-house maintenance, because you pay for reduced downtime and documented work. If you have engineers available, as-seen ex-gym kit can be cheaper overall. Compare refurbished asks against Equipd valuations and similar as-seen listings for the same model.',
    },
    {
      question: 'What warranty comes with refurbished commercial equipment?',
      answer:
        'Warranty varies by dealer — common terms are 30 to 90 days on parts or labour, sometimes longer on major components. Private sellers may offer none. Get warranty scope, exclusions and who honours it in writing before you pay.',
    },
    {
      question: 'Why are there few refurbished listings on Equipd sometimes?',
      answer:
        'Not every dealer tags stock with the refurbished keyword, and inventory turns quickly. Use category browse and all commercial filters if search is quiet — dealer-maintained kit is often listed with detailed descriptions even without the exact word.',
    },
    {
      question: 'How is refurbished different from used ex-gym equipment?',
      answer:
        'Used ex-gym equipment is sold largely as removed from the facility. Refurbished has had intentional service work before sale. The difference is documentation and labour, not necessarily a different original machine.',
    },
    {
      question: 'Can hotels and studios buy refurbished equipment on Equipd?',
      answer:
        'Yes. Hotels, studios, councils and independent gyms buy refurbished commercial cardio and strength on Equipd when budget and opening timelines matter. Inspect or arrange dealer delivery consistent with your project plan.',
    },
    {
      question: 'What should I ask a refurbisher before buying?',
      answer:
        'Ask for a list of replaced parts, hours or usage history, cosmetic grade, warranty terms, delivery and install scope, and parts availability for future service. Reputable dealers answer specifically.',
    },
    {
      question: 'Does Buyer Protection apply to dealer refurbished purchases?',
      answer:
        'Eligible purchases paid through Equipd include Buyer Protection after confirmed handover if the equipment is significantly different from the listing. Dealer warranties are separate agreements between you and the seller — document both.',
    },
    {
      question: 'Which brands are commonly refurbished?',
      answer:
        'Life Fitness, Technogym, Matrix, Precor, Cybex, Hammer Strength, StairMaster and Concept2 appear frequently in commercial refurbishment because parts and engineer familiarity keep total cost of ownership sensible.',
    },
    {
      question: 'Should I still inspect refurbished equipment?',
      answer:
        'Yes. Refurbished reduces risk but does not remove the need to test consoles, belts, stacks and frames under load before handover confirmation. Compare the unit against the seller\'s refurbishment list.',
    },
    {
      question: 'Can refurbishers sell on Equipd?',
      answer:
        'Yes. Dealers and refurbishers list commercial stock, describe work completed, and take payment through Equipd. Clear refurbishment notes and honest grading help the right buyers find your inventory.',
    },
    {
      question: 'How do I price refurbished equipment as a seller?',
      answer:
        'Value the base model on Equipd, then add a justified premium for documented parts and labour. If your ask exceeds nearby as-seen listings by a wide margin without clear work listed, buyers will compare elsewhere.',
    },
  ],
  midCtaHeading: 'Ready to browse refurbished commercial equipment?',
  midCtaLead:
    'See live refurbished commercial listings — and browse wider commercial stock if keyword matches are quiet today.',
  midCtaLabel: 'Browse Refurbished Commercial',
  exploreNote: 'Keep exploring',
  exploreHeading: 'Explore more',
  exploreLead: 'Continue into related commercial, refurbished and marketplace pages on Equipd.',
  exploreLinks: [
    {
      label: 'Commercial Gym Equipment',
      description: 'All facility-grade kit for clubs and studios',
      to: LANDING_PATHS.commercialGym,
    },
    {
      label: 'Commercial Cardio Equipment',
      description: 'Treadmills, bikes and rowers for facilities',
      to: LANDING_PATHS.commercialCardio,
    },
    {
      label: 'Commercial Strength Equipment',
      description: 'Racks, pin-loaded and plate-loaded kit',
      to: LANDING_PATHS.commercialStrength,
    },
    {
      label: 'Refurbished Home Gym Equipment',
      description: 'Professionally refreshed home fitness kit',
      to: LANDING_PATHS.refurbishedHome,
    },
    {
      label: 'Buy Used Gym Equipment',
      description: 'How buying on Equipd works',
      to: BUY_USED_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Sell Gym Equipment',
      description: 'List dealer or ex-gym stock for sale',
      to: SELL_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Equipment Valuation',
      description: 'Free Instant Valuation tool',
      to: VALUATION_PATH,
    },
  ],
})

export function buildRefurbishedCommercialGymEquipmentSeoDocument() {
  return buildCategoryLandingSeoDocument(REFURBISHED_COMMERCIAL_CONTENT)
}
