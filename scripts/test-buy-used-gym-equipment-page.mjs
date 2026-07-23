/**
 * Unit checks for /buy-used-gym-equipment landing page content and SEO.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { formatPageTitle } from '../src/lib/pageTitles.js'
import {
  BROWSE_PATH,
  BUY_BENEFITS,
  BUY_FAQ_ITEMS,
  BUY_GUIDE_LINKS,
  BUY_HERO_ARTWORK,
  BUY_HERO_TRUST_ITEMS,
  BUY_JOURNEY_STEPS,
  BUY_USED_GYM_EQUIPMENT_H1,
  BUY_USED_GYM_EQUIPMENT_LEAD,
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
  BUY_USED_GYM_EQUIPMENT_META_TITLE,
  BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
  BUY_USED_GYM_EQUIPMENT_PAGE_TITLE,
  BUY_USED_GYM_EQUIPMENT_PATH,
  BUY_VALUATION_STEPS,
  buildBuyUsedGymEquipmentBreadcrumbSchema,
  buildBuyUsedGymEquipmentFaqSchema,
  buildBuyUsedGymEquipmentSeoDocument,
  buildBuyUsedGymEquipmentWebPageSchema,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
} from '../src/lib/buyUsedGymEquipmentPage.js'
import { injectSeoIntoHtml } from '../src/lib/seoCataloguePrerender.js'
import { normalizeFaqItems } from '../src/lib/faqPageStructuredData.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const doc = buildBuyUsedGymEquipmentSeoDocument()

assert(doc.path === BUY_USED_GYM_EQUIPMENT_PATH, 'canonical path')
assert(doc.title === BUY_USED_GYM_EQUIPMENT_PAGE_TITLE, 'document title')
assert(doc.description === BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION, 'meta description')
assert(doc.canonicalPath === '/buy-used-gym-equipment', 'canonical path field')
assert(doc.openGraph?.['og:title'] === BUY_USED_GYM_EQUIPMENT_PAGE_TITLE, 'open graph title')
assert(
  doc.openGraph?.['og:image']?.endsWith('/buy-used-gym-equipment/buy-used-gym-equipment-og.png'),
  'dedicated open graph image',
)
assert(doc.openGraph?.['og:image:width'] === '1200', 'open graph image width')
assert(doc.openGraph?.['og:image:height'] === '630', 'open graph image height')
assert(doc.robots === 'index, follow, max-image-preview:large', 'robots directive')
assert(doc.bodyHtml.includes(`<h1>${BUY_USED_GYM_EQUIPMENT_H1}</h1>`), 'single H1 in prerender body')
assert((doc.bodyHtml.match(/<h1/g) || []).length === 1, 'only one H1 in prerender body')
assert(doc.bodyHtml.includes(BROWSE_PATH), 'browse link in prerender')
assert(doc.bodyHtml.includes(VALUATION_PATH), 'valuation link in prerender')
assert(doc.bodyHtml.includes(SELL_GYM_EQUIPMENT_PATH), 'sell cross-link in prerender')
assert(doc.bodyHtml.includes('Buyer Protection fee'), 'checkout journey mentions Buyer Protection fee')
assert(!doc.bodyHtml.includes('Seller Service Fee'), 'no seller fee on buyer page')
assert(
  /not an automatic return policy/i.test(doc.bodyHtml),
  'clarifies Buyer Protection is not automatic returns',
)
assert(!/verified sellers/i.test(doc.bodyHtml), 'no verified-sellers claim')

assert(
  formatPageTitle(BUY_USED_GYM_EQUIPMENT_META_TITLE) === doc.title,
  'React page title matches prerender title',
)

const journeyTitles = BUY_JOURNEY_STEPS.map((step) => step.title)
assert(journeyTitles[0] === 'Find your equipment', 'step 1 title')
assert(journeyTitles[1] === 'Agree a price', 'step 2 title')
assert(journeyTitles[2] === 'Secure your purchase', 'step 3 title')
assert(journeyTitles[3] === 'Collect with confidence', 'step 4 title')

for (const step of BUY_JOURNEY_STEPS) {
  assert(step.imageSrc.startsWith('/images/buy/step-'), `journey image path: ${step.title}`)
  assert(step.imageSrc.endsWith('.webp'), `journey image uses webp: ${step.title}`)
  assert(step.imageSrcMobile?.endsWith('-800.webp'), `mobile webp present: ${step.title}`)
  assert(step.imageWidth === 1536 && step.imageHeight === 1024, `consistent 3:2 size: ${step.title}`)
  assert(step.imageAlt, `journey alt text: ${step.title}`)
}

assert(BUY_VALUATION_STEPS.length === 4, 'valuation journey has four steps')
assert(BUY_BENEFITS.length === 3, 'three buyer benefits')
assert(BUY_FAQ_ITEMS.length === 11, 'eleven visible FAQs')
assert(
  BUY_FAQ_ITEMS.some((item) => item.question === 'How do I buy used commercial gym equipment safely?'),
  'commercial buying FAQ present',
)
assert(
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION.includes('Search thousands of listings'),
  'meta description includes buyer-intent search phrasing',
)
assert(
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION.length >= 140
    && BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION.length <= 170,
  'meta description length',
)
assert(doc.bodyHtml.includes('commercial gym equipment for sale'), 'commercial category link in prerender')
assert(doc.bodyHtml.includes('/browse?category=treadmill'), 'category internal link in prerender')
assert(doc.bodyHtml.includes('Buyer Protection after confirmed handover'), 'guide highlights in prerender')
assert(
  BUY_HERO_TRUST_ITEMS.join('|') ===
    'Buyer Protection|Secure payments|Sellers across the UK',
  'hero trust items',
)

assert(BUY_USED_GYM_EQUIPMENT_H1 === 'With Equipd', 'visible hero H1 matches sell lockup')
assert(BUY_USED_GYM_EQUIPMENT_LEAD.includes('Buy used gym equipment'), 'hero lead opens with primary intent')

const protectionFaq = BUY_FAQ_ITEMS.find((item) => item.question === 'How does Buyer Protection work?')
assert(/24-hour/i.test(protectionFaq?.answer || ''), '24-hour protection wording')
assert(/handover is confirmed/i.test(protectionFaq?.answer || ''), 'handover confirmation wording')

const sellerFaq = BUY_FAQ_ITEMS.find((item) => item.question === 'Is Equipd the seller of the equipment?')
assert(/marketplace/i.test(sellerFaq?.answer || ''), 'marketplace clarification')
assert(/independent sellers/i.test(sellerFaq?.answer || ''), 'independent sellers wording')

const pageJsx = readFileSync(join(process.cwd(), 'src', 'pages', 'BuyUsedGymEquipmentPage.jsx'), 'utf8')
assert(pageJsx.includes('<picture>'), 'journey images use picture element')
assert(pageJsx.includes('type="image/webp"'), 'webp source present')
assert(pageJsx.includes('media="(max-width: 767px)"'), 'mobile-only smaller journey sources')
assert(pageJsx.includes('media="(min-width: 768px)"'), 'desktop full-res journey sources')
assert(pageJsx.includes('srcSet={imageSrc}'), 'desktop webp uses full-res source only')
assert(!pageJsx.includes('800w, ${imageSrc} 1536w'), 'desktop no longer density-picks 800w')
assert(pageJsx.includes('loading="lazy"'), 'below-fold journey images lazy load')
assert(pageJsx.includes(`to={BROWSE_PATH}`), 'browse CTAs present')
assert(pageJsx.includes(`to={VALUATION_PATH}`), 'valuation CTAs present')
assert(pageJsx.includes('buy-page__seo'), 'combined SEO section present')
assert(pageJsx.includes('BUY_FAQ_ITEMS'), 'FAQ items rendered')
assert(pageJsx.includes('<article className="buy-page">'), 'semantic article wrapper')
assert(pageJsx.includes('<header className="buy-page__hero"'), 'semantic hero header')
assert(pageJsx.includes('BUY_GUIDE_HIGHLIGHTS'), 'guide trust highlights rendered')
assert(!/Product schema|@type:\s*['"]Product['"]/.test(pageJsx), 'no Product schema on page')
assert(!pageJsx.includes('Seller Service Fee'), 'no seller fee in page source')

const webPageSchema = buildBuyUsedGymEquipmentWebPageSchema()
assert(webPageSchema['@type'] === 'WebPage', 'WebPage schema type')
assert(webPageSchema.url.endsWith('/buy-used-gym-equipment'), 'WebPage url')
assert(webPageSchema.headline === BUY_USED_GYM_EQUIPMENT_H1, 'WebPage headline matches H1')
assert(webPageSchema.inLanguage === 'en-GB', 'WebPage language')
assert(webPageSchema.significantLink?.length >= 3, 'WebPage significantLink present')
assert(!doc.jsonLd.some((entry) => entry['@type'] === 'CollectionPage'), 'no CollectionPage schema')
assert(!doc.jsonLd.some((entry) => entry['@type'] === 'Product'), 'no Product schema')

const breadcrumbSchema = buildBuyUsedGymEquipmentBreadcrumbSchema()
assert(breadcrumbSchema['@type'] === 'BreadcrumbList', 'BreadcrumbList schema')
assert(breadcrumbSchema.itemListElement.length === 2, 'breadcrumb has Home + Buy')
assert(breadcrumbSchema.itemListElement[1].name === 'Buy Used Gym Equipment', 'breadcrumb leaf')

const faqSchema = buildBuyUsedGymEquipmentFaqSchema()
assert(faqSchema['@type'] === 'FAQPage', 'FAQPage schema')
assert(faqSchema.mainEntity.length === BUY_FAQ_ITEMS.length, 'FAQ schema count matches content')

const { items: normalizedFaqs } = normalizeFaqItems(BUY_FAQ_ITEMS)
assert(normalizedFaqs.length === BUY_FAQ_ITEMS.length, 'all FAQs eligible for schema')
for (const entry of normalizedFaqs) {
  const visible = BUY_FAQ_ITEMS.find((item) => item.question === entry.question)
  assert(visible?.answer === entry.answer, `FAQ schema matches visible copy: ${entry.question}`)
}

assert(!doc.jsonLd.some((entry) => entry['@type'] === 'Product'), 'no Product schema in jsonLd array')
assert(!doc.jsonLd.some((entry) => entry['@type'] === 'CollectionPage'), 'uses WebPage not CollectionPage')

const appSource = readFileSync(join(process.cwd(), 'src', 'App.jsx'), 'utf8')
assert(appSource.includes('path="buy-used-gym-equipment"'), 'route registered in App.jsx')
assert(appSource.includes('BuyUsedGymEquipmentPage'), 'page imported in App.jsx')

const sitemap = readFileSync(join(process.cwd(), 'scripts', 'generate-sitemap.mjs'), 'utf8')
assert(sitemap.includes('/buy-used-gym-equipment'), 'sitemap generator includes route')

const prerender = readFileSync(join(process.cwd(), 'scripts', 'prerender-seo-catalogue.mjs'), 'utf8')
assert(prerender.includes('buildBuyUsedGymEquipmentSeoDocument'), 'prerender includes buy page')

const navSource = readFileSync(join(process.cwd(), 'src', 'components', 'AppNav.jsx'), 'utf8')
assert(navSource.includes('/buy-used-gym-equipment'), 'nav includes Buy Equipment')
assert(navSource.includes('Buy Equipment'), 'nav label present')

const footerSource = readFileSync(join(process.cwd(), 'src', 'components', 'layout', 'SiteFooter.jsx'), 'utf8')
assert(footerSource.includes('/buy-used-gym-equipment'), 'footer includes buy landing')

assert(
  BUY_GUIDE_LINKS.some((item) => item.link.to === SELL_GYM_EQUIPMENT_PATH),
  'guide cross-links to sell page',
)

const sellContent = readFileSync(join(process.cwd(), 'src', 'lib', 'sellGymEquipmentPage.js'), 'utf8')
assert(sellContent.includes('/buy-used-gym-equipment'), 'sell page cross-links to buy page')

const journeyFiles = [
  'public/images/buy/step-1.webp',
  'public/images/buy/step-1.png',
  'public/images/buy/step-2.webp',
  'public/images/buy/step-2.png',
  'public/images/buy/step-3.webp',
  'public/images/buy/step-3.png',
  'public/images/buy/step-4.webp',
  'public/images/buy/step-4.png',
  'public/images/buy/step-1-800.webp',
  'public/images/buy/step-2-800.webp',
  'public/images/buy/step-3-800.webp',
  'public/images/buy/step-4-800.webp',
  'public/buy-used-gym-equipment/buy-used-gym-equipment-marketplace.webp',
  'public/buy-used-gym-equipment/buy-used-gym-equipment-marketplace.png',
  'public/buy-used-gym-equipment/buy-used-gym-equipment-og.png',
]
for (const relativePath of journeyFiles) {
  assert(existsSync(join(process.cwd(), relativePath)), `asset exists: ${relativePath}`)
}

assert(BUY_HERO_ARTWORK.src.includes('buy-used-gym-equipment-marketplace.webp'), 'hero artwork webp path')
assert(BUY_USED_GYM_EQUIPMENT_OG_IMAGE.width === 1200, 'og width')

const ogMeta = await sharp(join(process.cwd(), 'public', 'buy-used-gym-equipment', 'buy-used-gym-equipment-og.png')).metadata()
assert(ogMeta.width === 1200 && ogMeta.height === 630, 'og image dimensions')

const sampleHtml = `<!doctype html><html><head><title>Equipd</title></head><body><div id="root"></div></body></html>`
const injected = injectSeoIntoHtml(sampleHtml, doc)
assert(injected.includes('rel="canonical"'), 'canonical injected')
assert(injected.includes('https://www.equipd.co.uk/buy-used-gym-equipment'), 'canonical absolute url')
assert(injected.includes('FAQPage'), 'FAQ schema injected')
assert(injected.includes('Buy Used Gym Equipment Across the UK | Equipd'), 'title injected')

console.log('test-buy-used-gym-equipment-page: ok')
