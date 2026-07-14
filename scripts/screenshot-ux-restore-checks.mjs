/**
 * Visual + metric checks for Buyer Protection, mobile valuator, listing gallery.
 * Usage: PREVIEW_URL=http://127.0.0.1:4173 node scripts/screenshot-ux-restore-checks.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'ux-restore')
mkdirSync(OUT, { recursive: true })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'

async function dismissCookieBanner(page) {
  const accept = page.locator('button:has-text("Accept all"), button:has-text("Accept necessary")').first()
  if (await accept.count()) {
    await accept.click().catch(() => {})
    await page.waitForTimeout(200)
  }
}

const desktopViewports = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
]

const mobileViewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
]

async function measureModal(page) {
  const dialog = page.locator('.buyer-protection-modal__dialog').first()
  if (!(await dialog.count())) return { status: 'no-dialog' }
  return dialog.evaluate((el) => {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const body = el.querySelector('.buyer-protection-modal__body')
    const footer = el.querySelector('.buyer-protection-modal__footer')
    const header = el.querySelector('.buyer-protection-modal__header')
    const close = el.querySelector('.auth-modal__close')
    const overlay = el.closest('.buyer-protection-modal')
    const overlayStyle = overlay ? getComputedStyle(overlay) : null
    return {
      status: 'opened',
      maxHeight: style.maxHeight,
      overflowX: el.scrollWidth > el.clientWidth + 1,
      fitsViewport: rect.top >= -2 && rect.bottom <= window.innerHeight + 2,
      bodyScrollable: body ? body.scrollHeight >= body.clientHeight : null,
      headerVisible: header ? header.getBoundingClientRect().top >= 0 : null,
      footerVisible: footer ? footer.getBoundingClientRect().bottom <= window.innerHeight + 2 : null,
      closeVisible: close ? close.getBoundingClientRect().top >= 0 : null,
      overlayPosition: overlayStyle?.position || null,
      overlayZIndex: overlayStyle?.zIndex || null,
      parentIsBody: overlay?.parentElement === document.body,
    }
  })
}

async function openBuyerProtection(page) {
  await page.goto(`${base}/browse`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForTimeout(900)
  const listingLink = page.locator('a[href^="/listings/"]:not([href="/listings/new"])').first()
  if (!(await listingLink.count())) return { status: 'no-listing' }
  await listingLink.click()
  await page.waitForTimeout(1200)
  const trigger = page.locator(
    'button[aria-label="Includes Buyer Protection"], .buyer-protection-price__link, .buyer-protection-price__shield-button',
  ).first()
  if (!(await trigger.count())) return { status: 'no-trigger' }
  await trigger.click()
  await page.waitForTimeout(350)
  return measureModal(page)
}

async function measureValuator(page) {
  const card = page.locator('.home-valuator__card').first()
  await card.waitFor({ timeout: 15000 })
  return card.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const form = el.querySelector('.home-valuator__form')
    const formStyle = form ? getComputedStyle(form) : null
    const input = el.querySelector('.home-valuator__input')
    const button = el.querySelector('.home-valuator__submit')
    const pageOverflow = document.documentElement.scrollWidth > window.innerWidth + 1
    return {
      cardLeft: rect.left,
      cardRight: rect.right,
      fitsViewport: rect.left >= 8 && rect.right <= window.innerWidth - 8,
      formColumns: formStyle?.gridTemplateColumns || null,
      inputHeight: input?.getBoundingClientRect().height || null,
      buttonHeight: button?.getBoundingClientRect().height || null,
      pageOverflow,
      submitText: button?.innerText?.trim() || null,
    }
  })
}

async function measureGallery(page) {
  await page.goto(`${base}/browse`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForTimeout(900)
  const listingLink = page.locator('a[href^="/listings/"]:not([href="/listings/new"])').first()
  if (!(await listingLink.count())) return { status: 'no-listing' }
  await listingLink.click()
  await page.waitForTimeout(1200)
  const image = page.locator('.listing-gallery__main-image').first()
  if (!(await image.count())) return { status: 'no-image' }
  return image.evaluate((el) => {
    const wrap = el.closest('.listing-gallery__main-wrap')
    const gallery = el.closest('.listing-gallery')
    const imgRect = el.getBoundingClientRect()
    const wrapRect = wrap.getBoundingClientRect()
    const style = getComputedStyle(el)
    const centerDelta = Math.abs((imgRect.left + imgRect.right) / 2 - (wrapRect.left + wrapRect.right) / 2)
    return {
      status: 'ok',
      objectFit: style.objectFit,
      centreDeltaPx: Number(centerDelta.toFixed(2)),
      centred: centerDelta <= 8,
      wrapWidth: wrapRect.width,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      galleryWidth: gallery?.getBoundingClientRect().width || null,
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = { base, buyerProtection: [], valuator: [], gallery: [] }

  try {
    for (const vp of [...desktopViewports, ...mobileViewports.slice(0, 1)]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
      const modal = await openBuyerProtection(page)
      await page.screenshot({ path: join(OUT, `buyer-protection-${vp.name}.png`) })
      report.buyerProtection.push({ viewport: vp.name, ...modal })
      await page.close()
    }

    // 125% zoom desktop
    {
      const page = await browser.newPage({
        viewport: { width: Math.round(1920 / 1.25), height: Math.round(1080 / 1.25) },
        deviceScaleFactor: 1.25,
      })
      const modal = await openBuyerProtection(page)
      await page.screenshot({ path: join(OUT, 'buyer-protection-1920x1080-zoom125.png') })
      report.buyerProtection.push({ viewport: '1920x1080-zoom125', ...modal })
      await page.close()
    }

    for (const vp of mobileViewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await dismissCookieBanner(page)
      await page.waitForTimeout(800)
      const home = await measureValuator(page)
      await page.locator('.home-valuator').screenshot({ path: join(OUT, `valuator-home-${vp.name}.png`) })
      await page.goto(`${base}/brands`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await dismissCookieBanner(page)
      await page.waitForTimeout(800)
      const brands = await measureValuator(page)
      await page.locator('.home-valuator').screenshot({ path: join(OUT, `valuator-brands-${vp.name}.png`) })
      report.valuator.push({ viewport: vp.name, home, brands })
      await page.close()
    }

    for (const width of [320, 360, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } })
      const gallery = await measureGallery(page)
      await page.locator('.listing-gallery').first().screenshot({
        path: join(OUT, `gallery-mobile-${width}.png`),
      }).catch(() => {})
      report.gallery.push({ viewport: `${width}x844`, ...gallery })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))

  const modalFail = report.buyerProtection.find((r) => (
    r.status !== 'opened'
    || r.overflowX
    || r.fitsViewport === false
    || r.closeVisible === false
    || r.parentIsBody === false
    || Number(r.overlayZIndex) < 1100
  ))
  const valuatorFail = report.valuator.find((r) => (
    r.home.pageOverflow || r.brands.pageOverflow
    || r.home.fitsViewport === false || r.brands.fitsViewport === false
    || (r.home.inputHeight != null && r.home.inputHeight < 40)
    || (r.home.buttonHeight != null && r.home.buttonHeight < 40)
  ))
  const galleryFail = report.gallery.find((r) => (
    r.status !== 'ok' || r.objectFit !== 'contain' || r.centred === false || r.pageOverflow
  ))

  if (modalFail || valuatorFail || galleryFail) {
    console.error('UX restore checks failed', { modalFail, valuatorFail, galleryFail })
    process.exit(1)
  }
  console.log('UX restore visual checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
