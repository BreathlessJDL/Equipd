/**
 * Diagnostic + verification screenshots for /sell-gym-equipment width architecture.
 * Captures at exactly 1440×900, deviceScaleFactor 1, no post-resize.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const outDir = join(process.cwd(), 'reports', 'sell-gym-equipment-page')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})

await page.goto('http://127.0.0.1:5175/sell-gym-equipment', { waitUntil: 'networkidle' })
const accept = page.getByRole('button', { name: /accept all/i })
if (await accept.count()) await accept.first().click({ timeout: 2000 }).catch(() => {})
await page.waitForSelector('.sell-page__journey')

const report = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return {
      selector: el.className ? `.${String(el.className).trim().split(/\s+/).join('.')}` : el.tagName,
      width: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(r.right),
      maxWidth: s.maxWidth,
      padding: s.padding,
      margin: s.margin,
      background: s.backgroundColor,
      backgroundImage: s.backgroundImage === 'none' ? 'none' : s.backgroundImage.slice(0, 100),
    }
  }

  const grid = document.querySelector('.sell-page__journey')
  const ancestors = []
  let el = grid
  while (el) {
    ancestors.push({
      ...box(el),
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 80),
    })
    el = el.parentElement
    if (el === document.documentElement) {
      ancestors.push({ ...box(el), tag: 'html', cls: '' })
      break
    }
  }

  const frames = [...document.querySelectorAll('.sell-page__step-frame')].map((frame) => box(frame))
  const steps = [...document.querySelectorAll('.sell-page__step')].map((step) => box(step))

  return {
    env: {
      playwrightViewport: { width: 1440, height: 900 },
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportScale: window.visualViewport?.scale ?? null,
    },
    vars: {
      wideGutter: getComputedStyle(document.querySelector('.sell-page')).getPropertyValue('--sell-wide-gutter').trim(),
    },
    hero: box(document.querySelector('.sell-page__hero')),
    journeySection: box(document.querySelector('.sell-page__journey-section')),
    wide: box(document.querySelector('.sell-page__journey-section .sell-page__container--wide')),
    grid: box(grid),
    steps,
    frames,
    ancestors,
  }
})

// Clean screenshot (no overlay)
const cleanPath = join(outDir, 'desktop-1440-verified.png')
const cleanBuf = await page.screenshot({ type: 'png', fullPage: false })
writeFileSync(cleanPath, cleanBuf)
const cleanMeta = await sharp(cleanBuf).metadata()

// Debug overlay
await page.evaluate(() => {
  const mk = (label, el, color) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    const box = document.createElement('div')
    box.setAttribute('data-sell-debug', '1')
    Object.assign(box.style, {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${Math.max(r.height, 24)}px`,
      border: `2px solid ${color}`,
      boxSizing: 'border-box',
      pointerEvents: 'none',
      zIndex: '99999',
      background: 'transparent',
    })
    const tag = document.createElement('div')
    Object.assign(tag.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      background: color,
      color: '#fff',
      font: '11px/1.2 monospace',
      padding: '2px 4px',
      whiteSpace: 'nowrap',
    })
    tag.textContent = `${label} ${Math.round(r.width)}px L${Math.round(r.left)} R${Math.round(r.right)}`
    box.appendChild(tag)
    document.body.appendChild(box)
  }

  const vp = document.createElement('div')
  vp.setAttribute('data-sell-debug', '1')
  Object.assign(vp.style, {
    position: 'fixed',
    inset: '0',
    border: '3px dashed #111',
    pointerEvents: 'none',
    zIndex: '99998',
    boxSizing: 'border-box',
  })
  const vpTag = document.createElement('div')
  Object.assign(vpTag.style, {
    position: 'absolute',
    right: '8px',
    top: '8px',
    background: '#111',
    color: '#fff',
    font: '12px monospace',
    padding: '4px 6px',
  })
  vpTag.textContent = `viewport ${window.innerWidth}×${window.innerHeight}`
  vp.appendChild(vpTag)
  document.body.appendChild(vp)

  mk('journey section', document.querySelector('.sell-page__journey-section'), '#e8622a')
  mk('wide rail', document.querySelector('.sell-page__journey-section .sell-page__container--wide'), '#2563eb')
  mk('grid', document.querySelector('.sell-page__journey'), '#16a34a')
})

const debugPath = join(outDir, 'desktop-1440-debug-overlay.png')
const debugBuf = await page.screenshot({ type: 'png', fullPage: false })
writeFileSync(debugPath, debugBuf)

// Remove overlay
await page.evaluate(() => {
  document.querySelectorAll('[data-sell-debug]').forEach((node) => node.remove())
})

// Pixel edge proof on clean screenshot
const { data, info } = await sharp(cleanBuf).raw().toBuffer({ resolveWithObject: true })
const sample = (x, y) => {
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}
const journeyY = Math.min(Math.max((report.journeySection?.top || 500) + 20, 0), info.height - 1)
report.screenshot = {
  cleanPath,
  debugPath,
  outputWidth: cleanMeta.width,
  outputHeight: cleanMeta.height,
  postCaptureResize: false,
  deviceScaleFactor: 1,
  journeyEdgePixels: {
    y: journeyY,
    left: sample(0, journeyY),
    nearLeft: sample(8, journeyY),
    mid: sample(720, journeyY),
    nearRight: sample(1431, journeyY),
    right: sample(1439, journeyY),
  },
}

const summaryPath = join(outDir, 'width-diagnosis-1440.json')
writeFileSync(summaryPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  env: report.env,
  screenshot: report.screenshot,
  heroWidth: report.hero?.width,
  journeySectionWidth: report.journeySection?.width,
  wideWidth: report.wide?.width,
  gridWidth: report.grid?.width,
  leftGutter: report.grid?.left,
  rightGutter: 1440 - (report.grid?.right || 0),
  stepWidths: report.steps?.map((s) => s.width),
  frameWidths: report.frames?.map((f) => f.width),
  ancestorWidths: report.ancestors?.map((a) => ({ cls: a.cls || a.tag, width: a.width })),
  summaryPath,
  cleanPath,
  debugPath,
}, null, 2))

await browser.close()
