/**
 * Sell gym equipment landing page — content, SEO, and structured data.
 * Node-safe (no DOM). Shared by the React page and build-time prerender.
 */

import { EQUIPD_SITE_ORIGIN, getBrandPagePath } from './brandCatalogueCore.js'
import { buildBreadcrumbSchema } from './breadcrumbStructuredData.js'
import {
  buildFaqPageSchemaNode,
  normalizeFaqItems,
  renderFaqPageScriptTag,
} from './faqPageStructuredData.js'
import { EQUIPD_ORGANIZATION_ID, SITE_SCHEMA_ATTR } from './siteStructuredData.js'

export const SELL_GYM_EQUIPMENT_PATH = '/sell-gym-equipment'
export const CREATE_LISTING_PATH = '/listings/new'
export const VALUATION_PATH = '/valuation'
export const BROWSE_PATH = '/browse'
export const BRANDS_PATH = '/brands'

export const SELL_GYM_EQUIPMENT_META_TITLE =
  "Sell Gym Equipment | UK's Fitness Equipment Marketplace"

export const SELL_GYM_EQUIPMENT_PAGE_TITLE =
  `${SELL_GYM_EQUIPMENT_META_TITLE} | Equipd`

/** ~152 characters — includes primary keyword, UK, free listing, secure payments, home/commercial. */
export const SELL_GYM_EQUIPMENT_META_DESCRIPTION =
  'Sell gym equipment on Equipd — the UK marketplace for home and commercial fitness equipment. Free listing, secure payments, and reach buyers nationwide.'

export const SELL_GYM_EQUIPMENT_H1 = 'Sell Your Gym Equipment'

export const SELL_GYM_EQUIPMENT_LEAD =
  'List used home or commercial gym equipment in minutes, reach serious buyers across the UK, and get paid securely through Equipd.'

export const SELL_HERO_TRUST_ITEMS = Object.freeze([
  'Free to list',
  'Reach buyers nationwide',
  'Secure payments through Stripe',
])

export const WEBPAGE_SCHEMA_KEY = 'webpage'

const JOURNEY_IMAGE_DIR = '/images/sell'
const HERO_IMAGE_DIR = '/sell-gym-equipment'

/** Right-hand hero artwork — transparent marketplace collage. */
export const SELL_HERO_ARTWORK = Object.freeze({
  src: `${HERO_IMAGE_DIR}/sell-gym-equipment-marketplace.webp`,
  srcPng: `${HERO_IMAGE_DIR}/sell-gym-equipment-marketplace.png`,
  width: 994,
  height: 759,
  alt: 'Sell gym equipment on Equipd: create a listing, accept an offer, confirm handover and get paid securely',
})

function buildJourneyImageSet(baseName) {
  return {
    imageSrc: `${JOURNEY_IMAGE_DIR}/${baseName}.webp`,
    imageSrcPng: `${JOURNEY_IMAGE_DIR}/${baseName}.png`,
    imageSrcMobile: `${JOURNEY_IMAGE_DIR}/${baseName}-800.webp`,
    imageSrcMobilePng: `${JOURNEY_IMAGE_DIR}/${baseName}-800.png`,
    imageWidth: 1600,
    imageHeight: 900,
  }
}

export const SELL_JOURNEY_STEPS = Object.freeze([
  {
    step: 1,
    title: 'Create your listing',
    description: 'Add photos, a clear description and your asking price in a few minutes.',
    ...buildJourneyImageSet('step-1'),
    imageAlt:
      'Sell gym equipment listing form on Equipd with photo uploads, item details and asking price',
  },
  {
    step: 2,
    title: 'Accept an offer',
    description: 'Chat with buyers, review offers and agree the sale when you are ready.',
    ...buildJourneyImageSet('step-2'),
    imageAlt: 'Equipd messaging screen showing a buyer offer on used gym equipment',
  },
  {
    step: 3,
    title: 'Hand over your equipment',
    description:
      'Choose collection, seller delivery or a buyer-arranged courier, then confirm handover securely.',
    ...buildJourneyImageSet('step-3'),
    imageAlt: 'Secure QR handover confirmation for selling gym equipment on Equipd',
  },
  {
    step: 4,
    title: 'Get paid',
    description: 'When the order completes, your payout is released securely through Stripe.',
    ...buildJourneyImageSet('step-4'),
    imageAlt: 'Equipd payout summary showing secure Stripe payment after a gym equipment sale',
  },
])

