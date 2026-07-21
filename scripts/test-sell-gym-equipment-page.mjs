/**
 * Unit checks for /sell-gym-equipment landing page content and SEO.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatPageTitle } from '../src/lib/pageTitles.js'
import {
  buildSellGymEquipmentBreadcrumbSchema,
  buildSellGymEquipmentFaqSchema,
  buildSellGymEquipmentSeoDocument,
  buildSellGymEquipmentWebPageSchema,
  CREATE_LISTING_PATH,
  SELL_FAQ_ITEMS,
  SELL_GUIDE_SECTIONS,
  SELL_GYM_EQUIPMENT_H1,
  SELL_GYM_EQUIPMENT_LEAD,
  SELL_GYM_EQUIPMENT_META_DESCRIPTION,
  SELL_GYM_EQUIPMENT_META_TITLE,
  SELL_GYM_EQUIPMENT_PAGE_TITLE,
  SELL_GYM_EQUIPMENT_PATH,
  SELL_HERO_ARTWORK,
  SELL_HERO_TRUST_ITEMS,
  SELL_JOURNEY_STEPS,
  VALUATION_PATH,
} from '../src/lib/sellGymEquipmentPage.js'
import { injectSeoIntoHtml } from '../src/lib/seoCataloguePrerender.js'
import { normalizeFaqItems } from '../src/lib/faqPageStructuredData.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const doc = buildSellGymEquipmentSeoDocument()

assert(doc.path === SELL_GYM_EQUIPMENT_PATH, 'canonical path')
assert(doc.title === SELL_GYM_EQUIPMENT_PAGE_TITLE, 'document title')
assert(doc.description === SELL_GYM_EQUIPMENT_META_DESCRIPTION, 'meta description')
assert(doc.canonicalPath === '/sell-gym-equipment', 'canonical path field')
assert(doc.openGraph?.['og:title'] === SELL_GYM_EQUIPMENT_PAGE_TITLE, 'open graph title')
assert(doc.openGraph?.['og:image']?.includes('sell-gym-equipment-marketplace'), 'open graph image')
assert(doc.bodyHtml.includes(`<h1>${SELL_GYM_EQUIPMENT_H1}</h1>`), 'single H1 in prerender body')
assert((doc.bodyHtml.match(/<h1/g) || []).length === 1, 'only one H1 in prerender body')
assert(
  doc.bodyHtml.indexOf('seo-sell-mid-cta-heading') < doc.bodyHtml.indexOf('seo-sell-guide-heading'),
  'prerender CTA before guide',
)
assert(
  doc.bodyHtml.indexOf('seo-sell-guide-heading') < doc.bodyHtml.indexOf('seo-sell-faq-heading'),
  'prerender guide before FAQ',
)
assert(doc.bodyHtml.includes('seo-sell-guide-heading'), 'guide section in prerender')
assert(doc.bodyHtml.includes('<details'), 'guide topics are expandable in prerender')
assert(doc.bodyHtml.includes('/brands/life-fitness'), 'brand internal links in prerender')
assert(doc.bodyHtml.includes('A practical guide'), 'guide note in prerender')
assert(doc.bodyHtml.includes('Free specialist listings'), 'guide highlights in prerender')

assert(
  formatPageTitle(SELL_GYM_EQUIPMENT_META_TITLE) === doc.title,
  'React page title matches prerender title',
)

assert(doc.bodyHtml.includes(CREATE_LISTING_PATH), 'create listing link in prerender')
assert(doc.bodyHtml.includes(VALUATION_PATH), 'valuation link in prerender')
assert(!doc.bodyHtml.toLowerCase().includes('buyer protection fee'), 'no buyer fee in prerender')
assert(doc.bodyHtml.includes('2% Seller Service Fee'), 'seller fee in FAQ prerender')

const journeyTitles = SELL_JOURNEY_STEPS.map((step) => step.title)
assert(journeyTitles[0] === 'Create your listing', 'step 1 title')
assert(journeyTitles[1] === 'Accept an offer', 'step 2 title')
assert(journeyTitles[2] === 'Hand over your equipment', 'step 3 title')
assert(journeyTitles[3] === 'Get paid', 'step 4 title')
assert(!journeyTitles.some((title) => /discover|valuation/i.test(title)), 'no non-seller journey steps')

for (const step of SELL_JOURNEY_STEPS) {
  assert(step.imageSrc.startsWith('/images/sell/step-'), `journey image path: ${step.title}`)
  assert(step.imageSrc.endsWith('.webp'), `journey image uses webp: ${step.title}`)
  assert(!step.imageSrc.includes('-800.'), `desktop source is full-res: ${step.title}`)
  assert(step.imageSrcPng?.endsWith('.png'), `png fallback present: ${step.title}`)
  assert(step.imageSrcMobile?.endsWith('-800.webp'), `mobile webp present: ${step.title}`)
  assert(step.imageSrcMobilePng?.endsWith('-800.png'), `mobile png present: ${step.title}`)
  assert(step.imageWidth === 1600 && step.imageHeight === 900, `consistent 16:9 frame: ${step.title}`)
  assert(step.imageAlt, `journey alt text: ${step.title}`)
}

const pageJsx = readFileSync(join(process.cwd(), 'src', 'pages', 'SellGymEquipmentPage.jsx'), 'utf8')
assert(pageJsx.includes('<picture>'), 'journey images use picture element')
assert(pageJsx.includes('type="image/webp"'), 'webp source present')
assert(pageJsx.includes('media="(max-width: 767px)"'), 'mobile-only smaller journey sources')
assert(pageJsx.includes('srcSet={imageSrc}'), 'desktop uses full-resolution webp')
assert(pageJsx.includes('sizes='), 'responsive sizes attribute present')
assert(pageJsx.includes('loading="lazy"'), 'below-fold journey images lazy load')
assert(!pageJsx.includes('imageSrcSet'), 'no density srcset that prefers -800 on desktop')
assert(!pageJsx.toLowerCase().includes('buyer protection fee'), 'no buyer fee on page')
assert(!/Product schema|@type:\s*['"]Product['"]/.test(pageJsx), 'no Product schema on page')

const feeAnswers = SELL_FAQ_ITEMS.filter((item) =>
  /cost to list gym equipment|Seller Service Fee/i.test(item.question))
assert(feeAnswers.length >= 2, 'fee FAQs present')
for (const entry of feeAnswers) {
  assert(entry.answer.includes('2% Seller Service Fee'), `seller fee wording: ${entry.question}`)
  assert(!/buyer protection fee/i.test(entry.answer), `no buyer fee in: ${entry.question}`)
}

assert(SELL_FAQ_ITEMS.length >= 8 && SELL_FAQ_ITEMS.length <= 12, 'FAQ count in target range')
assert(SELL_GUIDE_SECTIONS.length >= 5, 'guide has multiple H3 sections')

const payoutFaq = SELL_FAQ_ITEMS.find((item) => item.question === 'How do I receive payment?')
assert(/Stripe Connect/i.test(payoutFaq?.answer || ''), 'Stripe Connect payout wording')
assert(!/Equipd (manually )?transfer/i.test(payoutFaq?.answer || ''), 'no manual bank transfer claim')

const journeyFiles = [
  'public/images/sell/step-1.webp',
  'public/images/sell/step-1.png',
  'public/images/sell/step-2.webp',
  'public/images/sell/step-2.png',
  'public/images/sell/step-3.webp',
  'public/images/sell/step-3.png',
  'public/images/sell/step-4.webp',
  'public/images/sell/step-4.png',
  'public/images/sell/step-1-800.webp',
  'public/images/sell/step-2-800.webp',
  'public/images/sell/step-3-800.webp',
  'public/images/sell/step-4-800.webp',
]
for (const relativePath of journeyFiles) {
  assert(
    existsSync(join(process.cwd(), relativePath)),
    `journey asset exists: ${relativePath}`,
  )
}

assert(!existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'step-1-create-listing.webp')), 'old step-1 journey webp removed')
assert(!existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'step-2-accept-offer.webp')), 'old step-2 journey webp removed')
assert(!existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'step-3-handover.webp')), 'old step-3 journey webp removed')
assert(!existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'step-4-get-paid.webp')), 'old step-4 journey webp removed')

const webPageSchema = buildSellGymEquipmentWebPageSchema()
assert(webPageSchema['@type'] === 'WebPage', 'WebPage schema type')
assert(webPageSchema.url.endsWith('/sell-gym-equipment'), 'WebPage url')
assert(webPageSchema.primaryImageOfPage?.url, 'WebPage primary image')
assert(webPageSchema.publisher?.['@id']?.includes('#organization'), 'WebPage publisher Organization ref')
assert(webPageSchema.inLanguage === 'en-GB', 'WebPage language')

const breadcrumbSchema = buildSellGymEquipmentBreadcrumbSchema()
assert(breadcrumbSchema['@type'] === 'BreadcrumbList', 'BreadcrumbList schema')
assert(breadcrumbSchema.itemListElement.length === 2, 'breadcrumb has Home + Sell')
assert(breadcrumbSchema.itemListElement[1].name === 'Sell Gym Equipment', 'breadcrumb leaf')

const faqSchema = buildSellGymEquipmentFaqSchema()
assert(faqSchema['@type'] === 'FAQPage', 'FAQPage schema')
assert(faqSchema.mainEntity.length === SELL_FAQ_ITEMS.length, 'FAQ schema count matches content')

const { items: normalizedFaqs } = normalizeFaqItems(SELL_FAQ_ITEMS)
assert(normalizedFaqs.length === SELL_FAQ_ITEMS.length, 'all FAQs eligible for schema')
for (const entry of normalizedFaqs) {
  const visible = SELL_FAQ_ITEMS.find((item) => item.question === entry.question)
  assert(visible?.answer === entry.answer, `FAQ schema matches visible copy: ${entry.question}`)
}

assert(!doc.jsonLd.some((entry) => entry['@type'] === 'Product'), 'no Product schema')

const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')
assert(appSource.includes('path="sell-gym-equipment"'), 'route registered in App.jsx')
assert(appSource.includes('SellGymEquipmentPage'), 'page imported in App.jsx')

const sitemap = readFileSync(join(process.cwd(), 'scripts', 'generate-sitemap.mjs'), 'utf8')
assert(sitemap.includes('/sell-gym-equipment'), 'sitemap generator includes route')

const prerender = readFileSync(join(process.cwd(), 'scripts', 'prerender-seo-catalogue.mjs'), 'utf8')
assert(prerender.includes('buildSellGymEquipmentSeoDocument'), 'prerender includes sell page')

const pageSource = readFileSync(join(process.cwd(), 'src', 'pages', 'SellGymEquipmentPage.jsx'), 'utf8')
assert(
  pageSource.includes('ProtectedLink') && pageSource.includes('to={CREATE_LISTING_PATH}'),
  'primary CTA uses ProtectedLink',
)
assert(pageSource.includes(`to={VALUATION_PATH}`), 'valuation CTA uses valuation route')
assert(pageSource.includes('sell-page__btn--primary'), 'primary create-listing button style present')
assert(pageSource.includes('sell-page__btn--primary-lg'), 'larger mid-page create-listing CTA present')
assert(pageSource.includes('sell-page__mid-cta'), 'create-listing band after benefits present')
assert(pageSource.includes('Ready to get started?'), 'mid-page CTA heading present')
assert(
  pageSource.indexOf('sell-page__mid-cta') < pageSource.indexOf('<SellGuideSection'),
  'Create Listing CTA appears above SEO guide',
)
assert(
  pageSource.indexOf('<SellGuideSection') < pageSource.indexOf('className="sell-page__faq"'),
  'SEO guide appears above FAQ',
)
assert(pageSource.includes('Check Your Equipment Value First'), 'optional valuation is secondary CTA')
assert(!pageSource.includes('sell-page__closing'), 'final closing CTA section removed')
assert(!pageSource.includes('Ready to sell your gym equipment?'), 'closing headline removed')
assert(!pageSource.includes('Create Your Listing Now'), 'closing CTA copy removed')
assert(!pageSource.includes('sell-page__btn--primary-finale'), 'finale CTA size unused')
assert((pageSource.match(/CREATE_LISTING_PATH/g) || []).length >= 3, 'create listing CTAs appear in hero, optional and mid')
assert((pageSource.match(/VALUATION_PATH/g) || []).length >= 2, 'valuation CTAs remain in hero and optional')
assert(pageSource.includes('loading="lazy"'), 'journey images lazy load below the fold')
assert(pageSource.includes('sell-page__guide'), 'long-form guide section present')
assert(pageSource.includes('sell-page__guide-layout'), 'guide split layout present')
assert(pageSource.includes('sell-page__guide-topics'), 'guide expandable topics present')
assert(pageSource.includes('sell-page__guide-topic'), 'guide topic details present')
assert(pageSource.includes('sell-page__handwritten-note'), 'guide handwritten note present')
assert(pageSource.includes('sell-page__guide-highlights'), 'guide highlights present')
assert(pageSource.includes('openTopicId'), 'guide accordion open state present')
assert(
  /function SellGuideSection[\s\S]*?sell-page__visual-rail/.test(pageSource),
  'guide uses visual rail width',
)
assert(!pageSource.includes('reading-rail--guide'), 'guide no longer uses narrow reading rail')
assert(!pageSource.includes('sell-page__guide-grid'), 'old equal two-column guide grid removed')
assert(pageSource.includes('sell-page__step-image'), 'journey image class present')
assert(pageSource.includes('rel = \'preload\'') || pageSource.includes('rel = "preload"') || pageSource.includes("rel: 'preload'") || pageSource.includes('link.rel = \'preload\'') || pageSource.includes('link.rel = "preload"'), 'hero image preload present')
assert(pageSource.includes('openGraph'), 'social meta via openGraph')
assert(pageSource.includes('sell-page__hero-visual'), 'split hero visual present')
assert(pageSource.includes('sell-page__hero-artwork'), 'hero artwork wrapper present')
assert(pageSource.includes('sell-page__hero-artwork-image'), 'hero artwork image present')
assert(pageSource.includes('SELL_HERO_ARTWORK'), 'hero uses custom artwork constant')
assert(pageSource.includes('SELL_HERO_TRUST_ITEMS'), 'hero trust items from shared content')
assert(pageSource.includes('sell-page__valuation-preview'), 'optional valuation preview present')
assert(!pageSource.includes('sell-page__step-hover-preview'), 'large floating hover preview removed')
assert(pageSource.includes('alt={imageAlt}'), 'journey images keep informative alt text')
assert(!pageSource.includes('SellJourneyLightbox'), 'lightbox removed from page')
assert(!pageSource.includes('Expand preview'), 'expand affordance removed')
assert(!pageSource.includes('onExpand'), 'expand handlers removed')
assert(!pageSource.includes('sell-page__step-preview'), 'preview button removed')
assert(!pageSource.includes('hero-equipment'), 'old treadmill hero asset removed from page')
assert(!pageSource.includes('SELL_HERO_IMAGE'), 'old hero image constant unused')
assert(!pageSource.includes('SELL_HERO_COLLAGE_PANELS'), 'layered collage panels removed')
assert(!pageSource.includes('HeroCollage'), 'layered collage component removed')
assert(!/DRIPP/i.test(pageSource), 'no invented DRIPP branding on page')

const contentSource = readFileSync(join(process.cwd(), 'src', 'lib', 'sellGymEquipmentPage.js'), 'utf8')
assert(SELL_HERO_TRUST_ITEMS.join('|') === 'Free to list|Reach buyers nationwide|Secure payments through Stripe', 'hero trust items are the three seller benefits')
assert(!SELL_HERO_TRUST_ITEMS.some((item) => /buyer protection/i.test(item)), 'hero trust does not list Buyer Protection')
assert(SELL_HERO_ARTWORK.src.includes('sell-gym-equipment-marketplace.webp'), 'hero artwork webp path')
assert(SELL_HERO_ARTWORK.srcPng.includes('sell-gym-equipment-marketplace.png'), 'hero artwork png fallback')
assert(/sell gym equipment/i.test(SELL_HERO_ARTWORK.alt), 'hero artwork alt includes primary keyword')
assert(!contentSource.includes('SELL_HERO_IMAGE'), 'old hero image export removed')
assert(!contentSource.includes('SELL_HERO_COLLAGE_PANELS'), 'collage panel export removed')
assert(!contentSource.includes('hero-equipment'), 'old hero equipment paths removed from content')
assert(!contentSource.includes('hero-selling-artwork'), 'opaque hero artwork paths removed')
assert(SELL_GYM_EQUIPMENT_LEAD.includes('get paid securely through Equipd'), 'hero lead copy exported')
assert(SELL_GYM_EQUIPMENT_H1 === 'Sell Your Gym Equipment', 'SEO hero headline')
assert(SELL_GYM_EQUIPMENT_META_DESCRIPTION.length >= 140 && SELL_GYM_EQUIPMENT_META_DESCRIPTION.length <= 165, 'meta description length')

const cssSource = readFileSync(join(process.cwd(), 'src', 'pages', 'SellGymEquipmentPage.css'), 'utf8')
assert(cssSource.includes('sell-page__guide'), 'guide section styles present')
assert(cssSource.includes('sell-page__guide-layout'), 'guide layout styles present')
assert(cssSource.includes('sell-page__guide-topics'), 'guide topics styles present')
assert(/0\.36fr/.test(cssSource) && /0\.64fr/.test(cssSource), 'guide uses asymmetric intro/topics columns')
assert(cssSource.includes('sell-page__handwritten-note'), 'handwritten guide note styles present')
assert(!cssSource.includes('sell-page__guide-grid'), 'old guide grid styles removed')
assert(!/sell-page__guide-block\s*\{[^}]*max-width:\s*72rem/s.test(cssSource), 'guide blocks are not capped at 72rem')
assert(cssSource.includes('max-width: 100%') || cssSource.includes('max-width: none'), 'page root is not a constrained column')
assert(cssSource.includes('--sell-visual-max: 104rem'), 'wide visual rail max is 104rem')
assert(cssSource.includes('--sell-visual-gutter'), 'wide visual gutter defined')
assert(cssSource.includes('sell-page__visual-rail'), 'visual rail class present')
assert(cssSource.includes('calc(100% - (2 * var(--sell-visual-gutter)))'), 'visual rail uses viewport minus gutters')
assert(!cssSource.includes('--sell-rail-max: 90rem'), 'homepage 90rem rail not used for sell visuals')
assert(/\.sell-page\s*\{[^}]*background:\s*transparent/s.test(cssSource), 'sell page root is transparent like homepage')
assert(cssSource.includes('sell-page__btn--primary'), 'primary CTA styles present')
assert(cssSource.includes('translateY(-2px)'), 'primary CTA hover lift present')
assert(cssSource.includes('sell-page__mid-cta'), 'mid CTA band styles present')
assert(cssSource.includes('sell-page__optional-actions'), 'optional dual CTA stack styles present')
assert(!cssSource.includes('sell-page__closing'), 'closing CTA styles removed')
assert(!cssSource.includes('sell-page__btn--primary-finale'), 'finale CTA size removed')
assert(!pageSource.includes('Get an Instant Valuation'), 'old optional primary valuation CTA removed')
assert(cssSource.includes('sell-page__hero-artwork'), 'hero artwork styles present')
assert(cssSource.includes('sell-page__hero-artwork-image'), 'hero artwork image styles present')
assert(cssSource.includes('--sell-hand'), 'handwritten font token present')
assert(cssSource.includes('var(--sell-hand)'), 'handwritten font applied')
assert(cssSource.includes('--sell-hero-art-bg'), 'hero art background token present')
assert(cssSource.includes('object-fit: contain'), 'hero and journey images use object-fit contain')
assert(!cssSource.includes('sell-page__hero-collage'), 'obsolete collage styles removed')
assert(!cssSource.includes('sell-page__hero-panel--create'), 'obsolete collage panel styles removed')
assert(!cssSource.includes('background-image:') || !/sell-page__hero[^{]*\{[^}]*background-image:/s.test(cssSource), 'hero is not a full-bleed background image')
assert(!/margin:\s*0\s+calc\(-1 \* var\(--sell-gutter\)\)/.test(cssSource), 'no negative-gutter breakout hacks')
assert(cssSource.includes('padding: 4px') || cssSource.includes('padding: 8px') || cssSource.includes('padding: 10px') || cssSource.includes('padding: 3px'), 'tight journey frame padding')
assert(!/\.sell-page__step-image\s*\{[^}]*object-fit:\s*cover/s.test(cssSource), 'journey images never use object-fit cover')
assert(cssSource.includes('aspect-ratio: 16 / 9'), 'consistent journey frame aspect ratio')
assert(!cssSource.includes('DIAG:') && !cssSource.includes('TEMPORARY WIDTH DIAGNOSTIC'), 'diagnostic overlays removed')
assert(!pageSource.includes('data-sell-diag-vw') && !pageSource.includes('diagVw'), 'diagnostic badge removed from JSX')
assert(cssSource.includes('.sell-page__journey::before'), 'desktop timeline connector')
assert(cssSource.includes('prefers-reduced-motion'), 'reduced motion supported')
assert(cssSource.includes('scale(1.22)'), 'desktop journey hover enlargement ~1.22')
assert(cssSource.includes('(min-width: 1100px) and (hover: hover) and (pointer: fine)'), 'hover enlarge limited to desktop fine pointers')
assert(cssSource.includes('z-index: 20'), 'hovered journey card raises above neighbours')
assert(cssSource.includes('overflow: visible') || cssSource.includes('overflow-x: clip'), 'overflow handling present')
assert(!cssSource.includes('.sell-lightbox'), 'lightbox styles removed')
assert(!cssSource.includes('Expand preview'), 'expand styles removed')
{
  const mobileHeroBlock = cssSource.match(/@media \(max-width: 767px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert(
    /\.sell-page__hero-artwork \{[^}]*display: none/.test(mobileHeroBlock),
    'mobile hero artwork hidden',
  )
  assert(mobileHeroBlock.includes('radial-gradient'), 'mobile hero has controlled orange glow')
  assert(!cssSource.includes('100vw'), 'no full-bleed 100vw breakout')
}
assert(
  /\.sell-page__hero-eyebrow \{[^}]*display: inline-block/.test(cssSource),
  'handwritten eyebrow styled for all hero widths',
)
assert(pageJsx.includes('sell-page__hero-eyebrow'), 'hero eyebrow present in markup')
assert(pageJsx.includes('Sell it simply'), 'hero eyebrow copy')
assert(/sell-page__hero-eyebrow" aria-hidden="true"/.test(pageJsx), 'eyebrow is decorative only')
assert((pageJsx.match(/<h1/g) || []).length === 1, 'hero keeps a single H1')
assert(/<h1 id="sell-page-title" className="sell-page__h1">\s*with Equipd\s*<\/h1>/.test(pageJsx), 'visible H1 reads "with Equipd"')
assert(pageSource.includes('sell-page__step-number'), 'journey marker structure')
assert(pageSource.includes('sell-page__benefit-mark'), 'benefit handwritten markers present')
assert(pageSource.includes('Want to know what it'), 'optional valuation heading')
assert(!pageSource.includes('Not sure what it'), 'old optional heading removed')
assert(!pageSource.includes('sell-page__container--hero'), 'hero no longer uses centred container wrapper')
assert(pageSource.includes('sell-page__visual-rail'), 'wide visual rail used in markup')
assert(pageSource.includes('sell-page__reading-rail'), 'narrow reading rail used in markup')
assert(pageSource.includes('sell-page__faq-layout'), 'faq uses guide-matched split layout')
assert(pageSource.includes('sell-page__faq-intro'), 'faq intro column present')
assert(pageSource.includes('sell-page__handwritten-note'), 'faq uses handwritten accent')
assert(pageSource.includes('SELL_FAQ_NOTE'), 'faq note copy present')
assert(pageSource.includes('SELL_FAQ_INTRO'), 'faq intro copy present')
assert(!pageSource.includes('sell-page__reading-rail--faq'), 'faq no longer uses narrow reading rail')
assert(!pageSource.includes('sell-page__faq-section'), 'old faq-section class removed')
assert(pageSource.includes('sell-page__reading-rail--optional'), 'optional uses reading rail')
assert(!pageSource.includes('sell-page__container--rail'), 'old homepage-style rail containers removed')
assert(cssSource.includes('minmax(0, 1fr)'), 'grid children can shrink without overflow')
assert(/\.sell-page__benefits-section\s*\{[^}]*background:/s.test(cssSource), 'benefits full-width section background')
assert(/\.sell-page\s*\{[^}]*padding:\s*0;/s.test(cssSource), 'page root has no horizontal column padding')
assert(/\.sell-page__journey-section\s*\{[^}]*background:\s*#fff/s.test(cssSource), 'journey uses solid full-bleed white')

const appShellCss = readFileSync(join(process.cwd(), 'src', 'components', 'layout', 'AppShell.css'), 'utf8')
assert(appShellCss.includes('app-shell__main--sell'), 'sell shell main variant exists')
assert(appShellCss.includes('app-shell__main--home'), 'home shell main variant exists')
const appShellJsx = readFileSync(join(process.cwd(), 'src', 'components', 'layout', 'AppShell.jsx'), 'utf8')
assert(
  appShellJsx.includes('usesBrowseShellFooter || isSellGymEquipmentRoutePage'),
  'sell route reuses homepage full-bleed main shell',
)
assert(!existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'hero-equipment.webp')), 'obsolete treadmill hero webp removed')
assert(!existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'hero-equipment.png')), 'obsolete treadmill hero png removed')
assert(existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'sell-gym-equipment-marketplace.webp')), 'SEO hero webp present')
assert(existsSync(join(process.cwd(), 'public', 'sell-gym-equipment', 'sell-gym-equipment-marketplace.png')), 'SEO hero png present')
assert(existsSync(join(process.cwd(), 'scripts', 'generate-sell-equipment-header-transparent.mjs')), 'transparent header generator present')
assert(existsSync(join(process.cwd(), 'public', 'images', 'sell', 'step-1.webp')), 'journey step-1 webp present')
assert(
  existsSync(join(process.cwd(), 'public', 'images', 'sell', 'step-1.png')),
  'journey step-1 png present',
)

const template = `<!doctype html>
<html lang="en">
  <head><title>Equipd</title></head>
  <body><div id="root"></div></body>
</html>`

const html = injectSeoIntoHtml(template, doc)
assert(
  html.includes(`<title>Sell Gym Equipment | UK&#39;s Fitness Equipment Marketplace | Equipd</title>`) ||
    html.includes(`<title>${SELL_GYM_EQUIPMENT_PAGE_TITLE}</title>`),
  'prerender title tag',
)
assert(html.includes('name="description"'), 'prerender meta description')
assert(html.includes('rel="canonical"'), 'prerender canonical')
assert(html.includes('og:title'), 'prerender open graph title')
assert(html.includes('twitter:card'), 'prerender twitter card')
assert(
  (html.match(/property="og:title"/g) || []).length === 1,
  'single og:title after stripping homepage defaults',
)
assert(
  !html.includes('Buy, Sell &amp; Value Used Gym Equipment | Equipd Marketplace'),
  'homepage social title not left in sell prerender',
)
assert(html.includes('"@type":"WebPage"') || html.includes('"@type": "WebPage"'), 'WebPage JSON-LD in prerender')
assert(html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'), 'FAQPage JSON-LD in prerender')
assert(html.includes('"@type":"BreadcrumbList"') || html.includes('"@type": "BreadcrumbList"'), 'Breadcrumb JSON-LD in prerender')
assert(!html.includes('"@type":"Product"'), 'no Product JSON-LD in prerender')

console.log('sell gym equipment page tests passed')
