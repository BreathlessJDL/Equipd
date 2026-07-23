/**
 * Buy used gym equipment landing page — content, SEO, and structured data.
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
import {
  BROWSE_PATH,
  BRANDS_PATH,
  BUYER_PROTECTION_PATH,
  CREATE_LISTING_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
  WEBPAGE_SCHEMA_KEY,
} from './sellGymEquipmentPage.js'

export const BUY_USED_GYM_EQUIPMENT_PATH = '/buy-used-gym-equipment'
export const HOW_BUYING_WORKS_PATH = '/help/how-buying-works'
export const COLLECTION_ORDERS_PATH = '/help/collection-orders'

export {
  BROWSE_PATH,
  BRANDS_PATH,
  BUYER_PROTECTION_PATH,
  CREATE_LISTING_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
  WEBPAGE_SCHEMA_KEY,
}

export const BUY_USED_GYM_EQUIPMENT_META_TITLE =
  'Buy Used Gym Equipment Across the UK'

export const BUY_USED_GYM_EQUIPMENT_PAGE_TITLE =
  `${BUY_USED_GYM_EQUIPMENT_META_TITLE} | Equipd`

/** Unique buyer-intent snippet — distinct from sell and homepage copy. */
export const BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION =
  'Browse used commercial and home gym equipment for sale across the UK. Search thousands of listings, make offers, pay securely and buy with confidence through Equipd.'

export const BUY_USED_GYM_EQUIPMENT_H1 = 'With Equipd'

/** WebPage JSON-LD headline must match the visible hero H1. */
const BUY_USED_GYM_EQUIPMENT_WEBPAGE_SCHEMA_HEADLINE = BUY_USED_GYM_EQUIPMENT_H1

export const BUY_USED_GYM_EQUIPMENT_EYEBROW = 'Buy with confidence'

export const BUY_USED_GYM_EQUIPMENT_LEAD =
  'Buy used gym equipment from sellers across the UK. Browse commercial and home gym machines, ask questions, make offers and pay securely through Equipd with Buyer Protection.'

export const BUY_HERO_TRUST_ITEMS = Object.freeze([
  'Buyer Protection',
  'Secure payments',
  'Sellers across the UK',
])

export const BUY_HERO_ANNOTATIONS = Object.freeze([
  'Find the right equipment',
  'Chat with sellers and agree a price',
  'Secure payment through Equipd',
  "Protected until you're happy",
])

const JOURNEY_IMAGE_DIR = '/images/buy'
const HERO_IMAGE_DIR = '/buy-used-gym-equipment'

export const BUY_USED_GYM_EQUIPMENT_OG_IMAGE = Object.freeze({
  src: `${HERO_IMAGE_DIR}/buy-used-gym-equipment-og.png`,
  width: 1200,
  height: 630,
  alt: 'Equipd marketplace preview for buying used gym equipment in the UK',
})

/** Right-hand hero artwork — buyer journey collage. */
export const BUY_HERO_ARTWORK = Object.freeze({
  src: `${HERO_IMAGE_DIR}/buy-used-gym-equipment-marketplace.webp`,
  srcPng: `${HERO_IMAGE_DIR}/buy-used-gym-equipment-marketplace.png`,
  width: 1535,
  height: 1024,
  alt: 'Equipd listing, seller chat and Buyer Protection cards for buying used gym equipment',
})

/**
 * Mobile sizes helper retained for documentation / future responsive srcsets.
 * Desktop journey sources now use the full 1536w asset only (no density pick).
 */
export const BUY_JOURNEY_IMAGE_SIZES =
  '(max-width: 767px) 92vw, (max-width: 1199px) 42vw, 22vw'

function buildJourneyImageSet(baseName) {
  return {
    imageSrc: `${JOURNEY_IMAGE_DIR}/${baseName}.webp`,
    imageSrcPng: `${JOURNEY_IMAGE_DIR}/${baseName}.png`,
    imageSrcMobile: `${JOURNEY_IMAGE_DIR}/${baseName}-800.webp`,
    imageSrcMobilePng: `${JOURNEY_IMAGE_DIR}/${baseName}-800.png`,
    imageWidth: 1536,
    imageHeight: 1024,
  }
}

export const BUY_JOURNEY_HEADING = 'How buying on Equipd works'
export const BUY_JOURNEY_LEAD =
  'Find second-hand gym equipment, agree a price, pay securely and collect with Buyer Protection.'