export const SELL_BENEFITS = Object.freeze([
  {
    title: 'List in minutes',
    body: 'Add photos and a few details to publish your listing for free.',
  },
  {
    title: 'Sell with confidence',
    body: 'Buyer Protection and Stripe payments support the transaction from offer to payout.',
  },
  {
    title: 'Reach the right audience',
    body: 'Equipd is built for home and commercial gym equipment — not general classified clutter.',
  },
])

export const SELL_GUIDE_HEADING = 'Selling gym equipment in the UK'

export const SELL_GUIDE_NOTE = 'A practical guide'

export const SELL_GUIDE_INTRO =
  'If you want to sell gym equipment without the noise of general classifieds, Equipd is a specialist fitness equipment marketplace: free listings, buyers who understand the kit, clear handover options and secure payouts across the UK.'

export const SELL_GUIDE_HIGHLIGHTS = Object.freeze([
  'Free specialist listings',
  'Home and commercial equipment',
  'Secure payments and flexible handover',
])

export const SELL_GUIDE_SECTIONS = Object.freeze([
  {
    id: 'specialist-marketplace',
    title: 'Why use a specialist fitness marketplace?',
    paragraphs: [
      'General platforms attract browsers. A dedicated fitness equipment marketplace attracts people who already know what a commercial treadmill, spinner or plate-loaded machine is worth living with — and what fair used pricing looks like.',
      'That focus usually means better conversations, fewer wasted enquiries and a cleaner path from listing to handover when you sell used gym equipment online. You are not competing with sofas, bikes or random household clutter for attention.',
      'Equipd is built around product context, messaging and protected checkout so both home sellers and facility operators can move kit with less friction.',
    ],
  },
  {
    id: 'home-and-commercial',
    title: 'Home gym and commercial gym equipment',
    paragraphs: [
      'You can sell home gym equipment — treadmills, bikes, racks, free weights and compact strength pieces — when you upgrade, move or clear space. Clear photos of wear points and a realistic asking price help serious buyers decide quickly.',
      'You can also sell commercial gym equipment from studios, hotels and facilities, including cardio fleets and selectorised strength. Buyers on Equipd expect commercial-grade condition notes, service history where you have it, and honest availability for collection.',
      'Whether you are clearing a spare room or refreshing a floor, the same listing flow covers home and commercial kit.',
    ],
    bullets: [
      { before: 'Browse live stock on the ', link: { to: BROWSE_PATH, label: 'marketplace' }, after: '.' },
      {
        before: 'See ',
        link: { to: `${BROWSE_PATH}?rating=full_commercial`, label: 'commercial equipment' },
        after: ' listings buyers already shop.',
      },
      {
        before: 'Scan ',
        link: { to: BROWSE_PATH, label: 'home equipment' },
        after: ' and other fitness categories before you price yours.',
      },
      {
        before: 'Compare model guides and values via ',
        link: { to: VALUATION_PATH, label: 'Equipment Values' },
        after: '.',
      },
    ],
  },
  {
    id: 'brands',
    title: 'Popular brands buyers look for',
    paragraphs: [
      'Serious buyers often filter by brand and series. Accurate model names, serial plates and clear photos help your listing sit next to trusted product guides — and stand out when someone is searching for a specific frame or console.',
      'Major fitness brands regularly attract strong demand on a specialist marketplace. If you are unsure of the exact model, photograph the badge and console so buyers can confirm before they offer.',
    ],
    brandLinks: [
      { label: 'Life Fitness', to: getBrandPagePath('life-fitness') },
      { label: 'Technogym', to: getBrandPagePath('technogym') },
      { label: 'Matrix', to: getBrandPagePath('matrix-fitness') },
      { label: 'Concept2', to: getBrandPagePath('concept2') },
      { label: 'Precor', to: getBrandPagePath('precor') },
      { label: 'Cybex', to: getBrandPagePath('cybex') },
    ],
    paragraphsAfter: [
      'Explore more manufacturers when you need a precise match in the ',
    ],
    brandsDirectory: { to: BRANDS_PATH, label: 'Equipd brands directory' },
  },
  {
    id: 'pricing',
    title: 'Pricing guidance and valuations',
    paragraphs: [
      'Asking price is still your choice. Condition, age, completeness and local collection practicality all move the needle on what buyers will pay for used gym equipment in the UK.',
      'An optional valuation helps you sense-check original RRP, manufacture year and used-market context before you list. Use that guidance to set a confident price — then create your listing. You never need a valuation to sell gym equipment on Equipd.',
      'Well-priced listings with honest condition notes typically attract faster offers than optimistic asking prices that sit for weeks.',
    ],
  },
  {
    id: 'handover-and-payments',
    title: 'Collection, delivery and secure payments',
    paragraphs: [
      'Handover can be buyer collection, seller delivery or a buyer-arranged courier. Collection and seller delivery use Equipd’s QR confirmation flow; courier orders use evidence and delivery confirmation so both sides know when risk transfers.',
      'Payments run through Stripe Connect. When the order completes under Buyer Protection, your payout is released — so selling exercise equipment does not mean chasing cash on the doorstep or relying on informal bank transfers.',
      'Listings are free. When an item sells, Equipd applies a 2% Seller Service Fee deducted from your payout. You see the sale price, fee and amount you receive before you accept.',
    ],
  },
  {
    id: 'vs-general-marketplaces',
    title: 'How Equipd differs from Facebook Marketplace and eBay',
    paragraphs: [
      'Facebook Marketplace and eBay are broad. Equipd is narrower on purpose: fitness-specific listings, structured product context, protected checkout and a seller fee that only applies when you sell.',
      'That focus helps when you want to sell gym machines, commercial cardio or home strength kit without negotiating through scattered messages and unclear payment norms. Buyers come expecting gym equipment — not a general car-boot browse.',
      'If your goal is to sell gym equipment UK-wide with less friction and more trust, a specialist used gym equipment marketplace is usually a clearer route than starting from scratch on a general platform.',
    ],
  },
])

