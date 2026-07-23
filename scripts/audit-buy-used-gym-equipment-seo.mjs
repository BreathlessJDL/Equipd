/**
 * SEO + visual validation for /buy-used-gym-equipment.
 * Requires a running preview/dev server (PREVIEW_URL).
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:4179').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'buy-used-gym-equipment-seo')
mkdirSync(outDir, { recursive: true })
const pageUrl = `${base}/buy-used-gym-equipment`

async function captureScreens() {
  const browser = await chromium.launch()
  const results = []

  for (const vp of [
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 })
    const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
    if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
    await page.waitForSelector('#buy-page-title')

    const seo = await page.evaluate(() => {
      const title = document.title
      const description = document.querySelector('meta[name="description"]')?.content || ''
      const canonical = document.querySelector('link[rel="canonical"]')?.href || ''
      const robots = document.querySelector('meta[name="robots"]')?.content || ''
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content || ''
      const ogImage = document.querySelector('meta[property="og:image"]')?.content || ''
      const h1 = [...document.querySelectorAll('h1')].map((el) => el.textContent.trim())
      const h2 = [...document.querySelectorAll('h2')].map((el) => el.textContent.trim())
      const faqs = [...document.querySelectorAll('.buy-page__faq-item summary')].map((el) =>
        el.textContent.trim(),
      )
      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((node) => {
          try {
            return JSON.parse(node.textContent || '')
          } catch {
            return null
          }
        })
        .filter(Boolean)
      const faqSchema = jsonLd.find((entry) => entry['@type'] === 'FAQPage')
      const overflow =
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      return {
        title,
        description,
        canonical,
        robots,
        ogTitle,
        ogImage,
        h1,
        h2,
        faqCount: faqs.length,
        faqSchemaCount: faqSchema?.mainEntity?.length || 0,
        schemaTypes: [...new Set(jsonLd.map((entry) => entry['@type']).filter(Boolean))],
        overflow,
        hasArticle: Boolean(document.querySelector('article.buy-page')),
        hasHeroHeader: Boolean(document.querySelector('header.buy-page__hero')),
      }
    })

    await page.screenshot({ path: join(outDir, `${vp.name}-full.png`), fullPage: true })
    await page.locator('.buy-page__hero').screenshot({ path: join(outDir, `${vp.name}-hero.png`) })
    results.push({ viewport: vp.name, ...seo })
    await page.close()
  }

  await browser.close()
  return results
}

function runLighthouseSeo() {
  const reportPath = join(outDir, 'lighthouse-seo.json')
  const result = spawnSync(
    'npx',
    [
      '--yes',
      'lighthouse',
      pageUrl,
      '--only-categories=seo',
      '--preset=desktop',
      '--quiet',
      '--chrome-flags=--headless --no-sandbox',
      '--output=json',
      `--output-path=${reportPath}`,
    ],
    { encoding: 'utf8', shell: true },
  )

  if (result.status !== 0) {
    return {
      error: result.stderr || result.stdout || `lighthouse exited ${result.status}`,
    }
  }

  const lhr = JSON.parse(readFileSync(reportPath, 'utf8'))
  const score = Math.round((lhr.categories.seo?.score || 0) * 100)
  const auditIds = [
    'document-title',
    'meta-description',
    'http-status-code',
    'is-crawlable',
    'canonical',
    'crawlable-anchors',
    'image-alt',
    'link-text',
  ]
  const audits = {}
  for (const id of auditIds) {
    const audit = lhr.audits?.[id]
    if (!audit) continue
    audits[id] = {
      score: audit.score,
      title: audit.title,
      displayValue: audit.displayValue ?? null,
    }
  }
  return { score, audits }
}

const screens = await captureScreens()
const lighthouseSeo = runLighthouseSeo()
const summary = { pageUrl, screens, lighthouseSeo }
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))

for (const row of screens) {
  if (row.overflow) throw new Error(`${row.viewport}: overflow`)
  if (row.h1.length !== 1 || row.h1[0] !== 'With Equipd') throw new Error(`${row.viewport}: H1`)
  if (row.faqCount !== 11 || row.faqSchemaCount !== 11) throw new Error(`${row.viewport}: FAQ mismatch`)
  if (!row.canonical.includes('/buy-used-gym-equipment')) throw new Error(`${row.viewport}: canonical`)
  if (!row.title.includes('Buy Used Gym Equipment Across the UK')) throw new Error(`${row.viewport}: title`)
  if (!row.description.includes('Search thousands of listings')) throw new Error(`${row.viewport}: description`)
  if (!row.hasArticle || !row.hasHeroHeader) throw new Error(`${row.viewport}: semantic structure`)
}

if (lighthouseSeo?.score != null && lighthouseSeo.score < 90) {
  throw new Error(`Lighthouse SEO score too low: ${lighthouseSeo.score}`)
}

console.log('buy-used-gym-equipment SEO validation: ok')