export const BUY_JOURNEY_STEPS = Object.freeze([
  {
    step: 1,
    title: 'Find your equipment',
    description:
      'Search or browse used gym equipment for sale across the UK. Filter by brand, category, location and price to find commercial machines or home gym kit.',
    ...buildJourneyImageSet('step-1'),
    imageAlt:
      'Equipd browse screen showing used gym equipment listings with search and filters',
  },
  {
    step: 2,
    title: 'Agree a price',
    description:
      'Message the seller, ask about condition and make an offer. Agree a price that works for both of you before you pay.',
    ...buildJourneyImageSet('step-2'),
    imageAlt: 'Equipd messaging screen with a buyer offer on a used gym machine',
  },
  {
    step: 3,
    title: 'Secure your purchase',
    description:
      'Pay securely through Equipd with Stripe. Your payment is held safely until you confirm handover, and checkout shows the Buyer Protection fee clearly.',
    ...buildJourneyImageSet('step-3'),
    imageAlt:
      'Equipd secure checkout with item price, Buyer Protection fee and pay securely button',
  },
  {
    step: 4,
    title: 'Collect with confidence',
    description:
      'Collect in person, arrange seller delivery or use a buyer courier. Once you confirm handover, the seller gets paid and your 24-hour Buyer Protection period begins.',
    ...buildJourneyImageSet('step-4'),
    imageAlt:
      'Buyer confirming gym equipment handover on Equipd with QR code and Buyer Protection',
  },
])

export const BUY_VALUATION_EYEBROW = "Not sure what it's worth?"
export const BUY_VALUATION_HEADING = 'Check the value first'
export const BUY_VALUATION_COPY =
  'Get a free market estimate before you buy used gym equipment. Equipd’s valuation tool helps you understand what similar machines may be worth so you can buy with more confidence.'

export const BUY_VALUATION_STEPS = Object.freeze([
  {
    label: 'Search',
    body: 'Find your equipment',
  },
  {
    label: 'Details',
    body: 'Answer a few quick questions',
  },
  {
    label: 'Estimate',
    body: 'See the estimated market value',
  },
  {
    label: 'Buy with confidence',
    body: 'Make a more informed purchase',
    emphasize: true,
  },
])

export const BUY_BENEFITS_HEADING = 'Why buy on Equipd?'

export const BUY_BENEFITS = Object.freeze([
  {
    id: 'buyer-protection',
    title: 'Buyer Protection',
    body: 'Eligible purchases are protected through Equipd after handover, giving you time to raise an issue if something is not right.',
  },
  {
    id: 'secure-payments',
    title: 'Secure payments',
    body: 'Payments are processed securely through Stripe. Funds are managed through Equipd rather than paid directly to the seller.',
  },
  {
    id: 'specialist-marketplace',
    title: 'Specialist marketplace',
    body: 'Equipd is built specifically for commercial and home gym equipment, without the clutter of a general classifieds marketplace.',
  },
])

export const BUY_MID_CTA_HEADING = 'Ready to buy used gym equipment?'
export const BUY_MID_CTA_LEAD =
  'Browse used commercial and home gym equipment listed by independent sellers across the UK.'
export const BUY_MID_CTA_LABEL = 'Browse Equipment Now'

export const BUY_GUIDE_NOTE = 'A practical guide'
export const BUY_GUIDE_HEADING = 'Buying used gym equipment in the UK'
export const BUY_GUIDE_INTRO =
  'If you want to buy used gym equipment in the UK, a specialist marketplace makes the process clearer. Equipd connects buyers with independent sellers of commercial and home gym machines, with on-platform messaging, secure Stripe payments and Buyer Protection on eligible purchases.'

export const BUY_GUIDE_HIGHLIGHTS = Object.freeze([
  'Used commercial and home gym equipment',
  'Secure Stripe payments',
  'Buyer Protection after confirmed handover',
])

export const BUY_GUIDE_PARAGRAPHS = Object.freeze([
  {
    id: 'value',
    text: 'Buying second-hand gym equipment can offer better value than buying new, especially for treadmills, bikes, racks and commercial gym machines that still have years of use left. Age, condition, service history and how easy collection is all affect a fair price.',
  },
  {
    id: 'commercial-home',
    text: 'Commercial gym equipment for sale is often built for heavy facility use, while home gym equipment for sale can be simpler to move and install. Either way, check the brand, model and manufacture year, and ask for clear photos before you offer.',
  },
  {
    id: 'checks',
    text: 'Before you buy used gym machines, ask about wear, missing parts and any service history. For large items, measure doorways, lifts and access routes so collection day is straightforward. Keep the conversation in Equipd messages so it stays with the listing.',
  },
  {
    id: 'fulfilment',
    text: 'Fulfilment can be buyer collection, seller delivery or a buyer-arranged courier. Collection and seller delivery use Equipd’s QR confirmation after you inspect the equipment. Courier sales use collection evidence and delivery confirmation instead. Equipd does not run a nationwide delivery fleet.',
  },
  {
    id: 'marketplace',
    text: 'Equipd is the marketplace, not the seller. Listings are offered by independent sellers across the UK. You pay through Equipd so funds are held until handover is confirmed, then eligible purchases have a 24-hour Buyer Protection period.',
  },
])