export const SELL_FAQ_NOTE = 'A few quick answers'

export const SELL_FAQ_INTRO =
  'Find answers about listing fees, valuations, payments, collection and selling home or commercial gym equipment.'

export const SELL_FAQ_ITEMS = Object.freeze([
  {
    question: 'How much does it cost to list gym equipment?',
    answer:
      'Creating a listing is free. When an item sells, Equipd applies a 2% Seller Service Fee, which is deducted from your payout before funds are transferred through Stripe.',
  },
  {
    question: 'How do I sell gym equipment on Equipd?',
    answer:
      'Create a free listing with photos, a description and your asking price. When a buyer offers, chat in Equipd messaging, accept the sale, arrange handover, and receive your payout through Stripe once the order completes.',
  },
  {
    question: 'Can I sell commercial gym equipment?',
    answer:
      'Yes. Studios, gyms and facilities can list commercial cardio, strength and functional equipment on Equipd for buyers across the UK.',
  },
  {
    question: 'Can I sell home gym equipment?',
    answer:
      'Yes. Equipd supports home gym equipment as well as commercial kit — including treadmills, bikes, racks, weights and other fitness equipment.',
  },
  {
    question: 'Do I need a valuation before selling?',
    answer:
      'No. You can create a listing immediately. The valuation tool is optional if you want guidance on what your equipment may be worth before choosing an asking price.',
  },
  {
    question: 'How do I receive payment?',
    answer:
      'Payments and seller payouts are processed through Stripe Connect. Funds are released after the order is successfully completed under the current Buyer Protection process.',
  },
  {
    question: 'Can buyers collect equipment?',
    answer:
      'Yes. Equipd supports buyer collection, seller delivery and buyer-arranged courier. Collection and seller delivery use the Equipd QR handover flow.',
  },
  {
    question: 'What brands can I sell?',
    answer:
      'You can list equipment from major fitness brands such as Life Fitness, Technogym, Matrix, Concept2, Precor, Cybex and many others. Accurate brand and model details help serious buyers find your listing.',
  },
  {
    question: 'How long does it take to sell?',
    answer:
      'Timing varies by item, price and demand. Well-photographed listings with clear descriptions and realistic asking prices typically attract interest faster on a specialist marketplace.',
  },
  {
    question: 'What happens when I receive an offer?',
    answer:
      'You can chat with the buyer in Equipd messaging and accept, decline or respond to the offer using the live offer tools.',
  },
  {
    question: 'What is the Seller Service Fee?',
    answer:
      'When your item sells, Equipd deducts a 2% Seller Service Fee from your payout before funds are transferred through Stripe. You will see the sale price, fee and amount you receive before accepting offers.',
  },
  {
    question: 'Can a buyer arrange a courier?',
    answer:
      'Yes. For buyer-arranged courier orders, the buyer organises collection and delivery. The seller provides handover evidence when the courier collects, and the buyer confirms delivery once the equipment arrives.',
  },
])

