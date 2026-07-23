/**
 * Desktop + mobile screenshots and overflow checks for /buy-used-gym-equipment.
 *
 *   $env:PREVIEW_URL='http://127.0.0.1:4179'; node scripts/screenshot-buy-used-gym-equipment-page.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:4179').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'buy-used-gym-equipment-page')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) {
    await accept.click({ timeout: 2500 }).catch(() => {})
  }
}

const browser = await chromium.launch()
const results = []

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  const consoleErrors = []
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto(`${base}/buy-used-gym-equipment`, { waitUntil: 'networkidle', timeout: 60000 })
  await dismissCookies(page)
  await page.waitForSelector('#buy-page-title', { timeout: 30000 })
  await page.waitForTimeout(400)

  const metrics = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    const title = document.querySelector('#buy-page-title')?.textContent?.trim() || ''
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    const ctas = [...document.querySelectorAll('a.buy-page__btn')].map((el) => ({
      text: el.textContent.trim(),
      href: el.getAttribute('href'),
    }))
    const faqCount = document.querySelectorAll('.buy-page__faq-item').length
    const faqSchema = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => {
        try {
          return JSON.parse(node.textContent || '')
        } catch {
          return null
        }
      })
      .find((entry) => entry?.['@type'] === 'FAQPage')
    return {
      overflow,
      title,
      canonical,
      description,
      ctas,
      faqCount,
      faqSchemaCount: faqSchema?.mainEntity?.length || 0,
    }
  })

  await page.screenshot({ path: join(outDir, `${vp.name}-full.png`), fullPage: true })
  await page.locator('.buy-page__hero').screenshot({ path: join(outDir, `${vp.name}-hero.png`) })
  await page.locator('.buy-page__journey-section').screenshot({
    path: join(outDir, `${vp.name}-journey.png`),
  })

  results.push({
    viewport: vp.name,
    consoleErrors,
    ...metrics,
  })
  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ base, results }, null, 2))

for (const row of results) {
  if (row.overflow) throw new Error(`${row.viewport}: horizontal overflow`)
  if (row.title !== 'With Equipd') {
    throw new Error(`${row.viewport}: unexpected H1 ${row.title}`)
  }
  if (!row.canonical.includes('/buy-used-gym-equipment')) {
    throw new Error(`${row.viewport}: missing canonical`)
  }
  if (row.faqCount !== 11 || row.faqSchemaCount !== 11) {
    throw new Error(`${row.viewport}: FAQ count mismatch visible=${row.faqCount} schema=${row.faqSchemaCount}`)
  }
  const browse = row.ctas.filter((cta) => cta.href === '/browse')
  const valuation = row.ctas.filter((cta) => cta.href === '/valuation')
  if (browse.length < 2) throw new Error(`${row.viewport}: expected browse CTAs`)
  if (valuation.length < 2) throw new Error(`${row.viewport}: expected valuation CTAs`)
  if (row.consoleErrors.length) {
    console.warn(`${row.viewport}: console errors`, row.consoleErrors)
  }
}

console.log(JSON.stringify({ outDir, results }, null, 2))