export const BUY_GUIDE_LINKS = Object.freeze([
  {
    before: 'Browse live ',
    link: { to: BROWSE_PATH, label: 'used gym equipment listings' },
    after: '.',
  },
  {
    before: 'See current ',
    link: { to: `${BROWSE_PATH}?rating=full_commercial`, label: 'commercial gym equipment for sale' },
    after: '.',
  },
  {
    before: 'Shop ',
    link: { to: `${BROWSE_PATH}?category=treadmill`, label: 'used treadmills' },
    after: ' and other popular categories.',
  },
  {
    before: 'Compare models in ',
    link: { to: BRANDS_PATH, label: 'Equipment Values' },
    after: '.',
  },
  {
    before: 'Check a price with the ',
    link: { to: VALUATION_PATH, label: 'free valuation tool' },
    after: '.',
  },
  {
    before: 'Selling instead? Read how to ',
    link: { to: SELL_GYM_EQUIPMENT_PATH, label: 'sell gym equipment' },
    after: ' on Equipd.',
  },
])

export const BUY_GUIDE_BRAND_LINKS = Object.freeze([
  { label: 'Life Fitness', to: getBrandPagePath('life-fitness') },
  { label: 'Technogym', to: getBrandPagePath('technogym') },
  { label: 'Matrix', to: getBrandPagePath('matrix-fitness') },
  { label: 'Concept2', to: getBrandPagePath('concept2') },
  { label: 'Precor', to: getBrandPagePath('precor') },
  { label: 'Cybex', to: getBrandPagePath('cybex') },
])

export const BUY_FAQ_NOTE = 'Common questions'
export const BUY_FAQ_INTRO =
  'Answers on Buyer Protection, offers, collection, delivery and how to buy used gym equipment safely on Equipd.'

export const BUY_FAQ_ITEMS = Object.freeze([
  {
    question: 'How does Buyer Protection work?',
    answer:
      'When you pay through Equipd, funds are held securely until handover is confirmed. After confirmed collection or delivery, eligible purchases have a 24-hour Buyer Protection period. If something is significantly wrong, you can raise a case with evidence during that window for Equipd to review.',
  },
  {
    question: 'Can I inspect the equipment before I buy?',
    answer:
      'For collection and seller delivery, you can inspect and test the equipment before confirming handover with Equipd’s QR code. Confirm only when you are satisfied. Courier orders follow a different evidence-based process because you are not present at collection.',
  },
  {
    question: 'Can I make an offer on a listing?',
    answer:
      'Yes. Message the seller on Equipd to ask questions, then make an offer. The seller can accept, decline or reply with a counter offer.',
  },
  {
    question: 'What collection and delivery options are available?',
    answer:
      'Sellers can offer buyer collection, seller delivery or a buyer-arranged courier. Collection and seller delivery use QR confirmation. Courier sales use collection evidence and delivery confirmation. Equipd does not operate a nationwide delivery fleet.',
  },
  {
    question: 'Can I arrange my own courier?',
    answer:
      'Yes, when the listing allows a buyer-arranged courier. You organise collection and delivery. The seller provides handover evidence when the courier collects, and you confirm delivery once the equipment arrives.',
  },
  {
    question: 'How do I buy used commercial gym equipment safely?',
    answer:
      'Use Equipd messaging to confirm condition and access, then pay through Equipd checkout rather than cash or bank transfer. Inspect commercial machines carefully before QR confirmation on collection or seller delivery, and raise any eligible issue during the 24-hour Buyer Protection period if something is wrong after handover.',
  },
  {
    question: 'When does the seller receive payment?',
    answer:
      'Payment is held by Equipd until handover is confirmed. After confirmation, the 24-hour Buyer Protection period runs. If no eligible issue is raised, the order moves toward completion and the seller payout is released through Stripe.',
  },
  {
    question: 'What should I check before buying used gym equipment?',
    answer:
      'Confirm the brand, model, age and condition. Ask for extra photos or service history if needed, and check access for large machines. Use Equipd messaging so the conversation stays with the listing.',
  },
  {
    question: 'Can I use the valuation tool before buying?',
    answer:
      'Yes. The free valuation tool gives an estimated market value based on similar equipment. It is guidance only, not a guaranteed purchase price or sale price.',
  },
  {
    question: 'Is Equipd the seller of the equipment?',
    answer:
      'No. Equipd is a marketplace. Listings are offered by independent sellers. Equipd provides messaging, secure checkout, handover confirmation and Buyer Protection for eligible purchases.',
  },
  {
    question: 'What happens if there is a problem after handover?',
    answer:
      'Raise a case from your order during the 24-hour Buyer Protection period and provide supporting evidence. Equipd reviews eligible issues case by case. Buyer Protection is not an automatic return policy for a change of mind.',
  },
])

