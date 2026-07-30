/**
 * Phase 2 production readiness validation (read-only).
 * Run after `npm run build`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { EQUIPMENT_LANDING_PATHS, EQUIPMENT_LANDING_DEFS_VALIDATED } from '../src/lib/equipmentLandingDefs.js'
import { EQUIPMENT_LANDING_CONTENT_LIST, buildAllEquipmentLandingSeoDocuments } from '../src/lib/equipmentLandingPages.js'
import { BUY_USED_GYM_EQUIPMENT_H1 } from '../src/lib/buyUsedGymEquipmentPage.js'
import { COMMERCIAL_CATEGORIES } from '../src/lib/commercialGymEquipmentPage.js'
import { HOME_CATEGORIES } from '../src/lib/homeGymEquipmentPage.js'
import { LANDING_PATHS } from '../src/lib/landingPagePaths.js'

const ORIGIN = 'https://www.equipd.co.uk'

const HUB_PATHS = [
  '/buy-used-gym-equipment',
  '/sell-gym-equipment',
  '/valuation',
  LANDING_PATHS.commercialGym,
  LANDING_PATHS.homeGym,
  LANDING_PATHS.commercialCardio,
  LANDING_PATHS.commercialStrength,
  LANDING_PATHS.homeCardio,
  LANDING_PATHS.homeStrength,
  LANDING_PATHS.refurbishedCommercial,
  LANDING_PATHS.refurbishedHome,
]

const PHASE1_PATHS = [...HUB_PATHS.filter((p) => p !== '/sell-gym-equipment' && p !== '/valuation'), ...EQUIPMENT_LANDING_PATHS]

const issues = []
const notes = []

if (BUY_USED_GYM_EQUIPMENT_H1 !== 'Buy Used Gym Equipment') {
  issues.push(`Buy H1 is "${BUY_USED_GYM_EQUIPMENT_H1}"`)
}

for (const cat of COMMERCIAL_CATEGORIES) {
  if (String(cat.to).includes('/browse')) issues.push(`Commercial category still browse: ${cat.label}`)
}
for (const cat of HOME_CATEGORIES) {
  if (String(cat.to).includes('/browse')) issues.push(`Home category still browse: ${cat.label}`)
}

const docs = buildAllEquipmentLandingSeoDocuments()
const titles = new Set()
const canons = new Set()
for (const doc of docs) {
  if (!doc.title || !doc.description || !doc.canonicalPath) issues.push(`Missing meta for ${doc.path}`)
  if (titles.has(doc.title)) issues.push(`Duplicate title: ${doc.title}`)
  titles.add(doc.title)
  if (canons.has(doc.canonicalPath)) issues.push(`Duplicate canonical: ${doc.canonicalPath}`)
  canons.add(doc.canonicalPath)
}

const sitemapXml = readFileSync('public/sitemap.xml', 'utf8')
const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const locSet = new Set(locs)
const sitemapDups = locs.filter((l, i) => locs.indexOf(l) !== i)
const missingSitemap = PHASE1_PATHS.filter((p) => !locSet.has(`${ORIGIN}${p}`))
const badProtocol = locs.filter((l) => !l.startsWith('https://'))
const localhost = locs.filter((l) => /localhost|127\.0\.0\.1|vercel\.app|staging/i.test(l))

if (sitemapDups.length) issues.push(`Sitemap duplicate locs: ${sitemapDups.length}`)
if (missingSitemap.length) issues.push(`Sitemap missing: ${missingSitemap.join(', ')}`)
if (badProtocol.length) issues.push(`Non-HTTPS sitemap URLs: ${badProtocol.length}`)
if (localhost.length) issues.push(`Staging/localhost sitemap URLs: ${localhost.length}`)

const robots = readFileSync('public/robots.txt', 'utf8')
const robotsMissing = EQUIPMENT_LANDING_PATHS.filter((p) => !robots.includes(`Allow: ${p}`))
if (robotsMissing.length) notes.push(`robots Allow missing (Allow:/ still covers): ${robotsMissing.length}`)

const prerenderFail = []
for (const p of [...new Set([...HUB_PATHS, ...EQUIPMENT_LANDING_PATHS])]) {
  const file = `dist${p}/index.html`
  if (!existsSync(file)) {
    prerenderFail.push({ path: p, failed: ['missing-file'] })
    continue
  }
  const html = readFileSync(file, 'utf8')
  const checks = {
    title: /<title>/i.test(html),
    meta: /name="description"/i.test(html),
    canonical: /rel="canonical"/i.test(html),
    h1: /<h1[\s>]/i.test(html),
    breadcrumb: /BreadcrumbList/i.test(html),
    faq: /FAQPage/i.test(html),
    pageSchema: /WebPage|CollectionPage/i.test(html),
  }
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
  if (failed.length) prerenderFail.push({ path: p, failed })
}
if (prerenderFail.length) issues.push(`Prerender failures: ${prerenderFail.length}`)

// Internal linking orphans among equipment pages
const equipmentPaths = new Set(EQUIPMENT_LANDING_PATHS)
const inbound = Object.fromEntries([...equipmentPaths].map((p) => [p, []]))
function add(from, to) {
  if (!equipmentPaths.has(to)) return
  if (!inbound[to].includes(from)) inbound[to].push(from)
}
for (const def of EQUIPMENT_LANDING_DEFS_VALIDATED) {
  add(def.parentPath, def.path)
  for (const n of def.neighborCategories || []) add(def.path, n.to)
}
for (const cat of COMMERCIAL_CATEGORIES) add(LANDING_PATHS.commercialGym, cat.to)
for (const cat of HOME_CATEGORIES) add(LANDING_PATHS.homeGym, cat.to)
const orphans = Object.entries(inbound).filter(([, from]) => from.length === 0).map(([p]) => p)
if (orphans.length) issues.push(`Orphan equipment pages: ${orphans.join(', ')}`)

const brands = locs.filter((l) => l.includes('/brands/') && !l.endsWith('/brands')).length
const brandsIndex = locs.includes(`${ORIGIN}/brands`) ? 1 : 0
const equipment = locs.filter((l) => l.includes('/equipment/')).length
const listings = locs.filter((l) => /\/listings\//.test(l) && !/\/listings\/(leeds|manchester|birmingham|london|sheffield|bristol|liverpool|newcastle|glasgow|cardiff)$/.test(l.replace(ORIGIN, ''))).length
const locationHubs = locs.filter((l) => /\/listings\/(leeds|manchester|birmingham|london|sheffield|bristol|liverpool|newcastle|glasgow|cardiff)$/.test(l)).length
const valuation = locs.includes(`${ORIGIN}/valuation`) ? 1 : 0
const landingCount = PHASE1_PATHS.filter((p) => locSet.has(`${ORIGIN}${p}`)).length
const searchIntent = EQUIPMENT_LANDING_PATHS.length

const report = {
  ok: issues.length === 0,
  issues,
  notes,
  buyH1: BUY_USED_GYM_EQUIPMENT_H1,
  contentPages: EQUIPMENT_LANDING_CONTENT_LIST.length,
  sitemap: {
    total: locs.length,
    unique: locSet.size,
    landingPages: landingCount,
    searchIntentPages: searchIntent,
    brandPages: brands,
    brandsIndex,
    marketplaceListingsApprox: listings,
    locationHubs,
    equipmentCatalogue: equipment,
    valuationPages: valuation,
    duplicates: [...new Set(sitemapDups)],
    missingPhase1: missingSitemap,
    badProtocol: badProtocol.length,
    localhostOrStaging: localhost,
  },
  prerender: {
    checked: HUB_PATHS.length + EQUIPMENT_LANDING_PATHS.length,
    failCount: prerenderFail.length,
    fails: prerenderFail.slice(0, 20),
  },
  linking: {
    orphans,
    sampleInbound: Object.fromEntries(Object.entries(inbound).slice(0, 5)),
  },
}

console.log(JSON.stringify(report, null, 2))
process.exit(issues.length ? 1 : 0)
