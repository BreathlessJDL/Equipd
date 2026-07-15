import { extractPageContent, preparePageContentForAi, extractEvidenceWindowTexts } from '../supabase/functions/_shared/intelligencePageExtract.ts'

const url = 'https://www.technogym.com/en-GB/product/skillmill_DJK0.html'
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const markers = [
  '£', 'GBP', 'Price', 'List Price', 'RRP', 'MSRP', 'from £', 'starting from',
  'incl. VAT', 'excl. VAT', 'price from', 'incl VAT', 'excl VAT', 'full price', 'cash price',
]

const res = await fetch(url, {
  headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
  redirect: 'follow',
})
const html = await res.text()
const extracted = extractPageContent(html)
const prepared = preparePageContentForAi(extracted)
const windows = extractEvidenceWindowTexts([extracted.bodyText, extracted.jsonLdText].filter(Boolean).join(' '))

console.log('=== Supplementary: Technogym.com with browser User-Agent (diagnostic only) ===')
console.log('HTTP', res.status, 'bytes', html.length)
console.log('JSON-LD:', extracted.jsonLdText.slice(0, 400) || '—')
console.log('Body price context:', extracted.bodyText.match(/.{0,60}(?:from\s*£|£)[\d,]+.{0,60}/i)?.[0] || '—')

for (const label of markers) {
  const pattern = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  console.log(`  ${pattern.test(extracted.combinedText) ? '✓' : '✗'} ${label}`)
}

console.log('PRICE_EVIDENCE_MARKERS windows:', windows.price.length)
for (const [i, w] of windows.price.entries()) console.log(`  [${i}]`, w.slice(0, 250))
console.log('Prepared contains £ amounts?', [...prepared.matchAll(/£\s*[\d,]+/g)].map((m) => m[0]).join(' | ') || 'NO')
console.log('Prepared preview:\n', prepared.slice(0, 1500))

const scriptHints = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap((block, index) => {
    const content = block[1] ?? ''
    if (!/price|amount|gbp|£/i.test(content)) return []
    const pound = content.match(/(?:from\s*£|£)\s*[\d,]+/)
    if (pound) return [`script[${index}]: ${pound[0]}`]
    const priceJson = content.match(/"price"\s*:\s*[\d"]+/i)
    if (priceJson) return [`script[${index}]: ${priceJson[0]}`]
    return []
  })
  .slice(0, 10)
console.log('Script/JSON price hints:', scriptHints.length ? scriptHints.join('\n  ') : 'none')