export function buildBuyUsedGymEquipmentOpenGraph() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_OG_IMAGE.src}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
    'og:description': BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
    'og:image': imageUrl,
    'og:image:width': String(BUY_USED_GYM_EQUIPMENT_OG_IMAGE.width),
    'og:image:height': String(BUY_USED_GYM_EQUIPMENT_OG_IMAGE.height),
    'og:image:alt': BUY_USED_GYM_EQUIPMENT_OG_IMAGE.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
    'twitter:description': BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
    'twitter:image': imageUrl,
  }
}

export function buildBuyUsedGymEquipmentBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', item: '/' },
      { name: 'Buy Used Gym Equipment', item: BUY_USED_GYM_EQUIPMENT_PATH },
    ],
    { canonicalUrl: BUY_USED_GYM_EQUIPMENT_PATH },
  )
}

export function buildBuyUsedGymEquipmentWebPageSchema() {
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_PATH}`
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_OG_IMAGE.src}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
    headline: BUY_USED_GYM_EQUIPMENT_WEBPAGE_SCHEMA_HEADLINE,
    description: BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: {
      '@id': `${EQUIPD_SITE_ORIGIN}/#website`,
    },
    about: {
      '@type': 'Thing',
      name: 'Buy used gym equipment',
    },
    significantLink: [
      `${EQUIPD_SITE_ORIGIN}${BROWSE_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${VALUATION_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${BRANDS_PATH}`,
      `${EQUIPD_SITE_ORIGIN}${SELL_GYM_EQUIPMENT_PATH}`,
    ],
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: BUY_USED_GYM_EQUIPMENT_OG_IMAGE.width,
      height: BUY_USED_GYM_EQUIPMENT_OG_IMAGE.height,
    },
    image: [imageUrl],
    publisher: {
      '@id': EQUIPD_ORGANIZATION_ID,
    },
  }
}

