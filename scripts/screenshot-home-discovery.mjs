import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'debug-screenshots')
const url = process.argv[2] ?? 'http://localhost:5176/'

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })

async function captureDiscovery(viewport, filename) {
  const page = await browser.newPage({ viewport })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.home-discovery', { timeout: 15000 })
  const section = page.locator('.home-discovery')
  await section.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await section.screenshot({ path: path.join(outDir, filename) })
  await page.close()
}

await captureDiscovery({ width: 1280, height: 900 }, 'home-discovery-after-desktop.png')
await captureDiscovery({ width: 390, height: 844 }, 'home-discovery-after-mobile.png')

console.log('Saved screenshots to debug-screenshots/')
await browser.close()
