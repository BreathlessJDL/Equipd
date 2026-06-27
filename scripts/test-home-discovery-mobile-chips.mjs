import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5176/'

async function checkWidth(page, width) {
  await page.setViewportSize({ width, height: 844 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.home-discovery-card--locations .home-discovery-chip', {
    timeout: 15000,
  })

  const report = await page.evaluate(() => {
    function rectsOverlap(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    }

    const card = document.querySelector('.home-discovery-card--locations')
    const chips = [...document.querySelectorAll('.home-discovery-card--locations .home-discovery-chip')]
    const cardRect = card.getBoundingClientRect()
    const chipRects = chips.map((chip) => {
      const r = chip.getBoundingClientRect()
      return {
        label: chip.textContent.trim(),
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      }
    })

    const overflowsCard = chipRects.filter(
      (r) =>
        r.left < cardRect.left - 0.5 ||
        r.right > cardRect.right + 0.5 ||
        r.top < cardRect.top - 0.5 ||
        r.bottom > cardRect.bottom + 0.5
    )

    const overlaps = []
    for (let i = 0; i < chipRects.length; i += 1) {
      for (let j = i + 1; j < chipRects.length; j += 1) {
        if (rectsOverlap(chipRects[i], chipRects[j])) {
          overlaps.push([chipRects[i].label, chipRects[j].label])
        }
      }
    }

    const chipsStyle = getComputedStyle(
      document.querySelector('.home-discovery-card--locations .home-discovery-card__chips')
    )
    const sampleChipStyle = getComputedStyle(chips[0])

    return {
      chipCount: chips.length,
      rowCount: new Set(chipRects.map((r) => Math.round(r.top))).size,
      overflowsCard: overflowsCard.map((r) => r.label),
      overlaps,
      chipsDisplay: chipsStyle.display,
      chipsFlexWrap: chipsStyle.flexWrap,
      chipsJustify: chipsStyle.justifyContent,
      chipsGap: chipsStyle.gap,
      chipFontSize: sampleChipStyle.fontSize,
      chipPadding: `${sampleChipStyle.paddingTop} ${sampleChipStyle.paddingRight}`,
      brandsHidden:
        getComputedStyle(document.querySelector('.home-discovery-card--brands')).display === 'none',
    }
  })

  return { width, ...report }
}

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage()

const widths = [390, 430]
const results = []

for (const width of widths) {
  results.push(await checkWidth(page, width))
}

await browser.close()

let failed = false
for (const result of results) {
  const ok =
    result.chipCount === 10 &&
    result.overlaps.length === 0 &&
    result.overflowsCard.length === 0 &&
    result.brandsHidden
  if (!ok) failed = true
  console.log(JSON.stringify(result, null, 2))
}

if (failed) {
  console.error('\nMobile chip layout checks FAILED')
  process.exit(1)
}

console.log('\nMobile chip layout checks passed at 390px and 430px')