export function buildSellGymEquipmentOpenGraph() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${SELL_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${SELL_HERO_ARTWORK.srcPng}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': SELL_GYM_EQUIPMENT_PAGE_TITLE,
    'og:description': SELL_GYM_EQUIPMENT_META_DESCRIPTION,
    'og:image': imageUrl,
    'og:image:alt': SELL_HERO_ARTWORK.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': SELL_GYM_EQUIPMENT_PAGE_TITLE,
    'twitter:description': SELL_GYM_EQUIPMENT_META_DESCRIPTION,
    'twitter:image': imageUrl,
  }
}

export function buildSellGymEquipmentBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', item: '/' },
      { name: 'Sell Gym Equipment', item: SELL_GYM_EQUIPMENT_PATH },
    ],
    { canonicalUrl: SELL_GYM_EQUIPMENT_PATH },
  )
}

export function buildSellGymEquipmentWebPageSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${SELL_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${SELL_HERO_ARTWORK.srcPng}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: SELL_GYM_EQUIPMENT_PAGE_TITLE,
    headline: SELL_GYM_EQUIPMENT_H1,
    description: SELL_GYM_EQUIPMENT_META_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: {
      '@id': `${EQUIPD_SITE_ORIGIN}/#website`,
    },
    about: {
      '@type': 'Thing',
      name: 'Sell gym equipment',
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: SELL_HERO_ARTWORK.width,
      height: SELL_HERO_ARTWORK.height,
    },
    image: [imageUrl],
    publisher: {
      '@id': EQUIPD_ORGANIZATION_ID,
    },
  }
}

