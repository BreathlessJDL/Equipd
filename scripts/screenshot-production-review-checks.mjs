/**
 * Visual smoke screenshots for production-review release checks.
 * Usage: PREVIEW_URL=http://127.0.0.1:4173 node scripts/screenshot-production-review-checks.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'production-review')
mkdirSync(OUT, { recursive: true })

const viewports = [
  { name: '1280x720', width: 1280, height: 720, scale: 1 },
  { name: '1366x768', width: 1366, height: 768, scale: 1 },
  { name: '1440x900', width: 1440, height: 900, scale: 1 },
  { name: '1920x1080-zoom125', width: 1920, height: 1080, scale: 1.25 },
]

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = []

  try {
    for (const vp of viewports) {
      const page = await browser.newPage({
        viewport: {
          width: Math.round(vp.width / vp.scale),
          height: Math.round(vp.height / vp.scale),
        },
        deviceScaleFactor: vp.scale,
      })

      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(800)
      const title = await page.title()
      const metaDescription = await page.locator('meta[name="description"]').getAttribute('content')
      await page.screenshot({ path: join(OUT, `home-${vp.name}.png`), fullPage: false })

      // Browse for a listing with Buyer Protection price link
      await page.goto(`${base}/browse`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(1200)
      const listingLink = page.locator('a[href^="/listing/"]').first()
      let modalOk = { status: 'no-listing' }
      if (await listingLink.count()) {
        await listingLink.click()
        await page.waitForTimeout(1200)
        const shield = page.locator('button[aria-label="Includes Buyer Protection"], .buyer-protection-price__link, .buyer-protection-price__shield-button').first()
        if (await shield.count()) {
          await shield.click()
          await page.waitForTimeout(400)
          const dialog = page.locator('.buyer-protection-modal__dialog').first()
          if (await dialog.count()) {
            const metrics = await dialog.evaluate((el) => {
              const style = getComputedStyle(el)
              const rect = el.getBoundingClientRect()
              const body = el.querySelector('.buyer-protection-modal__body')
              const footer = el.querySelector('.buyer-protection-modal__footer')
              const header = el.querySelector('.buyer-protection-modal__header')
              return {
                maxHeight: style.maxHeight,
                overflowX: el.scrollWidth > el.clientWidth + 1,
                top: rect.top,
                bottom: rect.bottom,
                viewportHeight: window.innerHeight,
                fitsViewport: rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
                bodyScrollable: body ? body.scrollHeight > body.clientHeight : null,
                headerVisible: header ? header.getBoundingClientRect().top >= 0 : null,
                footerVisible: footer ? footer.getBoundingClientRect().bottom <= window.innerHeight + 2 : null,
              }
            })
            modalOk = { status: 'opened', ...metrics }
            await page.screenshot({ path: join(OUT, `buyer-protection-${vp.name}.png`) })
            await page.keyboard.press('Escape')
          } else {
            modalOk = { status: 'trigger-clicked-no-dialog' }
          }
        } else {
          modalOk = { status: 'no-buyer-protection-trigger' }
        }
      }

      await page.goto(`${base}/brands/technogym`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(1000)
      const listingImages = await page.locator('.brand-page, main').locator('img').count()
      await page.screenshot({ path: join(OUT, `brand-tg-${vp.name}.png`), fullPage: false })

      await page.goto(`${base}/brands/precor`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(1000)
      const discoveryText = await page.locator('body').innerText()
      const hasDiscoverySeries = /Discovery Series/i.test(discoveryText)
      const hasDiscovery = /\bDiscovery\b/.test(discoveryText)
      await page.screenshot({ path: join(OUT, `brand-precor-${vp.name}.png`), fullPage: false })

      const valueLabel = await page.locator('text=Estimated used value by year').count()

      results.push({
        viewport: vp.name,
        title,
        metaDescription,
        modalOk,
        listingImages,
        hasDiscovery,
        hasDiscoverySeries,
        valueLabelCount: valueLabel,
      })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base, results }, null, 2))
  console.log(JSON.stringify({ base, out: OUT, results }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
