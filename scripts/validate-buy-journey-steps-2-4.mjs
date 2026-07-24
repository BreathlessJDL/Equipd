/**
 * Validate buy journey step image update across viewports and capture section screenshots.
 *   $env:PREVIEW_URL='http://127.0.0.1:4191'; node scripts/validate-buy-journey-steps-2-4.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:4191').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'buy-journey-steps-2-4-update')
mkdirSync(outDir, { recursive: true })

const expectedTitles = [
  'Find your equipment',
  'Agree a price',
  'Secure your purchase',
  'Collect with confidence',
]

const browser = await chromium.launch()
const results = []

for (const vp of [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  await page.goto(`${base}/buy-used-gym-equipment`, { waitUntil: 'networkidle', timeout: 90000 })
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
  await page.waitForSelector('.buy-page__journey-section', { timeout: 30000 })
  await page.waitForTimeout(500)

  const metrics = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    const steps = [...document.querySelectorAll('.buy-page__step')].map((li, idx) => {
      const img = li.querySelector('img.buy-page__step-image')
      const frame = li.querySelector('.buy-page__step-frame')
      const title = li.querySelector('.buy-page__step-title')?.textContent?.trim()
      const copy = li.querySelector('.buy-page__step-copy')?.textContent?.trim()
      const cs = img ? getComputedStyle(img) : null
      return {
        step: idx + 1,
        title,
        copyLen: copy?.length || 0,
        src: img?.currentSrc || img?.src || '',
        naturalWidth: img?.naturalWidth || 0,
        naturalHeight: img?.naturalHeight || 0,
        complete: Boolean(img?.complete && img?.naturalWidth > 0),
        objectFit: cs?.objectFit || '',
        objectPosition: cs?.objectPosition || '',
        widthAttr: img?.getAttribute('width'),
        heightAttr: img?.getAttribute('height'),
        frameW: frame ? Math.round(frame.getBoundingClientRect().width) : 0,
        frameH: Math.round(frame?.getBoundingClientRect().height || 0),
        imgW: img ? Math.round(img.getBoundingClientRect().width) : 0,
        imgH: img ? Math.round(img.getBoundingClientRect().height) : 0,
      }
    })
    return { overflow, steps }
  })

  let hoverOk = null
  if (vp.width >= 1100) {
    await page.locator('.buy-page__step').nth(1).hover()
    await page.waitForTimeout(300)
    hoverOk = await page.evaluate(() => {
      const img = document.querySelectorAll('.buy-page__step-image')[1]
      return {
        transform: getComputedStyle(img).transform,
        nw: img.naturalWidth,
        src: img.currentSrc,
      }
    })
  }

  await page.locator('.buy-page__journey-section').screenshot({
    path: join(outDir, `${vp.name}-journey.png`),
  })

  results.push({ viewport: vp.name, ...metrics, hoverOk })
  await page.close()
}

await browser.close()

const issues = []
for (const row of results) {
  if (row.overflow) issues.push(`${row.viewport}: overflow`)
  const [s1, s2, s3, s4] = row.steps
  if (!s1.src.includes('step-1')) issues.push(`${row.viewport}: step1 asset changed`)
  if (!s2.src.includes('buy-journey-step-2')) issues.push(`${row.viewport}: step2 missing new asset`)
  if (!s3.src.includes('buy-journey-step-3')) issues.push(`${row.viewport}: step3 missing new asset`)
  if (!s4.src.includes('buy-journey-step-4')) issues.push(`${row.viewport}: step4 missing new asset`)
  for (const s of row.steps) {
    if (!s.complete) issues.push(`${row.viewport}: step${s.step} not loaded`)
    if (s.objectFit !== 'contain') issues.push(`${row.viewport}: step${s.step} object-fit`)
    // Computed value is typically "50% 50%" for `center`.
    if (!(s.objectPosition === 'center' || s.objectPosition === '50% 50%')) {
      issues.push(`${row.viewport}: step${s.step} object-position=${s.objectPosition}`)
    }
    if (Number(s.widthAttr) !== 1536 || Number(s.heightAttr) !== 1024) {
      issues.push(`${row.viewport}: step${s.step} dims attrs`)
    }
  }
  const titles = row.steps.map((s) => s.title)
  if (JSON.stringify(titles) !== JSON.stringify(expectedTitles)) {
    issues.push(`${row.viewport}: titles changed`)
  }
  if (row.hoverOk && row.hoverOk.nw < 1536) {
    issues.push(`${row.viewport}: hover using low-res source (${row.hoverOk.nw})`)
  }
}

writeFileSync(join(outDir, 'results.json'), JSON.stringify({ results, issues }, null, 2))
console.log(
  JSON.stringify(
    {
      outDir,
      issues,
      summary: results.map((r) => ({
        viewport: r.viewport,
        overflow: r.overflow,
        sources: r.steps.map(
          (s) => `${s.src.split('/').pop()}@${s.naturalWidth}x${s.naturalHeight}`,
        ),
        hover: r.hoverOk,
      })),
    },
    null,
    2,
  ),
)
if (issues.length) process.exit(1)
console.log('validate-buy-journey-steps-2-4: ok')