export function buildSellGymEquipmentFaqSchema() {
  return buildFaqPageSchemaNode([...SELL_FAQ_ITEMS], {
    canonicalUrl: SELL_GYM_EQUIPMENT_PATH,
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
  const highlights = SELL_GUIDE_HIGHLIGHTS.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  const topics = SELL_GUIDE_SECTIONS.map((section, index) => {
    const paras = (section.paragraphs || [])
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('\n      ')
    const bullets = section.bullets?.length
      ? `<ul>${section.bullets
          .map((item) => {
            if (typeof item === 'string') return `<li>${escapeHtml(item)}</li>`
            return `<li>${escapeHtml(item.before)}<a href="${escapeHtml(item.link.to)}">${escapeHtml(item.link.label)}</a>${escapeHtml(item.after)}</li>`
          })
          .join('')}</ul>`
      : ''
    const brands = section.brandLinks?.length
      ? `<p>${section.brandLinks
          .map((b) => `<a href="${escapeHtml(b.to)}">${escapeHtml(b.label)}</a>`)
          .join(' · ')}</p>`
      : ''
    const brandsDir = section.brandsDirectory
      ? `<p>${escapeHtml((section.paragraphsAfter || []).join(' '))}<a href="${escapeHtml(section.brandsDirectory.to)}">${escapeHtml(section.brandsDirectory.label)}</a>.</p>`
      : (section.paragraphsAfter || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('\n      ')
    const openAttr = index === 0 ? ' open' : ''
    return `<details${openAttr}>
      <summary><h3>${escapeHtml(section.title)}</h3></summary>
      <div>
        ${paras}
        ${bullets}
        ${brands}
        ${brandsDir}
      </div>
    </details>`
  }).join('\n    ')

  return `<section aria-labelledby="seo-sell-guide-heading">
    <h2 id="seo-sell-guide-heading">${escapeHtml(SELL_GUIDE_HEADING)}</h2>
    <p>${escapeHtml(SELL_GUIDE_NOTE)}</p>
    <p>${escapeHtml(SELL_GUIDE_INTRO)}</p>
    <ul>${highlights}</ul>
    ${topics}
  </section>`
}

/**
 * Build SEO document for build-time prerender (/sell-gym-equipment/index.html).
 */
export function buildSellGymEquipmentSeoDocument() {
  const journeyItems = SELL_JOURNEY_STEPS.map(
    (step) => `<li>
      <h3>${escapeHtml(String(step.step))}. ${escapeHtml(step.title)}</h3>
      <img
        src="${escapeHtml(step.imageSrc)}"
        alt="${escapeHtml(step.imageAlt)}"
        width="${step.imageWidth}"
        height="${step.imageHeight}"
        loading="lazy"
        decoding="async"
      />
      <p>${escapeHtml(step.description)}</p>
    </li>`,
  ).join('\n      ')

  const benefitItems = SELL_BENEFITS.map(
    (item) => `<li><strong>${escapeHtml(item.title)}</strong> ${escapeHtml(item.body)}</li>`,
  ).join('\n      ')

  const bodyHtml = `
<article class="seo-prerender sell-gym-equipment-seo">
  <nav aria-label="Breadcrumb"><p><a href="/">Home</a> <span aria-hidden="true">/</span> Sell Gym Equipment</p></nav>
  <header>
    <h1>${escapeHtml(SELL_GYM_EQUIPMENT_H1)}</h1>
    <p>${escapeHtml(SELL_GYM_EQUIPMENT_LEAD)}</p>
    <p><a href="${CREATE_LISTING_PATH}">Create a Listing Now</a> · <a href="${VALUATION_PATH}">Get a Valuation</a></p>
    <p>A valuation is optional — you can list your equipment immediately.</p>
  </header>
  <section aria-labelledby="seo-sell-journey-heading">
    <h2 id="seo-sell-journey-heading">How selling on Equipd works</h2>
    <p>List your equipment, agree a sale and get paid securely.</p>
    <ol>${journeyItems}</ol>
  </section>
  <section aria-labelledby="seo-sell-valuation-heading">
    <h2 id="seo-sell-valuation-heading">Want to know what it&apos;s worth first?</h2>
    <p>Get an instant equipment valuation before listing if you would like guidance on your asking price.</p>
    <p><a href="${CREATE_LISTING_PATH}">Create a Listing</a> · <a href="${VALUATION_PATH}">Check Your Equipment Value First</a></p>
    <p>A valuation is optional — you can list your equipment immediately.</p>
  </section>
  <section aria-labelledby="seo-sell-benefits-heading">
    <h2 id="seo-sell-benefits-heading">Why sell on Equipd?</h2>
    <ul>${benefitItems}</ul>
  </section>
  <section aria-labelledby="seo-sell-mid-cta-heading">
    <h2 id="seo-sell-mid-cta-heading">Ready to get started?</h2>
    <p>Create your listing in minutes and start reaching buyers today.</p>
    <p><a href="${CREATE_LISTING_PATH}">Create a Listing Now</a></p>
  </section>
  ${renderGuideSectionHtml()}
  <section aria-labelledby="seo-sell-faq-heading">
    <h2 id="seo-sell-faq-heading">Frequently asked questions</h2>
    <p>${escapeHtml(SELL_FAQ_NOTE)}</p>
    <p>${escapeHtml(SELL_FAQ_INTRO)}</p>
    ${renderFaqSectionHtml(SELL_FAQ_ITEMS)}
  </section>
</article>`.trim()

  return {
    path: SELL_GYM_EQUIPMENT_PATH,
    title: SELL_GYM_EQUIPMENT_PAGE_TITLE,
    description: SELL_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: SELL_GYM_EQUIPMENT_PATH,
    openGraph: buildSellGymEquipmentOpenGraph(),
    // Desktop LCP: hero artwork is hidden below 768px
    headLinks: [
      {
        rel: 'preload',
        as: 'image',
        href: SELL_HERO_ARTWORK.src,
        type: 'image/webp',
        media: '(min-width: 768px)',
        fetchPriority: 'high',
      },
    ],
    jsonLd: [
      buildSellGymEquipmentWebPageSchema(),
      buildSellGymEquipmentBreadcrumbSchema(),
      buildSellGymEquipmentFaqSchema(),
    ].filter(Boolean),
    bodyHtml,
  }
}

function escapeJsonForHtmlScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function renderWebPageScriptTag(schema) {
  if (!schema || schema['@type'] !== 'WebPage') return ''
  return [
    `<script type="application/ld+json" ${SITE_SCHEMA_ATTR}="${WEBPAGE_SCHEMA_KEY}">`,
    escapeJsonForHtmlScript(schema),
    '</script>',
  ].join('')
}

export function syncWebPageSchemaInDocument(doc, schema) {
  if (!doc?.head) return null
  const selector = `script[${SITE_SCHEMA_ATTR}="${WEBPAGE_SCHEMA_KEY}"]`
  const existing = [...doc.head.querySelectorAll(selector)]

  if (!schema) {
    for (const node of existing) node.remove()
    return null
  }

  const expectedId = schema['@id']
  const matching = existing.filter((node) => {
    try {
      const raw = node.textContent || node.text || ''
      return JSON.parse(raw)['@id'] === expectedId && raw === JSON.stringify(schema)
    } catch {
      return false
    }
  })

  if (matching.length === 1 && existing.length === 1) {
    return matching[0]
  }

  for (const node of existing) node.remove()

  const script = doc.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute(SITE_SCHEMA_ATTR, WEBPAGE_SCHEMA_KEY)
  const serialized = JSON.stringify(schema)
  script.text = serialized
  script.textContent = serialized
  doc.head.appendChild(script)
  return script
}

export { renderFaqPageScriptTag }
