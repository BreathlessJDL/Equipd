import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:5174/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })

const report = await page.evaluate(() => {
  const pick = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      selector,
      display: cs.display,
      alignItems: cs.alignItems,
      alignSelf: cs.alignSelf,
      justifyContent: cs.justifyContent,
      height: cs.height,
      minHeight: cs.minHeight,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      lineHeight: cs.lineHeight,
      rect: { top: r.top, bottom: r.bottom, height: r.height },
    }
  }

  const bar = document.querySelector('.home-header__bar')
  const inner = document.querySelector('.home-header__inner')
  const rowKids = bar
    ? [...bar.children].map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          className: el.className,
          tag: el.tagName,
          display: cs.display,
          alignSelf: cs.alignSelf,
          height: cs.height,
          marginTop: cs.marginTop,
          rect: { top: r.top, bottom: r.bottom, height: r.height },
        }
      })
    : []

  const barR = bar?.getBoundingClientRect()
  const innerR = inner?.getBoundingClientRect()

  return {
    inner: pick('.home-header__inner'),
    bar: pick('.home-header__bar'),
    brand: pick('.home-header__brand'),
    search: pick('.home-header__search'),
    nav: pick('.home-header__nav'),
    logoImg: pick('.home-header .equipd-logo__image'),
    searchBtn: pick('.home-header__search-button'),
    topActions: pick('.home-header__top-actions'),
    rowKids,
    centers: barR
      ? {
          barMid: barR.top + barR.height / 2,
          innerMid: innerR ? innerR.top + innerR.height / 2 : null,
          kidMids: rowKids.map((k) => ({
            className: k.className,
            mid: k.rect.top + k.rect.height / 2,
            offsetFromBarMid: k.rect.top + k.rect.height / 2 - (barR.top + barR.height / 2),
          })),
        }
      : null,
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