export function buildBuyUsedGymEquipmentFaqSchema() {
  return buildFaqPageSchemaNode([...BUY_FAQ_ITEMS], {
    canonicalUrl: BUY_USED_GYM_EQUIPMENT_PATH,
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
  const highlights = BUY_GUIDE_HIGHLIGHTS.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  const paragraphs = BUY_GUIDE_PARAGRAPHS.map(
    (entry) => `<p>${escapeHtml(entry.text)}</p>`,
  ).join('\n    ')
  const links = BUY_GUIDE_LINKS.map(
    (item) =>
      `<li>${escapeHtml(item.before)}<a href="${escapeHtml(item.link.to)}">${escapeHtml(item.link.label)}</a>${escapeHtml(item.after)}</li>`,
  ).join('')
  const brands = BUY_GUIDE_BRAND_LINKS.map(
    (brand) => `<a href="${escapeHtml(brand.to)}">${escapeHtml(brand.label)}</a>`,
  ).join(' · ')

  return `<section aria-labelledby="seo-buy-guide-heading">
    <p>${escapeHtml(BUY_GUIDE_NOTE)}</p>
    <h2 id="seo-buy-guide-heading">${escapeHtml(BUY_GUIDE_HEADING)}</h2>
    <p>${escapeHtml(BUY_GUIDE_INTRO)}</p>
    <ul>${highlights}</ul>
    ${paragraphs}
    <ul>${links}</ul>
    <p>Popular brands: ${brands}</p>
  </section>`
}

/**
 * Build SEO document for build-time prerender (/buy-used-gym-equipment/index.html).
 */
export function buildBuyUsedGymEquipmentSeoDocument() {
  const journeyItems = BUY_JOURNEY_STEPS.map(
    (step) => `<li>
      <h3>${escapeHtml(String(step.step))}. ${escapeHtml(step.title)}</h3>
      <picture>
        <source media="(max-width: 767px)" type="image/webp" srcset="${escapeHtml(step.imageSrcMobile)}" />
        <source media="(max-width: 767px)" type="image/png" srcset="${escapeHtml(step.imageSrcMobilePng)}" />
        <source media="(min-width: 768px)" type="image/webp" srcset="${escapeHtml(step.imageSrc)}" />
        <source media="(min-width: 768px)" type="image/png" srcset="${escapeHtml(step.imageSrcPng)}" />
        <img
          src="${escapeHtml(step.imageSrcPng)}"
          alt="${escapeHtml(step.imageAlt)}"
          width="${step.imageWidth}"
          height="${step.imageHeight}"
          loading="lazy"
          decoding="async"
        />
      </picture>
      <p>${escapeHtml(step.description)}</p>
    </li>`,
  ).join('\n      ')

  const benefitItems = BUY_BENEFITS.map(
    (item) => `<li><strong>${escapeHtml(item.title)}</strong> ${escapeHtml(item.body)}</li>`,
  ).join('\n      ')

  const valuationSteps = BUY_VALUATION_STEPS.map(
    (step) => `<li><strong>${escapeHtml(step.label)}</strong> ${escapeHtml(step.body)}</li>`,
  ).join('')

  const bodyHtml = `
<article class="seo-prerender buy-used-gym-equipment-seo">
  <nav aria-label="Breadcrumb"><p><a href="/">Home</a> <span aria-hidden="true">/</span> Buy Used Gym Equipment</p></nav>
  <header>
    <p>${escapeHtml(BUY_USED_GYM_EQUIPMENT_EYEBROW)}</p>
    <h1>${escapeHtml(BUY_USED_GYM_EQUIPMENT_H1)}</h1>
    <p>${escapeHtml(BUY_USED_GYM_EQUIPMENT_LEAD)}</p>
    <p><a href="${BROWSE_PATH}">Browse Equipment</a> · <a href="${VALUATION_PATH}">Get a Free Valuation</a></p>
    <ul>${BUY_HERO_TRUST_ITEMS.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </header>
  <section aria-labelledby="seo-buy-journey-heading">
    <h2 id="seo-buy-journey-heading">${escapeHtml(BUY_JOURNEY_HEADING)}</h2>
    <p>${escapeHtml(BUY_JOURNEY_LEAD)}</p>
    <ol>${journeyItems}</ol>
  </section>
  <section aria-labelledby="seo-buy-valuation-heading">
    <p>${escapeHtml(BUY_VALUATION_EYEBROW)}</p>
    <h2 id="seo-buy-valuation-heading">${escapeHtml(BUY_VALUATION_HEADING)}</h2>
    <p>${escapeHtml(BUY_VALUATION_COPY)}</p>
    <ol>${valuationSteps}</ol>
    <p><a href="${VALUATION_PATH}">Get a Free Valuation</a> · <a href="${BROWSE_PATH}">Browse Equipment</a></p>
  </section>
  <section aria-labelledby="seo-buy-benefits-heading">
    <h2 id="seo-buy-benefits-heading">${escapeHtml(BUY_BENEFITS_HEADING)}</h2>
    <ul>${benefitItems}</ul>
  </section>
  <section aria-labelledby="seo-buy-mid-cta-heading">
    <h2 id="seo-buy-mid-cta-heading">${escapeHtml(BUY_MID_CTA_HEADING)}</h2>
    <p>${escapeHtml(BUY_MID_CTA_LEAD)}</p>
    <p><a href="${BROWSE_PATH}">${escapeHtml(BUY_MID_CTA_LABEL)}</a></p>
  </section>
  ${renderGuideSectionHtml()}
  <section aria-labelledby="seo-buy-faq-heading">
    <h2 id="seo-buy-faq-heading">Frequently asked questions</h2>
    <p>${escapeHtml(BUY_FAQ_NOTE)}</p>
    <p>${escapeHtml(BUY_FAQ_INTRO)}</p>
    ${renderFaqSectionHtml(BUY_FAQ_ITEMS)}
  </section>
</article>`.trim()

  return {
    path: BUY_USED_GYM_EQUIPMENT_PATH,
    title: BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
    description: BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: BUY_USED_GYM_EQUIPMENT_PATH,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildBuyUsedGymEquipmentOpenGraph(),
    headLinks: [
      {
        rel: 'preload',
        as: 'image',
        href: BUY_HERO_ARTWORK.src,
        type: 'image/webp',
        media: '(min-width: 768px)',
        fetchPriority: 'high',
      },
    ],
    jsonLd: [
      buildBuyUsedGymEquipmentWebPageSchema(),
      buildBuyUsedGymEquipmentBreadcrumbSchema(),
      buildBuyUsedGymEquipmentFaqSchema(),
    ].filter(Boolean),
    bodyHtml,
  }
}

export { renderFaqPageScriptTag, SITE_SCHEMA_ATTR }
